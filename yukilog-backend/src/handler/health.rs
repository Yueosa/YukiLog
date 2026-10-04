use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

use crate::handler::state::AppState;

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    status: &'static str,
    database: Option<bool>,
    redis: Option<bool>,
}

pub async fn live() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        database: None,
        redis: None,
    })
}

pub async fn ready(State(state): State<AppState>) -> Response {
    let database = state.db.ping();
    let redis = async {
        let mut connection = state.redis.get_multiplexed_tokio_connection().await?;
        redis::cmd("PING")
            .query_async::<_, String>(&mut connection)
            .await
            .map(|_| ())
    };
    let (database, redis) = tokio::join!(database, redis);
    let database_ok = database.is_ok();
    let redis_ok = redis.is_ok();
    let healthy = database_ok && redis_ok;

    if let Err(error) = &database {
        tracing::error!("Readiness database check failed: {:?}", error);
    }
    if let Err(error) = &redis {
        tracing::error!("Readiness Redis check failed: {:?}", error);
    }

    let status = if healthy {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (
        status,
        Json(HealthResponse {
            status: if healthy { "ok" } else { "unavailable" },
            database: Some(database_ok),
            redis: Some(redis_ok),
        }),
    )
        .into_response()
}
