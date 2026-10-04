use std::{env, error::Error, time::Duration};

use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor, message::Mailbox,
    transport::smtp::authentication::Credentials,
};
use sea_orm::{
    ActiveModelTrait, DatabaseBackend, DatabaseConnection, EntityTrait, FromQueryResult,
    IntoActiveModel, Set, Statement,
};

use crate::{
    entities::{articles, dynamics, email_deliveries, subscribers},
    subscriptions::{SubscriptionState, TokenPurpose},
};

const BATCH_SIZE: u32 = 10;
const MAX_ATTEMPTS: i16 = 10;

type WorkerError = Box<dyn Error + Send + Sync>;

pub struct MailWorker {
    database: DatabaseConnection,
    signer: SubscriptionState,
    public_origin: String,
    from: Mailbox,
    transport: AsyncSmtpTransport<Tokio1Executor>,
}

impl MailWorker {
    pub fn from_env(database: DatabaseConnection) -> Result<Self, WorkerError> {
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
        OR (
               status = 'sending'
               AND locked_at < now() - interval '15 minutes'
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
                tracing::warn!(delivery_id = %delivery.id, %error, "email delivery failed");
                self.mark_failed(&delivery, &error.to_string()).await?;
            }
        }
        Ok(count)
    }

    async fn send_delivery(&self, delivery: &email_deliveries::Model) -> Result<(), WorkerError> {
        let subscriber = subscribers::Entity::find_by_id(delivery.subscriber_id)
            .one(&self.database)
            .await?
            .ok_or("subscriber no longer exists")?;
        let (subject, body) = match delivery.kind.as_str() {
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
                    delivery
                        .article_id
                        .ok_or("article delivery has no target")?,
                )
                .one(&self.database)
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
                    delivery
                        .dynamic_id
                        .ok_or("dynamic delivery has no target")?,
                )
                .one(&self.database)
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
                self.mark_cancelled(delivery).await?;
                return Ok(());
            }
        };
        let message = Message::builder()
            .from(self.from.clone())
            .to(subscriber.email.parse::<Mailbox>()?)
            .subject(subject)
            .body(body)?;
        self.transport.send(message).await?;
        self.mark_sent(delivery).await?;
        if delivery.kind == "confirm_subscription" {
            let mut active = subscriber.into_active_model();
            active.confirmation_sent_at = Set(Some(chrono::Utc::now().fixed_offset()));
            active.update(&self.database).await?;
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

    async fn mark_sent(&self, delivery: &email_deliveries::Model) -> Result<(), sea_orm::DbErr> {
        let mut active = delivery.clone().into_active_model();
        active.status = Set("sent".to_owned());
        active.sent_at = Set(Some(chrono::Utc::now().fixed_offset()));
        active.locked_at = Set(None);
        active.last_error = Set(None);
        active.update(&self.database).await?;
        Ok(())
    }

    async fn mark_cancelled(
        &self,
        delivery: &email_deliveries::Model,
    ) -> Result<(), sea_orm::DbErr> {
        let mut active = delivery.clone().into_active_model();
        active.status = Set("cancelled".to_owned());
        active.locked_at = Set(None);
        active.update(&self.database).await?;
        Ok(())
    }

    async fn mark_failed(
        &self,
        delivery: &email_deliveries::Model,
        error: &str,
    ) -> Result<(), sea_orm::DbErr> {
        let delay = retry_delay(delivery.attempt_count);
        let next_attempt_at =
            chrono::Utc::now().fixed_offset() + chrono::Duration::seconds(delay as i64);
        let mut active = delivery.clone().into_active_model();
        active.status = Set("failed".to_owned());
        active.locked_at = Set(None);
        active.next_attempt_at = Set(next_attempt_at);
        active.last_error = Set(Some(excerpt(error, 2000)));
        active.update(&self.database).await?;
        Ok(())
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
    let mut output = value.chars().take(maximum).collect::<String>();
    if value.chars().count() > maximum {
        output.push('…');
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_delay_uses_bounded_exponential_backoff() {
        assert_eq!(retry_delay(1), 60);
        assert_eq!(retry_delay(2), 120);
        assert_eq!(retry_delay(10), 15_360);
        assert!(retry_delay(20) <= 6 * 60 * 60);
    }
}
