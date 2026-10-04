use std::{env, error::Error, time::Duration};

use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::Mailbox,
    transport::smtp::{Error as SmtpError, authentication::Credentials},
};
use sea_orm::{
    ActiveModelTrait, ConnectionTrait, DatabaseBackend, DatabaseConnection, EntityTrait,
    FromQueryResult, IntoActiveModel, QuerySelect, Set, Statement, TransactionTrait,
};

use crate::{
    entities::{
        admin_accounts, admin_notifications, articles, dynamics, email_deliveries, subscribers,
    },
    subscriptions::{SubscriptionState, TokenPurpose},
};

const BATCH_SIZE: u32 = 1;
const MAX_ATTEMPTS: i16 = 10;
const STALE_AFTER_MINUTES: i16 = 15;

type WorkerError = Box<dyn Error + Send + Sync>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SmtpFailureDisposition {
    Retry,
    Permanent,
    Uncertain,
}

pub struct MailWorker {
    database: DatabaseConnection,
    signer: SubscriptionState,
    public_origin: String,
    from: Mailbox,
    transport: AsyncSmtpTransport<Tokio1Executor>,
}

impl MailWorker {
    pub fn from_env(database: DatabaseConnection) -> Result<Self, WorkerError> {
        if env::var("YUKILOG_MAIL_ENABLED").as_deref() != Ok("true") {
            return Err(
                "mail delivery is disabled; set YUKILOG_MAIL_ENABLED=true explicitly".into(),
            );
        }
        let public_origin = required_env("YUKILOG_PUBLIC_ORIGIN")?;
        let signer = SubscriptionState::new(required_env("YUKILOG_SUBSCRIPTION_SECRET")?)?;
        let smtp_host = required_env("YUKILOG_SMTP_HOST")?;
        let smtp_user = required_env("YUKILOG_SMTP_USERNAME")?;
        let smtp_password = required_env("YUKILOG_SMTP_PASSWORD")?;
        let smtp_from = required_env("YUKILOG_SMTP_FROM")?.parse::<Mailbox>()?;
        let smtp_port = env::var("YUKILOG_SMTP_PORT")
            .unwrap_or_else(|_| "587".to_owned())
            .parse::<u16>()?;
        let transport = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&smtp_host)?
            .port(smtp_port)
            .credentials(Credentials::new(smtp_user, smtp_password))
            .build();
        Ok(Self {
            database,
            signer,
            public_origin: public_origin.trim_end_matches('/').to_owned(),
            from: smtp_from,
            transport,
        })
    }

    pub async fn run_batch(&self) -> Result<usize, WorkerError> {
        self.quarantine_stale_deliveries().await?;
        let deliveries = email_deliveries::Model::find_by_statement(Statement::from_string(
            DatabaseBackend::Postgres,
            format!(
                r#"
WITH selected AS (
    SELECT id
      FROM email_deliveries
     WHERE (
               status IN ('pending', 'failed')
               AND attempt_count < {MAX_ATTEMPTS}
               AND next_attempt_at <= now()
           )
     ORDER BY next_attempt_at, created_at
     FOR UPDATE SKIP LOCKED
     LIMIT {BATCH_SIZE}
)
UPDATE email_deliveries AS delivery
   SET status = 'sending',
       attempt_count = LEAST(delivery.attempt_count + 1, 20),
       locked_at = now(),
       last_error = NULL
  FROM selected
 WHERE delivery.id = selected.id
RETURNING delivery.*
"#
            ),
        ))
        .all(&self.database)
        .await?;
        let count = deliveries.len();
        for delivery in deliveries {
            if let Err(error) = self.send_delivery(&delivery).await {
                tracing::error!(
                    delivery_id = %delivery.id,
                    %error,
                    "email delivery state could not be finalized"
                );
            }
        }
        let admin_count = self.run_admin_notification().await?;
        Ok(count + admin_count)
    }

    async fn quarantine_stale_deliveries(&self) -> Result<(), sea_orm::DbErr> {
        self.database
            .execute(Statement::from_string(
                DatabaseBackend::Postgres,
                format!(
                    r#"
UPDATE email_deliveries
   SET status = 'uncertain',
       locked_at = NULL,
       last_error = '投递结果未知：worker 在 SMTP 完成前后中断；为避免重复邮件，必须人工核对后重试'
 WHERE status = 'sending'
   AND locked_at < now() - interval '{STALE_AFTER_MINUTES} minutes'
"#
                ),
            ))
            .await?;
        self.database
            .execute(Statement::from_string(
                DatabaseBackend::Postgres,
                format!(
                    r#"
UPDATE admin_notifications
   SET email_status = 'uncertain',
       email_locked_at = NULL,
       email_last_error = '投递结果未知：worker 在 SMTP 完成前后中断；为避免重复邮件，必须人工核对后处理'
 WHERE email_status = 'sending'
   AND email_locked_at < now() - interval '{STALE_AFTER_MINUTES} minutes'
"#
                ),
            ))
            .await?;
        Ok(())
    }

    async fn send_delivery(&self, delivery: &email_deliveries::Model) -> Result<(), WorkerError> {
        let transaction = self.database.begin().await?;
        let subscriber = subscribers::Entity::find_by_id(delivery.subscriber_id)
            .lock_shared()
            .one(&transaction)
            .await?
            .ok_or("subscriber no longer exists")?;
        let current = email_deliveries::Entity::find_by_id(delivery.id)
            .lock_exclusive()
            .one(&transaction)
            .await?;
        let Some(current) = current else {
            transaction.rollback().await?;
            return Ok(());
        };
        if current.status != "sending" {
            transaction.rollback().await?;
            return Ok(());
        }
        if !delivery_is_allowed(&current, &subscriber) {
            let mut active = current.into_active_model();
            active.status = Set("cancelled".to_owned());
            active.locked_at = Set(None);
            active.update(&transaction).await?;
            transaction.commit().await?;
            return Ok(());
        }

        let (subject, body) = match current.kind.as_str() {
            "confirm_subscription" if subscriber.status == "pending" => {
                let token = self.signer.token(
                    subscriber.id,
                    &subscriber.token_nonce,
                    TokenPurpose::Confirm,
                )?;
                (
                    "确认订阅 YukiLog".to_owned(),
                    format!(
                        "请打开以下链接确认订阅：\n\n{}/subscriptions/confirm/{}\n",
                        self.public_origin, token
                    ),
                )
            }
            "article_published" if subscriber.status == "active" => {
                let article = articles::Entity::find_by_id(
                    current.article_id.ok_or("article delivery has no target")?,
                )
                .one(&transaction)
                .await?
                .ok_or("article no longer exists")?;
                (
                    format!("YukiLog 新文章：{}", article.title),
                    self.notification_body(
                        subscriber.id,
                        &subscriber.token_nonce,
                        &format!("{}/articles/{}", self.public_origin, article.slug),
                        article.summary.as_deref().unwrap_or("打开链接阅读全文。"),
                    )?,
                )
            }
            "dynamic_published" if subscriber.status == "active" => {
                let dynamic = dynamics::Entity::find_by_id(
                    current.dynamic_id.ok_or("dynamic delivery has no target")?,
                )
                .one(&transaction)
                .await?
                .ok_or("dynamic no longer exists")?;
                let link = format!("{}/dynamics#dynamic-{}", self.public_origin, dynamic.id);
                (
                    "YukiLog 发布了新动态".to_owned(),
                    self.notification_body(
                        subscriber.id,
                        &subscriber.token_nonce,
                        &link,
                        &excerpt(&dynamic.content_markdown, 300),
                    )?,
                )
            }
            _ => {
                let mut active = current.into_active_model();
                active.status = Set("cancelled".to_owned());
                active.locked_at = Set(None);
                active.update(&transaction).await?;
                transaction.commit().await?;
                return Ok(());
            }
        };
        let message = Message::builder()
            .from(self.from.clone())
            .to(subscriber.email.parse::<Mailbox>()?)
            .subject(subject)
            .body(body)?;
        match self.transport.send(message).await {
            Ok(_) => {
                let is_confirmation = current.kind == "confirm_subscription";
                let mut active = current.into_active_model();
                active.status = Set("sent".to_owned());
                active.sent_at = Set(Some(chrono::Utc::now().fixed_offset()));
                active.locked_at = Set(None);
                active.last_error = Set(None);
                active.update(&transaction).await?;
                if is_confirmation {
                    let mut subscriber = subscriber.into_active_model();
                    subscriber.confirmation_sent_at = Set(Some(chrono::Utc::now().fixed_offset()));
                    subscriber.update(&transaction).await?;
                }
                transaction.commit().await?;
            }
            Err(error) => {
                let disposition = smtp_failure_disposition(&error);
                let detail = excerpt(&error.to_string(), 2000);
                let mut active = current.into_active_model();
                active.locked_at = Set(None);
                active.last_error = Set(Some(detail));
                match disposition {
                    SmtpFailureDisposition::Retry => {
                        active.status = Set("failed".to_owned());
                        active.next_attempt_at = Set(chrono::Utc::now().fixed_offset()
                            + chrono::Duration::seconds(retry_delay(delivery.attempt_count) as i64));
                    }
                    SmtpFailureDisposition::Permanent => {
                        active.status = Set("failed".to_owned());
                        active.attempt_count = Set(MAX_ATTEMPTS);
                    }
                    SmtpFailureDisposition::Uncertain => {
                        active.status = Set("uncertain".to_owned());
                    }
                }
                active.update(&transaction).await?;
                transaction.commit().await?;
                tracing::warn!(
                    delivery_id = %delivery.id,
                    ?disposition,
                    smtp_status = ?error.status(),
                    "SMTP delivery did not complete normally"
                );
            }
        }
        Ok(())
    }

    async fn run_admin_notification(&self) -> Result<usize, WorkerError> {
        let notifications = admin_notifications::Model::find_by_statement(Statement::from_string(
            DatabaseBackend::Postgres,
            format!(
                r#"
WITH selected AS (
    SELECT id
      FROM admin_notifications
     WHERE email_status IN ('pending', 'failed')
       AND email_attempt_count < {MAX_ATTEMPTS}
       AND email_due_at <= now()
     ORDER BY email_due_at, created_at
     FOR UPDATE SKIP LOCKED
     LIMIT {BATCH_SIZE}
)
UPDATE admin_notifications AS notification
   SET email_status = 'sending',
       email_attempt_count = LEAST(notification.email_attempt_count + 1, 20),
       email_locked_at = now(),
       email_last_error = NULL
  FROM selected
 WHERE notification.id = selected.id
RETURNING notification.*
"#
            ),
        ))
        .all(&self.database)
        .await?;
        let count = notifications.len();
        for notification in notifications {
            if let Err(error) = self.send_admin_notification(&notification).await {
                tracing::error!(
                    notification_id = %notification.id,
                    %error,
                    "admin notification email state could not be finalized"
                );
            }
        }
        Ok(count)
    }

    async fn send_admin_notification(
        &self,
        claimed: &admin_notifications::Model,
    ) -> Result<(), WorkerError> {
        let transaction = self.database.begin().await?;
        let account = admin_accounts::Entity::find_by_id(claimed.account_id)
            .lock_shared()
            .one(&transaction)
            .await?
            .ok_or("notification account no longer exists")?;
        let current = admin_notifications::Entity::find_by_id(claimed.id)
            .lock_exclusive()
            .one(&transaction)
            .await?;
        let Some(current) = current else {
            transaction.rollback().await?;
            return Ok(());
        };
        if current.email_status != "sending" {
            transaction.rollback().await?;
            return Ok(());
        }
        let kind_enabled = match current.kind.as_str() {
            "comment" => account.notify_on_comments,
            "friend_link_application" => account.notify_on_friend_links,
            "article_like" => account.notify_on_likes,
            _ => false,
        };
        let Some(recipient) = account
            .notification_email
            .as_deref()
            .filter(|_| account.is_active && account.email_notifications_enabled && kind_enabled)
        else {
            let mut active = current.into_active_model();
            active.email_status = Set("cancelled".to_owned());
            active.email_locked_at = Set(None);
            active.update(&transaction).await?;
            transaction.commit().await?;
            return Ok(());
        };
        let recipient = match recipient.parse::<Mailbox>() {
            Ok(recipient) => recipient,
            Err(error) => {
                let mut active = current.into_active_model();
                active.email_status = Set("failed".to_owned());
                active.email_attempt_count = Set(MAX_ATTEMPTS);
                active.email_locked_at = Set(None);
                active.email_last_error = Set(Some(excerpt(&error.to_string(), 2000)));
                active.update(&transaction).await?;
                transaction.commit().await?;
                return Ok(());
            }
        };
        let new_events = current.event_count - current.emailed_event_count;
        if new_events <= 0 {
            let mut active = current.into_active_model();
            active.email_status = Set("sent".to_owned());
            active.email_locked_at = Set(None);
            active.email_sent_at = Set(Some(chrono::Utc::now().fixed_offset()));
            active.update(&transaction).await?;
            transaction.commit().await?;
            return Ok(());
        }
        let body = format!(
            "{}\n\n本次新增事件：{}\n查看：{}{}\n",
            current.message, new_events, self.public_origin, current.target_url
        );
        let message = Message::builder()
            .from(self.from.clone())
            .to(recipient)
            .subject(format!("[YukiLog] {}", current.title))
            .body(body)?;
        match self.transport.send(message).await {
            Ok(_) => {
                let event_count = current.event_count;
                let mut active = current.into_active_model();
                active.email_status = Set("sent".to_owned());
                active.emailed_event_count = Set(event_count);
                active.email_sent_at = Set(Some(chrono::Utc::now().fixed_offset()));
                active.email_locked_at = Set(None);
                active.email_last_error = Set(None);
                active.update(&transaction).await?;
                transaction.commit().await?;
            }
            Err(error) => {
                let disposition = smtp_failure_disposition(&error);
                let mut active = current.into_active_model();
                active.email_locked_at = Set(None);
                active.email_last_error = Set(Some(excerpt(&error.to_string(), 2000)));
                match disposition {
                    SmtpFailureDisposition::Retry => {
                        active.email_status = Set("failed".to_owned());
                        active.email_due_at = Set(Some(
                            chrono::Utc::now().fixed_offset()
                                + chrono::Duration::seconds(
                                    retry_delay(claimed.email_attempt_count) as i64,
                                ),
                        ));
                    }
                    SmtpFailureDisposition::Permanent => {
                        active.email_status = Set("failed".to_owned());
                        active.email_attempt_count = Set(MAX_ATTEMPTS);
                    }
                    SmtpFailureDisposition::Uncertain => {
                        active.email_status = Set("uncertain".to_owned());
                    }
                }
                active.update(&transaction).await?;
                transaction.commit().await?;
                tracing::warn!(
                    notification_id = %claimed.id,
                    ?disposition,
                    smtp_status = ?error.status(),
                    "admin notification email did not complete normally"
                );
            }
        }
        Ok(())
    }

    fn notification_body(
        &self,
        subscriber_id: sea_orm::prelude::Uuid,
        nonce: &[u8],
        link: &str,
        summary: &str,
    ) -> Result<String, WorkerError> {
        let token = self
            .signer
            .token(subscriber_id, nonce, TokenPurpose::Unsubscribe)?;
        Ok(format!(
            "{summary}\n\n阅读：{link}\n\n不再接收邮件：{}/subscriptions/unsubscribe/{}",
            self.public_origin, token
        ))
    }
}

