use axum::Json;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct LiveResponse {
    service: &'static str,
    status: &'static str,
}

pub async fn live() -> Json<LiveResponse> {
    Json(LiveResponse {
        service: "yukilog",
        status: "ok",
    })
}
