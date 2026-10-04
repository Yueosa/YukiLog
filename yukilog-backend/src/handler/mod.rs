use axum::{
    extract::DefaultBodyLimit,
    routing::{delete, get, post, put},
    Router,
};

use crate::handler::state::AppState;

/// 统一响应格式
pub mod response;

/// 错误处理和转换
pub mod error;

/// JWT 认证和登录
pub mod auth;

/// 中间件（JWT 认证等）
pub mod middleware;

/// 工具函数（IP提取、限流、Gravatar）
pub mod utils;

/// 应用程序状态（数据库连接和 Redis 客户端）
pub mod state;

/// 存活与就绪检查
pub mod health;

/// 公开接口（前台）
pub mod public;

/// 管理接口（后台）
pub mod admin;

// ================================
// 路由注册
// ================================

/// 认证路由（登录）
pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/api/admin/login", post(auth::login))
        .layer(DefaultBodyLimit::max(16 * 1024))
}

/// 公开路由（前台，无需认证）
pub fn public_routes() -> Router<AppState> {
    Router::new()
        // Themes (3个)
        .route("/api/public/themes", get(public::themes::list_themes))
        .route("/api/public/themes/:slug", get(public::themes::get_theme))
        .route("/api/public/themes/:slug/view", post(public::themes::increment_theme_view))
        // Tags (3个)
        .route("/api/public/tags", get(public::tags::list_tags))
        .route("/api/public/tags/:slug", get(public::tags::get_tag))
        .route("/api/public/tags/:slug/view", post(public::tags::increment_tag_view))
        // Posts (3个)
        .route("/api/public/posts", get(public::posts::list_posts))
        .route("/api/public/posts/:slug", get(public::posts::get_post))
        .route("/api/public/posts/:slug/view", post(public::posts::increment_post_view))
        // Search (1个)
        .route("/api/public/search", get(public::posts::search_posts))
        // Stats (1个)
        .route("/api/public/stats", get(public::posts::get_site_stats))
        // Comments (3个)
        .route("/api/public/posts/:slug/comments", get(public::comments::get_post_comments))
        .route("/api/public/posts/:slug/comments", post(public::comments::create_comment))
        .route("/api/public/posts/:slug/comments/:id", get(public::comments::get_comment_replies))
        // Links (2个)
        .route("/api/public/links", get(public::links::list_links))
        .route("/api/public/links/submit", post(public::links::submit_link))
        // Notes (2个)
        .route("/api/public/notes", get(public::notes::list_notes))
        .route("/api/public/notes/:id", get(public::notes::get_note))
        .layer(DefaultBodyLimit::max(256 * 1024))
}

/// 管理路由（后台，需要 JWT 认证）
pub fn admin_routes() -> Router<AppState> {
    Router::new()
        // Themes (3个)
        .route("/api/admin/themes", post(admin::themes::create_theme))
        .route("/api/admin/themes/:id", put(admin::themes::update_theme))
        .route("/api/admin/themes/:id", delete(admin::themes::delete_theme))
        // Tags (4个)
        .route("/api/admin/tags", post(admin::tags::create_tag))
        .route("/api/admin/tags/:id", put(admin::tags::update_tag))
        .route("/api/admin/tags/:id", delete(admin::tags::delete_tag))
        .route("/api/admin/tags/merge", post(admin::tags::merge_tags))
        // Posts (5个)
        .route("/api/admin/posts", get(admin::posts::list_posts))
        .route("/api/admin/posts", post(admin::posts::create_post))
        .route("/api/admin/posts/:slug", get(admin::posts::get_post))
        .route("/api/admin/posts/:slug", put(admin::posts::update_post))
        .route("/api/admin/posts/:slug", delete(admin::posts::delete_post))
        // Comments (6个)
        .route("/api/admin/comments", get(admin::comments::list_comments))
        .route("/api/admin/comments/pending", get(admin::comments::list_pending_comments))
        .route("/api/admin/comments/:id/approve", put(admin::comments::approve_comment))
        .route("/api/admin/comments/:id/reject", put(admin::comments::reject_comment))
        .route("/api/admin/comments/:id", put(admin::comments::update_comment))
        .route("/api/admin/comments/:id", delete(admin::comments::delete_comment))
        // Links (6个)
        .route("/api/admin/links", get(admin::links::list_links))
        .route("/api/admin/links/pending", get(admin::links::list_pending_links))
        .route("/api/admin/links/:id/approve", put(admin::links::approve_link))
        .route("/api/admin/links/:id/broken", put(admin::links::mark_link_broken))
        .route("/api/admin/links/:id", put(admin::links::update_link))
        .route("/api/admin/links/:id", delete(admin::links::delete_link))
        // Notes (4个)
        .route("/api/admin/notes", get(admin::notes::list_notes))
        .route("/api/admin/notes", post(admin::notes::create_note))
        .route("/api/admin/notes/:id", put(admin::notes::update_note))
        .route("/api/admin/notes/:id", delete(admin::notes::delete_note))
        .layer(DefaultBodyLimit::max(4 * 1024 * 1024))
        // 应用 JWT 认证中间件 - 需要在 with_state 之后应用
}


/// 应用根路由（合并所有路由）
pub fn app_routes(state: AppState) -> Router {
    let admin_routes_with_auth = admin_routes()
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            self::middleware::jwt_auth,
        ));

    Router::new()
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready))
        .merge(auth_routes())
        .merge(public_routes())
        .merge(admin_routes_with_auth)
        .with_state(state)
}
