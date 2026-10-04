use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use std::net::SocketAddr;

use crate::handler::{
    response::{ok, ApiResponse},
    state::AppState,
    utils::{check_rate_limit, get_client_ip},
};
use crate::service::{self, error::ServiceError, tags::{Tag, TagSortBy}};

// ================================
// DTO 定义
// ================================

#[derive(Debug, Deserialize)]
pub struct ListTagsQuery {
    /// 排序方式
    pub sort: Option<TagSortBy>,
}

// ================================
// Handler 实现
// ================================

/// GET /api/public/tags
///
/// 获取所有标签列表
///
/// # 查询参数
///
/// - `sort`: 排序方式（post_count | view_count | created_at）
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": [
///     {
///       "id": 1,
///       "name": "Rust",
///       "slug": "rust",
///       "description": "Rust 编程语言",
///       "post_count": 5,
///       "view_count": 500,
///       "created_at": "2024-01-01T00:00:00Z"
///     }
///   ]
/// }
/// ```
pub async fn list_tags(
    State(state): State<AppState>,
    Query(params): Query<ListTagsQuery>,
) -> Result<Json<ApiResponse<Vec<Tag>>>, ServiceError> {
    let tags = service::tags::list_all_tags(&state.db, params.sort, None, None).await?;
    Ok(ok(tags))
}

/// GET /api/public/tags/:slug
///
/// 获取标签详情
///
/// # 路径参数
///
/// - `slug`: 标签 slug
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": {
///     "id": 1,
///     "name": "Rust",
///     "slug": "rust",
///     "description": "Rust 编程语言",
///     "post_count": 5,
///     "view_count": 500,
///     "created_at": "2024-01-01T00:00:00Z"
///   }
/// }
/// ```
pub async fn get_tag(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ApiResponse<Tag>>, ServiceError> {
    let tag = service::tags::get_tag_by_slug(&state.db, &slug).await?;
    Ok(ok(tag))
}

/// POST /api/public/tags/:slug/view
///
/// 增加标签浏览计数
///
/// # 限流
///
/// - 同一 IP 10 分钟内只计数一次
/// - 静默处理：已访问过返回成功，但不增加计数
///
/// # 路径参数
///
/// - `slug`: 标签 slug
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": null
/// }
/// ```
pub async fn increment_tag_view(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> Result<Json<ApiResponse<()>>, ServiceError> {
    let ip = get_client_ip(&headers, addr, state.config.trust_proxy_headers);
    let cache_key = format!("view:tag:{}:{}", slug, ip);

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

    // 获取标签并增加计数
    let tag = service::tags::get_tag_by_slug(&state.db, &slug).await?;
    service::tags::increment_view_count(&state.db, tag.id).await?;

    tracing::debug!("Tag {} view incremented for IP: {}", slug, ip);
    Ok(ok(()))
}
