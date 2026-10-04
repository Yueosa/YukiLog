use std::net::SocketAddr;

use tracing_subscriber::EnvFilter;
use yukilog_server::{AppState, app, config::AppConfig, database};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("yukilog_server=info,tower_http=info")),
        )
        .init();

    let config = AppConfig::from_env()?;
    let database = database::connect(&config.database_url).await?;
    let listen_addr = config.listen_addr;
    let state = AppState::new(
        database.clone(),
        config.public_origin,
        config.media_dir,
        config.subscription_secret,
    )
    .await?;
    let listener = tokio::net::TcpListener::bind(listen_addr).await?;

    tracing::info!(address = %listen_addr, "YukiLog server started");
    axum::serve(
        listener,
        app(state).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    database.close().await?;
    Ok(())
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        tracing::error!(%error, "failed to listen for shutdown signal");
    }
    tracing::info!("shutdown signal received");
}
