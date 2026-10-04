use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, Uri},
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, FixedOffset, Utc};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, ConnectionTrait, DatabaseBackend,
    DatabaseTransaction, EntityTrait, IntoActiveModel, QueryFilter, QueryOrder, QuerySelect, Set,
    Statement, TransactionTrait, prelude::Uuid,
};
use serde::{Deserialize, Serialize};

use crate::{
    AppState, auth,
    entities::{
        article_tags, articles, categories, comments, dynamics, friend_links, media_assets, tags,
    },
    error::AppError,
    media::MediaResponse,
};

#[derive(Debug, Deserialize)]
pub struct CategoryWrite {
    name: String,
    slug: String,
    description: Option<String>,
    sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct CategoryResponse {
    id: Uuid,
    name: String,
    slug: String,
    description: Option<String>,
    sort_order: i32,
}

pub async fn list_categories(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<CategoryResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = categories::Entity::find()
        .order_by_asc(categories::Column::SortOrder)
        .order_by_asc(categories::Column::Name)
        .all(&state.database)
        .await?;
    Ok(Json(
        models.into_iter().map(CategoryResponse::from).collect(),
    ))
}

pub async fn create_category(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<CategoryWrite>,
) -> Result<Json<CategoryResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = categories::ActiveModel {
        id: NotSet,
        name: Set(input.name),
        slug: Set(input.slug),
        description: Set(input.description),
        sort_order: Set(input.sort_order),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&state.database)
    .await?;
    Ok(Json(model.into()))
}

pub async fn update_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<CategoryWrite>,
) -> Result<Json<CategoryResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = categories::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.name = Set(input.name);
    active.slug = Set(input.slug);
    active.description = Set(input.description);
    active.sort_order = Set(input.sort_order);
    Ok(Json(active.update(&state.database).await?.into()))
}

pub async fn delete_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let result = categories::Entity::delete_by_id(id)
        .exec(&state.database)
        .await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct TagWrite {
    name: String,
    slug: String,
}

#[derive(Debug, Serialize)]
pub struct TagResponse {
    id: Uuid,
    name: String,
    slug: String,
}

pub async fn list_tags(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<TagResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = tags::Entity::find()
        .order_by_asc(tags::Column::Name)
        .all(&state.database)
        .await?;
    Ok(Json(models.into_iter().map(TagResponse::from).collect()))
}

pub async fn create_tag(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<TagWrite>,
) -> Result<Json<TagResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = tags::ActiveModel {
        id: NotSet,
        name: Set(input.name),
        slug: Set(input.slug),
        created_at: NotSet,
    }
    .insert(&state.database)
    .await?;
    Ok(Json(model.into()))
}

pub async fn update_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<TagWrite>,
) -> Result<Json<TagResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = tags::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.name = Set(input.name);
    active.slug = Set(input.slug);
    Ok(Json(active.update(&state.database).await?.into()))
}

pub async fn delete_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let result = tags::Entity::delete_by_id(id).exec(&state.database).await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ArticleWrite {
    category_id: Uuid,
    cover_media_id: Option<Uuid>,
    title: String,
    slug: String,
    summary: Option<String>,
    body_markdown: String,
    allow_comments: bool,
    #[serde(default)]
    tag_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ArticleResponse {
    id: Uuid,
    category_id: Uuid,
    cover_media_id: Option<Uuid>,
    title: String,
    slug: String,
    summary: Option<String>,
    body_markdown: String,
    status: String,
    allow_comments: bool,
    published_at: Option<DateTime<FixedOffset>>,
    created_at: DateTime<FixedOffset>,
    updated_at: DateTime<FixedOffset>,
    tag_ids: Vec<Uuid>,
}

pub async fn list_articles(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<ArticleResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = articles::Entity::find()
        .order_by_desc(articles::Column::CreatedAt)
        .all(&state.database)
        .await?;
    let mut responses = Vec::with_capacity(models.len());
    for model in models {
        responses.push(article_response(&state, model).await?);
    }
    Ok(Json(responses))
}

pub async fn get_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    jar: CookieJar,
) -> Result<Json<ArticleResponse>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let model = articles::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(article_response(&state, model).await?))
}

