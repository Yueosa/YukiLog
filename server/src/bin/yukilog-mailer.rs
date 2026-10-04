use tracing_subscriber::EnvFilter;
use yukilog_server::{database, mail};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("yukilog_server=info")),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL")?;
    let database = database::connect(&database_url).await?;
    let worker = mail::MailWorker::from_env(database.clone())?;
    tracing::info!("YukiLog mail worker started");
    let result = mail::run_forever(worker).await;
    database.close().await?;
    result
}
