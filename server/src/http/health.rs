use axum::{Json, extract::State, http::StatusCode};
use serde::Serialize;

use crate::AppState;

#[derive(Debug, Serialize)]
pub struct LiveResponse {
    service: &'static str,
    status: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ReadyResponse {
    service: &'static str,
    status: &'static str,
    database: &'static str,
}

pub async fn live() -> Json<LiveResponse> {
    Json(LiveResponse {
        service: "yukilog",
        status: "ok",
    })
}

pub async fn ready(State(state): State<AppState>) -> (StatusCode, Json<ReadyResponse>) {
    match state.database.ping().await {
        Ok(()) => (
            StatusCode::OK,
            Json(ReadyResponse {
                service: "yukilog",
                status: "ok",
                database: "ok",
            }),
        ),
        Err(error) => {
            tracing::warn!(%error, "database readiness probe failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(ReadyResponse {
                    service: "yukilog",
                    status: "unavailable",
                    database: "unavailable",
                }),
            )
        }
    }
}