pub async fn create_article(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<ArticleWrite>,
) -> Result<Json<ArticleResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    validate_cover(&transaction, input.cover_media_id).await?;
    let model = articles::ActiveModel {
        id: NotSet,
        category_id: Set(input.category_id),
        cover_media_id: Set(input.cover_media_id),
        title: Set(input.title),
        slug: Set(input.slug),
        summary: Set(input.summary),
        body_markdown: Set(input.body_markdown),
        status: Set("draft".to_owned()),
        allow_comments: Set(input.allow_comments),
        published_at: Set(None),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&transaction)
    .await?;
    replace_article_tags(&transaction, model.id, input.tag_ids).await?;
    transaction.commit().await?;
    Ok(Json(article_response(&state, model).await?))
}

pub async fn update_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<ArticleWrite>,
) -> Result<Json<ArticleResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    let model = articles::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    validate_cover(&transaction, input.cover_media_id).await?;
    let mut active = model.into_active_model();
    active.category_id = Set(input.category_id);
    active.cover_media_id = Set(input.cover_media_id);
    active.title = Set(input.title);
    active.slug = Set(input.slug);
    active.summary = Set(input.summary);
    active.body_markdown = Set(input.body_markdown);
    active.allow_comments = Set(input.allow_comments);
    let model = active.update(&transaction).await?;
    replace_article_tags(&transaction, id, input.tag_ids).await?;
    transaction.commit().await?;
    Ok(Json(article_response(&state, model).await?))
}

pub async fn delete_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let result = articles::Entity::delete_by_id(id)
        .exec(&state.database)
        .await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn publish_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<Json<ArticleResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    let model = articles::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    let model = if model.status == "published" {
        model
    } else {
        let mut active = model.into_active_model();
        active.status = Set("published".to_owned());
        active.published_at = Set(Some(Utc::now().fixed_offset()));
        let model = active.update(&transaction).await?;
        queue_article_delivery(&transaction, id).await?;
        model
    };
    transaction.commit().await?;
    Ok(Json(article_response(&state, model).await?))
}

pub async fn withdraw_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<Json<ArticleResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    let model = articles::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.status = Set("draft".to_owned());
    active.published_at = Set(None);
    let model = active.update(&transaction).await?;
    cancel_delivery(&transaction, "article_id", id).await?;
    transaction.commit().await?;
    Ok(Json(article_response(&state, model).await?))
}

#[derive(Debug, Deserialize)]
pub struct DynamicWrite {
    content_markdown: String,
    allow_comments: bool,
}

#[derive(Debug, Serialize)]
pub struct DynamicResponse {
    id: Uuid,
    content_markdown: String,
    status: String,
    allow_comments: bool,
    published_at: Option<DateTime<FixedOffset>>,
    created_at: DateTime<FixedOffset>,
    updated_at: DateTime<FixedOffset>,
}

pub async fn list_dynamics(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<DynamicResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = dynamics::Entity::find()
        .order_by_desc(dynamics::Column::CreatedAt)
        .all(&state.database)
        .await?;
    Ok(Json(
        models.into_iter().map(DynamicResponse::from).collect(),
    ))
}

pub async fn create_dynamic(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<DynamicWrite>,
) -> Result<Json<DynamicResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = dynamics::ActiveModel {
        id: NotSet,
        content_markdown: Set(input.content_markdown),
        status: Set("draft".to_owned()),
        allow_comments: Set(input.allow_comments),
        published_at: Set(None),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&state.database)
    .await?;
    Ok(Json(model.into()))
}

pub async fn get_dynamic(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    jar: CookieJar,
) -> Result<Json<DynamicResponse>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let model = dynamics::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(model.into()))
}

pub async fn update_dynamic(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<DynamicWrite>,
) -> Result<Json<DynamicResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = dynamics::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.content_markdown = Set(input.content_markdown);
    active.allow_comments = Set(input.allow_comments);
    Ok(Json(active.update(&state.database).await?.into()))
}

