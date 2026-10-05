use std::{net::SocketAddr, time::Duration};

use axum::{
    Json,
    extract::{ConnectInfo, Path, State},
    http::{HeaderMap, Uri, header::USER_AGENT},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::Utc;
use cookie::time::Duration as CookieDuration;
use rand::{RngCore, rngs::OsRng};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, ConnectionTrait, DatabaseBackend,
    EntityTrait, QueryFilter, QueryOrder, Set, Statement, TransactionTrait, sea_query::Expr,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{
    AppState, auth,
    content::client_ip,
    entities::{
        article_likes, article_metrics, articles, comments, dynamic_likes, dynamic_metrics,
        dynamics, friend_links,
    },
    error::AppError,
    ops::notifications::{self, NewNotification, NotificationKind},
};

const VIEW_COOLDOWN: Duration = Duration::from_secs(30);
const COMMENT_COOLDOWN: Duration = Duration::from_secs(60);
const FRIEND_LINK_COOLDOWN: Duration = Duration::from_secs(10 * 60);
const LIKE_COOLDOWN: Duration = Duration::from_secs(30);
const VISITOR_COOKIE_DAYS: i64 = 365;

#[derive(Debug, Deserialize)]
pub struct CommentWrite {
    parent_id: Option<sea_orm::prelude::Uuid>,
    display_name: String,
    email: Option<String>,
    website: Option<String>,
    content: String,
}

#[derive(Debug, Serialize)]
pub struct PublicCommentResponse {
    id: sea_orm::prelude::Uuid,
    parent_id: Option<sea_orm::prelude::Uuid>,
    display_name: String,
    email: Option<String>,
    avatar_url: String,
    agent_label: String,
    website: Option<String>,
    content: String,
    created_at: chrono::DateTime<chrono::FixedOffset>,
}

#[derive(Debug, Serialize)]
pub struct SubmittedCommentResponse {
    id: sea_orm::prelude::Uuid,
    status: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct FriendLinkApplication {
    name: String,
    url: String,
    description: Option<String>,
    email: String,
    avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FriendLinkApplicationResponse {
    status: &'static str,
}

pub async fn apply_friend_link(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(input): Json<FriendLinkApplication>,
) -> Result<Json<FriendLinkApplicationResponse>, AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    validate_friend_link_url(&input.url)?;
    let avatar_url = input.avatar_url.and_then(|value| {
        let trimmed = value.trim().to_owned();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    if let Some(value) = &avatar_url {
        validate_friend_link_url(value)?;
    }
    let target = stable_rate_key(&input.url);
    if !state
        .content
        .allow(
            client_ip(&headers, peer),
            target,
            "friend-link-application",
            FRIEND_LINK_COOLDOWN,
        )
        .await
    {
        return Err(AppError::RateLimited);
    }

    let transaction = state.database.begin().await?;
    let model = friend_links::ActiveModel {
        id: NotSet,
        avatar_media_id: Set(None),
        avatar_url: Set(avatar_url),
        name: Set(input.name),
        url: Set(input.url),
        description: Set(input.description),
        application_email: Set(Some(input.email.trim().to_lowercase())),
        is_visible: Set(false),
        sort_order: Set(0),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&transaction)
    .await?;
    notifications::create(
        &transaction,
        NewNotification {
            kind: NotificationKind::FriendLinkApplication,
            article_id: None,
            comment_id: None,
            friend_link_id: Some(model.id),
            title: format!("新的友链申请：{}", model.name),
            message: model
                .description
                .clone()
                .unwrap_or_else(|| model.url.clone()),
            target_url: "/admin#friends".to_owned(),
        },
    )
    .await?;
    transaction.commit().await?;
    Ok(Json(FriendLinkApplicationResponse { status: "pending" }))
}

pub async fn list_article_comments(
    State(state): State<AppState>,
    Path(article_id): Path<sea_orm::prelude::Uuid>,
) -> Result<Json<Vec<PublicCommentResponse>>, AppError> {
    ensure_article_published(&state, article_id, false).await?;
    let models = comments::Entity::find()
        .filter(comments::Column::ArticleId.eq(article_id))
        .filter(comments::Column::Status.eq("visible"))
        .order_by_asc(comments::Column::CreatedAt)
        .all(&state.database)
        .await?;
    Ok(Json(
        models
            .into_iter()
            .map(PublicCommentResponse::from)
            .collect(),
    ))
}

pub async fn create_article_comment(
    State(state): State<AppState>,
    Path(article_id): Path<sea_orm::prelude::Uuid>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(input): Json<CommentWrite>,
) -> Result<Json<SubmittedCommentResponse>, AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    ensure_article_published(&state, article_id, true).await?;
    enforce_comment_limit(&state, &headers, peer, article_id).await?;
    validate_comment_email(input.email.as_deref())?;
    validate_website(input.website.as_deref())?;
    let user_agent = capture_user_agent(&headers);
    let transaction = state.database.begin().await?;
    ensure_visible_parent(&transaction, input.parent_id, Some(article_id), None).await?;
    let model = comments::ActiveModel {
        id: NotSet,
        article_id: Set(Some(article_id)),
        dynamic_id: Set(None),
        parent_id: Set(input.parent_id),
        display_name: Set(input.display_name),
        email: Set(input.email),
        website: Set(input.website),
        content: Set(input.content),
        user_agent: Set(user_agent),
        status: Set("pending".to_owned()),
        created_at: NotSet,
    }
    .insert(&transaction)
    .await?;
    let article = articles::Entity::find_by_id(article_id)
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    notifications::create(
        &transaction,
        NewNotification {
            kind: NotificationKind::Comment,
            article_id: Some(article_id),
            comment_id: Some(model.id),
            friend_link_id: None,
            title: format!("文章收到新评论：{}", article.title),
            message: excerpt(&model.content, 500),
            target_url: format!("/articles/{}#comments", article.slug),
        },
    )
    .await?;
    transaction.commit().await?;
    Ok(Json(SubmittedCommentResponse {
        id: model.id,
        status: "pending",
    }))
}

pub async fn list_dynamic_comments(
    State(state): State<AppState>,
    Path(dynamic_id): Path<sea_orm::prelude::Uuid>,
) -> Result<Json<Vec<PublicCommentResponse>>, AppError> {
    ensure_dynamic_published(&state, dynamic_id, false).await?;
    let models = comments::Entity::find()
        .filter(comments::Column::DynamicId.eq(dynamic_id))
        .filter(comments::Column::Status.eq("visible"))
        .order_by_asc(comments::Column::CreatedAt)
        .all(&state.database)
        .await?;
    Ok(Json(
        models
            .into_iter()
            .map(PublicCommentResponse::from)
            .collect(),
    ))
}

pub async fn create_dynamic_comment(
    State(state): State<AppState>,
    Path(dynamic_id): Path<sea_orm::prelude::Uuid>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(input): Json<CommentWrite>,
) -> Result<Json<SubmittedCommentResponse>, AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    ensure_dynamic_published(&state, dynamic_id, true).await?;
    enforce_comment_limit(&state, &headers, peer, dynamic_id).await?;
    validate_comment_email(input.email.as_deref())?;
    validate_website(input.website.as_deref())?;
    let user_agent = capture_user_agent(&headers);
    let transaction = state.database.begin().await?;
    ensure_visible_parent(&transaction, input.parent_id, None, Some(dynamic_id)).await?;
    let model = comments::ActiveModel {
        id: NotSet,
        article_id: Set(None),
        dynamic_id: Set(Some(dynamic_id)),
        parent_id: Set(input.parent_id),
        display_name: Set(input.display_name),
        email: Set(input.email),
        website: Set(input.website),
        content: Set(input.content),
        user_agent: Set(user_agent),
        status: Set("pending".to_owned()),
        created_at: NotSet,
    }
    .insert(&transaction)
    .await?;
    notifications::create(
        &transaction,
        NewNotification {
            kind: NotificationKind::Comment,
            article_id: None,
            comment_id: Some(model.id),
            friend_link_id: None,
            title: "动态收到新评论".to_owned(),
            message: excerpt(&model.content, 500),
            target_url: format!("/dynamics#dynamic-{dynamic_id}"),
        },
    )
    .await?;
    transaction.commit().await?;
    Ok(Json(SubmittedCommentResponse {
        id: model.id,
        status: "pending",
    }))
}

#[derive(Debug, Serialize)]
pub struct MetricsResponse {
    view_count: i64,
    like_count: i64,
    liked: bool,
}

#[derive(Debug, Serialize)]
pub struct DynamicMetricsResponse {
    like_count: i64,
    liked: bool,
}

pub async fn record_view(
    State(state): State<AppState>,
    Path(article_id): Path<sea_orm::prelude::Uuid>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<Json<MetricsResponse>, AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    ensure_article_published(&state, article_id, false).await?;
    let address = client_ip(&headers, peer);
    if state
        .content
        .allow(address, article_id, "view", VIEW_COOLDOWN)
        .await
    {
        article_metrics::Entity::update_many()
            .filter(article_metrics::Column::ArticleId.eq(article_id))
            .col_expr(
                article_metrics::Column::ViewCount,
                Expr::col(article_metrics::Column::ViewCount).add(1),
            )
            .exec(&state.database)
            .await?;
    }
    let liked = visitor_liked(&state, &jar, article_id).await?;
    Ok(Json(metrics(&state, article_id, liked).await?))
}

pub async fn get_metrics(
    State(state): State<AppState>,
    Path(article_id): Path<sea_orm::prelude::Uuid>,
    jar: CookieJar,
) -> Result<Json<MetricsResponse>, AppError> {
    ensure_article_published(&state, article_id, false).await?;
    let liked = visitor_liked(&state, &jar, article_id).await?;
    Ok(Json(metrics(&state, article_id, liked).await?))
}

pub async fn like_article(
    State(state): State<AppState>,
    Path(article_id): Path<sea_orm::prelude::Uuid>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(CookieJar, Json<MetricsResponse>), AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    ensure_article_published(&state, article_id, false).await?;
    if !state
        .content
        .allow(client_ip(&headers, peer), article_id, "like", LIKE_COOLDOWN)
        .await
    {
        return Err(AppError::RateLimited);
    }
    let (jar, visitor_hash) = visitor_identity(&state, jar);
    let transaction = state.database.begin().await?;
    let inserted = transaction
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
INSERT INTO article_likes (article_id, visitor_token_hash)
VALUES ($1, $2)
ON CONFLICT (article_id, visitor_token_hash) DO NOTHING
RETURNING article_id
"#,
            [article_id.into(), visitor_hash.into()],
        ))
        .await?
        .is_some();
    if inserted {
        let article = articles::Entity::find_by_id(article_id)
            .one(&transaction)
            .await?
            .ok_or(AppError::NotFound)?;
        notifications::create_article_like(&transaction, article_id, &article.slug, &article.title)
            .await?;
    }
    transaction.commit().await?;
    Ok((jar, Json(metrics(&state, article_id, true).await?)))
}

