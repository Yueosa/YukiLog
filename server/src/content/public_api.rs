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
        dynamic_metrics, dynamics, friend_links, media_assets, site_settings, tags,
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
    }))
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
}