pub async fn delete_dynamic(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let result = dynamics::Entity::delete_by_id(id)
        .exec(&state.database)
        .await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn publish_dynamic(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<Json<DynamicResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    let model = dynamics::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    let model = if model.status == "published" {
        model
    } else {
        let mut active = model.into_active_model();
        active.status = Set("published".to_owned());
        active.published_at = Set(Some(Utc::now().fixed_offset()));
        let model = active.update(&transaction).await?;
        queue_dynamic_delivery(&transaction, id).await?;
        model
    };
    transaction.commit().await?;
    Ok(Json(model.into()))
}

pub async fn withdraw_dynamic(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<Json<DynamicResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    let model = dynamics::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.status = Set("draft".to_owned());
    active.published_at = Set(None);
    let model = active.update(&transaction).await?;
    cancel_delivery(&transaction, "dynamic_id", id).await?;
    transaction.commit().await?;
    Ok(Json(model.into()))
}

#[derive(Debug, Deserialize)]
pub struct CommentStatusWrite {
    status: String,
}

#[derive(Debug, Serialize)]
pub struct CommentResponse {
    id: Uuid,
    article_id: Option<Uuid>,
    dynamic_id: Option<Uuid>,
    parent_id: Option<Uuid>,
    display_name: String,
    email: String,
    website: Option<String>,
    content: String,
    status: String,
    created_at: DateTime<FixedOffset>,
}

pub async fn list_comments(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<CommentResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = comments::Entity::find()
        .order_by_desc(comments::Column::CreatedAt)
        .all(&state.database)
        .await?;
    Ok(Json(
        models.into_iter().map(CommentResponse::from).collect(),
    ))
}

pub async fn update_comment_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<CommentStatusWrite>,
) -> Result<Json<CommentResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = comments::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.status = Set(input.status);
    Ok(Json(active.update(&state.database).await?.into()))
}

pub async fn delete_comment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let result = comments::Entity::delete_by_id(id)
        .exec(&state.database)
        .await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct FriendLinkWrite {
    avatar_media_id: Option<Uuid>,
    name: String,
    url: String,
    description: Option<String>,
    is_visible: bool,
    sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct FriendLinkResponse {
    id: Uuid,
    avatar_media_id: Option<Uuid>,
    name: String,
    url: String,
    description: Option<String>,
    is_visible: bool,
    sort_order: i32,
}

pub async fn list_friend_links(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<FriendLinkResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = friend_links::Entity::find()
        .order_by_asc(friend_links::Column::SortOrder)
        .all(&state.database)
        .await?;
    Ok(Json(
        models.into_iter().map(FriendLinkResponse::from).collect(),
    ))
}

pub async fn create_friend_link(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<FriendLinkWrite>,
) -> Result<Json<FriendLinkResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    validate_http_url(&input.url)?;
    let model = friend_links::ActiveModel {
        id: NotSet,
        avatar_media_id: Set(input.avatar_media_id),
        name: Set(input.name),
        url: Set(input.url),
        description: Set(input.description),
        is_visible: Set(input.is_visible),
        sort_order: Set(input.sort_order),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&state.database)
    .await?;
    Ok(Json(model.into()))
}

pub async fn update_friend_link(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<FriendLinkWrite>,
) -> Result<Json<FriendLinkResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    validate_http_url(&input.url)?;
    let model = friend_links::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.avatar_media_id = Set(input.avatar_media_id);
    active.name = Set(input.name);
    active.url = Set(input.url);
    active.description = Set(input.description);
    active.is_visible = Set(input.is_visible);
    active.sort_order = Set(input.sort_order);
    Ok(Json(active.update(&state.database).await?.into()))
}

pub async fn delete_friend_link(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(), AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let result = friend_links::Entity::delete_by_id(id)
        .exec(&state.database)
        .await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn list_media(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<MediaResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = media_assets::Entity::find()
        .order_by_desc(media_assets::Column::CreatedAt)
        .all(&state.database)
        .await?;
    Ok(Json(models.into_iter().map(MediaResponse::from).collect()))
}

async fn validate_cover(
    transaction: &DatabaseTransaction,
    cover_media_id: Option<Uuid>,
) -> Result<(), AppError> {
    let Some(id) = cover_media_id else {
        return Ok(());
    };
    let media = media_assets::Entity::find_by_id(id)
        .one(transaction)
        .await?
        .ok_or(AppError::InvalidRequest("封面媒体不存在"))?;
    if !media.media_type.starts_with("image/") {
        return Err(AppError::InvalidRequest("文章封面必须是图片"));
    }
    Ok(())
}

async fn replace_article_tags(
    transaction: &DatabaseTransaction,
    article_id: Uuid,
    mut tag_ids: Vec<Uuid>,
) -> Result<(), AppError> {
    tag_ids.sort_unstable();
    tag_ids.dedup();
    article_tags::Entity::delete_many()
        .filter(article_tags::Column::ArticleId.eq(article_id))
        .exec(transaction)
        .await?;
    for tag_id in tag_ids {
        article_tags::ActiveModel {
            article_id: Set(article_id),
            tag_id: Set(tag_id),
        }
        .insert(transaction)
        .await?;
    }
    Ok(())
}

async fn article_response(
    state: &AppState,
    article: articles::Model,
) -> Result<ArticleResponse, AppError> {
    let tag_ids = article_tags::Entity::find()
        .filter(article_tags::Column::ArticleId.eq(article.id))
        .order_by_asc(article_tags::Column::TagId)
        .all(&state.database)
        .await?
        .into_iter()
        .map(|model| model.tag_id)
        .collect();
    Ok(ArticleResponse {
        id: article.id,
        category_id: article.category_id,
        cover_media_id: article.cover_media_id,
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        body_markdown: article.body_markdown,
        status: article.status,
        allow_comments: article.allow_comments,
        published_at: article.published_at,
        created_at: article.created_at,
        updated_at: article.updated_at,
        tag_ids,
    })
}

async fn queue_article_delivery(
    transaction: &DatabaseTransaction,
    article_id: Uuid,
) -> Result<(), AppError> {
    transaction
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
INSERT INTO email_deliveries (subscriber_id, kind, article_id)
SELECT id, 'article_published', $1
FROM subscribers
WHERE status = 'active' AND subscribe_articles
ON CONFLICT (subscriber_id, article_id) WHERE article_id IS NOT NULL
DO UPDATE SET status = 'pending',
              attempt_count = 0,
              next_attempt_at = now(),
              locked_at = NULL,
              last_error = NULL,
              sent_at = NULL
WHERE email_deliveries.status = 'cancelled'
"#,
            [article_id.into()],
        ))
        .await?;
    Ok(())
}

