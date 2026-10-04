use std::{net::SocketAddr, sync::Arc, time::Duration};

use axum::{
    Form, Json,
    extract::{ConnectInfo, Path, State},
    http::HeaderMap,
    response::Html,
};
use axum_extra::extract::cookie::CookieJar;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::Utc;
use hmac::{Hmac, Mac};
use rand::{RngCore, rngs::OsRng};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, ConnectionTrait, DatabaseBackend,
    EntityTrait, IntoActiveModel, QueryFilter, QueryOrder, QuerySelect, Set, Statement,
    TransactionTrait, prelude::Uuid,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::{
    AppState, auth,
    content::client_ip,
    entities::{email_deliveries, subscribers},
    error::AppError,
};

type HmacSha256 = Hmac<Sha256>;

const TOKEN_PAYLOAD_BYTES: usize = 33;
const TOKEN_BYTES: usize = TOKEN_PAYLOAD_BYTES + 32;
const NONCE_BYTES: usize = 16;
const SUBSCRIBE_COOLDOWN: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub struct SubscriptionState {
    secret: Arc<[u8]>,
}

#[derive(Clone, Copy)]
pub(crate) enum TokenPurpose {
    Confirm = 1,
    Unsubscribe = 2,
}

#[derive(Debug, Deserialize)]
pub struct SubscribeRequest {
    email: String,
    subscribe_articles: bool,
    subscribe_dynamics: bool,
}

#[derive(Debug, Deserialize)]
pub struct TokenRequest {
    token: String,
}

#[derive(Debug, Deserialize)]
pub struct SubscribeForm {
    email: String,
    articles: Option<String>,
    dynamics: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SubscriptionResponse {
    status: &'static str,
}

#[derive(Debug, Serialize)]
pub struct AdminSubscriberResponse {
    id: Uuid,
    email: String,
    subscribe_articles: bool,
    subscribe_dynamics: bool,
    status: String,
    confirmation_sent_at: Option<chrono::DateTime<chrono::FixedOffset>>,
    confirmed_at: Option<chrono::DateTime<chrono::FixedOffset>>,
    unsubscribed_at: Option<chrono::DateTime<chrono::FixedOffset>>,
    created_at: chrono::DateTime<chrono::FixedOffset>,
}

#[derive(Debug, Serialize)]
pub struct AdminDeliveryResponse {
    id: Uuid,
    subscriber_id: Uuid,
    kind: String,
    article_id: Option<Uuid>,
    dynamic_id: Option<Uuid>,
    status: String,
    attempt_count: i16,
    next_attempt_at: chrono::DateTime<chrono::FixedOffset>,
    last_error: Option<String>,
    created_at: chrono::DateTime<chrono::FixedOffset>,
    sent_at: Option<chrono::DateTime<chrono::FixedOffset>>,
}

impl SubscriptionState {
    pub fn new(secret: String) -> Result<Self, AppError> {
        if secret.len() < 32 {
            return Err(AppError::Internal("subscription secret is too short"));
        }
        Ok(Self {
            secret: secret.into_bytes().into(),
        })
    }

    pub(crate) fn token(
        &self,
        subscriber_id: Uuid,
        nonce: &[u8],
        purpose: TokenPurpose,
    ) -> Result<String, AppError> {
        if nonce.len() != NONCE_BYTES {
            return Err(AppError::Internal("subscriber nonce has invalid length"));
        }
        let mut payload = Vec::with_capacity(TOKEN_PAYLOAD_BYTES);
        payload.extend_from_slice(subscriber_id.as_bytes());
        payload.extend_from_slice(nonce);
        payload.push(purpose as u8);
        let mut mac = HmacSha256::new_from_slice(&self.secret)
            .map_err(|_| AppError::Internal("initialize subscription signer"))?;
        mac.update(&payload);
        payload.extend_from_slice(&mac.finalize().into_bytes());
        Ok(URL_SAFE_NO_PAD.encode(payload))
    }