fn delivery_is_allowed(
    delivery: &email_deliveries::Model,
    subscriber: &subscribers::Model,
) -> bool {
    match delivery.kind.as_str() {
        "confirm_subscription" => subscriber.status == "pending",
        "article_published" => subscriber.status == "active" && subscriber.subscribe_articles,
        "dynamic_published" => subscriber.status == "active" && subscriber.subscribe_dynamics,
        _ => false,
    }
}

fn smtp_failure_disposition(error: &SmtpError) -> SmtpFailureDisposition {
    smtp_failure_policy(error.is_transient(), error.is_permanent())
}

fn smtp_failure_policy(is_transient: bool, is_permanent: bool) -> SmtpFailureDisposition {
    if is_transient {
        SmtpFailureDisposition::Retry
    } else if is_permanent {
        SmtpFailureDisposition::Permanent
    } else {
        SmtpFailureDisposition::Uncertain
    }
}

pub async fn run_forever(worker: MailWorker) -> Result<(), WorkerError> {
    loop {
        let count = worker.run_batch().await?;
        let delay = if count == 0 {
            Duration::from_secs(15)
        } else {
            Duration::from_secs(1)
        };
        tokio::select! {
            () = tokio::time::sleep(delay) => {}
            result = tokio::signal::ctrl_c() => {
                result?;
                return Ok(());
            }
        }
    }
}

