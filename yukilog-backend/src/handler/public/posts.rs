use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use std::net::SocketAddr;

use crate::domain::status::PostStatus;
use crate::handler::{
    response::{ok, paged, ApiResponse, PagedData},
    state::AppState,
    utils::{check_rate_limit, get_client_ip},
};
use crate::service::{
    self,
    error::ServiceError,
    posts::{PostFilter, PostSortBy, PostWithRelations},
};

// ================================
// DTO 定义
// ================================

#[derive(Debug, Deserialize)]
pub struct ListPostsQuery {
    /// 分页：页码（从 1 开始）
    pub page: Option<u64>,
    /// 分页：每页数量（默认 10，最大 100）
    pub page_size: Option<u64>,
    /// 排序方式
    pub sort: Option<PostSortBy>,
    /// 筛选：主题 slug（多个用逗号分隔）
    pub theme_slugs: Option<String>,
    /// 筛选：标签 slug（多个标签用逗号分隔，AND 关系）
    pub tag_slugs: Option<String>,
    /// 筛选：仅精选文章
    pub is_featured: Option<bool>,
}

// ================================
// Handler 实现
// ================================

/// GET /api/public/posts
///
/// 获取文章列表（分页）
///
/// # 查询参数
///
/// - `page`: 页码（从 1 开始，默认 1）
/// - `page_size`: 每页数量（默认 10，最大 100）
/// - `sort`: 排序方式（view_count | created_at | updated_at）
/// - `theme_slugs`: 按主题筛选（多个用逗号分隔）
/// - `tag_slugs`: 按标签筛选（多个标签用逗号分隔，AND 关系）
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": {
///     "items": [
///       {
///         "id": 1,
///         "title": "文章标题",
///         "slug": "article-slug",
///         "summary": "文章摘要",
///         "content": "文章内容",
///         "status": "Published",
///         "theme_id": 1,
///         "view_count": 100,
///         "created_at": "2024-01-01T00:00:00Z",
///         "updated_at": "2024-01-01T00:00:00Z"
///       }
///     ],
///     "total": 100,
///     "page": 1,
///     "page_size": 10,
///     "total_pages": 10
///   }
/// }
/// ```
pub async fn list_posts(
    State(state): State<AppState>,
    Query(params): Query<ListPostsQuery>,
) -> Result<Json<ApiResponse<PagedData<PostWithRelations>>>, ServiceError> {
    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(10).min(100).max(1);

    // 解析主题 slug 列表
    let theme_slugs = params
        .theme_slugs
        .as_ref()
        .map(|s| s.split(',').map(|t| t.trim().to_string()).collect::<Vec<_>>());

    // 解析标签 slug 列表
    let tag_slugs = params
        .tag_slugs
        .as_ref()
        .map(|s| s.split(',').map(|t| t.trim().to_string()).collect::<Vec<_>>());

    // 构造过滤器（仅返回已发布的文章）
    let filter = PostFilter {
        theme_slugs,
        tag_slugs,
        status: Some(PostStatus::Published),
        sort_by: params.sort,
        count: Some(page_size),
        page: Some(page),
        is_featured: params.is_featured,
    };

    // 获取文章列表（含关联数据）
    let posts = service::posts::list_posts_with_relations(&state.db, filter.clone()).await?;

    // 获取总数（SELECT COUNT(*)）
    let count_filter = PostFilter {
        count: None,
        page: None,
        ..filter
    };
    let total = service::posts::count_posts(&state.db, count_filter).await?;

    Ok(paged(posts, total, page, page_size))
}

