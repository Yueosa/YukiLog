use axum::{
    extract::{ConnectInfo, Path, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::handler::{
    response::{ok, ApiResponse},
    state::AppState,
    utils::{check_rate_limit, generate_gravatar_url, get_client_ip, get_user_agent},
};
use crate::service::{
    self,
    comments::{Comment, CommentNode, CreateCommentInput},
    error::ServiceError,
};

// ================================
// DTO 定义
// ================================

#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    /// 评论者昵称
    pub nickname: String,
    /// 评论者邮箱
    pub email: String,
    /// 评论内容
    pub content: String,
    /// 父评论 ID（顶层评论为 null）
    pub parent_id: Option<i64>,
    /// 网站 URL（可选）
    pub website: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateCommentResponse {
    /// 评论 ID
    pub id: i64,
    /// 创建时间
    pub created_at: chrono::DateTime<chrono::FixedOffset>,
}

/// 公开评论：不含邮箱 / IP / UA
#[derive(Debug, Serialize)]
pub struct PublicComment {
    pub id: i64,
    pub post_id: i64,
    pub content: String,
    pub guest_nick: String,
    pub guest_website: Option<String>,
    pub parent_id: Option<i64>,
    pub root_id: Option<i64>,
    pub visitor_info: Option<String>,
    pub avatar_url: String,
    pub created_at: chrono::DateTime<chrono::FixedOffset>,
}

#[derive(Debug, Serialize)]
pub struct PublicCommentNode {
    pub comment: PublicComment,
    pub children: Vec<PublicCommentNode>,
}

fn to_public_comment(comment: &Comment) -> PublicComment {
    PublicComment {
        id: comment.id,
        post_id: comment.post_id,
        content: comment.content.clone(),
        guest_nick: comment.guest_nick.clone(),
        guest_website: comment.guest_website.clone(),
        parent_id: comment.parent_id,
        root_id: comment.root_id,
        visitor_info: comment.visitor_info.clone(),
        avatar_url: generate_gravatar_url(comment.guest_email.as_deref().unwrap_or("")),
        created_at: comment.created_at,
    }
}

fn to_public_tree(nodes: Vec<CommentNode>) -> Vec<PublicCommentNode> {
    nodes
        .into_iter()
        .map(|node| PublicCommentNode {
            comment: to_public_comment(&node.comment),
            children: to_public_tree(node.children),
        })
        .collect()
}

// ================================
// Handler 实现
// ================================

/// GET /api/public/posts/:slug/comments
///
/// 获取文章评论树（仅返回顶层评论和直接回复）
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
///   "data": [
///     {
///       "id": 1,
///       "post_id": 1,
///       "nickname": "张三",
///       "email_hash": "abc123",
///       "avatar_url": "https://www.gravatar.com/avatar/abc123?d=identicon",
///       "content": "评论内容",
///       "parent_id": null,
///       "root_id": null,
///       "website": "https://example.com",
///       "status": "approved",
///       "ip_address": "127.0.0.1",
///       "user_agent": "Mozilla/5.0",
///       "created_at": "2024-01-01T00:00:00Z",
///       "replies": [
///         {
///           "id": 2,
///           "nickname": "李四",
///           "content": "回复内容",
///           "parent_id": 1,
///           "root_id": 1,
///           "replies": []
///         }
///       ]
///     }
///   ]
/// }
/// ```
pub async fn get_post_comments(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ApiResponse<Vec<PublicCommentNode>>>, ServiceError> {
    let comments = service::comments::get_post_comment_tree(&state.db, &slug).await?;
    Ok(ok(to_public_tree(comments)))
}

/// GET /api/public/posts/:slug/comments/:id
///
/// 获取评论的所有回复（延迟加载）
///
/// # 路径参数
///
/// - `slug`: 文章 slug（未使用，仅用于 RESTful 路径语义）
/// - `id`: 评论 ID
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": [
///     {
///       "id": 3,
///       "nickname": "王五",
///       "content": "回复内容",
///       "parent_id": 2,
///       "root_id": 1,
///       "replies": []
///     }
///   ]
/// }
/// ```
pub async fn get_comment_replies(
    State(state): State<AppState>,
    Path((_slug, id)): Path<(String, i64)>,
) -> Result<Json<ApiResponse<Vec<PublicComment>>>, ServiceError> {
    let replies = service::comments::list_comment_replies(&state.db, id).await?;
    Ok(ok(replies.iter().map(to_public_comment).collect()))
}

/// POST /api/public/posts/:slug/comments
///
/// 创建评论
///
/// # 限流
///
/// - 同一 IP 10 秒内只能发表 1 条评论
/// - 触发限流返回 400 错误
///
/// # 路径参数
///
/// - `slug`: 文章 slug
///
/// # 请求体
///
/// ```json
/// {
///   "nickname": "张三",
///   "email": "zhangsan@example.com",
///   "content": "评论内容",
///   "parent_id": null,
///   "website": "https://example.com"
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
///     "created_at": "2024-01-01T00:00:00Z"
///   }
/// }
/// ```
pub async fn create_comment(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Path(slug): Path<String>,
    Json(req): Json<CreateCommentRequest>,
) -> Result<Json<ApiResponse<CreateCommentResponse>>, ServiceError> {
    let ip = get_client_ip(&headers, addr);
    let cache_key = format!("comment:{}:{}", slug, ip);

    // IP 限流检查（10 秒）
    if !check_rate_limit(&state.redis, &cache_key, 10)
        .await
        .map_err(|e| {
            tracing::error!("Redis error in check_rate_limit: {:?}", e);
            ServiceError::InvalidInput("限流检查失败".to_string())
        })?
    {
        return Err(ServiceError::InvalidInput(
            "评论过于频繁，请稍后再试".to_string(),
        ));
    }

    // 获取 IP 和 User-Agent
    let user_agent = get_user_agent(&headers);

    // 创建评论输入
    let input = CreateCommentInput {
        content: req.content,
        guest_nick: req.nickname,
        guest_email: Some(req.email),
        guest_website: req.website,
        parent_id: req.parent_id,
        ip: Some(ip.to_string()),
        ua: user_agent,
    };

    let comment = service::comments::create_comment(&state.db, &slug, input).await?;

    tracing::info!(
        "Comment created: id={}, post_slug={}, ip={}",
        comment.id,
        slug,
        ip
    );

    Ok(ok(CreateCommentResponse {
        id: comment.id,
        created_at: comment.created_at,
    }))
}