fn required_env(name: &'static str) -> Result<String, WorkerError> {
    let value = env::var(name)?;
    if value.trim().is_empty() {
        return Err(format!("{name} is empty").into());
    }
    Ok(value)
}

fn retry_delay(attempt: i16) -> u64 {
    let exponent = u32::from(attempt.clamp(1, 9) as u16 - 1);
    60_u64.saturating_mul(2_u64.pow(exponent)).min(6 * 60 * 60)
}

fn excerpt(value: &str, maximum: usize) -> String {
    if value.chars().count() <= maximum {
        return value.to_owned();
    }
    let mut output = value
        .chars()
        .take(maximum.saturating_sub(1))
        .collect::<String>();
    output.push('…');
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::{
        io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
        net::TcpListener,
    };

    #[test]
    fn retries_only_explicit_transient_smtp_rejections() {
        assert_eq!(
            smtp_failure_policy(true, false),
            SmtpFailureDisposition::Retry
        );
        assert_eq!(
            smtp_failure_policy(false, true),
            SmtpFailureDisposition::Permanent
        );
        assert_eq!(
            smtp_failure_policy(false, false),
            SmtpFailureDisposition::Uncertain
        );
    }

    #[tokio::test]
    async fn fake_smtp_accepts_one_message() {
        let (port, server) = fake_smtp("250 2.0.0 queued\r\n").await;
        let transport = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous("127.0.0.1")
            .port(port)
            .build();
        transport.send(test_message()).await.unwrap();
        server.await.unwrap();
    }

    #[tokio::test]
    async fn fake_smtp_transient_rejection_is_retryable() {
        let (port, server) = fake_smtp("451 4.3.0 try later\r\n").await;
        let transport = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous("127.0.0.1")
            .port(port)
            .build();
        let error = transport.send(test_message()).await.unwrap_err();
        assert_eq!(
            smtp_failure_disposition(&error),
            SmtpFailureDisposition::Retry
        );
        server.await.unwrap();
    }

    fn test_message() -> Message {
        Message::builder()
            .from("YukiLog <sender@example.com>".parse().unwrap())
            .to("reader@example.com".parse().unwrap())
            .subject("test")
            .body("test body".to_owned())
            .unwrap()
    }

    async fn fake_smtp(final_response: &'static str) -> (u16, tokio::task::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let task = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = stream.into_split();
            let mut lines = BufReader::new(reader).lines();
            writer.write_all(b"220 localhost ESMTP\r\n").await.unwrap();
            while let Some(line) = lines.next_line().await.unwrap() {
                if line.starts_with("EHLO ") {
                    writer
                        .write_all(b"250-localhost\r\n250 PIPELINING\r\n")
                        .await
                        .unwrap();
                } else if line.starts_with("MAIL FROM:") || line.starts_with("RCPT TO:") {
                    writer.write_all(b"250 2.1.0 ok\r\n").await.unwrap();
                } else if line == "DATA" {
                    writer
                        .write_all(b"354 end with <CRLF>.<CRLF>\r\n")
                        .await
                        .unwrap();
                    while lines.next_line().await.unwrap().as_deref() != Some(".") {}
                    writer.write_all(final_response.as_bytes()).await.unwrap();
                    if final_response.starts_with('4') || final_response.starts_with('5') {
                        break;
                    }
                } else if line == "QUIT" {
                    writer.write_all(b"221 2.0.0 bye\r\n").await.unwrap();
                    break;
                }
            }
        });
        (port, task)
    }

    #[test]
    fn retry_delay_uses_bounded_exponential_backoff() {
        assert_eq!(retry_delay(1), 60);
        assert_eq!(retry_delay(2), 120);
        assert_eq!(retry_delay(10), 15_360);
        assert!(retry_delay(20) <= 6 * 60 * 60);
    }
}
