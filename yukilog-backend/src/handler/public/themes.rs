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
use crate::service::{self, error::ServiceError, themes::{Theme, ThemeSortBy}};

// ================================
// DTO 定义
// ================================

#[derive(Debug, Deserialize)]
pub struct ListThemesQuery {
    /// 排序方式
    pub sort: Option<ThemeSortBy>,
}

// ================================
// Handler 实现
// ================================

/// GET /api/public/themes
///
/// 获取所有主题列表
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
///       "name": "技术",
///       "slug": "tech",
///       "description": "技术相关文章",
///       "post_count": 10,
///       "view_count": 1000,
///       "created_at": "2024-01-01T00:00:00Z"
///     }
///   ]
/// }
/// ```
pub async fn list_themes(
    State(state): State<AppState>,
    Query(params): Query<ListThemesQuery>,
) -> Result<Json<ApiResponse<Vec<Theme>>>, ServiceError> {
    let themes = service::themes::list_all_themes(&state.db, params.sort).await?;
    Ok(ok(themes))
}

/// GET /api/public/themes/:slug
///
/// 获取主题详情
///
/// # 路径参数
///
/// - `slug`: 主题 slug
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": {
///     "id": 1,
///     "name": "技术",
///     "slug": "tech",
///     "description": "技术相关文章",
///     "post_count": 10,
///     "view_count": 1000,
///     "created_at": "2024-01-01T00:00:00Z"
///   }
/// }
/// ```
pub async fn get_theme(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ApiResponse<Theme>>, ServiceError> {
    let theme = service::themes::get_theme_by_slug(&state.db, &slug).await?;
    Ok(ok(theme))
}

/// POST /api/public/themes/:slug/view
///
/// 增加主题浏览计数
///
/// # 限流
///
/// - 同一 IP 10 分钟内只计数一次
/// - 静默处理：已访问过返回成功，但不增加计数
///
/// # 路径参数
///
/// - `slug`: 主题 slug
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": null
/// }
/// ```
pub async fn increment_theme_view(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> Result<Json<ApiResponse<()>>, ServiceError> {
    let ip = get_client_ip(&headers, addr, state.config.trust_proxy_headers);
    let cache_key = format!("view:theme:{}:{}", slug, ip);

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

    // 获取主题并增加计数
    let theme = service::themes::get_theme_by_slug(&state.db, &slug).await?;
    service::themes::increment_view_count(&state.db, theme.id).await?;

    tracing::debug!("Theme {} view incremented for IP: {}", slug, ip);
    Ok(ok(()))
}
