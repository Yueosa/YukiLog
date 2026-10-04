pub mod auth;
pub mod config;
pub mod database;
pub mod entities;
pub mod error;
mod http;

use axum::Router;
use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct AppState {
    pub(crate) database: DatabaseConnection,
    pub(crate) auth: auth::AuthState,
}

impl AppState {
    pub async fn new(
        database: DatabaseConnection,
        public_origin: String,
    ) -> Result<Self, error::AppError> {
        let auth = auth::AuthState::new(public_origin).await?;
        Ok(Self { database, auth })
    }

    #[cfg(test)]
    pub(crate) fn for_test() -> Self {
        Self {
            database: DatabaseConnection::Disconnected,
            auth: auth::AuthState::for_test(),
        }
    }
}

pub fn app(state: AppState) -> Router {
    http::router(state)
}
