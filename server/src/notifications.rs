use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Duration, FixedOffset, Utc};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, ConnectionTrait, DatabaseBackend,
    EntityTrait, IntoActiveModel, QueryFilter, QueryOrder, QuerySelect, Set, Statement,
    TransactionTrait, prelude::Uuid,
};
use serde::{Deserialize, Serialize};

use crate::{
    AppState, auth,
    entities::{admin_accounts, admin_notifications},
    error::AppError,
};

#[derive(Clone, Copy)]
pub enum NotificationKind {
    Comment,
    FriendLinkApplication,
    ArticleLike,
}

impl NotificationKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Comment => "comment",
            Self::FriendLinkApplication => "friend_link_application",
            Self::ArticleLike => "article_like",
        }
    }
}

pub struct NewNotification {
    pub kind: NotificationKind,
    pub article_id: Option<Uuid>,
    pub comment_id: Option<Uuid>,
    pub friend_link_id: Option<Uuid>,
    pub title: String,
    pub message: String,
    pub target_url: String,
}

#[derive(Debug, Deserialize)]
pub struct NotificationQuery {
    #[serde(default)]
    unread_only: bool,
}

#[derive(Debug, Serialize)]
pub struct NotificationResponse {
    id: Uuid,
    kind: String,
    article_id: Option<Uuid>,
    comment_id: Option<Uuid>,
    friend_link_id: Option<Uuid>,
    title: String,
    message: String,
    target_url: String,
    event_count: i32,
    read_at: Option<DateTime<FixedOffset>>,
    email_status: String,
    email_attempt_count: i16,
    email_last_error: Option<String>,
    emailed_event_count: i32,
    email_sent_at: Option<DateTime<FixedOffset>>,
    created_at: DateTime<FixedOffset>,
    updated_at: DateTime<FixedOffset>,
}

#[derive(Debug, Deserialize)]
pub struct NotificationSettingsWrite {
    notification_email: Option<String>,
    email_notifications_enabled: bool,
    notify_on_comments: bool,
    notify_on_friend_links: bool,
    notify_on_likes: bool,
    notification_frequency: String,
}

#[derive(Debug, Serialize)]
pub struct NotificationSettingsResponse {
    notification_email: Option<String>,
    email_notifications_enabled: bool,
    notify_on_comments: bool,
    notify_on_friend_links: bool,
    notify_on_likes: bool,
    notification_frequency: String,
}

pub async fn create<C: ConnectionTrait>(
    connection: &C,
    input: NewNotification,
) -> Result<(), AppError> {
    let accounts = admin_accounts::Entity::find()
        .filter(admin_accounts::Column::IsActive.eq(true))
        .all(connection)
        .await?;
    let now = Utc::now().fixed_offset();
    for account in accounts {
        let (email_status, email_due_at) = email_plan(&account, input.kind, now);
        admin_notifications::ActiveModel {
            id: NotSet,
            account_id: Set(account.id),
            kind: Set(input.kind.as_str().to_owned()),
            article_id: Set(input.article_id),
            comment_id: Set(input.comment_id),
            friend_link_id: Set(input.friend_link_id),
            title: Set(input.title.clone()),
            message: Set(input.message.clone()),
            target_url: Set(input.target_url.clone()),
            aggregation_key: Set(None),
            event_count: Set(1),
            read_at: Set(None),
            email_status: Set(email_status),
            email_due_at: Set(email_due_at),
            email_attempt_count: Set(0),
            email_locked_at: Set(None),
            email_last_error: Set(None),
            emailed_event_count: Set(0),
            email_sent_at: Set(None),
            created_at: NotSet,
            updated_at: NotSet,
        }
        .insert(connection)
        .await?;
    }
    Ok(())
}

