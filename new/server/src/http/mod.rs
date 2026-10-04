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
    use crate::content::{admin, design, public, settings};

    let media_files = ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("cache-control"),
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        ))
        .service(ServeDir::new(state.media.public_dir()));

    Router::new()
        .route("/", get(crate::web::home))
        .route("/articles", get(crate::web::article_list))
        .route("/articles/{slug}", get(crate::web::article_detail))
        .route("/dynamics", get(crate::web::dynamic_list))
        .route("/friends", get(crate::web::friend_list))
        .route("/search", get(crate::web::search))
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready))
        .route("/api/admin/auth/login", post(crate::auth::login))
        .route("/api/admin/auth/session", get(crate::auth::session))
        .route("/api/admin/auth/logout", post(crate::auth::logout))
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
                .post(crate::media::upload)
                .layer(DefaultBodyLimit::max(
                    crate::media::MAX_UPLOAD_BYTES + 1024 * 1024,
                )),
        )
        .route("/api/admin/layouts", get(design::list_layouts))
        .route(
            "/api/admin/layouts/{page_key}",
            get(design::get_layout).put(design::put_layout),
        )
        .route(
            "/api/admin/settings",
            get(settings::get_settings).put(settings::put_settings),
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