pub async fn unlike_article(
    State(state): State<AppState>,
    Path(article_id): Path<sea_orm::prelude::Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(CookieJar, Json<MetricsResponse>), AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    ensure_article_published(&state, article_id, false).await?;
    let (jar, visitor_hash) = visitor_identity(&state, jar);
    article_likes::Entity::delete_many()
        .filter(article_likes::Column::ArticleId.eq(article_id))
        .filter(article_likes::Column::VisitorTokenHash.eq(visitor_hash))
        .exec(&state.database)
        .await?;
    Ok((jar, Json(metrics(&state, article_id, false).await?)))
}

pub async fn get_dynamic_metrics(
    State(state): State<AppState>,
    Path(dynamic_id): Path<sea_orm::prelude::Uuid>,
    jar: CookieJar,
) -> Result<Json<DynamicMetricsResponse>, AppError> {
    ensure_dynamic_published(&state, dynamic_id, false).await?;
    let liked = visitor_liked_dynamic(&state, &jar, dynamic_id).await?;
    Ok(Json(dynamic_metrics_of(&state, dynamic_id, liked).await?))
}

pub async fn like_dynamic(
    State(state): State<AppState>,
    Path(dynamic_id): Path<sea_orm::prelude::Uuid>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(CookieJar, Json<DynamicMetricsResponse>), AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    ensure_dynamic_published(&state, dynamic_id, false).await?;
    if !state
        .content
        .allow(client_ip(&headers, peer), dynamic_id, "like", LIKE_COOLDOWN)
        .await
    {
        return Err(AppError::RateLimited);
    }
    let (jar, visitor_hash) = visitor_identity(&state, jar);
    state
        .database
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
INSERT INTO dynamic_likes (dynamic_id, visitor_token_hash)
VALUES ($1, $2)
ON CONFLICT (dynamic_id, visitor_token_hash) DO NOTHING
"#,
            [dynamic_id.into(), visitor_hash.into()],
        ))
        .await?;
    Ok((
        jar,
        Json(dynamic_metrics_of(&state, dynamic_id, true).await?),
    ))
}

