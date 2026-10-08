use std::{collections::HashMap, net::SocketAddr, time::Duration};

use axum::{
    Json,
    extract::{ConnectInfo, Path, Query, State},
    http::HeaderMap,
};
use chrono::{DateTime, FixedOffset, Utc};
use sea_orm::{
    ColumnTrait, EntityTrait, JoinType, PaginatorTrait, QueryFilter, QueryOrder, QuerySelect,
    RelationTrait, Select,
    prelude::Uuid,
    sea_query::Expr,
};
use serde::{Deserialize, Serialize};

use crate::{
    AppState,
    content::{client_ip, settings::{SiteSettingsWrite, SocialLink}},
    entities::{
        article_metrics, article_tags, articles, categories, comments, dynamic_media,
        dynamic_metrics, dynamics, friend_links, media_assets, series, site_settings, tags,
    },
    error::AppError,
    markup,
};

const LIST_COOLDOWN: Duration = Duration::from_millis(300);
const SEARCH_COOLDOWN: Duration = Duration::from_millis(800);
const DEFAULT_PAGE_SIZE: u64 = 10;
const MAX_PAGE_SIZE: u64 = 20;
const SEARCH_LIMIT: u64 = 10;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeroBackgroundJson {
    url: String,
    position: Option<String>,
    size: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSiteResponse {
    site_title: String,
    site_description: Option<String>,
    owner_name: String,
    owner_bio: String,
    avatar_url: String,
    masthead_url: String,
    social_links: Vec<SocialLink>,
    mail_enabled: bool,
    article_count: i64,
    dynamic_count: i64,
    friend_count: i64,
    total_views: i64,
    hero_backgrounds: Vec<HeroBackgroundJson>,
    hero_quote: Option<String>,
    theme: serde_json::Value,
    shell_layout: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRef {
    name: String,
    slug: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagRef {
    name: String,
    slug: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleItem {
    id: Uuid,
    slug: String,
    title: String,
    summary: String,
    cover_url: String,
    category: Option<CategoryRef>,
    tags: Vec<TagRef>,
    published_at: String,
    views: i64,
    likes: i64,
    featured: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleListResponse {
    items: Vec<ArticleItem>,
    page: u64,
    total_pages: u64,
    total: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleLink {
    slug: String,
    title: String,
}

/// 系列内相邻章节引用（系列上下文优先用 seriesTitle 短标题）
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeriesChapterLink {
    slug: String,
    title: String,
    series_title: Option<String>,
}

/// 文章详情里的系列上下文：order 为当前章序号（未排序成员为 null）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleSeriesNav {
    slug: String,
    name: String,
    order: Option<i32>,
    total: i64,
    prev: Option<SeriesChapterLink>,
    next: Option<SeriesChapterLink>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeriesListItem {
    slug: String,
    name: String,
    description: Option<String>,
    cover_url: Option<String>,
    chapter_count: i64,
    latest_at: Option<String>,
    featured: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeriesListResponse {
    items: Vec<SeriesListItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeriesChapterItem {
    slug: String,
    title: String,
    series_title: Option<String>,
    summary: Option<String>,
    cover_url: Option<String>,
    series_order: Option<i32>,
    published_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeriesDetailResponse {
    slug: String,
    name: String,
    description: Option<String>,
    cover_url: Option<String>,
    chapters: Vec<SeriesChapterItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleDetailResponse {
    #[serde(flatten)]
    item: ArticleItem,
    html: String,
    headings: Vec<markup::Heading>,
    /// 旁注（note-N 锚点与正文上标互链，文章页右栏/文末渲染）
    notes: Vec<lianmarkup::Note>,
    updated_at: String,
    allow_comments: bool,
    prev: Option<ArticleLink>,
    next: Option<ArticleLink>,
    series: Option<ArticleSeriesNav>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentItem {
    id: Uuid,
    parent_id: Option<Uuid>,
    display_name: String,
    avatar_url: String,
    website: Option<String>,
    content_html: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentListResponse {
    items: Vec<CommentItem>,
    total: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DynamicItem {
    id: Uuid,
    content_html: String,
    mood: Option<String>,
    media_urls: Vec<String>,
    /// 与 media_urls 同序的 card 变体地址（无变体时回退原图），九宫格缩图用
    media_card_urls: Vec<String>,
    likes: i64,
    comment_count: u64,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DynamicListResponse {
    items: Vec<DynamicItem>,
    page: u64,
    total_pages: u64,
    total: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendItem {
    name: String,
    url: String,
    description: String,
    avatar_url: String,
    host: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendListResponse {
    items: Vec<FriendItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSection<T> {
    items: Vec<T>,
    total: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    articles: SearchSection<ArticleItem>,
    dynamics: SearchSection<DynamicItem>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PublicSort {
    Featured,
    Popular,
    Recent,
}

impl PublicSort {
    fn parse(value: Option<&str>) -> Result<Self, AppError> {
        match value {
            None | Some("featured") => Ok(Self::Featured),
            Some("popular") => Ok(Self::Popular),
            Some("recent") => Ok(Self::Recent),
            Some(_) => Err(AppError::InvalidRequest("无效的排序方式")),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleListParams {
    sort: Option<String>,
    category: Option<String>,
    tag: Option<String>,
    page: Option<u64>,
    page_size: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageParams {
    page: Option<u64>,
    page_size: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchParams {
    q: Option<String>,
    page: Option<u64>,
}

struct Page {
    number: u64,
    size: u64,
}

impl Page {
    fn new(number: Option<u64>, size: Option<u64>) -> Self {
        Self {
            number: number.unwrap_or(1).clamp(1, 10_000),
            size: size.unwrap_or(DEFAULT_PAGE_SIZE).clamp(1, MAX_PAGE_SIZE),
        }
    }

    fn offset(&self) -> u64 {
        (self.number - 1) * self.size
    }

    fn pages(&self, total: u64) -> u64 {
        total.div_ceil(self.size)
    }
}

pub async fn site(State(state): State<AppState>) -> Result<Json<PublicSiteResponse>, AppError> {
    let model = site_settings::Entity::find_by_id(true)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotConfigured)?;
    let settings = SiteSettingsWrite {
        site_title: model.site_title,
        site_description: model.site_description,
        owner_name: model.owner_name,
        owner_bio: model.owner_bio,
        avatar_media_id: model.avatar_media_id,
        avatar_external_url: model.avatar_external_url,
        masthead_media_id: model.masthead_media_id,
        hero_background_media_ids: serde_json::from_value(model.hero_background_media_ids)
            .map_err(|_| AppError::Internal("stored hero backgrounds do not match schema"))?,
        hero_quote: model.hero_quote,
        social_links: serde_json::from_value(model.social_links)
            .map_err(|_| AppError::Internal("decode social links"))?,
        theme: serde_json::from_value(model.theme)
            .map_err(|_| AppError::Internal("decode theme"))?,
        shell_layout: serde_json::from_value(model.shell_layout)
            .map_err(|_| AppError::Internal("decode shell layout"))?,
    };
    settings
        .validate()
        .map_err(|_| AppError::Internal("stored site settings failed validation"))?;
    let hero_backgrounds = crate::ops::media::hero_background_urls(
        &state.database,
        &settings.hero_background_media_ids,
    )
    .await
    .into_iter()
    .map(|(url, position, size)| HeroBackgroundJson { url, position, size })
    .collect();
    let avatar_media_url = media_url(&state, settings.avatar_media_id).await?;
    let avatar_external_url = settings.avatar_external_url.clone().unwrap_or_default();
    let avatar_url = if avatar_media_url.is_empty() {
        avatar_external_url
    } else {
        avatar_media_url
    };
    let masthead_url = media_url(&state, settings.masthead_media_id).await?;
    let now = Utc::now().fixed_offset();
    let article_count = articles::Entity::find()
        .filter(articles::Column::Status.eq("published"))
        .filter(articles::Column::PublishedAt.lte(now))
        .count(&state.database)
        .await? as i64;
    let dynamic_count = dynamics::Entity::find()
        .filter(dynamics::Column::Status.eq("published"))
        .filter(dynamics::Column::PublishedAt.lte(now))
        .count(&state.database)
        .await? as i64;
    let friend_count = friend_links::Entity::find()
        .filter(friend_links::Column::IsVisible.eq(true))
        .count(&state.database)
        .await? as i64;
    let total_views = article_metrics::Entity::find()
        .all(&state.database)
        .await?
        .iter()
        .map(|metric| metric.view_count)
        .sum();
    Ok(Json(PublicSiteResponse {
        site_title: settings.site_title,
        site_description: settings.site_description,
        owner_name: settings.owner_name,
        owner_bio: settings.owner_bio,
        avatar_url,
        masthead_url,
        social_links: settings.social_links,
        mail_enabled: crate::ops::subscriptions::mail_enabled(),
        article_count,
        dynamic_count,
        friend_count,
        total_views,
        hero_backgrounds,
        hero_quote: settings.hero_quote,
        theme: serde_json::to_value(&settings.theme)
            .map_err(|_| AppError::Internal("serialize theme"))?,
        shell_layout: serde_json::to_value(&settings.shell_layout)
            .map_err(|_| AppError::Internal("serialize shell layout"))?,
    }))
}

pub async fn articles(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Query(params): Query<ArticleListParams>,
) -> Result<Json<ArticleListResponse>, AppError> {
    rate_limit(&state, &headers, peer, "public-articles", LIST_COOLDOWN).await?;
    let sort = PublicSort::parse(params.sort.as_deref())?;
    let page = Page::new(params.page, params.page_size);
    let category_id = match params.category.as_deref() {
        Some(slug) => Some(
            categories::Entity::find()
                .filter(categories::Column::Slug.eq(slug))
                .one(&state.database)
                .await?
                .map(|category| category.id)
                .unwrap_or(Uuid::nil()),
        ),
        None => None,
    };
    let tag_id = match params.tag.as_deref() {
        Some(slug) => Some(
            tags::Entity::find()
                .filter(tags::Column::Slug.eq(slug))
                .one(&state.database)
                .await?
                .map(|tag| tag.id)
                .unwrap_or(Uuid::nil()),
        ),
        None => None,
    };
    let mut query = published_articles();
    if let Some(category_id) = category_id {
        query = query.filter(articles::Column::CategoryId.eq(category_id));
    }
    if let Some(tag_id) = tag_id {
        let tag_articles = sea_orm::sea_query::Query::select()
            .column(article_tags::Column::ArticleId)
            .from(article_tags::Entity)
            .and_where(Expr::col(article_tags::Column::TagId).eq(tag_id))
            .to_owned();
        query = query.filter(articles::Column::Id.in_subquery(tag_articles));
    }
    let total = query
        .clone()
        .count(&state.database)
        .await?;
    let models = apply_sort(query, sort)
        .offset(page.offset())
        .limit(page.size)
        .all(&state.database)
        .await?;
    let mut items = Vec::with_capacity(models.len());
    for model in models {
        items.push(article_item(&state, model).await?);
    }
    Ok(Json(ArticleListResponse {
        items,
        page: page.number,
        total_pages: page.pages(total),
        total,
    }))
}

pub async fn article_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ArticleDetailResponse>, AppError> {
    let article = require(
        published_articles()
            .filter(articles::Column::Slug.eq(slug))
            .one(&state.database)
            .await?,
    )?;
    let rendered = markup::render(&article.body_markdown);
    let published_at = article
        .published_at
        .expect("published article has timestamp");
    let prev = published_articles()
        .filter(articles::Column::PublishedAt.gt(published_at))
        .order_by_asc(articles::Column::PublishedAt)
        .one(&state.database)
        .await?;
    let next = published_articles()
        .filter(articles::Column::PublishedAt.lt(published_at))
        .order_by_desc(articles::Column::PublishedAt)
        .one(&state.database)
        .await?;
    let updated_at = article.updated_at.to_rfc3339();
    let allow_comments = article.allow_comments;
    let series_nav = match article.series_id {
        Some(series_id) => series_nav(&state, series_id, article.id, article.series_order).await?,
        None => None,
    };
    let item = article_item(&state, article).await?;
    Ok(Json(ArticleDetailResponse {
        item,
        html: rendered.html,
        headings: rendered.headings,
        notes: rendered.notes,
        updated_at,
        allow_comments,
        prev: prev.map(|article| ArticleLink {
            slug: article.slug,
            title: article.title,
        }),
        next: next.map(|article| ArticleLink {
            slug: article.slug,
            title: article.title,
        }),
        series: series_nav,
    }))
}

/// 系列列表：featured 在前（按 featured_at 倒序），其余按最近章节发布倒序。
pub async fn series_list(
    State(state): State<AppState>,
) -> Result<Json<SeriesListResponse>, AppError> {
    let models = series::Entity::find()
        .order_by_asc(series::Column::Name)
        .all(&state.database)
        .await?;
    // 章节聚合（只计已发布且到点）：博客规模直接在内存里 group
    let chapters = published_articles()
        .filter(articles::Column::SeriesId.is_not_null())
        .all(&state.database)
        .await?;
    let mut aggregates: HashMap<Uuid, (i64, Option<DateTime<FixedOffset>>)> = HashMap::new();
    for chapter in chapters {
        let Some(series_id) = chapter.series_id else {
            continue;
        };
        let entry = aggregates.entry(series_id).or_insert((0, None));
        entry.0 += 1;
        if let Some(published_at) = chapter.published_at {
            entry.1 = Some(entry.1.map_or(published_at, |latest| latest.max(published_at)));
        }
    }
    let mut rows: Vec<(series::Model, i64, Option<DateTime<FixedOffset>>)> = models
        .into_iter()
        .map(|model| {
            let (count, latest) = aggregates.get(&model.id).copied().unwrap_or((0, None));
            (model, count, latest)
        })
        .collect();
    rows.sort_by(|a, b| {
        b.0.featured_at
            .is_some()
            .cmp(&a.0.featured_at.is_some())
            .then_with(|| b.0.featured_at.cmp(&a.0.featured_at))
            .then_with(|| b.2.cmp(&a.2))
            .then_with(|| a.0.name.cmp(&b.0.name))
    });
    let mut items = Vec::with_capacity(rows.len());
    for (model, chapter_count, latest_at) in rows {
        items.push(SeriesListItem {
            slug: model.slug.clone(),
            name: model.name.clone(),
            description: model.description.clone(),
            cover_url: series_cover_url(&state, &model).await?,
            chapter_count,
            latest_at: latest_at.map(|at| at.to_rfc3339()),
            featured: model.featured_at.is_some(),
        });
    }
    Ok(Json(SeriesListResponse { items }))
}

/// 系列目录：章节按 series_order 升序（未排序成员排最后，按发布时间次序）。
pub async fn series_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<SeriesDetailResponse>, AppError> {
    let model = require(
        series::Entity::find()
            .filter(series::Column::Slug.eq(slug))
            .one(&state.database)
            .await?,
    )?;
    let chapters = series_chapters(&state, model.id).await?;
    let cover_url = series_cover_url(&state, &model).await?;
    let mut chapter_items = Vec::with_capacity(chapters.len());
    for chapter in chapters {
        let published_at = chapter
            .published_at
            .expect("published article has timestamp");
        let cover_url = cover_media_url(&state, chapter.cover_media_id).await?;
        chapter_items.push(SeriesChapterItem {
            slug: chapter.slug,
            title: chapter.title,
            series_title: chapter.series_title,
            summary: chapter.summary,
            cover_url: (!cover_url.is_empty()).then_some(cover_url),
            series_order: chapter.series_order,
            published_at: published_at.to_rfc3339(),
        });
    }
    Ok(Json(SeriesDetailResponse {
        slug: model.slug,
        name: model.name,
        description: model.description,
        cover_url,
        chapters: chapter_items,
    }))
}

/// 一个系列的已发布章节：series_order 升序、NULL 排最后，平局按发布时间次序。
fn series_chapters_query(series_id: Uuid) -> Select<articles::Entity> {
    published_articles()
        .filter(articles::Column::SeriesId.eq(series_id))
        .order_by_with_nulls(
            articles::Column::SeriesOrder,
            sea_orm::sea_query::Order::Asc,
            sea_orm::sea_query::NullOrdering::Last,
        )
        .order_by_asc(articles::Column::PublishedAt)
}

async fn series_chapters(
    state: &AppState,
    series_id: Uuid,
) -> Result<Vec<articles::Model>, AppError> {
    Ok(series_chapters_query(series_id).all(&state.database).await?)
}

/// 系列封面：自身封面优先（card 变体），没有则回退第一章封面，再无为 null。
async fn series_cover_url(
    state: &AppState,
    model: &series::Model,
) -> Result<Option<String>, AppError> {
    if model.cover_media_id.is_some() {
        let url = cover_media_url(state, model.cover_media_id).await?;
        if !url.is_empty() {
            return Ok(Some(url));
        }
    }
    let first = series_chapters_query(model.id)
        .limit(1)
        .one(&state.database)
        .await?;
    if let Some(chapter) = first {
        let url = cover_media_url(state, chapter.cover_media_id).await?;
        if !url.is_empty() {
            return Ok(Some(url));
        }
    }
    Ok(None)
}

/// 文章详情的系列上下文；文章不属于系列或系列已不存在时为 None。
async fn series_nav(
    state: &AppState,
    series_id: Uuid,
    current_id: Uuid,
    current_order: Option<i32>,
) -> Result<Option<ArticleSeriesNav>, AppError> {
    let Some(model) = series::Entity::find_by_id(series_id)
        .one(&state.database)
        .await?
    else {
        return Ok(None);
    };
    let chapters = series_chapters(state, series_id).await?;
    Ok(Some(series_nav_from(&model, &chapters, current_id, current_order)))
}

/// prev/next 只按已排序章节（series_order 非空）的相邻关系计算；
/// 未排序成员没有前后章。chapters 必须已按 series_chapters_query 的顺序排好。
fn series_nav_from(
    model: &series::Model,
    chapters: &[articles::Model],
    current_id: Uuid,
    current_order: Option<i32>,
) -> ArticleSeriesNav {
    fn link(chapter: &articles::Model) -> SeriesChapterLink {
        SeriesChapterLink {
            slug: chapter.slug.clone(),
            title: chapter.title.clone(),
            series_title: chapter.series_title.clone(),
        }
    }
    let ordered: Vec<&articles::Model> = chapters
        .iter()
        .filter(|chapter| chapter.series_order.is_some())
        .collect();
    let (prev, next) = match ordered.iter().position(|chapter| chapter.id == current_id) {
        Some(index) => (
            index.checked_sub(1).map(|i| link(ordered[i])),
            ordered.get(index + 1).map(|chapter| link(chapter)),
        ),
        None => (None, None),
    };
    ArticleSeriesNav {
        slug: model.slug.clone(),
        name: model.name.clone(),
        order: current_order,
        total: chapters.len() as i64,
        prev,
        next,
    }
}

pub async fn article_comments(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<CommentListResponse>, AppError> {
    let article = require(
        published_articles()
            .filter(articles::Column::Slug.eq(slug))
            .one(&state.database)
            .await?,
    )?;
    let models = comments::Entity::find()
        .filter(comments::Column::ArticleId.eq(article.id))
        .filter(comments::Column::Status.eq("visible"))
        .order_by_asc(comments::Column::CreatedAt)
        .all(&state.database)
        .await?;
    let total = models.len() as u64;
    Ok(Json(CommentListResponse {
        items: models.into_iter().map(comment_item).collect(),
        total,
    }))
}

pub async fn dynamic_list(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Query(params): Query<PageParams>,
) -> Result<Json<DynamicListResponse>, AppError> {
    rate_limit(&state, &headers, peer, "public-dynamics", LIST_COOLDOWN).await?;
    let page = Page::new(params.page, params.page_size);
    let query = published_dynamics();
    let total = query.clone().count(&state.database).await?;
    let models = query
        .order_by_desc(dynamics::Column::PublishedAt)
        .offset(page.offset())
        .limit(page.size)
        .all(&state.database)
        .await?;
    let items = dynamic_items(&state, models).await?;
    Ok(Json(DynamicListResponse {
        items,
        page: page.number,
        total_pages: page.pages(total),
        total,
    }))
}

pub async fn dynamic_comments(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommentListResponse>, AppError> {
    let dynamic = require(
        published_dynamics()
            .filter(dynamics::Column::Id.eq(id))
            .one(&state.database)
            .await?,
    )?;
    let models = comments::Entity::find()
        .filter(comments::Column::DynamicId.eq(dynamic.id))
        .filter(comments::Column::Status.eq("visible"))
        .order_by_asc(comments::Column::CreatedAt)
        .all(&state.database)
        .await?;
    let total = models.len() as u64;
    Ok(Json(CommentListResponse {
        items: models.into_iter().map(comment_item).collect(),
        total,
    }))
}

pub async fn friends(
    State(state): State<AppState>,
) -> Result<Json<FriendListResponse>, AppError> {
    let models = friend_links::Entity::find()
        .filter(friend_links::Column::IsVisible.eq(true))
        .order_by_asc(friend_links::Column::SortOrder)
        .order_by_asc(friend_links::Column::Name)
        .all(&state.database)
        .await?;
    let mut items = Vec::with_capacity(models.len());
    for model in models {
        let host = host_of(&model.url);
        let avatar_url = match model.avatar_url {
            Some(url) => url,
            None => {
                let local = media_url(&state, model.avatar_media_id).await?;
                if local.is_empty() {
                    format!("https://{host}/favicon.ico")
                } else {
                    local
                }
            }
        };
        items.push(FriendItem {
            name: model.name,
            url: model.url,
            description: model.description.unwrap_or_default(),
            avatar_url,
            host,
        });
    }
    Ok(Json(FriendListResponse { items }))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PulseItem {
    /// comment = 新评论；friend = 新友链
    kind: &'static str,
    /// 评论者昵称 / 友链名
    author: String,
    /// 文章标题（动态评论与友链为空串）
    target_title: String,
    target_url: String,
    created_at: DateTime<FixedOffset>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PulseResponse {
    items: Vec<PulseItem>,
}

/// 站点脉搏：最近可见评论与新加入友链的混合时间线（首页 free-panel2）。
pub async fn pulse(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<Json<PulseResponse>, AppError> {
    rate_limit(&state, &headers, peer, "public-pulse", LIST_COOLDOWN).await?;
    let recent_comments = comments::Entity::find()
        .filter(comments::Column::Status.eq("visible"))
        .order_by_desc(comments::Column::CreatedAt)
        .limit(4)
        .all(&state.database)
        .await?;
    let mut items: Vec<PulseItem> = Vec::new();
    for comment in recent_comments {
        let (title, url) = if let Some(article_id) = comment.article_id {
            let Some(article) = articles::Entity::find_by_id(article_id)
                .one(&state.database)
                .await?
            else {
                continue;
            };
            (article.title, format!("/articles/{}#comments", article.slug))
        } else if let Some(dynamic_id) = comment.dynamic_id {
            (String::new(), format!("/dynamics#dynamic-{dynamic_id}"))
        } else {
            continue;
        };
        items.push(PulseItem {
            kind: "comment",
            author: comment.display_name,
            target_title: title,
            target_url: url,
            created_at: comment.created_at,
        });
    }
    let recent_friends = friend_links::Entity::find()
        .filter(friend_links::Column::IsVisible.eq(true))
        .order_by_desc(friend_links::Column::CreatedAt)
        .limit(3)
        .all(&state.database)
        .await?;
    for friend in recent_friends {
        items.push(PulseItem {
            kind: "friend",
            author: friend.name,
            target_title: String::new(),
            target_url: friend.url,
            created_at: friend.created_at,
        });
    }
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    items.truncate(6);
    Ok(Json(PulseResponse { items }))
}

pub async fn search(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Query(params): Query<SearchParams>,
) -> Result<Json<SearchResponse>, AppError> {
    rate_limit(&state, &headers, peer, "public-search", SEARCH_COOLDOWN).await?;
    let term = search_term(params.q.as_deref());
    let offset = (params.page.unwrap_or(1).clamp(1, 10_000) - 1) * SEARCH_LIMIT;
    if term.is_empty() {
        return Ok(Json(SearchResponse {
            articles: SearchSection {
                items: Vec::new(),
                total: 0,
            },
            dynamics: SearchSection {
                items: Vec::new(),
                total: 0,
            },
        }));
    }
    let pattern = like_pattern(&term);
    let article_query = published_articles().filter(
        Expr::col(articles::Column::Title)
            .like(&pattern)
            .or(Expr::col(articles::Column::Summary).like(&pattern))
            .or(Expr::col(articles::Column::BodyMarkdown).like(&pattern)),
    );
    let article_total = article_query.clone().count(&state.database).await?;
    let article_models = article_query
        .order_by_desc(articles::Column::PublishedAt)
        .offset(offset)
        .limit(SEARCH_LIMIT)
        .all(&state.database)
        .await?;
    let mut article_items = Vec::with_capacity(article_models.len());
    for model in article_models {
        article_items.push(article_item(&state, model).await?);
    }
    let dynamic_query = published_dynamics()
        .filter(Expr::col(dynamics::Column::ContentMarkdown).like(&pattern));
    let dynamic_total = dynamic_query.clone().count(&state.database).await?;
    let dynamic_models = dynamic_query
        .order_by_desc(dynamics::Column::PublishedAt)
        .offset(offset)
        .limit(SEARCH_LIMIT)
        .all(&state.database)
        .await?;
    let dynamic_items = dynamic_items(&state, dynamic_models).await?;
    Ok(Json(SearchResponse {
        articles: SearchSection {
            items: article_items,
            total: article_total,
        },
        dynamics: SearchSection {
            items: dynamic_items,
            total: dynamic_total,
        },
    }))
}

fn published_articles() -> Select<articles::Entity> {
    articles::Entity::find()
        .filter(articles::Column::Status.eq("published"))
        .filter(articles::Column::PublishedAt.lte(Utc::now().fixed_offset()))
}

fn published_dynamics() -> Select<dynamics::Entity> {
    dynamics::Entity::find()
        .filter(dynamics::Column::Status.eq("published"))
        .filter(dynamics::Column::PublishedAt.lte(Utc::now().fixed_offset()))
}

fn apply_sort(query: Select<articles::Entity>, sort: PublicSort) -> Select<articles::Entity> {
    match sort {
        PublicSort::Featured => query
            .order_by_with_nulls(
                articles::Column::FeaturedAt,
                sea_orm::sea_query::Order::Desc,
                sea_orm::sea_query::NullOrdering::Last,
            )
            .order_by_desc(articles::Column::PublishedAt),
        PublicSort::Popular => query
            .join(JoinType::LeftJoin, articles::Relation::ArticleMetrics.def())
            .order_by(
                Expr::cust(
                    "COALESCE(article_metrics.like_count, 0) * 20 + COALESCE(article_metrics.view_count, 0)",
                ),
                sea_orm::sea_query::Order::Desc,
            )
            .order_by_desc(articles::Column::PublishedAt),
        PublicSort::Recent => query.order_by_desc(articles::Column::PublishedAt),
    }
}

async fn rate_limit(
    state: &AppState,
    headers: &HeaderMap,
    peer: SocketAddr,
    action: &'static str,
    cooldown: Duration,
) -> Result<(), AppError> {
    if state
        .content
        .allow(client_ip(headers, peer), Uuid::nil(), action, cooldown)
        .await
    {
        Ok(())
    } else {
        Err(AppError::RateLimited)
    }
}

async fn article_item(
    state: &AppState,
    article: articles::Model,
) -> Result<ArticleItem, AppError> {
    let category = categories::Entity::find_by_id(article.category_id)
        .one(&state.database)
        .await?
        .map(|category| CategoryRef {
            name: category.name,
            slug: category.slug,
        });
    let metrics = article_metrics::Entity::find_by_id(article.id)
        .one(&state.database)
        .await?;
    let tag_links = article_tags::Entity::find()
        .filter(article_tags::Column::ArticleId.eq(article.id))
        .all(&state.database)
        .await?;
    let mut tag_refs = Vec::with_capacity(tag_links.len());
    for link in tag_links {
        if let Some(tag) = tags::Entity::find_by_id(link.tag_id)
            .one(&state.database)
            .await?
        {
            tag_refs.push(TagRef {
                name: tag.name,
                slug: tag.slug,
            });
        }
    }
    let cover_url = cover_media_url(state, article.cover_media_id).await?;
    let published_at = article
        .published_at
        .expect("published article has timestamp");
    Ok(ArticleItem {
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary.unwrap_or_default(),
        cover_url,
        category,
        tags: tag_refs,
        published_at: published_at.to_rfc3339(),
        views: metrics.as_ref().map(|metric| metric.view_count).unwrap_or(0),
        likes: metrics.as_ref().map(|metric| metric.like_count).unwrap_or(0),
        featured: article.featured_at.is_some(),
    })
}

async fn dynamic_items(
    state: &AppState,
    models: Vec<dynamics::Model>,
) -> Result<Vec<DynamicItem>, AppError> {
    let ids = models.iter().map(|model| model.id).collect::<Vec<_>>();
    let metrics = if ids.is_empty() {
        Vec::new()
    } else {
        dynamic_metrics::Entity::find()
            .filter(dynamic_metrics::Column::DynamicId.is_in(ids.iter().copied()))
            .all(&state.database)
            .await?
    };
    let likes = metrics
        .into_iter()
        .map(|metric| (metric.dynamic_id, metric.like_count))
        .collect::<HashMap<_, _>>();
    let comment_rows = if ids.is_empty() {
        Vec::new()
    } else {
        comments::Entity::find()
            .filter(comments::Column::DynamicId.is_in(ids.iter().copied()))
            .filter(comments::Column::Status.eq("visible"))
            .all(&state.database)
            .await?
    };
    let mut comment_counts: HashMap<Uuid, u64> = HashMap::new();
    for comment in comment_rows {
        if let Some(dynamic_id) = comment.dynamic_id {
            *comment_counts.entry(dynamic_id).or_default() += 1;
        }
    }
    let attachments = if ids.is_empty() {
        Vec::new()
    } else {
        dynamic_media::Entity::find()
            .filter(dynamic_media::Column::DynamicId.is_in(ids.iter().copied()))
            .order_by_asc(dynamic_media::Column::Position)
            .all(&state.database)
            .await?
    };
    let assets = if attachments.is_empty() {
        HashMap::new()
    } else {
        media_assets::Entity::find()
            .filter(
                media_assets::Column::Id
                    .is_in(attachments.iter().map(|row| row.media_id).collect::<Vec<_>>()),
            )
            .all(&state.database)
            .await?
            .into_iter()
            .map(|media| (media.id, media))
            .collect::<HashMap<_, _>>()
    };
    let mut media_urls: HashMap<Uuid, Vec<String>> = HashMap::new();
    let mut media_card_urls: HashMap<Uuid, Vec<String>> = HashMap::new();
    for attachment in attachments {
        if let Some(asset) = assets.get(&attachment.media_id) {
            media_urls
                .entry(attachment.dynamic_id)
                .or_default()
                .push(format!("/media/{}", asset.storage_key));
            // 九宫格用 card 变体，灯箱点开仍看 media_urls 里的原图
            media_card_urls
                .entry(attachment.dynamic_id)
                .or_default()
                .push(crate::ops::media::card_or_original(asset));
        }
    }
    Ok(models
        .into_iter()
        .map(|model| {
            let published_at = model.published_at.expect("published dynamic has timestamp");
            DynamicItem {
                id: model.id,
                content_html: markup::render(&model.content_markdown).html,
                mood: model.mood,
                media_urls: media_urls.remove(&model.id).unwrap_or_default(),
                media_card_urls: media_card_urls.remove(&model.id).unwrap_or_default(),
                likes: likes.get(&model.id).copied().unwrap_or(0),
                comment_count: comment_counts.get(&model.id).copied().unwrap_or(0),
                created_at: published_at.to_rfc3339(),
            }
        })
        .collect())
}

fn comment_item(model: comments::Model) -> CommentItem {
    CommentItem {
        id: model.id,
        parent_id: model.parent_id,
        display_name: model.display_name,
        avatar_url: crate::content::public::comment_avatar_url(
            model.website.as_deref(),
            model.email.as_deref(),
        ),
        website: model.website,
        content_html: escape_html(&model.content),
        created_at: model.created_at.to_rfc3339(),
    }
}

async fn media_url(state: &AppState, id: Option<Uuid>) -> Result<String, AppError> {
    let Some(id) = id else {
        return Ok(String::new());
    };
    Ok(media_assets::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .map(|media| format!("/media/{}", media.storage_key))
        .unwrap_or_default())
}

/// 封面没有灯箱场景，优先 card 变体（无变体回退原图）。
async fn cover_media_url(state: &AppState, id: Option<Uuid>) -> Result<String, AppError> {
    let Some(id) = id else {
        return Ok(String::new());
    };
    Ok(media_assets::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .map(|media| crate::ops::media::card_or_original(&media))
        .unwrap_or_default())
}

fn require<T>(value: Option<T>) -> Result<T, AppError> {
    value.ok_or(AppError::NotFound)
}

fn search_term(value: Option<&str>) -> String {
    value
        .unwrap_or_default()
        .trim()
        .chars()
        .take(100)
        .collect()
}

fn like_pattern(term: &str) -> String {
    format!("%{}%", term.replace('%', "\\%").replace('_', "\\_"))
}

fn host_of(url: &str) -> String {
    let without_scheme = url.split("://").nth(1).unwrap_or(url);
    without_scheme
        .split('/')
        .next()
        .unwrap_or(without_scheme)
        .trim_end_matches('/')
        .to_owned()
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use sea_orm::DatabaseBackend;

    use super::*;

    #[test]
    fn parses_sort_values() {
        assert_eq!(PublicSort::parse(None).unwrap(), PublicSort::Featured);
        assert_eq!(
            PublicSort::parse(Some("featured")).unwrap(),
            PublicSort::Featured
        );
        assert_eq!(
            PublicSort::parse(Some("popular")).unwrap(),
            PublicSort::Popular
        );
        assert_eq!(PublicSort::parse(Some("recent")).unwrap(), PublicSort::Recent);
        assert!(PublicSort::parse(Some("trending")).is_err());
    }

    #[test]
    fn clamps_pagination_bounds() {
        let page = Page::new(None, None);
        assert_eq!(page.number, 1);
        assert_eq!(page.size, DEFAULT_PAGE_SIZE);
        let page = Page::new(Some(0), Some(500));
        assert_eq!(page.number, 1);
        assert_eq!(page.size, MAX_PAGE_SIZE);
        let page = Page::new(Some(3), Some(5));
        assert_eq!(page.offset(), 10);
        assert_eq!(page.pages(0), 0);
        assert_eq!(page.pages(1), 1);
        assert_eq!(page.pages(51), 11);
    }

    #[test]
    fn sort_queries_match_ssr_ordering() {
        let popular = apply_sort(published_articles(), PublicSort::Popular)
            .offset(0)
            .limit(10);
        let sql = sea_orm::QueryTrait::build(&popular, DatabaseBackend::Postgres).to_string();
        assert!(
            sql.contains(
                "ORDER BY COALESCE(article_metrics.like_count, 0) * 20 + COALESCE(article_metrics.view_count, 0) DESC"
            ),
            "missing weighted ordering: {sql}"
        );
        let featured = apply_sort(published_articles(), PublicSort::Featured);
        let sql = sea_orm::QueryTrait::build(&featured, DatabaseBackend::Postgres).to_string();
        assert!(sql.contains(r#""featured_at" DESC"#), "missing featured ordering: {sql}");
        let recent = apply_sort(published_articles(), PublicSort::Recent);
        let sql = sea_orm::QueryTrait::build(&recent, DatabaseBackend::Postgres).to_string();
        assert!(!sql.contains("JOIN"), "recent must not join: {sql}");
        assert!(sql.contains(r#""published_at" DESC"#));
    }

    #[test]
    fn search_term_matches_ssr_limits() {
        assert_eq!(search_term(None), "");
        assert_eq!(search_term(Some("  夜航  ")), "夜航");
        let long = "雪".repeat(150);
        assert_eq!(search_term(Some(&long)).chars().count(), 100);
        assert_eq!(like_pattern("50%_"), "%50\\%\\_%");
    }

    #[test]
    fn missing_content_maps_to_404() {
        let missing: Option<articles::Model> = None;
        let error = require(missing).unwrap_err();
        assert!(matches!(error, AppError::NotFound));
        let response = axum::response::IntoResponse::into_response(error);
        assert_eq!(response.status(), axum::http::StatusCode::NOT_FOUND);
        let present: Option<u8> = Some(1);
        assert_eq!(require(present).unwrap(), 1);
    }

    #[tokio::test]
    async fn comment_item_escapes_content() {
        let comment = comments::Model {
            id: Uuid::nil(),
            article_id: None,
            dynamic_id: None,
            parent_id: None,
            display_name: "来访者".to_owned(),
            email: None,
            website: Some("https://example.com".to_owned()),
            content: "<b>你好</b>".to_owned(),
            user_agent: None,
            status: "visible".to_owned(),
            created_at: Utc::now().fixed_offset(),
        };
        let item = comment_item(comment);
        assert_eq!(item.content_html, "&lt;b&gt;你好&lt;/b&gt;");
        assert_eq!(item.avatar_url, "https://example.com/favicon.ico");
    }

    fn test_series() -> series::Model {
        test_series_with(100, false)
    }

    fn test_series_with(id: u128, featured: bool) -> series::Model {
        let now = Utc::now().fixed_offset();
        series::Model {
            id: Uuid::from_u128(id),
            name: "夜航系列".to_owned(),
            slug: "nightflight".to_owned(),
            description: None,
            cover_media_id: None,
            featured_at: featured.then_some(now),
            created_at: now,
            updated_at: now,
        }
    }

    fn test_chapter(id: u128, order: Option<i32>) -> articles::Model {
        let now = Utc::now().fixed_offset();
        articles::Model {
            id: Uuid::from_u128(id),
            category_id: Uuid::nil(),
            cover_media_id: None,
            series_id: Some(Uuid::nil()),
            title: format!("章节 {id}"),
            slug: format!("chapter-{id}"),
            summary: None,
            body_markdown: "正文".to_owned(),
            status: "published".to_owned(),
            allow_comments: true,
            published_at: Some(now),
            featured_at: None,
            series_order: order,
            series_title: Some(format!("第 {id} 章")),
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn series_chapters_query_orders_sorted_first_then_unsorted() {
        let query = series_chapters_query(Uuid::nil());
        let sql = sea_orm::QueryTrait::build(&query, DatabaseBackend::Postgres).to_string();
        assert!(sql.contains(r#""series_id""#), "missing series filter: {sql}");
        assert!(sql.contains("'published'"), "only published chapters: {sql}");
        assert!(
            sql.contains(r#""series_order" ASC NULLS LAST"#),
            "unsorted members must come last: {sql}"
        );
        assert!(
            sql.contains(r#""published_at" ASC"#),
            "ties break by publish time: {sql}"
        );
    }

    #[test]
    fn series_nav_links_adjacent_ordered_chapters() {
        let series = test_series();
        // 已按 series_chapters_query 顺序：0,1,2，未排序成员排最后
        let chapters = vec![
            test_chapter(1, Some(0)),
            test_chapter(2, Some(1)),
            test_chapter(3, Some(2)),
            test_chapter(4, None),
        ];
        let nav = series_nav_from(&series, &chapters, Uuid::from_u128(2), Some(1));
        assert_eq!(nav.slug, "nightflight");
        assert_eq!(nav.name, "夜航系列");
        assert_eq!(nav.order, Some(1));
        assert_eq!(nav.total, 4);
        let prev = nav.prev.unwrap();
        assert_eq!(prev.slug, "chapter-1");
        assert_eq!(prev.series_title, Some("第 1 章".to_owned()));
        let next = nav.next.unwrap();
        assert_eq!(next.slug, "chapter-3");

        // 首章没有上一章；末章没有下一章
        let nav = series_nav_from(&series, &chapters, Uuid::from_u128(1), Some(0));
        assert!(nav.prev.is_none());
        assert!(nav.next.is_some());
        let nav = series_nav_from(&series, &chapters, Uuid::from_u128(3), Some(2));
        assert!(nav.prev.is_some());
        assert!(nav.next.is_none());

        // 未排序成员没有前后章，order 为 None，但仍计入 total
        let nav = series_nav_from(&series, &chapters, Uuid::from_u128(4), None);
        assert_eq!(nav.order, None);
        assert_eq!(nav.total, 4);
        assert!(nav.prev.is_none());
        assert!(nav.next.is_none());
    }

    #[test]
    fn series_responses_serialize_camel_case() {
        let item = SeriesListItem {
            slug: "nightflight".to_owned(),
            name: "夜航系列".to_owned(),
            description: None,
            cover_url: None,
            chapter_count: 3,
            latest_at: None,
            featured: true,
        };
        let value = serde_json::to_value(&item).unwrap();
        let object = value.as_object().unwrap();
        for key in [
            "slug",
            "name",
            "description",
            "coverUrl",
            "chapterCount",
            "latestAt",
            "featured",
        ] {
            assert!(object.contains_key(key), "missing key {key}");
        }
        assert!(value["coverUrl"].is_null());
        assert_eq!(value["chapterCount"], 3);

        let chapter = SeriesChapterItem {
            slug: "chapter-1".to_owned(),
            title: "标题".to_owned(),
            series_title: Some("第一章".to_owned()),
            summary: None,
            cover_url: None,
            series_order: Some(0),
            published_at: "2026-10-01T00:00:00+00:00".to_owned(),
        };
        let value = serde_json::to_value(&chapter).unwrap();
        let object = value.as_object().unwrap();
        for key in [
            "slug",
            "title",
            "seriesTitle",
            "summary",
            "coverUrl",
            "seriesOrder",
            "publishedAt",
        ] {
            assert!(object.contains_key(key), "missing key {key}");
        }

        let nav = ArticleSeriesNav {
            slug: "nightflight".to_owned(),
            name: "夜航系列".to_owned(),
            order: Some(0),
            total: 3,
            prev: None,
            next: Some(SeriesChapterLink {
                slug: "chapter-2".to_owned(),
                title: "标题".to_owned(),
                series_title: None,
            }),
        };
        let value = serde_json::to_value(&nav).unwrap();
        assert!(value["prev"].is_null());
        assert!(value["next"]["seriesTitle"].is_null());
        assert_eq!(value["total"], 3);
    }

    // 响应样例：构造三个端点的真实序列化输出（打印供文档/联调参考）。
    // sea-orm mock 特性会让 DatabaseConnection 失去 Clone（AppState 依赖），
    // 因此 handler 级联调留在 SQL 形状断言与纯函数测试，此处直接构造响应体。
    #[test]
    fn series_endpoints_sample_payloads() {
        let latest = Utc::now().fixed_offset().to_rfc3339();
        let list = SeriesListResponse {
            items: vec![
                SeriesListItem {
                    slug: "nightflight".to_owned(),
                    name: "夜航系列".to_owned(),
                    description: Some("长夜飞行记录".to_owned()),
                    cover_url: Some("/media/ab/cover-1.card.webp".to_owned()),
                    chapter_count: 3,
                    latest_at: Some(latest.clone()),
                    featured: true,
                },
                SeriesListItem {
                    slug: "fragments".to_owned(),
                    name: "碎片集".to_owned(),
                    description: None,
                    cover_url: None,
                    chapter_count: 1,
                    latest_at: None,
                    featured: false,
                },
            ],
        };
        let value = serde_json::to_value(&list).unwrap();
        println!(
            "GET /api/public/series →\n{}",
            serde_json::to_string_pretty(&value).unwrap()
        );
        assert_eq!(value["items"][0]["slug"], "nightflight");
        assert_eq!(value["items"][1]["coverUrl"], serde_json::Value::Null);

        let detail = SeriesDetailResponse {
            slug: "nightflight".to_owned(),
            name: "夜航系列".to_owned(),
            description: Some("长夜飞行记录".to_owned()),
            cover_url: Some("/media/ab/cover-1.card.webp".to_owned()),
            chapters: vec![
                SeriesChapterItem {
                    slug: "chapter-0".to_owned(),
                    title: "长标题：夜航之前".to_owned(),
                    series_title: Some("第零章".to_owned()),
                    summary: Some("系列序章".to_owned()),
                    cover_url: None,
                    series_order: Some(0),
                    published_at: latest.clone(),
                },
                SeriesChapterItem {
                    slug: "chapter-1".to_owned(),
                    title: "第一章正文标题".to_owned(),
                    series_title: None,
                    summary: None,
                    cover_url: None,
                    series_order: None,
                    published_at: latest.clone(),
                },
            ],
        };
        let value = serde_json::to_value(&detail).unwrap();
        println!(
            "GET /api/public/series/nightflight →\n{}",
            serde_json::to_string_pretty(&value).unwrap()
        );
        assert_eq!(value["chapters"][0]["seriesOrder"], 0);
        assert_eq!(value["chapters"][0]["seriesTitle"], "第零章");

        let nav = ArticleSeriesNav {
            slug: "nightflight".to_owned(),
            name: "夜航系列".to_owned(),
            order: Some(1),
            total: 3,
            prev: Some(SeriesChapterLink {
                slug: "chapter-0".to_owned(),
                title: "长标题：夜航之前".to_owned(),
                series_title: Some("第零章".to_owned()),
            }),
            next: None,
        };
        let value = serde_json::to_value(&nav).unwrap();
        println!(
            "GET /api/public/articles/<slug> → series =\n{}",
            serde_json::to_string_pretty(&value).unwrap()
        );
        assert_eq!(value["order"], 1);
        assert_eq!(value["prev"]["seriesTitle"], "第零章");
        assert!(value["next"].is_null());
    }
}