pub async fn create_article_like<C: ConnectionTrait>(
    connection: &C,
    article_id: Uuid,
    article_slug: &str,
    article_title: &str,
) -> Result<(), AppError> {
    let accounts = admin_accounts::Entity::find()
        .filter(admin_accounts::Column::IsActive.eq(true))
        .all(connection)
        .await?;
    let now = Utc::now().fixed_offset();
    for account in accounts {
        let (email_status, email_due_at) = email_plan(&account, NotificationKind::ArticleLike, now);
        connection
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
INSERT INTO admin_notifications (
    account_id, kind, article_id, title, message, target_url,
    aggregation_key, email_status, email_due_at
)
VALUES ($1, 'article_like', $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (account_id, aggregation_key)
    WHERE read_at IS NULL AND aggregation_key IS NOT NULL
DO UPDATE SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    target_url = EXCLUDED.target_url,
    event_count = admin_notifications.event_count + 1,
    email_status = EXCLUDED.email_status,
    email_due_at = EXCLUDED.email_due_at,
    email_attempt_count = 0,
    email_locked_at = NULL,
    email_last_error = NULL,
    email_sent_at = NULL
"#,
                [
                    account.id.into(),
                    article_id.into(),
                    format!("文章收到新的点赞：{article_title}").into(),
                    "有访客喜欢了这篇文章。".into(),
                    format!("/articles/{article_slug}").into(),
                    format!("article-like:{article_id}").into(),
                    email_status.into(),
                    email_due_at.into(),
                ],
            ))
            .await?;
    }
    Ok(())
}

pub async fn list(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(query): Query<NotificationQuery>,
) -> Result<Json<Vec<NotificationResponse>>, AppError> {
    let account_id = auth::authorize_read(&state, &jar).await?;
    let mut select = admin_notifications::Entity::find()
        .filter(admin_notifications::Column::AccountId.eq(account_id))
        .order_by_desc(admin_notifications::Column::UpdatedAt)
        .limit(100);
    if query.unread_only {
        select = select.filter(admin_notifications::Column::ReadAt.is_null());
    }
    Ok(Json(
        select
            .all(&state.database)
            .await?
            .into_iter()
            .map(Into::into)
            .collect(),
    ))
}