pub async fn unlike_dynamic(
    State(state): State<AppState>,
    Path(dynamic_id): Path<sea_orm::prelude::Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(CookieJar, Json<DynamicMetricsResponse>), AppError> {
    auth::verify_public_origin(&state.auth, &headers)?;
    ensure_dynamic_published(&state, dynamic_id, false).await?;
    let (jar, visitor_hash) = visitor_identity(&state, jar);
    dynamic_likes::Entity::delete_many()
        .filter(dynamic_likes::Column::DynamicId.eq(dynamic_id))
        .filter(dynamic_likes::Column::VisitorTokenHash.eq(visitor_hash))
        .exec(&state.database)
        .await?;
    Ok((
        jar,
        Json(dynamic_metrics_of(&state, dynamic_id, false).await?),
    ))
}

async fn ensure_article_published(
    state: &AppState,
    article_id: sea_orm::prelude::Uuid,
    require_comments: bool,
) -> Result<(), AppError> {
    let model = articles::Entity::find_by_id(article_id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    if model.status != "published"
        || model
            .published_at
            .is_none_or(|time| time > Utc::now().fixed_offset())
    {
        return Err(AppError::NotFound);
    }
    if require_comments && !model.allow_comments {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

async fn ensure_dynamic_published(
    state: &AppState,
    dynamic_id: sea_orm::prelude::Uuid,
    require_comments: bool,
) -> Result<(), AppError> {
    let model = dynamics::Entity::find_by_id(dynamic_id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    if model.status != "published"
        || model
            .published_at
            .is_none_or(|time| time > Utc::now().fixed_offset())
    {
        return Err(AppError::NotFound);
    }
    if require_comments && !model.allow_comments {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

async fn enforce_comment_limit(
    state: &AppState,
    headers: &HeaderMap,
    peer: SocketAddr,
    target: sea_orm::prelude::Uuid,
) -> Result<(), AppError> {
    let address = client_ip(headers, peer);
    if state
        .content
        .allow(address, target, "comment", COMMENT_COOLDOWN)
        .await
    {
        Ok(())
    } else {
        Err(AppError::RateLimited)
    }
}

async fn ensure_visible_parent<C: ConnectionTrait>(
    connection: &C,
    parent_id: Option<sea_orm::prelude::Uuid>,
    article_id: Option<sea_orm::prelude::Uuid>,
    dynamic_id: Option<sea_orm::prelude::Uuid>,
) -> Result<(), AppError> {
    let Some(parent_id) = parent_id else {
        return Ok(());
    };
    let exists = comments::Entity::find_by_id(parent_id)
        .filter(comments::Column::ArticleId.eq(article_id))
        .filter(comments::Column::DynamicId.eq(dynamic_id))
        .filter(comments::Column::Status.eq("visible"))
        .one(connection)
        .await?
        .is_some();
    if !exists {
        return Err(AppError::InvalidRequest("回复的评论不存在或尚未公开"));
    }
    Ok(())
}

async fn metrics(
    state: &AppState,
    article_id: sea_orm::prelude::Uuid,
    liked: bool,
) -> Result<MetricsResponse, AppError> {
    let model = article_metrics::Entity::find_by_id(article_id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(MetricsResponse {
        view_count: model.view_count,
        like_count: model.like_count,
        liked,
    })
}

async fn visitor_liked(
    state: &AppState,
    jar: &CookieJar,
    article_id: sea_orm::prelude::Uuid,
) -> Result<bool, AppError> {
    let secure = auth::secure_cookies(&state.auth);
    let cookie_name = if secure {
        "__Host-yukilog_visitor"
    } else {
        "yukilog_visitor"
    };
    let Some(cookie) = jar.get(cookie_name) else {
        return Ok(false);
    };
    let hash = Sha256::digest(cookie.value().as_bytes()).to_vec();
    Ok(article_likes::Entity::find()
        .filter(article_likes::Column::ArticleId.eq(article_id))
        .filter(article_likes::Column::VisitorTokenHash.eq(hash))
        .one(&state.database)
        .await?
        .is_some())
}

async fn dynamic_metrics_of(
    state: &AppState,
    dynamic_id: sea_orm::prelude::Uuid,
    liked: bool,
) -> Result<DynamicMetricsResponse, AppError> {
    let model = dynamic_metrics::Entity::find_by_id(dynamic_id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(DynamicMetricsResponse {
        like_count: model.like_count,
        liked,
    })
}

async fn visitor_liked_dynamic(
    state: &AppState,
    jar: &CookieJar,
    dynamic_id: sea_orm::prelude::Uuid,
) -> Result<bool, AppError> {
    let secure = auth::secure_cookies(&state.auth);
    let cookie_name = if secure {
        "__Host-yukilog_visitor"
    } else {
        "yukilog_visitor"
    };
    let Some(cookie) = jar.get(cookie_name) else {
        return Ok(false);
    };
    let hash = Sha256::digest(cookie.value().as_bytes()).to_vec();
    Ok(dynamic_likes::Entity::find()
        .filter(dynamic_likes::Column::DynamicId.eq(dynamic_id))
        .filter(dynamic_likes::Column::VisitorTokenHash.eq(hash))
        .one(&state.database)
        .await?
        .is_some())
}

fn visitor_identity(state: &AppState, jar: CookieJar) -> (CookieJar, Vec<u8>) {
    let secure = auth::secure_cookies(&state.auth);
    let cookie_name = if secure {
        "__Host-yukilog_visitor"
    } else {
        "yukilog_visitor"
    };
    if let Some(token) = jar.get(cookie_name).map(|cookie| cookie.value().to_owned()) {
        let hash = Sha256::digest(token.as_bytes()).to_vec();
        return (jar, hash);
    }

    let mut random = [0_u8; 32];
    OsRng.fill_bytes(&mut random);
    let token = URL_SAFE_NO_PAD.encode(random);
    let hash = Sha256::digest(token.as_bytes()).to_vec();
    let cookie = Cookie::build((cookie_name, token))
        .path("/")
        .http_only(true)
        .secure(secure)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(VISITOR_COOKIE_DAYS))
        .build();
    (jar.add(cookie), hash)
}

fn validate_comment_email(value: Option<&str>) -> Result<(), AppError> {
    let Some(value) = value else {
        return Ok(());
    };
    let valid = (3..=254).contains(&value.len())
        && value
            .find('@')
            .is_some_and(|at| at > 0 && at + 1 < value.len());
    if valid {
        Ok(())
    } else {
        Err(AppError::InvalidRequest("评论邮箱格式无效"))
    }
}

pub(crate) fn comment_avatar_url(website: Option<&str>, email: Option<&str>) -> String {
    if let Some(host) = website
        .and_then(|value| value.parse::<Uri>().ok())
        .and_then(|uri| uri.host().map(str::to_owned))
    {
        return format!("https://{host}/favicon.ico");
    }
    if let Some(email) = email {
        let digest = Sha256::digest(email.trim().to_lowercase().as_bytes());
        return format!("https://www.gravatar.com/avatar/{digest:x}?d=404");
    }
    String::new()
}

fn validate_website(value: Option<&str>) -> Result<(), AppError> {
    let Some(value) = value else {
        return Ok(());
    };
    let uri = value
        .parse::<Uri>()
        .map_err(|_| AppError::InvalidRequest("评论网站 URL 无效"))?;
    if !matches!(uri.scheme_str(), Some("http" | "https")) || uri.authority().is_none() {
        return Err(AppError::InvalidRequest(
            "评论网站 URL 必须使用 http 或 https",
        ));
    }
    Ok(())
}

fn validate_friend_link_url(value: &str) -> Result<(), AppError> {
    let uri = value
        .parse::<Uri>()
        .map_err(|_| AppError::InvalidRequest("友链 URL 无效"))?;
    if !matches!(uri.scheme_str(), Some("http" | "https")) || uri.authority().is_none() {
        return Err(AppError::InvalidRequest("友链 URL 必须使用 http 或 https"));
    }
    Ok(())
}

fn stable_rate_key(value: &str) -> sea_orm::prelude::Uuid {
    let digest = Sha256::digest(value.as_bytes());
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    sea_orm::prelude::Uuid::from_bytes(bytes)
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

fn capture_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.chars().take(512).collect())
}

impl From<comments::Model> for PublicCommentResponse {
    fn from(model: comments::Model) -> Self {
        let avatar_url = comment_avatar_url(model.website.as_deref(), model.email.as_deref());
        let agent_label = crate::markup::agent_label(model.user_agent.as_deref().unwrap_or(""));
        Self {
            id: model.id,
            parent_id: model.parent_id,
            display_name: model.display_name,
            email: model.email,
            avatar_url,
            agent_label,
            website: model.website,
            content: model.content,
            created_at: model.created_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_comment_website_protocol() {
        assert!(validate_website(None).is_ok());
        assert!(validate_website(Some("https://example.com")).is_ok());
        assert!(validate_website(Some("file:///etc/passwd")).is_err());
    }

    #[test]
    fn validates_optional_comment_email() {
        assert!(validate_comment_email(None).is_ok());
        assert!(validate_comment_email(Some("a@b.co")).is_ok());
        assert!(validate_comment_email(Some("ab")).is_err());
        assert!(validate_comment_email(Some("@example.com")).is_err());
        assert!(validate_comment_email(Some("missing-at")).is_err());
        assert!(validate_comment_email(Some("trailing@")).is_err());
    }

    #[test]
    fn avatar_url_prefers_website_favicon_then_gravatar() {
        assert_eq!(
            comment_avatar_url(Some("https://example.com/blog"), Some("a@b.co")),
            "https://example.com/favicon.ico"
        );
        let gravatar = comment_avatar_url(None, Some(" A@B.co "));
        assert!(gravatar.starts_with("https://www.gravatar.com/avatar/"));
        assert!(gravatar.ends_with("?d=404"));
        assert_eq!(comment_avatar_url(None, None), "");
        assert_eq!(comment_avatar_url(Some("not a url"), None), "");
    }

    #[test]
    fn validates_friend_link_protocol() {
        assert!(validate_friend_link_url("https://example.com").is_ok());
        assert!(validate_friend_link_url("javascript:alert(1)").is_err());
        assert!(validate_friend_link_url("/relative").is_err());
    }

    #[test]
    fn excerpts_never_exceed_database_limit() {
        assert_eq!(excerpt("abcd", 4), "abcd");
        assert_eq!(excerpt("abcde", 4), "abc…");
        assert_eq!(excerpt("测试文本内容", 4).chars().count(), 4);
    }

    #[test]
    fn visitor_cookie_reuses_stable_hash() {
        let state = AppState::for_test();
        let (jar, first) = visitor_identity(&state, CookieJar::new());
        let (_, second) = visitor_identity(&state, jar);
        assert_eq!(first, second);
        assert_eq!(first.len(), 32);
    }
}
