use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, Uri},
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, FixedOffset, Utc};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, ConnectionTrait, DatabaseBackend,
    DatabaseTransaction, EntityTrait, IntoActiveModel, PaginatorTrait, QueryFilter, QueryOrder,
    QuerySelect, Set, Statement, TransactionTrait, prelude::Uuid,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{
    AppState, auth,
    entities::{
        article_tags, articles, categories, comments, dynamic_media, dynamics, friend_links,
        media_assets, tags,
    },
    error::AppError,
    ops::media::MediaResponse,
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

// deny_unknown_fields：拼错或用 camelCase 的字段必须立刻 422，不能静默丢弃——
// 生产事故根因：客户端发 coverMediaId 时被 serde 忽略，cover_media_id 落为
// None，每次保存都把已绑定的封面清成 NULL 且返回 200。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArticleWrite {
    category_id: Uuid,
    #[serde(alias = "coverMediaId")]
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
    featured_at: Option<DateTime<FixedOffset>>,
    created_at: DateTime<FixedOffset>,
    updated_at: DateTime<FixedOffset>,
    tag_ids: Vec<Uuid>,
}

#[derive(Debug, Default, Deserialize)]
pub struct PublishWrite {
    published_at: Option<DateTime<FixedOffset>>,
}

#[derive(Debug, Deserialize)]
pub struct FeaturedWrite {
    featured: bool,
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
        featured_at: Set(None),
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
    input: Option<Json<PublishWrite>>,
) -> Result<Json<ArticleResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let publish_at = resolve_publish_at(input.map(|Json(input)| input), Utc::now().fixed_offset());
    let transaction = state.database.begin().await?;
    let model = articles::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    let model = if model.status == "published"
        && model
            .published_at
            .is_some_and(|published_at| published_at <= Utc::now().fixed_offset())
    {
        model
    } else {
        let mut active = model.into_active_model();
        active.status = Set("published".to_owned());
        active.published_at = Set(Some(publish_at));
        let model = active.update(&transaction).await?;
        queue_article_delivery(&transaction, id, publish_at).await?;
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
    active.featured_at = Set(None);
    let model = active.update(&transaction).await?;
    cancel_delivery(&transaction, "article_id", id).await?;
    transaction.commit().await?;
    Ok(Json(article_response(&state, model).await?))
}

pub async fn set_article_featured(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<FeaturedWrite>,
) -> Result<Json<ArticleResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let model = articles::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.featured_at = Set(if input.featured {
        Some(Utc::now().fixed_offset())
    } else {
        None
    });
    let model = active.update(&state.database).await?;
    Ok(Json(article_response(&state, model).await?))
}

#[derive(Debug, Deserialize)]
pub struct DynamicWrite {
    content_markdown: String,
    allow_comments: bool,
    #[serde(default)]
    mood: Option<String>,
    #[serde(default)]
    media_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize)]
pub struct DynamicMediaItem {
    id: Uuid,
    url: String,
    original_name: String,
    media_type: String,
    width: Option<i32>,
    height: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct DynamicResponse {
    id: Uuid,
    content_markdown: String,
    mood: Option<String>,
    status: String,
    allow_comments: bool,
    published_at: Option<DateTime<FixedOffset>>,
    created_at: DateTime<FixedOffset>,
    updated_at: DateTime<FixedOffset>,
    media: Vec<DynamicMediaItem>,
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
    let mut media = load_dynamics_media(
        &state.database,
        models.iter().map(|model| model.id).collect(),
    )
    .await?;
    Ok(Json(
        models
            .into_iter()
            .map(|model| {
                let media = media.remove(&model.id).unwrap_or_default();
                dynamic_response_from(model, media)
            })
            .collect(),
    ))
}

pub async fn create_dynamic(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<DynamicWrite>,
) -> Result<Json<DynamicResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    let model = dynamics::ActiveModel {
        id: NotSet,
        content_markdown: Set(input.content_markdown),
        mood: Set(normalize_mood(input.mood)?),
        status: Set("draft".to_owned()),
        allow_comments: Set(input.allow_comments),
        published_at: Set(None),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&transaction)
    .await?;
    if let Some(media_ids) = input.media_ids {
        replace_dynamic_media(&transaction, model.id, &media_ids).await?;
    }
    transaction.commit().await?;
    dynamic_response(&state, model).await.map(Json)
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
    dynamic_response(&state, model).await.map(Json)
}