pub async fn mark_read(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    let account_id = auth::authorize_write(&state, &headers, &jar).await?;
    let result = admin_notifications::Entity::update_many()
        .filter(admin_notifications::Column::Id.eq(id))
        .filter(admin_notifications::Column::AccountId.eq(account_id))
        .col_expr(
            admin_notifications::Column::ReadAt,
            sea_orm::sea_query::Expr::value(Some(Utc::now().fixed_offset())),
        )
        .exec(&state.database)
        .await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn mark_all_read(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    let account_id = auth::authorize_write(&state, &headers, &jar).await?;
    admin_notifications::Entity::update_many()
        .filter(admin_notifications::Column::AccountId.eq(account_id))
        .filter(admin_notifications::Column::ReadAt.is_null())
        .col_expr(
            admin_notifications::Column::ReadAt,
            sea_orm::sea_query::Expr::value(Some(Utc::now().fixed_offset())),
        )
        .exec(&state.database)
        .await?;
    Ok(())
}

pub async fn retry_email(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    let account_id = auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    let model = admin_notifications::Entity::find_by_id(id)
        .filter(admin_notifications::Column::AccountId.eq(account_id))
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    if matches!(model.email_status.as_str(), "sending" | "sent") {
        return Err(AppError::InvalidRequest(
            "正在发送或已经发送的通知邮件不能重试",
        ));
    }
    let mut active = model.into_active_model();
    active.email_status = Set("pending".to_owned());
    active.email_due_at = Set(Some(Utc::now().fixed_offset()));
    active.email_attempt_count = Set(0);
    active.email_locked_at = Set(None);
    active.email_last_error = Set(None);
    active.email_sent_at = Set(None);
    active.update(&transaction).await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn cancel_email(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    let account_id = auth::authorize_write(&state, &headers, &jar).await?;
    let result = admin_notifications::Entity::update_many()
        .filter(admin_notifications::Column::Id.eq(id))
        .filter(admin_notifications::Column::AccountId.eq(account_id))
        .filter(admin_notifications::Column::EmailStatus.ne("sent"))
        .col_expr(
            admin_notifications::Column::EmailStatus,
            sea_orm::sea_query::Expr::value("cancelled"),
        )
        .col_expr(
            admin_notifications::Column::EmailLockedAt,
            sea_orm::sea_query::Expr::value(Option::<DateTime<FixedOffset>>::None),
        )
        .exec(&state.database)
        .await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn get_settings(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<NotificationSettingsResponse>, AppError> {
    let account_id = auth::authorize_read(&state, &jar).await?;
    let account = admin_accounts::Entity::find_by_id(account_id)
        .one(&state.database)
        .await?
        .ok_or(AppError::Unauthorized)?;
    Ok(Json(account.into()))
}

pub async fn put_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<NotificationSettingsWrite>,
) -> Result<Json<NotificationSettingsResponse>, AppError> {
    let account_id = auth::authorize_write(&state, &headers, &jar).await?;
    let account = admin_accounts::Entity::find_by_id(account_id)
        .one(&state.database)
        .await?
        .ok_or(AppError::Unauthorized)?;
    let mut active = account.into_active_model();
    active.notification_email = Set(input
        .notification_email
        .map(|email| email.trim().to_lowercase())
        .filter(|email| !email.is_empty()));
    active.email_notifications_enabled = Set(input.email_notifications_enabled);
    active.notify_on_comments = Set(input.notify_on_comments);
    active.notify_on_friend_links = Set(input.notify_on_friend_links);
    active.notify_on_likes = Set(input.notify_on_likes);
    active.notification_frequency = Set(input.notification_frequency);
    Ok(Json(active.update(&state.database).await?.into()))
}

fn email_plan(
    account: &admin_accounts::Model,
    kind: NotificationKind,
    now: DateTime<FixedOffset>,
) -> (String, Option<DateTime<FixedOffset>>) {
    let kind_enabled = match kind {
        NotificationKind::Comment => account.notify_on_comments,
        NotificationKind::FriendLinkApplication => account.notify_on_friend_links,
        NotificationKind::ArticleLike => account.notify_on_likes,
    };
    email_plan_for(
        crate::subscriptions::mail_enabled(),
        account.email_notifications_enabled,
        account.notification_email.is_some(),
        kind_enabled,
        &account.notification_frequency,
        now,
    )
}

fn email_plan_for(
    globally_enabled: bool,
    enabled: bool,
    has_email: bool,
    kind_enabled: bool,
    frequency: &str,
    now: DateTime<FixedOffset>,
) -> (String, Option<DateTime<FixedOffset>>) {
    if !globally_enabled || !enabled || !has_email || !kind_enabled {
        return ("suppressed".to_owned(), None);
    }
    let due_at = match frequency {
        "immediate" => now,
        "hourly" => now + Duration::hours(1),
        "daily" => now + Duration::days(1),
        _ => return ("suppressed".to_owned(), None),
    };
    ("pending".to_owned(), Some(due_at))
}

impl From<admin_notifications::Model> for NotificationResponse {
    fn from(model: admin_notifications::Model) -> Self {
        Self {
            id: model.id,
            kind: model.kind,
            article_id: model.article_id,
            comment_id: model.comment_id,
            friend_link_id: model.friend_link_id,
            title: model.title,
            message: model.message,
            target_url: model.target_url,
            event_count: model.event_count,
            read_at: model.read_at,
            email_status: model.email_status,
            email_attempt_count: model.email_attempt_count,
            email_last_error: model.email_last_error,
            emailed_event_count: model.emailed_event_count,
            email_sent_at: model.email_sent_at,
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}

impl From<admin_accounts::Model> for NotificationSettingsResponse {
    fn from(model: admin_accounts::Model) -> Self {
        Self {
            notification_email: model.notification_email,
            email_notifications_enabled: model.email_notifications_enabled,
            notify_on_comments: model.notify_on_comments,
            notify_on_friend_links: model.notify_on_friend_links,
            notify_on_likes: model.notify_on_likes,
            notification_frequency: model.notification_frequency,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_plan_requires_all_switches_and_applies_frequency() {
        let now = Utc::now().fixed_offset();
        assert_eq!(
            email_plan_for(true, false, true, true, "immediate", now),
            ("suppressed".to_owned(), None)
        );
        assert_eq!(
            email_plan_for(true, true, true, false, "immediate", now),
            ("suppressed".to_owned(), None)
        );
        assert_eq!(
            email_plan_for(true, true, true, true, "hourly", now),
            ("pending".to_owned(), Some(now + Duration::hours(1)))
        );
        assert_eq!(
            email_plan_for(true, true, true, true, "daily", now),
            ("pending".to_owned(), Some(now + Duration::days(1)))
        );
        assert_eq!(
            email_plan_for(false, true, true, true, "immediate", now),
            ("suppressed".to_owned(), None)
        );
    }
}
