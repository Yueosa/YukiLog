use std::{env, error::Error, time::Duration};

use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, MultiPart, SinglePart},
    transport::smtp::{Error as SmtpError, authentication::Credentials},
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, DatabaseConnection,
    EntityTrait, FromQueryResult, IntoActiveModel, QueryFilter, QueryOrder, QuerySelect, Set,
    Statement, TransactionTrait,
};

use crate::{
    entities::{
        admin_accounts, admin_notifications, articles, comments, dynamic_media, dynamics,
        email_deliveries, media_assets, subscribers,
    },
    markup,
    ops::subscriptions::{SubscriptionState, TokenPurpose},
};

const BATCH_SIZE: u32 = 1;
const MAX_ATTEMPTS: i16 = 10;
const STALE_AFTER_MINUTES: i16 = 15;
const BRAND_COLOR: &str = "#3278d4";
const MAX_DYNAMIC_IMAGES: usize = 4;

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
        if !crate::ops::subscriptions::mail_enabled() {
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
        // comment_reply 走非订阅者路径（recipient_email + 评论内容），单独处理
        if delivery.kind == "comment_reply" {
            return self.send_comment_reply(delivery).await;
        }
        let transaction = self.database.begin().await?;
        // 订阅类投递必有 subscriber_id（库约束）；防御性兜底按取消处理
        let Some(subscriber_id) = delivery.subscriber_id else {
            let current = email_deliveries::Entity::find_by_id(delivery.id)
                .lock_exclusive()
                .one(&transaction)
                .await?;
            if let Some(current) = current {
                return finalize_delivery(transaction, current, "cancelled", None).await;
            }
            transaction.rollback().await?;
            return Ok(());
        };
        let subscriber = subscribers::Entity::find_by_id(subscriber_id)
            .lock_shared()
            .one(&transaction)
            .await?;
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
        let Some(subscriber) = subscriber else {
            return finalize_delivery(transaction, current, "cancelled", None).await;
        };
        if !delivery_is_allowed(&current, &subscriber) {
            return finalize_delivery(transaction, current, "cancelled", None).await;
        }

        let content = match current.kind.as_str() {
            "confirm_subscription" if subscriber.status == "pending" => {
                let token = self.signer.token(
                    subscriber.id,
                    &subscriber.token_nonce,
                    TokenPurpose::Confirm,
                )?;
                confirm_subscription_content(&self.public_origin, &token)
            }
            "article_published" if subscriber.status == "active" => {
                let Some(article_id) = current.article_id else {
                    return finalize_delivery(transaction, current, "cancelled", None).await;
                };
                let article = articles::Entity::find_by_id(article_id)
                    .one(&transaction)
                    .await?;
                let Some(article) = article else {
                    return finalize_delivery(transaction, current, "cancelled", None).await;
                };
                let cover_url = match article.cover_media_id {
                    Some(media_id) => media_assets::Entity::find_by_id(media_id)
                        .one(&transaction)
                        .await?
                        .filter(|media| media.media_type.starts_with("image/"))
                        .map(|media| {
                            format!(
                                "{}{}",
                                self.public_origin,
                                crate::ops::media::card_or_original(&media)
                            )
                        }),
                    None => None,
                };                article_published_content(
                    &self.unsubscribe_url(subscriber.id, &subscriber.token_nonce)?,
                    &article.title,
                    &format!("{}/articles/{}", self.public_origin, article.slug),
                    article.summary.as_deref().unwrap_or("打开链接阅读全文。"),
                    cover_url.as_deref(),
                )
            }
            "dynamic_published" if subscriber.status == "active" => {
                let Some(dynamic_id) = current.dynamic_id else {
                    return finalize_delivery(transaction, current, "cancelled", None).await;
                };
                let dynamic = dynamics::Entity::find_by_id(dynamic_id)
                    .one(&transaction)
                    .await?;
                let Some(dynamic) = dynamic else {
                    return finalize_delivery(transaction, current, "cancelled", None).await;
                };
                let attachments = dynamic_media::Entity::find()
                    .filter(dynamic_media::Column::DynamicId.eq(dynamic.id))
                    .order_by_asc(dynamic_media::Column::Position)
                    .all(&transaction)
                    .await?;
                let assets = if attachments.is_empty() {
                    Vec::new()
                } else {
                    media_assets::Entity::find()
                        .filter(
                            media_assets::Column::Id
                                .is_in(attachments.iter().map(|row| row.media_id)),
                        )
                        .all(&transaction)
                        .await?
                };
                let image_urls = attachments
                    .iter()
                    .filter_map(|row| assets.iter().find(|media| media.id == row.media_id))
                    .filter(|media| media.media_type.starts_with("image/"))
                    // 邮件里用 card 变体压体积，无变体回退原图
                    .map(|media| {
                        format!(
                            "{}{}",
                            self.public_origin,
                            crate::ops::media::card_or_original(media)
                        )
                    })
                    .collect::<Vec<_>>();
                let link = format!("{}/dynamics#dynamic-{}", self.public_origin, dynamic.id);
                dynamic_published_content(
                    &self.unsubscribe_url(subscriber.id, &subscriber.token_nonce)?,
                    &link,
                    &excerpt(&dynamic.content_markdown, 300),
                    &markup::render(&dynamic.content_markdown).html,
                    &image_urls,
                )
            }
            _ => {
                return finalize_delivery(transaction, current, "cancelled", None).await;
            }
        };
        let recipient = match subscriber.email.parse::<Mailbox>() {
            Ok(recipient) => recipient,
            Err(error) => {
                let mut active = current.into_active_model();
                active.status = Set("failed".to_owned());
                active.attempt_count = Set(MAX_ATTEMPTS);
                active.locked_at = Set(None);
                active.last_error = Set(Some(excerpt(&error.to_string(), 2000)));
                active.update(&transaction).await?;
                transaction.commit().await?;
                return Ok(());
            }
        };
        let message = multipart_message(self.from.clone(), recipient, &content)?;
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

    /// comment_reply：审核通过的回复 → 通知被回复者（非订阅者，单次事务性邮件，
    /// 无退订链接）。终态语义与订阅类投递一致（451 重试 / 550 永久失败 / 未知转人工）。
    async fn send_comment_reply(&self, delivery: &email_deliveries::Model) -> Result<(), WorkerError> {
        let transaction = self.database.begin().await?;
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
        let Some(content) = self.comment_reply_content(&transaction, &current).await? else {
            // 回复/被回复评论已不可见或目标内容已删除：不必再通知
            return finalize_delivery(transaction, current, "cancelled", None).await;
        };
        let recipient = match current
            .recipient_email
            .as_deref()
            .unwrap_or_default()
            .parse::<Mailbox>()
        {
            Ok(recipient) => recipient,
            Err(error) => {
                let mut active = current.into_active_model();
                active.status = Set("failed".to_owned());
                active.attempt_count = Set(MAX_ATTEMPTS);
                active.locked_at = Set(None);
                active.last_error = Set(Some(excerpt(&error.to_string(), 2000)));
                active.update(&transaction).await?;
                transaction.commit().await?;
                return Ok(());
            }
        };
        let message = multipart_message(self.from.clone(), recipient, &content)?;
        match self.transport.send(message).await {
            Ok(_) => {
                let mut active = current.into_active_model();
                active.status = Set("sent".to_owned());
                active.sent_at = Set(Some(chrono::Utc::now().fixed_offset()));
                active.locked_at = Set(None);
                active.last_error = Set(None);
                active.update(&transaction).await?;
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

    /// 组装 comment_reply 邮件内容；回复或被回复评论不可见、目标内容删除时返回 None。
    async fn comment_reply_content<C: sea_orm::ConnectionTrait>(
        &self,
        connection: &C,
        delivery: &email_deliveries::Model,
    ) -> Result<Option<MailContent>, WorkerError> {
        let Some(comment_id) = delivery.comment_id else {
            return Ok(None);
        };
        let reply = comments::Entity::find_by_id(comment_id).one(connection).await?;
        let Some(reply) = reply.filter(|comment| comment.status == "visible") else {
            return Ok(None);
        };
        let Some(parent_id) = reply.parent_id else {
            return Ok(None);
        };
        let parent = comments::Entity::find_by_id(parent_id).one(connection).await?;
        let Some(parent) = parent.filter(|comment| comment.status == "visible") else {
            return Ok(None);
        };
        let (title, link) = if let Some(article_id) = reply.article_id {
            let article = articles::Entity::find_by_id(article_id).one(connection).await?;
            let Some(article) = article else {
                return Ok(None);
            };
            (
                article.title,
                format!("{}/articles/{}#comments", self.public_origin, article.slug),
            )
        } else if let Some(dynamic_id) = reply.dynamic_id {
            let dynamic = dynamics::Entity::find_by_id(dynamic_id).one(connection).await?;
            let Some(dynamic) = dynamic else {
                return Ok(None);
            };
            (
                "一条动态".to_owned(),
                format!("{}/dynamics#dynamic-{}", self.public_origin, dynamic.id),
            )
        } else {
            return Ok(None);
        };
        Ok(Some(comment_reply_content(
            &parent.display_name,
            &parent.content,
            &reply.display_name,
            &reply.content,
            &title,
            &link,
        )))
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
        let content = admin_notification_content(
            &self.public_origin,
            &current.title,
            &current.message,
            new_events,
            &current.target_url,
        );
        let message = multipart_message(self.from.clone(), recipient, &content)?;
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

    fn unsubscribe_url(
        &self,
        subscriber_id: sea_orm::prelude::Uuid,
        nonce: &[u8],
    ) -> Result<String, WorkerError> {
        let token = self
            .signer
            .token(subscriber_id, nonce, TokenPurpose::Unsubscribe)?;
        Ok(format!(
            "{}/subscriptions/unsubscribe/{}",
            self.public_origin, token
        ))
    }
}

struct MailContent {
    subject: String,
    text: String,
    html: String,
}

fn multipart_message(
    from: Mailbox,
    to: Mailbox,
    content: &MailContent,
) -> Result<Message, lettre::error::Error> {
    Message::builder()
        .from(from)
        .to(to)
        .subject(content.subject.clone())
        .multipart(
            MultiPart::alternative()
                .singlepart(SinglePart::plain(content.text.clone()))
                .singlepart(SinglePart::html(content.html.clone())),
        )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn brand_html(kicker: &str, body_html: &str, footer_html: &str) -> String {
    format!(
        r#"<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f2f4f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f4f8;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
<tr><td style="background-color:{BRAND_COLOR};border-radius:12px 12px 0 0;padding:18px 28px;">
<span style="font-family:'Helvetica Neue',Helvetica,'PingFang SC','Microsoft YaHei',sans-serif;font-size:18px;font-weight:bold;color:#ffffff;">YukiLog</span>
<span style="font-family:'Helvetica Neue',Helvetica,'PingFang SC','Microsoft YaHei',sans-serif;font-size:13px;color:#dbe7f7;padding-left:10px;">{}</span>
</td></tr>
<tr><td style="background-color:#ffffff;border-radius:0 0 12px 12px;padding:28px;font-family:'Helvetica Neue',Helvetica,'PingFang SC','Microsoft YaHei',sans-serif;font-size:15px;line-height:1.7;color:#20232a;">
{}
</td></tr>
<tr><td style="padding:16px 28px;font-family:'Helvetica Neue',Helvetica,'PingFang SC','Microsoft YaHei',sans-serif;font-size:12px;line-height:1.6;color:#667085;">
{}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"#,
        escape_html(kicker),
        body_html,
        footer_html
    )
}

fn button_html(href: &str, label: &str) -> String {
    format!(
        r#"<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="background-color:{BRAND_COLOR};border-radius:8px;"><a href="{}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 26px;font-size:15px;color:#ffffff;text-decoration:none;">{}</a></td></tr></table>"#,
        escape_html(href),
        escape_html(label)
    )
}

fn paragraph_html(text: &str) -> String {
    format!(
        r#"<p style="margin:0 0 14px;">{}</p>"#,
        escape_html(text).replace('\n', "<br>")
    )
}

/// comment_reply 模板：被回复者收到的事务性单次通知（无退订链接，不是订阅）。
fn comment_reply_content(
    parent_author: &str,
    parent_text: &str,
    reply_author: &str,
    reply_text: &str,
    title: &str,
    link: &str,
) -> MailContent {
    let parent_excerpt = excerpt(parent_text, 200);
    let reply_excerpt = excerpt(reply_text, 300);
    let body = format!(
        "{}{}{}{}{}{}",
        format!(
            r#"<h1 style="margin:0 0 14px;font-size:20px;">{}，你的评论收到了回复</h1>"#,
            escape_html(parent_author)
        ),
        format!(
            r#"<p style="margin:0 0 4px;font-size:13px;color:#667085;">你在《{}》下的评论：</p>"#,
            escape_html(title)
        ),
        format!(
            r#"<blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #dfe3ea;color:#667085;">{}</blockquote>"#,
            escape_html(&parent_excerpt).replace('\n', "<br>")
        ),
        format!(
            r#"<p style="margin:0 0 4px;font-size:13px;color:#667085;">{} 的回复：</p>"#,
            escape_html(reply_author)
        ),
        paragraph_html(&reply_excerpt),
        button_html(link, "查看回复"),
    );
    MailContent {
        subject: "你在 YukiLog 的评论收到了回复".to_owned(),
        text: format!(
            "{parent_author}，{reply_author} 回复了你的评论：\n\n{reply_excerpt}\n\n查看：{link}\n"
        ),
        html: brand_html(
            "评论回复",
            &body,
            "你收到这封邮件是因为在 YukiLog 评论时留下了邮箱；这是单次通知，不是订阅，只有别人回复你时才会再收到。",
        ),
    }
}

fn confirm_subscription_content(origin: &str, token: &str) -> MailContent {
    let url = format!("{origin}/subscriptions/confirm/{token}");
    let body = format!(
        "{}{}{}{}",
        r#"<h1 style="margin:0 0 14px;font-size:20px;">欢迎订阅 YukiLog</h1>"#,
        paragraph_html("只差一步：点击下面的按钮确认订阅，之后有新文章或新动态时会邮件提醒你。"),
        button_html(&url, "确认订阅"),
        format!(
            r#"<p style="margin:0;font-size:13px;color:#667085;">按钮打不开？复制这个链接到浏览器：<br><a href="{0}" style="color:{BRAND_COLOR};word-break:break-all;">{0}</a></p>"#,
            escape_html(&url)
        ),
    );
    MailContent {
        subject: "确认订阅 YukiLog".to_owned(),
        text: format!("请打开以下链接确认订阅：\n\n{url}\n"),
        html: brand_html(
            "订阅确认",
            &body,
            "这是一封订阅确认邮件；如果你没有订阅过 YukiLog，忽略即可。",
        ),
    }
}

fn article_published_content(
    unsubscribe_url: &str,
    title: &str,
    article_url: &str,
    summary: &str,
    cover_url: Option<&str>,
) -> MailContent {
    let cover_html = cover_url
        .map(|url| {
            format!(
                r#"<img src="{}" alt="{}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border-radius:8px;margin:0 0 18px;">"#,
                escape_html(url),
                escape_html(title)
            )
        })
        .unwrap_or_default();
    let body = format!(
        "{}{}{}{}{}",
        cover_html,
        format!(
            r#"<h1 style="margin:0 0 14px;font-size:20px;"><a href="{}" style="color:#20232a;text-decoration:none;">{}</a></h1>"#,
            escape_html(article_url),
            escape_html(title)
        ),
        paragraph_html(summary),
        button_html(article_url, "阅读全文"),
        format!(
            r#"<p style="margin:0;font-size:13px;color:#667085;">链接：<a href="{0}" style="color:{BRAND_COLOR};word-break:break-all;">{0}</a></p>"#,
            escape_html(article_url)
        ),
    );
    let footer = format!(
        r#"你订阅了 YukiLog 的新文章提醒。<a href="{}" style="color:{BRAND_COLOR};">不再接收邮件</a>"#,
        escape_html(unsubscribe_url)
    );
    MailContent {
        subject: format!("YukiLog 新文章：{title}"),
        text: format!("{summary}\n\n阅读：{article_url}\n\n不再接收邮件：{unsubscribe_url}"),
        html: brand_html("新文章", &body, &footer),
    }
}

fn dynamic_published_content(
    unsubscribe_url: &str,
    link: &str,
    text_excerpt: &str,
    body_html: &str,
    image_urls: &[String],
) -> MailContent {
    let total_images = image_urls.len();
    let mut images_html = String::new();
    for url in image_urls.iter().take(MAX_DYNAMIC_IMAGES) {
        images_html.push_str(&format!(
            r#"<img src="{}" alt="动态附图" width="266" style="display:inline-block;width:266px;max-width:48%;height:auto;border-radius:8px;margin:0 6px 8px 0;vertical-align:top;">"#,
            escape_html(url)
        ));
    }
    if total_images > MAX_DYNAMIC_IMAGES {
        images_html.push_str(&format!(
            r#"<p style="margin:0 0 14px;font-size:13px;color:#667085;">共 {total_images} 张图，打开动态查看全部。</p>"#
        ));
    }
    let body = format!(
        r#"<div style="margin:0 0 14px;">{}</div>{}{}{}"#,
        body_html,
        images_html,
        button_html(link, "查看动态"),
        format!(
            r#"<p style="margin:0;font-size:13px;color:#667085;">链接：<a href="{0}" style="color:{BRAND_COLOR};word-break:break-all;">{0}</a></p>"#,
            escape_html(link)
        ),
    );
    let footer = format!(
        r#"你订阅了 YukiLog 的新动态提醒。<a href="{}" style="color:{BRAND_COLOR};">不再接收邮件</a>"#,
        escape_html(unsubscribe_url)
    );
    MailContent {
        subject: "YukiLog 发布了新动态".to_owned(),
        text: format!("{text_excerpt}\n\n阅读：{link}\n\n不再接收邮件：{unsubscribe_url}"),
        html: brand_html("新动态", &body, &footer),
    }
}

fn admin_notification_content(
    origin: &str,
    title: &str,
    message: &str,
    new_events: i32,
    target_url: &str,
) -> MailContent {
    let url = format!("{origin}{target_url}");
    let body = format!(
        "{}{}{}",
        paragraph_html(message),
        paragraph_html(&format!("本次新增事件：{new_events}")),
        button_html(&url, "前往处理"),
    );
    MailContent {
        subject: format!("[YukiLog] {title}"),
        text: format!("{message}\n\n本次新增事件：{new_events}\n查看：{url}\n"),
        html: brand_html("管理通知", &body, "这封邮件发往 YukiLog 管理员通知邮箱。"),
    }
}

async fn finalize_delivery(
    transaction: sea_orm::DatabaseTransaction,
    current: email_deliveries::Model,
    status: &'static str,
    last_error: Option<String>,
) -> Result<(), WorkerError> {
    let mut active = current.into_active_model();
    active.status = Set(status.to_owned());
    active.locked_at = Set(None);
    active.last_error = Set(last_error);
    active.update(&transaction).await?;
    transaction.commit().await?;
    Ok(())
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

/// 审核通过一条"回复别人的评论"时调用：被回复者留了邮箱且不是自答，
/// 就队列一封 comment_reply 通知。唯一索引保证反复审核只发一封。
pub(crate) async fn queue_comment_reply_notification(
    database: &sea_orm::DatabaseConnection,
    reply: &comments::Model,
) -> Result<(), crate::error::AppError> {
    let Some(parent_id) = reply.parent_id else {
        return Ok(());
    };
    let parent = comments::Entity::find_by_id(parent_id).one(database).await?;
    let Some(parent) = parent else {
        return Ok(());
    };
    let Some(email) = parent
        .email
        .as_deref()
        .map(str::trim)
        .filter(|email| !email.is_empty())
    else {
        return Ok(());
    };
    // 自己回复自己（同邮箱）不通知
    if reply
        .email
        .as_deref()
        .map(str::trim)
        .is_some_and(|own| own.eq_ignore_ascii_case(email))
    {
        return Ok(());
    }
    database
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
INSERT INTO email_deliveries (kind, article_id, dynamic_id, comment_id, recipient_email)
VALUES ('comment_reply', $1, $2, $3, $4)
ON CONFLICT (comment_id) WHERE kind = 'comment_reply' DO NOTHING
"#,
            [
                reply.article_id.into(),
                reply.dynamic_id.into(),
                reply.id.into(),
                email.into(),
            ],
        ))
        .await?;
    Ok(())
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
    use sea_orm::{Database, EntityTrait, prelude::Uuid};
    use sea_orm_migration::MigratorTrait;
    use tokio::{
        io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
        net::TcpListener,
    };

    #[derive(Clone, Copy)]
    enum FakeSmtpOutcome {
        Respond(&'static str),
        DisconnectAfterData,
    }

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
        let (port, server) = fake_smtp(FakeSmtpOutcome::Respond("250 2.0.0 queued\r\n")).await;
        let transport = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous("127.0.0.1")
            .port(port)
            .build();
        transport.send(test_message()).await.unwrap();
        server.await.unwrap();
    }

    #[tokio::test]
    async fn fake_smtp_transient_rejection_is_retryable() {
        let (port, server) = fake_smtp(FakeSmtpOutcome::Respond("451 4.3.0 try later\r\n")).await;
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

    #[tokio::test]
    async fn fake_smtp_permanent_rejection_is_not_retried() {
        let (port, server) = fake_smtp(FakeSmtpOutcome::Respond(
            "550 5.1.1 mailbox unavailable\r\n",
        ))
        .await;
        let transport = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous("127.0.0.1")
            .port(port)
            .build();
        let error = transport.send(test_message()).await.unwrap_err();
        assert_eq!(
            smtp_failure_disposition(&error),
            SmtpFailureDisposition::Permanent
        );
        server.await.unwrap();
    }

    #[tokio::test]
    async fn fake_smtp_disconnect_after_data_is_uncertain() {
        let (port, server) = fake_smtp(FakeSmtpOutcome::DisconnectAfterData).await;
        let transport = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous("127.0.0.1")
            .port(port)
            .build();
        let error = transport.send(test_message()).await.unwrap_err();
        assert_eq!(
            smtp_failure_disposition(&error),
            SmtpFailureDisposition::Uncertain
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

    #[test]
    fn confirm_content_keeps_plain_text_and_adds_button() {
        let content = confirm_subscription_content("https://blog.example.com", "token-123");
        assert_eq!(content.subject, "确认订阅 YukiLog");
        assert!(
            content
                .text
                .contains("https://blog.example.com/subscriptions/confirm/token-123")
        );
        assert!(content.html.contains("确认订阅</a>"));
        assert!(
            content
                .html
                .contains("https://blog.example.com/subscriptions/confirm/token-123")
        );
        assert!(!content.html.contains("<img"));
    }

    #[test]
    fn article_content_embeds_absolute_cover_and_unsubscribe_link() {
        let content = article_published_content(
            "https://blog.example.com/subscriptions/unsubscribe/tok",
            "标题 <b>",
            "https://blog.example.com/articles/hello",
            "摘要",
            Some("https://blog.example.com/media/ab/cover.png"),
        );
        assert_eq!(content.subject, "YukiLog 新文章：标题 <b>");
        assert!(content.text.contains("摘要\n\n阅读：https://blog.example.com/articles/hello"));
        assert!(content.text.contains("不再接收邮件：https://blog.example.com/subscriptions/unsubscribe/tok"));
        assert!(
            content
                .html
                .contains(r#"<img src="https://blog.example.com/media/ab/cover.png""#)
        );
        assert!(content.html.contains("标题 &lt;b&gt;"));
        assert!(content.html.contains("阅读全文</a>"));
        assert!(content.html.contains("不再接收邮件</a>"));

        let without_cover = article_published_content(
            "https://blog.example.com/u",
            "标题",
            "https://blog.example.com/articles/hello",
            "摘要",
            None,
        );
        assert!(!without_cover.html.contains("<img"));
    }

    #[test]
    fn dynamic_content_caps_images_and_notes_overflow() {
        let images = (0..6)
            .map(|index| format!("https://blog.example.com/media/ab/{index}.png"))
            .collect::<Vec<_>>();
        let content = dynamic_published_content(
            "https://blog.example.com/subscriptions/unsubscribe/tok",
            "https://blog.example.com/dynamics#dynamic-1",
            "正文节选",
            "<p>正文 <strong>HTML</strong></p>",
            &images,
        );
        assert_eq!(content.subject, "YukiLog 发布了新动态");
        assert!(content.text.contains("正文节选"));
        assert!(content.html.contains("<p>正文 <strong>HTML</strong></p>"));
        assert_eq!(content.html.matches("<img").count(), MAX_DYNAMIC_IMAGES);
        assert!(content.html.contains("共 6 张图"));

        let few = dynamic_published_content(
            "https://blog.example.com/u",
            "https://blog.example.com/dynamics#dynamic-1",
            "正文节选",
            "<p>正文</p>",
            &images[..2],
        );
        assert_eq!(few.html.matches("<img").count(), 2);
        assert!(!few.html.contains("共 "));
    }

    #[test]
    fn comment_reply_content_includes_context_and_escapes() {
        let content = comment_reply_content(
            "小明 <script>",
            "写得真好\n受教了",
            "恋",
            "谢谢喜欢！",
            "夜航西飞",
            "https://blog.example.com/articles/ye-hang#comments",
        );
        assert_eq!(content.subject, "你在 YukiLog 的评论收到了回复");
        assert!(content.text.contains("恋 回复了你的评论"));
        assert!(content.text.contains("https://blog.example.com/articles/ye-hang#comments"));
        assert!(content.html.contains("小明 &lt;script&gt;，你的评论收到了回复"));
        assert!(content.html.contains("写得真好<br>受教了"));
        assert!(content.html.contains("《夜航西飞》"));
        // 事务性单次通知：没有退订链接，但说明邮件来源
        assert!(!content.html.contains("不再接收邮件"));
        assert!(content.html.contains("不是订阅"));
    }

    #[test]
    fn admin_content_includes_event_count_and_target() {
        let content = admin_notification_content(
            "https://blog.example.com",
            "新评论",
            "有人评论了 <文章>",
            3,
            "/admin/comments",
        );
        assert_eq!(content.subject, "[YukiLog] 新评论");
        assert!(
            content
                .text
                .contains("本次新增事件：3\n查看：https://blog.example.com/admin/comments")
        );
        assert!(content.html.contains("有人评论了 &lt;文章&gt;"));
        assert!(content.html.contains("前往处理</a>"));
    }

    #[test]
    fn multipart_message_serializes_alternative_plain_and_html() {
        let content = confirm_subscription_content("https://blog.example.com", "token-123");
        let message = multipart_message(
            "YukiLog <sender@example.com>".parse().unwrap(),
            "reader@example.com".parse().unwrap(),
            &content,
        )
        .unwrap();
        let raw = String::from_utf8(message.formatted()).unwrap();
        assert!(raw.contains("multipart/alternative"), "missing alternative: {raw}");
        assert!(raw.contains("text/plain"), "missing plain part: {raw}");
        assert!(raw.contains("text/html"), "missing html part: {raw}");
        assert!(raw.contains("subscriptions/confirm/token-123"));
    }

    async fn fake_smtp(outcome: FakeSmtpOutcome) -> (u16, tokio::task::JoinHandle<()>) {
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
                    match outcome {
                        FakeSmtpOutcome::Respond(final_response) => {
                            writer.write_all(final_response.as_bytes()).await.unwrap();
                            if final_response.starts_with('4') || final_response.starts_with('5') {
                                break;
                            }
                        }
                        FakeSmtpOutcome::DisconnectAfterData => break,
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

    #[tokio::test]
    #[ignore = "requires an isolated PostgreSQL database in YUKILOG_TEST_DATABASE_URL"]
    async fn postgres_delivery_state_machine_fault_injection() {
        let database_url = std::env::var("YUKILOG_TEST_DATABASE_URL")
            .expect("YUKILOG_TEST_DATABASE_URL is required");
        assert!(
            database_url.contains("test"),
            "refusing to reset a database URL without 'test' in its name"
        );
        let database = Database::connect(&database_url).await.unwrap();
        yukilog_migration::Migrator::fresh(&database).await.unwrap();
        database
            .execute_unprepared(
                r#"
INSERT INTO categories (id, name, slug)
VALUES ('10000000-0000-0000-0000-000000000001', 'Test', 'test');
INSERT INTO subscribers (
    id, email, subscribe_articles, subscribe_dynamics, status,
    token_nonce, confirmed_at
) VALUES (
    '20000000-0000-0000-0000-000000000001',
    'reader@example.com', true, false, 'active',
    decode(repeat('01', 16), 'hex'), now()
);
"#,
            )
            .await
            .unwrap();

        insert_test_delivery(
            &database,
            "30000000-0000-0000-0000-000000000001",
            "40000000-0000-0000-0000-000000000001",
        )
        .await;
        let (port, server) = fake_smtp(FakeSmtpOutcome::Respond("250 2.0.0 queued\r\n")).await;
        test_worker(database.clone(), port)
            .run_batch()
            .await
            .unwrap();
        server.await.unwrap();
        assert_delivery_status(&database, "40000000-0000-0000-0000-000000000001", "sent").await;

        insert_test_delivery(
            &database,
            "30000000-0000-0000-0000-000000000002",
            "40000000-0000-0000-0000-000000000002",
        )
        .await;
        let (port, server) = fake_smtp(FakeSmtpOutcome::Respond("451 4.3.0 try later\r\n")).await;
        test_worker(database.clone(), port)
            .run_batch()
            .await
            .unwrap();
        server.await.unwrap();
        assert_delivery_status(&database, "40000000-0000-0000-0000-000000000002", "failed").await;

        insert_test_delivery(
            &database,
            "30000000-0000-0000-0000-000000000003",
            "40000000-0000-0000-0000-000000000003",
        )
        .await;
        let (port, server) = fake_smtp(FakeSmtpOutcome::DisconnectAfterData).await;
        test_worker(database.clone(), port)
            .run_batch()
            .await
            .unwrap();
        server.await.unwrap();
        assert_delivery_status(
            &database,
            "40000000-0000-0000-0000-000000000003",
            "uncertain",
        )
        .await;

        database
            .execute_unprepared(
                r#"
INSERT INTO articles (
    id, category_id, title, slug, body_markdown, status, published_at
) VALUES (
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'Stale', 'stale', 'body', 'published', now()
);
INSERT INTO email_deliveries (
    id, subscriber_id, kind, article_id, status, attempt_count, locked_at
) VALUES (
    '40000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    'article_published',
    '30000000-0000-0000-0000-000000000004',
    'sending', 1, now() - interval '20 minutes'
);
"#,
            )
            .await
            .unwrap();
        test_worker(database.clone(), 9).run_batch().await.unwrap();
        assert_delivery_status(
            &database,
            "40000000-0000-0000-0000-000000000004",
            "uncertain",
        )
        .await;
        database.close().await.unwrap();
    }

    fn test_worker(database: DatabaseConnection, port: u16) -> MailWorker {
        MailWorker {
            database,
            signer: SubscriptionState::new(
                "test subscription signing secret with more than 32 bytes".to_owned(),
            )
            .unwrap(),
            public_origin: "https://blog.example.com".to_owned(),
            from: "YukiLog <sender@example.com>".parse().unwrap(),
            transport: AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous("127.0.0.1")
                .port(port)
                .build(),
        }
    }

    async fn insert_test_delivery(
        database: &DatabaseConnection,
        article_id: &str,
        delivery_id: &str,
    ) {
        database
            .execute_unprepared(&format!(
                r#"
INSERT INTO articles (
    id, category_id, title, slug, body_markdown, status, published_at
) VALUES (
    '{article_id}',
    '10000000-0000-0000-0000-000000000001',
    'Article {article_id}', 'article-{article_id}',
    'body', 'published', now()
);
INSERT INTO email_deliveries (
    id, subscriber_id, kind, article_id
) VALUES (
    '{delivery_id}',
    '20000000-0000-0000-0000-000000000001',
    'article_published', '{article_id}'
);
"#
            ))
            .await
            .unwrap();
    }

    async fn assert_delivery_status(
        database: &DatabaseConnection,
        delivery_id: &str,
        expected: &str,
    ) {
        let delivery = email_deliveries::Entity::find_by_id(Uuid::parse_str(delivery_id).unwrap())
            .one(database)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(delivery.status, expected);
    }
}