pub async fn update_dynamic(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(input): Json<DynamicWrite>,
) -> Result<Json<DynamicResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let transaction = state.database.begin().await?;
    let model = dynamics::Entity::find_by_id(id)
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.content_markdown = Set(input.content_markdown);
    active.mood = Set(normalize_mood(input.mood)?);
    active.allow_comments = Set(input.allow_comments);
    let model = active.update(&transaction).await?;
    if let Some(media_ids) = input.media_ids {
        replace_dynamic_media(&transaction, id, &media_ids).await?;
    }
    transaction.commit().await?;
    dynamic_response(&state, model).await.map(Json)
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
    input: Option<Json<PublishWrite>>,
) -> Result<Json<DynamicResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    let publish_at = resolve_publish_at(input.map(|Json(input)| input), Utc::now().fixed_offset());
    let transaction = state.database.begin().await?;
    let model = dynamics::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&transaction)
        .await?
        .ok_or(AppError::NotFound)?;
    let model = if model.status == "published"
        && model
            .published_at
            .is_some_and(|published_at| published_at <= Utc::now().fixed_offset())
    {
        model
    } else {
        let mut active = model.into_active_model();
        active.status = Set("published".to_owned());
        active.published_at = Set(Some(publish_at));
        let model = active.update(&transaction).await?;
        queue_dynamic_delivery(&transaction, id, publish_at).await?;
        model
    };
    transaction.commit().await?;
    dynamic_response(&state, model).await.map(Json)
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
    dynamic_response(&state, model).await.map(Json)
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
    email: Option<String>,
    website: Option<String>,
    content: String,
    user_agent: Option<String>,
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
    if !matches!(input.status.as_str(), "pending" | "visible" | "hidden") {
        return Err(AppError::BadRequest("评论状态必须是 pending、visible 或 hidden"));
    }
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
    avatar_url: Option<String>,
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
    avatar_url: Option<String>,
    name: String,
    url: String,
    description: Option<String>,
    application_email: Option<String>,
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
    validate_optional_http_url(input.avatar_url.as_deref())?;
    let model = friend_links::ActiveModel {
        id: NotSet,
        avatar_media_id: Set(input.avatar_media_id),
        avatar_url: Set(normalize_optional_http_url(input.avatar_url)),
        name: Set(input.name),
        url: Set(input.url),
        description: Set(input.description),
        application_email: Set(None),
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
    validate_optional_http_url(input.avatar_url.as_deref())?;
    let model = friend_links::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut active = model.into_active_model();
    active.avatar_media_id = Set(input.avatar_media_id);
    active.avatar_url = Set(normalize_optional_http_url(input.avatar_url));
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
        featured_at: article.featured_at,
        created_at: article.created_at,
        updated_at: article.updated_at,
        tag_ids,
    })
}

async fn queue_article_delivery(
    transaction: &DatabaseTransaction,
    article_id: Uuid,
    publish_at: DateTime<FixedOffset>,
) -> Result<(), AppError> {
    if !crate::ops::subscriptions::mail_enabled() {
        return Ok(());
    }
    transaction
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
INSERT INTO email_deliveries (subscriber_id, kind, article_id, next_attempt_at)
SELECT id, 'article_published', $1, $2
FROM subscribers
WHERE status = 'active' AND subscribe_articles
ON CONFLICT (subscriber_id, article_id) WHERE article_id IS NOT NULL
DO UPDATE SET status = 'pending',
              attempt_count = 0,
              next_attempt_at = EXCLUDED.next_attempt_at,
              locked_at = NULL,
              last_error = NULL,
              sent_at = NULL
WHERE email_deliveries.status IN ('cancelled', 'pending', 'failed')
"#,
            [article_id.into(), publish_at.into()],
        ))
        .await?;
    Ok(())
}

async fn queue_dynamic_delivery(
    transaction: &DatabaseTransaction,
    dynamic_id: Uuid,
    publish_at: DateTime<FixedOffset>,
) -> Result<(), AppError> {
    if !crate::ops::subscriptions::mail_enabled() {
        return Ok(());
    }
    transaction
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
INSERT INTO email_deliveries (subscriber_id, kind, dynamic_id, next_attempt_at)
SELECT id, 'dynamic_published', $1, $2
FROM subscribers
WHERE status = 'active' AND subscribe_dynamics
ON CONFLICT (subscriber_id, dynamic_id) WHERE dynamic_id IS NOT NULL
DO UPDATE SET status = 'pending',
              attempt_count = 0,
              next_attempt_at = EXCLUDED.next_attempt_at,
              locked_at = NULL,
              last_error = NULL,
              sent_at = NULL
WHERE email_deliveries.status IN ('cancelled', 'pending', 'failed')
"#,
            [dynamic_id.into(), publish_at.into()],
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

fn validate_optional_http_url(value: Option<&str>) -> Result<(), AppError> {
    match value {
        Some(url) if !url.trim().is_empty() => validate_http_url(url),
        _ => Ok(()),
    }
}

fn normalize_optional_http_url(value: Option<String>) -> Option<String> {
    value.and_then(|url| {
        let trimmed = url.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_owned())
    })
}