async fn queue_dynamic_delivery(
    transaction: &DatabaseTransaction,
    dynamic_id: Uuid,
) -> Result<(), AppError> {
    transaction
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
INSERT INTO email_deliveries (subscriber_id, kind, dynamic_id)
SELECT id, 'dynamic_published', $1
FROM subscribers
WHERE status = 'active' AND subscribe_dynamics
ON CONFLICT (subscriber_id, dynamic_id) WHERE dynamic_id IS NOT NULL
DO UPDATE SET status = 'pending',
              attempt_count = 0,
              next_attempt_at = now(),
              locked_at = NULL,
              last_error = NULL,
              sent_at = NULL
WHERE email_deliveries.status = 'cancelled'
"#,
            [dynamic_id.into()],
        ))
        .await?;
    Ok(())
}

async fn cancel_delivery(
    transaction: &DatabaseTransaction,
    target_column: &'static str,
    target_id: Uuid,
) -> Result<(), AppError> {
    let sql = format!(
        "UPDATE email_deliveries SET status = 'cancelled', locked_at = NULL \
         WHERE {target_column} = $1 AND status IN ('pending', 'failed', 'sending')"
    );
    transaction
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            sql,
            [target_id.into()],
        ))
        .await?;
    Ok(())
}

fn validate_http_url(value: &str) -> Result<(), AppError> {
    let uri = value
        .parse::<Uri>()
        .map_err(|_| AppError::InvalidRequest("友链 URL 无效"))?;
    if !matches!(uri.scheme_str(), Some("http" | "https")) || uri.authority().is_none() {
        return Err(AppError::InvalidRequest("友链 URL 必须使用 http 或 https"));
    }
    Ok(())
}

impl From<categories::Model> for CategoryResponse {
    fn from(model: categories::Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
            slug: model.slug,
            description: model.description,
            sort_order: model.sort_order,
        }
    }
}

impl From<tags::Model> for TagResponse {
    fn from(model: tags::Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
            slug: model.slug,
        }
    }
}

impl From<dynamics::Model> for DynamicResponse {
    fn from(model: dynamics::Model) -> Self {
        Self {
            id: model.id,
            content_markdown: model.content_markdown,
            status: model.status,
            allow_comments: model.allow_comments,
            published_at: model.published_at,
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}

impl From<comments::Model> for CommentResponse {
    fn from(model: comments::Model) -> Self {
        Self {
            id: model.id,
            article_id: model.article_id,
            dynamic_id: model.dynamic_id,
            parent_id: model.parent_id,
            display_name: model.display_name,
            email: model.email,
            website: model.website,
            content: model.content,
            status: model.status,
            created_at: model.created_at,
        }
    }
}

impl From<friend_links::Model> for FriendLinkResponse {
    fn from(model: friend_links::Model) -> Self {
        Self {
            id: model.id,
            avatar_media_id: model.avatar_media_id,
            name: model.name,
            url: model.url,
            description: model.description,
            is_visible: model.is_visible,
            sort_order: model.sort_order,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_http_friend_links() {
        assert!(validate_http_url("https://example.com/path").is_ok());
        assert!(validate_http_url("javascript:alert(1)").is_err());
        assert!(validate_http_url("/relative").is_err());
    }
}
