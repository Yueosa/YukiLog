pub mod config;
mod http;

use axum::Router;

pub fn app() -> Router {
    http::router()
}
