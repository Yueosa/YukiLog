use axum::{
    extract::{ConnectInfo, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::handler::{
    response::{ok, ApiResponse},
    state::AppState,
    utils::{check_rate_limit, get_client_ip},
};
use crate::service::{self, error::ServiceError, links::{CreateLinkInput, Link}};

// ================================
// DTO 定义
// ================================

#[derive(Debug, Deserialize)]
pub struct SubmitLinkRequest {
    /// 网站名称
    pub title: String,
    /// 网站 URL
    pub url: String,
    /// 网站头像 URL（可选）
    pub avatar: Option<String>,
    /// 网站描述
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SubmitLinkResponse {
    /// 友链 ID
    pub id: i64,
    /// 提示信息
    pub message: String,
}

// ================================
// Handler 实现
// ================================

/// GET /api/public/links
///
/// 获取活跃友链列表
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": [
///     {
///       "id": 1,
///       "name": "友链网站",
///       "url": "https://example.com",
///       "description": "友链描述",
///       "email": "admin@example.com",
///       "status": "active",
///       "created_at": "2024-01-01T00:00:00Z",
///       "updated_at": "2024-01-01T00:00:00Z"
///     }
///   ]
/// }
/// ```
pub async fn list_links(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<Link>>>, ServiceError> {
    let links = service::links::list_active_links(&state.db).await?;
    Ok(ok(links))
}

/// POST /api/public/links/submit
///
/// 提交友链申请
///
/// # 限流
///
/// - 同一 IP 10 分钟内只能提交 1 次
/// - 触发限流返回 400 错误
///
/// # 请求体
///
/// ```json
/// {
///   "title": "友链网站",
///   "url": "https://example.com",
///   "avatar": "https://example.com/avatar.png",
///   "description": "友链描述"
/// }
/// ```
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": {
///     "id": 1,
///     "message": "友链申请已提交，待管理员审核"
///   }
/// }
/// ```
///
/// # 说明
///
/// - 如果 URL 已存在且状态为 broken，将自动更新信息并恢复为 pending 状态
/// - 如果 URL 已存在且状态为 pending 或 active，将返回错误
pub async fn submit_link(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<SubmitLinkRequest>,
) -> Result<Json<ApiResponse<SubmitLinkResponse>>, ServiceError> {
    let ip = get_client_ip(&headers, addr, state.config.trust_proxy_headers);
    let cache_key = format!("link:submit:{}", ip);

    // IP 限流检查（10 分钟）
    if !check_rate_limit(&state.redis, &cache_key, 600)
        .await
        .map_err(|e| {
            tracing::error!("Redis error in check_rate_limit: {:?}", e);
            ServiceError::Unavailable("限流服务暂时不可用".to_string())
        })?
    {
        return Err(ServiceError::InvalidInput(
            "提交过于频繁，请 10 分钟后再试".to_string(),
        ));
    }

    // 创建友链申请（service层会处理重复URL和broken状态的logic）
    let input = CreateLinkInput {
        title: req.title,
        url: req.url,
        avatar: req.avatar,
        description: req.description,
    };

    let link = service::links::create_link_application(&state.db, input).await?;

    tracing::info!("Link application submitted: id={}, ip={}", link.id, ip);

    Ok(ok(SubmitLinkResponse {
        id: link.id,
        message: "友链申请已提交，待管理员审核".to_string(),
    }))
}
