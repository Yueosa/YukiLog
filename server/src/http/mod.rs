mod health;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    http::{HeaderName, HeaderValue},
    routing::{get, post, put},
};
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer, services::ServeDir, set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};

use crate::AppState;

pub fn router(state: AppState) -> Router {
    use crate::content::{admin, overview, public, public_api, settings};

    let media_files = ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("cache-control"),
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        ))
        .service(ServeDir::new(state.media.public_dir()));

    Router::new()
        .route("/", get(crate::site::gateway::home_page))
        .route("/articles", get(crate::site::gateway::article_list_page))
        .route(
            "/articles/{slug}",
            get(crate::site::gateway::article_detail_page),
        )
        .route("/dynamics", get(crate::site::gateway::dynamic_list_page))
        // 无 JS 表单回退（SSR 阅读版：纯表单评论与点赞，303 回跳）
        .route(
            "/articles/{slug}/comments",
            post(crate::content::public::article_comment_form),
        )
        .route(
            "/articles/{slug}/like",
            post(crate::content::public::article_like_form),
        )
        .route(
            "/dynamics/{id}/comments",
            post(crate::content::public::dynamic_comment_form),
        )
        .route(
            "/dynamics/{id}/like",
            post(crate::content::public::dynamic_like_form),
        )
        .route("/friends", get(crate::site::gateway::friend_list_page))
        .route(
            "/friends/apply",
            post(crate::content::public::friend_apply_form),
        )
        .route("/search", get(crate::site::gateway::search_page))
        .route("/feed.xml", get(crate::ops::feed::all))
        .route("/feeds/articles.xml", get(crate::ops::feed::articles))
        .route("/feeds/dynamics.xml", get(crate::ops::feed::dynamics))
        .route("/sitemap.xml", get(crate::ops::seo::sitemap))
        .route("/robots.txt", get(crate::ops::seo::robots))
        .route("/api/public/site", get(public_api::site))
        .route("/api/public/articles", get(public_api::articles))
        .route(
            "/api/public/articles/{slug}",
            get(public_api::article_detail),
        )
        .route(
            "/api/public/articles/{slug}/comments",
            get(public_api::article_comments),
        )
        .route("/api/public/dynamics", get(public_api::dynamic_list))
        .route(
            "/api/public/dynamics/{id}/comments",
            get(public_api::dynamic_comments),
        )
        .route("/api/public/friends", get(public_api::friends))
        .route("/api/public/pulse", get(public_api::pulse))
        .route("/api/public/search", get(public_api::search))
        .route("/api/hitokoto", get(crate::ops::hitokoto::hitokoto))
        .route(
            "/api/friend-link-applications",
            post(public::apply_friend_link),
        )
        .route("/api/subscriptions", post(crate::ops::subscriptions::subscribe))
        .route("/subscriptions", post(crate::ops::subscriptions::subscribe_form))
        .route(
            "/subscriptions/confirm/{token}",
            get(crate::ops::subscriptions::confirm),
        )
        .route(
            "/api/subscriptions/unsubscribe",
            post(crate::ops::subscriptions::unsubscribe),
        )
        .route(
            "/subscriptions/unsubscribe/{token}",
            get(crate::ops::subscriptions::unsubscribe_page)
                .post(crate::ops::subscriptions::unsubscribe_form),
        )
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready))
        .route("/api/admin/auth/login", post(crate::auth::login))
        .route("/api/admin/auth/session", get(crate::auth::session))
        .route("/api/admin/auth/logout", post(crate::auth::logout))
        .route("/api/admin/overview", get(overview::overview))
        .route(
            "/api/admin/auth/password",
            put(crate::auth::change_password),
        )
        .route(
            "/api/admin/categories",
            get(admin::list_categories).post(admin::create_category),
        )
        .route(
            "/api/admin/categories/{id}",
            put(admin::update_category).delete(admin::delete_category),
        )
        .route(
            "/api/admin/tags",
            get(admin::list_tags).post(admin::create_tag),
        )
        .route(
            "/api/admin/tags/{id}",
            put(admin::update_tag).delete(admin::delete_tag),
        )
        .route(
            "/api/admin/articles",
            get(admin::list_articles).post(admin::create_article),
        )
        .route(
            "/api/admin/articles/{id}",
            get(admin::get_article)
                .put(admin::update_article)
                .delete(admin::delete_article),
        )
        .route(
            "/api/admin/articles/{id}/publish",
            post(admin::publish_article),
        )
        .route(
            "/api/admin/articles/{id}/withdraw",
            post(admin::withdraw_article),
        )
        .route(
            "/api/admin/articles/{id}/featured",
            put(admin::set_article_featured),
        )
        .route(
            "/api/admin/dynamics",
            get(admin::list_dynamics).post(admin::create_dynamic),
        )
        .route(
            "/api/admin/dynamics/{id}",
            get(admin::get_dynamic)
                .put(admin::update_dynamic)
                .delete(admin::delete_dynamic),
        )
        .route(
            "/api/admin/dynamics/{id}/publish",
            post(admin::publish_dynamic),
        )
        .route(
            "/api/admin/dynamics/{id}/withdraw",
            post(admin::withdraw_dynamic),
        )
        .route("/api/admin/comments", get(admin::list_comments))
        .route(
            "/api/admin/comments/{id}",
            put(admin::update_comment_status).delete(admin::delete_comment),
        )
        .route(
            "/api/admin/friend-links",
            get(admin::list_friend_links).post(admin::create_friend_link),
        )
        .route(
            "/api/admin/friend-links/{id}",
            put(admin::update_friend_link).delete(admin::delete_friend_link),
        )
        .route(
            "/api/admin/media",
            get(admin::list_media)
                .post(crate::ops::media::upload)
                .layer(DefaultBodyLimit::max(
                    crate::ops::media::MAX_UPLOAD_BYTES + 1024 * 1024,
                )),
        )
        .route(
            "/api/admin/media/{id}",
            axum::routing::delete(crate::ops::media::delete),
        )
        .route(
            "/api/admin/settings",
            get(settings::get_settings).put(settings::put_settings),
        )
        .route(
            "/api/admin/parts/registry",
            get(crate::content::parts::registry),
        )
        .route(
            "/api/admin/subscribers",
            get(crate::ops::subscriptions::admin_list_subscribers),
        )
        .route(
            "/api/admin/subscribers/{id}",
            axum::routing::delete(crate::ops::subscriptions::admin_delete_subscriber),
        )
        .route(
            "/api/admin/deliveries",
            get(crate::ops::subscriptions::admin_list_deliveries),
        )
        .route(
            "/api/admin/deliveries/{id}/retry",
            post(crate::ops::subscriptions::admin_retry_delivery),
        )
        .route(
            "/api/admin/deliveries/{id}/cancel",
            post(crate::ops::subscriptions::admin_cancel_delivery),
        )
        .route("/api/admin/notifications", get(crate::ops::notifications::list))
        .route(
            "/api/admin/notifications/read-all",
            post(crate::ops::notifications::mark_all_read),
        )
        .route(
            "/api/admin/notifications/{id}/read",
            post(crate::ops::notifications::mark_read),
        )
        .route(
            "/api/admin/notifications/{id}/email-retry",
            post(crate::ops::notifications::retry_email),
        )
        .route(
            "/api/admin/notifications/{id}/email-cancel",
            post(crate::ops::notifications::cancel_email),
        )
        .route(
            "/api/admin/notification-settings",
            get(crate::ops::notifications::get_settings).put(crate::ops::notifications::put_settings),
        )
        .route(
            "/api/articles/{id}/comments",
            get(public::list_article_comments).post(public::create_article_comment),
        )
        .route(
            "/api/dynamics/{id}/comments",
            get(public::list_dynamic_comments).post(public::create_dynamic_comment),
        )
        .route("/api/articles/{id}/view", post(public::record_view))
        .route("/api/articles/{id}/metrics", get(public::get_metrics))
        .route(
            "/api/articles/{id}/like",
            put(public::like_article).delete(public::unlike_article),
        )
        .route(
            "/api/dynamics/{id}/metrics",
            get(public::get_dynamic_metrics),
        )
        .route(
            "/api/dynamics/{id}/like",
            post(public::like_dynamic).delete(public::unlike_dynamic),
        )
        .nest_service("/media", media_files)
        .layer(DefaultBodyLimit::max(256 * 1024))
        .layer(CompressionLayer::new())
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("SAMEORIGIN"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
        ))
        // Full CSP lives in ops/nginx/yukilog.conf; the SSR pages rely on inline
        // <script>/<style>, so the app layer only pins framing (modern equivalent
        // of X-Frame-Options) for deployments without the nginx front proxy.
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static("frame-ancestors 'self'"),
        ))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use axum::{
        body::Body,
        http::{Request, StatusCode, header},
    };
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    use super::*;

    fn test_state() -> AppState {
        AppState::for_test()
    }

    #[tokio::test]
    async fn live_endpoint_reports_healthy() {
        let response = router(test_state())
            .oneshot(
                Request::builder()
                    .uri("/health/live")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers()["x-content-type-options"],
            HeaderValue::from_static("nosniff")
        );

        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["service"], "yukilog");
        assert_eq!(json["status"], "ok");
    }

    #[tokio::test]
    async fn ready_endpoint_reports_disconnected_database() {
        let response = router(test_state())
            .oneshot(
                Request::builder()
                    .uri("/health/ready")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["database"], "unavailable");
    }

    #[tokio::test]
    async fn admin_session_requires_authentication() {
        let response = router(test_state())
            .oneshot(
                Request::builder()
                    .uri("/api/admin/auth/session")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn media_service_supports_byte_ranges() {
        let target_dir =
            PathBuf::from(std::env::var("CARGO_TARGET_DIR").unwrap_or_else(|_| "target".into()));
        let media_dir = target_dir.join(format!("yukilog-range-test-{}", std::process::id()));
        tokio::fs::create_dir_all(&media_dir).await.unwrap();
        tokio::fs::write(media_dir.join("sample.mp4"), b"0123456789")
            .await
            .unwrap();

        let response = ServeDir::new(&media_dir)
            .oneshot(
                Request::builder()
                    .uri("/sample.mp4")
                    .header(header::RANGE, "bytes=2-5")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(
            response.into_body().collect().await.unwrap().to_bytes(),
            "2345"
        );

        tokio::fs::remove_dir_all(media_dir).await.unwrap();
    }
}
