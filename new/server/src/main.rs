use tracing_subscriber::EnvFilter;
use yukilog_server::{app, config::AppConfig, database};

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
    let listener = tokio::net::TcpListener::bind(config.listen_addr).await?;

    tracing::info!(address = %config.listen_addr, "YukiLog server started");
    axum::serve(listener, app(database.clone()))
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