fn resolve_publish_at(
    input: Option<PublishWrite>,
    now: DateTime<FixedOffset>,
) -> DateTime<FixedOffset> {
    input.and_then(|input| input.published_at).unwrap_or(now)
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

fn dynamic_response_from(model: dynamics::Model, media: Vec<DynamicMediaItem>) -> DynamicResponse {
    DynamicResponse {
        id: model.id,
        content_markdown: model.content_markdown,
        mood: model.mood,
        status: model.status,
        allow_comments: model.allow_comments,
        published_at: model.published_at,
        created_at: model.created_at,
        updated_at: model.updated_at,
        media,
    }
}

async fn dynamic_response(
    state: &AppState,
    model: dynamics::Model,
) -> Result<DynamicResponse, AppError> {
    let media = load_dynamics_media(&state.database, vec![model.id])
        .await?
        .remove(&model.id)
        .unwrap_or_default();
    Ok(dynamic_response_from(model, media))
}

async fn load_dynamics_media(
    database: &sea_orm::DatabaseConnection,
    dynamic_ids: Vec<Uuid>,
) -> Result<HashMap<Uuid, Vec<DynamicMediaItem>>, AppError> {
    if dynamic_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let attachments = dynamic_media::Entity::find()
        .filter(dynamic_media::Column::DynamicId.is_in(dynamic_ids))
        .order_by_asc(dynamic_media::Column::Position)
        .all(database)
        .await?;
    let media = media_assets::Entity::find()
        .filter(
            media_assets::Column::Id.is_in(attachments.iter().map(|row| row.media_id).collect::<Vec<_>>()),
        )
        .all(database)
        .await?
        .into_iter()
        .map(|media| (media.id, media))
        .collect::<HashMap<_, _>>();
    let mut grouped: HashMap<Uuid, Vec<DynamicMediaItem>> = HashMap::new();
    for attachment in attachments {
        let Some(media) = media.get(&attachment.media_id) else {
            continue;
        };
        grouped
            .entry(attachment.dynamic_id)
            .or_default()
            .push(DynamicMediaItem {
                id: media.id,
                url: format!("/media/{}", media.storage_key),
                original_name: media.original_name.clone(),
                media_type: media.media_type.clone(),
                width: media.width,
                height: media.height,
            });
    }
    Ok(grouped)
}

fn normalize_mood(input: Option<String>) -> Result<Option<String>, AppError> {
    let Some(mood) = input else {
        return Ok(None);
    };
    let trimmed = mood.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if trimmed.chars().count() > 40 {
        return Err(AppError::InvalidRequest("心情最长 40 字"));
    }
    Ok(Some(trimmed.to_owned()))
}

fn validate_dynamic_media_shape(media_ids: &[Uuid]) -> Result<(), AppError> {
    if media_ids.len() > 9 {
        return Err(AppError::InvalidRequest("动态配图最多 9 张"));
    }
    let mut seen = std::collections::HashSet::with_capacity(media_ids.len());
    if !media_ids.iter().all(|id| seen.insert(id)) {
        return Err(AppError::InvalidRequest("动态配图不能重复"));
    }
    Ok(())
}

async fn ensure_dynamic_media_exists(
    connection: &DatabaseTransaction,
    media_ids: &[Uuid],
) -> Result<(), AppError> {
    validate_dynamic_media_shape(media_ids)?;
    let count = media_assets::Entity::find()
        .filter(media_assets::Column::Id.is_in(media_ids.to_vec()))
        .count(connection)
        .await?;
    if count != media_ids.len() as u64 {
        return Err(AppError::InvalidRequest("动态配图包含不存在的媒体"));
    }
    Ok(())
}

fn dynamic_media_models(dynamic_id: Uuid, media_ids: &[Uuid]) -> Vec<dynamic_media::ActiveModel> {
    media_ids
        .iter()
        .enumerate()
        .map(|(position, media_id)| dynamic_media::ActiveModel {
            dynamic_id: Set(dynamic_id),
            media_id: Set(*media_id),
            position: Set(position as i16),
        })
        .collect()
}

async fn replace_dynamic_media(
    transaction: &DatabaseTransaction,
    dynamic_id: Uuid,
    media_ids: &[Uuid],
) -> Result<(), AppError> {
    ensure_dynamic_media_exists(transaction, media_ids).await?;
    dynamic_media::Entity::delete_many()
        .filter(dynamic_media::Column::DynamicId.eq(dynamic_id))
        .exec(transaction)
        .await?;
    for model in dynamic_media_models(dynamic_id, media_ids) {
        model.insert(transaction).await?;
    }
    Ok(())
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
            user_agent: model.user_agent,
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
            avatar_url: model.avatar_url,
            name: model.name,
            url: model.url,
            description: model.description,
            application_email: model.application_email,
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

    #[test]
    fn publish_time_defaults_to_now_and_accepts_future_time() {
        let now = Utc::now().fixed_offset();
        assert_eq!(resolve_publish_at(None, now), now);
        let future = now + chrono::Duration::hours(2);
        assert_eq!(
            resolve_publish_at(
                Some(PublishWrite {
                    published_at: Some(future),
                }),
                now,
            ),
            future
        );
    }

    #[test]
    fn mood_is_trimmed_blank_becomes_none_and_long_is_rejected() {
        assert_eq!(normalize_mood(None).unwrap(), None);
        assert_eq!(normalize_mood(Some("   ".to_owned())).unwrap(), None);
        assert_eq!(
            normalize_mood(Some("  放晴  ".to_owned())).unwrap(),
            Some("放晴".to_owned())
        );
        assert!(normalize_mood(Some("很长".repeat(21))).is_err());
    }

    #[test]
    fn dynamic_media_shape_limits_count_and_rejects_duplicates() {
        let nine: Vec<Uuid> = (1..=9).map(Uuid::from_u128).collect();
        assert!(validate_dynamic_media_shape(&nine).is_ok());

        let ten: Vec<Uuid> = (1..=10).map(Uuid::from_u128).collect();
        assert!(validate_dynamic_media_shape(&ten).is_err());

        let mut duplicated = nine.clone();
        duplicated[8] = nine[0];
        assert!(validate_dynamic_media_shape(&duplicated).is_err());
    }

    #[test]
    fn dynamic_media_models_preserve_order_as_position() {
        let dynamic_id = Uuid::from_u128(100);
        let media_ids: Vec<Uuid> = [3_u128, 1, 2].into_iter().map(Uuid::from_u128).collect();
        let models = dynamic_media_models(dynamic_id, &media_ids);
        assert_eq!(models.len(), 3);
        for (position, model) in models.iter().enumerate() {
            assert_eq!(model.dynamic_id.clone().unwrap(), dynamic_id);
            assert_eq!(model.media_id.clone().unwrap(), media_ids[position]);
            assert_eq!(model.position.clone().unwrap(), position as i16);
        }
    }

    fn article_write_payload() -> serde_json::Value {
        serde_json::json!({
            "category_id": Uuid::from_u128(1),
            "cover_media_id": null,
            "title": "标题",
            "slug": "hello",
            "summary": null,
            "body_markdown": "正文",
            "allow_comments": true,
            "tag_ids": []
        })
    }

    #[test]
    fn article_write_accepts_snake_and_camel_cover_keys() {
        let mut payload = article_write_payload();
        payload["cover_media_id"] = serde_json::json!(Uuid::from_u128(42));
        let parsed: ArticleWrite = serde_json::from_value(payload).unwrap();
        assert_eq!(parsed.cover_media_id, Some(Uuid::from_u128(42)));

        // 回归：camelCase 客户端的 coverMediaId 不得再被静默丢弃
        let mut payload = article_write_payload();
        payload.as_object_mut().unwrap().remove("cover_media_id");
        payload["coverMediaId"] = serde_json::json!(Uuid::from_u128(42));
        let parsed: ArticleWrite = serde_json::from_value(payload).unwrap();
        assert_eq!(parsed.cover_media_id, Some(Uuid::from_u128(42)));
    }

    #[test]
    fn article_write_rejects_unknown_fields_instead_of_silently_dropping() {
        let mut payload = article_write_payload();
        payload["coverMediaid"] = serde_json::json!(Uuid::from_u128(42));
        assert!(serde_json::from_value::<ArticleWrite>(payload).is_err());

        let mut payload = article_write_payload();
        payload["cover_media_ids"] = serde_json::json!(Uuid::from_u128(42));
        assert!(serde_json::from_value::<ArticleWrite>(payload).is_err());
    }
}
