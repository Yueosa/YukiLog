//! YukiLog 后端服务入口
//!
//! 本文件负责初始化并启动 HTTP 服务器。

mod config;
mod domain;
mod entities;
mod handler;
mod repo;
mod service;

use std::net::SocketAddr;

use axum::http::{
    header::{AUTHORIZATION, CONTENT_TYPE},
    HeaderName, HeaderValue, Method,
};
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    set_header::SetResponseHeaderLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 初始化日志系统
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("🚀 Starting YukiLog backend server...");

    // 2. 加载配置
    let config = config::AppConfig::from_env()
        .expect("Failed to load configuration from environment");

    tracing::info!(
        "Configuration loaded: database={}, redis={}, server={}:{}",
        mask_connection_string(&config.database_url),
        mask_connection_string(&config.redis_url),
        config.server_host,
        config.server_port
    );

    // 3. 连接数据库
    let db = sea_orm::Database::connect(&config.database_url)
        .await
        .expect("Failed to connect to PostgreSQL database");

    tracing::info!("✅ Connected to PostgreSQL database");

    // 4. 连接 Redis
    let redis = redis::Client::open(config.redis_url.clone())
        .expect("Failed to create Redis client");

    // 测试 Redis 连接
    redis
        .get_multiplexed_tokio_connection()
        .await
        .expect("Failed to connect to Redis");

    tracing::info!("✅ Connected to Redis");

    // 5. 创建应用状态
    let state = handler::state::AppState {
        config: config.clone(),
        db,
        redis,
    };

    // 6. 组装应用路由。未配置 CORS 时只接受浏览器同源请求；
    // 开发环境若前后端不同端口，必须显式配置允许的源。
    let app = handler::app_routes(state);
    let app = if let Some(origins_vec) = &config.cors_allowed_origins {
        let origins: Vec<_> = origins_vec
            .iter()
            .map(|s| s.parse::<axum::http::HeaderValue>().expect("Invalid CORS origin"))
            .collect();

        let cors = CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
            .allow_headers([AUTHORIZATION, CONTENT_TYPE])
            .allow_credentials(true);

        tracing::info!("✅ CORS configured: {:?}", origins_vec);
        app.layer(cors)
    } else {
        tracing::info!("✅ CORS disabled; browser API access is same-origin only");
        app
    }
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
    ));

    // 7. 启动服务器
    let addr = format!("{}:{}", config.server_host, config.server_port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("❌ Failed to bind to {}: {}", addr, e);
            std::process::exit(1);
        });

    tracing::info!("🎉 YukiLog backend server listening on http://{}", addr);
    tracing::info!("📝 Press Ctrl+C to shutdown");

    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await?;

    Ok(())
}

/// 辅助函数：遮蔽连接字符串中的敏感信息
fn mask_connection_string(s: &str) -> String {
    if let Some(at_pos) = s.find('@') {
        if let Some(proto_end) = s.find("://") {
            format!("{}://***@{}", &s[..proto_end], &s[at_pos + 1..])
        } else {
            "***".to_string()
        }
    } else {
        s.to_string()
    }
}