    fn verify(
        &self,
        token: &str,
        purpose: TokenPurpose,
    ) -> Result<(Uuid, [u8; NONCE_BYTES]), AppError> {
        let decoded = URL_SAFE_NO_PAD
            .decode(token)
            .map_err(|_| AppError::InvalidRequest("订阅令牌无效"))?;
        if decoded.len() != TOKEN_BYTES || decoded[32] != purpose as u8 {
            return Err(AppError::InvalidRequest("订阅令牌无效"));
        }
        let (payload, signature) = decoded.split_at(TOKEN_PAYLOAD_BYTES);
        let mut mac = HmacSha256::new_from_slice(&self.secret)
            .map_err(|_| AppError::Internal("initialize subscription signer"))?;
        mac.update(payload);
        mac.verify_slice(signature)
            .map_err(|_| AppError::InvalidRequest("订阅令牌无效"))?;
        let id = Uuid::from_slice(&payload[..16])
            .map_err(|_| AppError::InvalidRequest("订阅令牌无效"))?;
        let mut nonce = [0_u8; NONCE_BYTES];
        nonce.copy_from_slice(&payload[16..32]);
        Ok((id, nonce))
    }

    #[cfg(test)]
    fn for_test() -> Self {
        Self::new("test subscription signing secret with more than 32 bytes".into()).unwrap()
    }
}

pub async fn subscribe(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(input): Json<SubscribeRequest>,
) -> Result<Json<SubscriptionResponse>, AppError> {
    subscribe_inner(&state, peer, &headers, input).await?;
    Ok(Json(SubscriptionResponse { status: "pending" }))
}

pub async fn subscribe_form(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Form(input): Form<SubscribeForm>,
) -> Result<Html<&'static str>, AppError> {
    subscribe_inner(
        &state,
        peer,
        &headers,
        SubscribeRequest {
            email: input.email,
            subscribe_articles: input.articles.is_some(),
            subscribe_dynamics: input.dynamics.is_some(),
        },
    )
    .await?;
    Ok(Html(
        "<!doctype html><meta charset=\"utf-8\"><title>请检查邮箱</title><p>如果地址可用，确认邮件会很快送达。</p>",
    ))
}

async fn subscribe_inner(
    state: &AppState,
    peer: SocketAddr,
    headers: &HeaderMap,
    input: SubscribeRequest,
) -> Result<(), AppError> {
    auth::verify_public_origin(&state.auth, headers)?;
    let email = input.email.trim().to_lowercase();
    let target = email_rate_key(&email);
    if !state
        .content
        .allow(
            client_ip(headers, peer),
            target,
            "subscribe",
            SUBSCRIBE_COOLDOWN,
        )
        .await
    {
        return Err(AppError::RateLimited);
    }

    let transaction = state.database.begin().await?;
    transaction
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            [email.clone().into()],
        ))
        .await?;
    let existing = subscribers::Entity::find()
        .filter(subscribers::Column::Email.eq(&email))
        .lock_exclusive()
        .one(&transaction)
        .await?;
    let subscriber = if let Some(model) = existing {
        if model.status == "active" {
            transaction.commit().await?;
            return Ok(());
        }
        let mut active = model.into_active_model();
        active.subscribe_articles = Set(input.subscribe_articles);
        active.subscribe_dynamics = Set(input.subscribe_dynamics);
        active.status = Set("pending".to_owned());
        active.token_nonce = Set(random_nonce().to_vec());
        active.confirmation_sent_at = Set(None);
        active.confirmed_at = Set(None);
        active.unsubscribed_at = Set(None);
        active.update(&transaction).await?
    } else {
        subscribers::ActiveModel {
            id: NotSet,
            email: Set(email),
            subscribe_articles: Set(input.subscribe_articles),
            subscribe_dynamics: Set(input.subscribe_dynamics),
            status: Set("pending".to_owned()),
            token_nonce: Set(random_nonce().to_vec()),
            confirmation_sent_at: Set(None),
            confirmed_at: Set(None),
            unsubscribed_at: Set(None),
            created_at: NotSet,
            updated_at: NotSet,
        }
        .insert(&transaction)
        .await?
    };
    queue_confirmation(&transaction, subscriber.id).await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn confirm(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Html<&'static str>, AppError> {
    let (subscriber_id, nonce) = state.subscriptions.verify(&token, TokenPurpose::Confirm)?;
    let transaction = state.database.begin().await?;
    let model = subscribers::Entity::find_by_id(subscriber_id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::InvalidRequest("订阅令牌无效"))?;
    validate_nonce(&model.token_nonce, &nonce)?;
    if model.status == "pending" {
        let mut active = model.into_active_model();
        active.status = Set("active".to_owned());
        active.confirmed_at = Set(Some(Utc::now().fixed_offset()));
        active.unsubscribed_at = Set(None);
        active.update(&transaction).await?;
    }
    transaction.commit().await?;
    Ok(Html(
        "<!doctype html><meta charset=\"utf-8\"><title>订阅已确认</title><p>订阅已确认，可以关闭此页面。</p>",
    ))
}

