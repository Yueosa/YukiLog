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
}

pub fn app(database: DatabaseConnection) -> Router {
    http::router(AppState { database })
}
