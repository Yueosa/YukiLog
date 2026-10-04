pub mod auth;
pub mod config;
pub mod content;
pub mod database;
pub mod entities;
pub mod error;
pub mod feed;
mod http;
pub mod layout;
pub mod mail;
pub mod markdown;
pub mod media;
pub mod notifications;
pub mod subscriptions;
pub mod web;

use axum::Router;
use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct AppState {
    pub(crate) database: DatabaseConnection,
    pub(crate) auth: auth::AuthState,
    pub(crate) content: content::ContentState,
    pub(crate) media: media::MediaStorage,
    pub(crate) subscriptions: subscriptions::SubscriptionState,
}

impl AppState {
    pub async fn new(
        database: DatabaseConnection,
        public_origin: String,
        media_dir: std::path::PathBuf,
        subscription_secret: String,
    ) -> Result<Self, error::AppError> {
        let auth = auth::AuthState::new(public_origin).await?;
        let media = media::MediaStorage::new(media_dir).await?;
        let subscriptions = subscriptions::SubscriptionState::new(subscription_secret)?;
        Ok(Self {
            database,
            auth,
            content: content::ContentState::default(),
            media,
            subscriptions,
        })
    }

    #[cfg(test)]
    pub(crate) fn for_test() -> Self {
        Self {
            database: DatabaseConnection::Disconnected,
            auth: auth::AuthState::for_test(),
            content: content::ContentState::default(),
            media: media::MediaStorage::for_test(),
            subscriptions: subscriptions::SubscriptionState::new(
                "test subscription signing secret with more than 32 bytes".into(),
            )
            .unwrap(),
        }
    }
}

pub fn app(state: AppState) -> Router {
    http::router(state)
}