pub async fn unsubscribe(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<TokenRequest>,
) -> Result<Json<SubscriptionResponse>, AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    unsubscribe_with_token(&state, &input.token).await?;
    Ok(Json(SubscriptionResponse {
        status: "unsubscribed",
    }))
}

pub async fn unsubscribe_page(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Html<String>, AppError> {
    state
        .subscriptions
        .verify(&token, TokenPurpose::Unsubscribe)?;
    Ok(Html(format!(
        "<!doctype html><meta charset=\"utf-8\"><title>退订 YukiLog</title>\
         <form method=\"post\" action=\"/subscriptions/unsubscribe/{token}\">\
         <p>确认不再接收 YukiLog 邮件？</p><button>确认退订</button></form>"
    )))
}

pub async fn unsubscribe_form(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Html<&'static str>, AppError> {
    unsubscribe_with_token(&state, &token).await?;
    Ok(Html(
        "<!doctype html><meta charset=\"utf-8\"><title>已经退订</title><p>已经退订，可以关闭此页面。</p>",
    ))
}

pub async fn admin_list_subscribers(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<AdminSubscriberResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = subscribers::Entity::find()
        .order_by_desc(subscribers::Column::CreatedAt)
        .all(&state.database)
        .await?;
    Ok(Json(models.into_iter().map(Into::into).collect()))
}

pub async fn admin_list_deliveries(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<AdminDeliveryResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = email_deliveries::Entity::find()
        .order_by_desc(email_deliveries::Column::CreatedAt)
        .all(&state.database)
        .await?;
    Ok(Json(models.into_iter().map(Into::into).collect()))
}

pub async fn admin_retry_delivery(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<Json<AdminDeliveryResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = email_deliveries::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    if model.status == "sent" {
        return Err(AppError::InvalidRequest("已发送的邮件不能重试"));
    }
    let mut active = model.into_active_model();
    active.status = Set("pending".to_owned());
    active.attempt_count = Set(0);
    active.next_attempt_at = Set(Utc::now().fixed_offset());
    active.locked_at = Set(None);
    active.last_error = Set(None);
    active.sent_at = Set(None);
    Ok(Json(active.update(&state.database).await?.into()))
}

pub async fn admin_cancel_delivery(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<Json<AdminDeliveryResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = email_deliveries::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    if model.status == "sent" {
        return Err(AppError::InvalidRequest("已发送的邮件不能取消"));
    }
    let mut active = model.into_active_model();
    active.status = Set("cancelled".to_owned());
    active.locked_at = Set(None);
    active.sent_at = Set(None);
    Ok(Json(active.update(&state.database).await?.into()))
}

async fn unsubscribe_with_token(state: &AppState, token: &str) -> Result<(), AppError> {
    let (subscriber_id, nonce) = state
        .subscriptions
        .verify(token, TokenPurpose::Unsubscribe)?;
    let transaction = state.database.begin().await?;
    let model = subscribers::Entity::find_by_id(subscriber_id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::InvalidRequest("订阅令牌无效"))?;
    validate_nonce(&model.token_nonce, &nonce)?;
    if model.status != "unsubscribed" {
        let mut active = model.into_active_model();
        active.status = Set("unsubscribed".to_owned());
        active.unsubscribed_at = Set(Some(Utc::now().fixed_offset()));
        active.update(&transaction).await?;
        email_deliveries::Entity::update_many()
            .filter(email_deliveries::Column::SubscriberId.eq(subscriber_id))
            .filter(email_deliveries::Column::Status.is_in(["pending", "failed", "sending"]))
            .col_expr(
                email_deliveries::Column::Status,
                sea_orm::sea_query::Expr::value("cancelled"),
            )
            .col_expr(
                email_deliveries::Column::LockedAt,
                sea_orm::sea_query::Expr::value(
                    Option::<chrono::DateTime<chrono::FixedOffset>>::None,
                ),
            )
            .exec(&transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(())
}

async fn queue_confirmation<C: ConnectionTrait>(
    connection: &C,
    subscriber_id: Uuid,
) -> Result<(), AppError> {
    connection
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
INSERT INTO email_deliveries (subscriber_id, kind)
VALUES ($1, 'confirm_subscription')
ON CONFLICT (subscriber_id) WHERE kind = 'confirm_subscription'
DO UPDATE SET status = 'pending',
              attempt_count = 0,
              next_attempt_at = now(),
              locked_at = NULL,
              last_error = NULL,
              sent_at = NULL
"#,
            [subscriber_id.into()],
        ))
        .await?;
    Ok(())
}

fn random_nonce() -> [u8; NONCE_BYTES] {
    let mut nonce = [0_u8; NONCE_BYTES];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

fn validate_nonce(stored: &[u8], supplied: &[u8; NONCE_BYTES]) -> Result<(), AppError> {
    if stored.len() != NONCE_BYTES || stored.ct_eq(supplied).unwrap_u8() != 1 {
        return Err(AppError::InvalidRequest("订阅令牌无效"));
    }
    Ok(())
}

fn email_rate_key(email: &str) -> Uuid {
    let digest = Sha256::digest(email.as_bytes());
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    Uuid::from_bytes(bytes)
}

impl From<subscribers::Model> for AdminSubscriberResponse {
    fn from(model: subscribers::Model) -> Self {
        Self {
            id: model.id,
            email: model.email,
            subscribe_articles: model.subscribe_articles,
            subscribe_dynamics: model.subscribe_dynamics,
            status: model.status,
            confirmation_sent_at: model.confirmation_sent_at,
            confirmed_at: model.confirmed_at,
            unsubscribed_at: model.unsubscribed_at,
            created_at: model.created_at,
        }
    }
}

impl From<email_deliveries::Model> for AdminDeliveryResponse {
    fn from(model: email_deliveries::Model) -> Self {
        Self {
            id: model.id,
            subscriber_id: model.subscriber_id,
            kind: model.kind,
            article_id: model.article_id,
            dynamic_id: model.dynamic_id,
            status: model.status,
            attempt_count: model.attempt_count,
            next_attempt_at: model.next_attempt_at,
            last_error: model.last_error,
            created_at: model.created_at,
            sent_at: model.sent_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signed_tokens_are_purpose_bound_and_nonce_bound() {
        let state = SubscriptionState::for_test();
        let id = Uuid::from_bytes([42_u8; 16]);
        let nonce = random_nonce();
        let token = state.token(id, &nonce, TokenPurpose::Confirm).unwrap();
        assert_eq!(
            state.verify(&token, TokenPurpose::Confirm).unwrap(),
            (id, nonce)
        );
        assert!(state.verify(&token, TokenPurpose::Unsubscribe).is_err());

        let mut tampered = token.into_bytes();
        tampered[10] = if tampered[10] == b'a' { b'b' } else { b'a' };
        assert!(
            state
                .verify(
                    std::str::from_utf8(&tampered).unwrap(),
                    TokenPurpose::Confirm
                )
                .is_err()
        );
    }

    #[test]
    fn email_rate_keys_are_stable_without_storing_email() {
        assert_eq!(
            email_rate_key("reader@example.com"),
            email_rate_key("reader@example.com")
        );
        assert_ne!(
            email_rate_key("reader@example.com"),
            email_rate_key("other@example.com")
        );
    }
}
