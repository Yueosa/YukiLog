pub mod auth;
pub mod config;
pub mod content;
pub mod database;
pub mod entities;
pub mod error;
mod http;
mod markup;
pub mod ops;
pub mod site;

use axum::Router;
use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct AppState {
    pub(crate) database: DatabaseConnection,
    pub(crate) auth: auth::AuthState,
    pub(crate) content: content::ContentState,
    pub(crate) media: ops::media::MediaStorage,
    pub(crate) subscriptions: ops::subscriptions::SubscriptionState,
    pub(crate) shell: site::gateway::ShellState,
}

impl AppState {
    pub async fn new(
        database: DatabaseConnection,
        public_origin: String,
        media_dir: std::path::PathBuf,
        subscription_secret: String,
    ) -> Result<Self, error::AppError> {
        let auth = auth::AuthState::new(public_origin).await?;
        let media = ops::media::MediaStorage::new(media_dir).await?;
        let subscriptions = ops::subscriptions::SubscriptionState::new(subscription_secret)?;
        Ok(Self {
            database,
            auth,
            content: content::ContentState::default(),
            media,
            subscriptions,
            shell: site::gateway::ShellState::from_env(),
        })
    }

    #[cfg(test)]
    pub(crate) fn for_test() -> Self {
        Self {
            database: DatabaseConnection::Disconnected,
            auth: auth::AuthState::for_test(),
            content: content::ContentState::default(),
            media: ops::media::MediaStorage::for_test(),
            subscriptions: ops::subscriptions::SubscriptionState::new(
                "test subscription signing secret with more than 32 bytes".into(),
            )
            .unwrap(),
            shell: site::gateway::ShellState::from_env(),
        }
    }
}

pub fn app(state: AppState) -> Router {
    http::router(state)
}