/// GET /api/public/posts/:slug
///
/// 获取文章详情
///
/// # 路径参数
///
/// - `slug`: 文章 slug
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": {
///     "id": 1,
///     "title": "文章标题",
///     "slug": "article-slug",
///     "summary": "文章摘要",
///     "content": "文章内容",
///     "status": "Published",
///     "theme_id": 1,
///     "view_count": 100,
///     "created_at": "2024-01-01T00:00:00Z",
///     "updated_at": "2024-01-01T00:00:00Z"
///   }
/// }
/// ```
pub async fn get_post(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ApiResponse<PostWithRelations>>, ServiceError> {
    // 获取文章及关联数据（include_draft = false）
    let post_with_rels = service::posts::get_post_with_relations(&state.db, &slug, false).await?;

    // 仅返回已发布的文章
    if post_with_rels.post.status != PostStatus::Published {
        return Err(ServiceError::NotFound);
    }

    Ok(ok(post_with_rels))
}

/// POST /api/public/posts/:slug/view
///
/// 增加文章浏览计数
///
/// # 限流
///
/// - 同一 IP 10 分钟内只计数一次
/// - 静默处理：已访问过返回成功，但不增加计数
///
/// # 路径参数
///
/// - `slug`: 文章 slug
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": null
/// }
/// ```
pub async fn increment_post_view(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> Result<Json<ApiResponse<()>>, ServiceError> {
    let ip = get_client_ip(&headers, addr, state.config.trust_proxy_headers);
    let cache_key = format!("view:post:{}:{}", slug, ip);

    // IP 限流检查（10 分钟）
    if !check_rate_limit(&state.redis, &cache_key, 600)
        .await
        .map_err(|e| {
            tracing::error!("Redis error in check_rate_limit: {:?}", e);
            ServiceError::Unavailable("限流服务暂时不可用".to_string())
        })?
    {
        // 已访问过，静默返回成功
        return Ok(ok(()));
    }

    // 获取文章并增加计数
    let post = service::posts::get_post_by_slug(&state.db, &slug).await?;

    // 仅对已发布的文章计数
    if post.status != PostStatus::Published {
        return Err(ServiceError::NotFound);
    }

    service::posts::increment_view_count(&state.db, post.id).await?;

    tracing::debug!("Post {} view incremented for IP: {}", slug, ip);
    Ok(ok(()))
}

// ================================
// 搜索
// ================================

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    /// 搜索关键词
    pub q: String,
    /// 分页：页码（从 1 开始，默认 1）
    pub page: Option<u64>,
    /// 分页：每页数量（默认 10，最大 50）
    pub page_size: Option<u64>,
}

/// GET /api/public/search?q=keyword&page=1&page_size=10
///
/// 全文搜索文章（ILIKE 模糊匹配 title + summary + content）
///
/// # 搜索范围
///
/// 仅搜索已发布（published）的文章，匹配 title / summary / content 中的关键词。
///
/// # 排序
///
/// 按相关性排序：标题匹配 > 摘要匹配 > 内容匹配 > 创建时间倒序
///
/// # 高亮
///
/// 搜索结果中 title / summary / content 中的关键词会用 `<mark>` 标签包裹。
/// content 字段会被截取为关键词附近约 200 字符的摘要。
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": {
///     "items": [...],
///     "total": 5,
///     "page": 1,
///     "page_size": 10,
///     "total_pages": 1
///   }
/// }
/// ```
pub async fn search_posts(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<ApiResponse<PagedData<PostWithRelations>>>, ServiceError> {
    let keyword = params.q.trim().to_string();

    // 关键词不能为空且长度合理
    if keyword.is_empty() {
        return Err(ServiceError::InvalidInput(
            "搜索关键词不能为空".to_string(),
        ));
    }
    if keyword.len() > 100 {
        return Err(ServiceError::InvalidInput(
            "搜索关键词过长（最多 100 个字符）".to_string(),
        ));
    }

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(10).min(50).max(1);

    let (results, total) =
        service::posts::search_posts(&state.db, &keyword, page, page_size).await?;

    Ok(paged(results, total, page, page_size))
}

/// GET /api/public/stats
///
/// 获取站点统计数据
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": {
///     "total_posts": 12,
///     "total_views": 4567,
///     "total_words": 123456
///   }
/// }
/// ```
pub async fn get_site_stats(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<service::posts::SiteStats>>, ServiceError> {
    let stats = service::posts::get_site_stats(&state.db).await?;
    Ok(ok(stats))
}
