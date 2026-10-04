use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use sea_orm::{DbErr, RuntimeErr, SqlErr};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database operation failed")]
    Database(#[from] DbErr),
    #[error("invalid request: {0}")]
    InvalidRequest(&'static str),
    #[error("authentication required")]
    Unauthorized,
    #[error("request origin or CSRF token is invalid")]
    Forbidden,
    #[error("too many authentication attempts")]
    RateLimited,
    #[error("internal operation failed: {0}")]
    Internal(&'static str),
}

#[derive(Serialize)]
struct ErrorResponse {
    code: &'static str,
    message: &'static str,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            Self::Database(error) => classify_database_error(error),
            Self::InvalidRequest(message) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "invalid_request",
                *message,
            ),
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "invalid_credentials",
                "登录信息无效",
            ),
            Self::Forbidden => (StatusCode::FORBIDDEN, "forbidden", "请求验证失败"),
            Self::RateLimited => (
                StatusCode::TOO_MANY_REQUESTS,
                "rate_limited",
                "尝试次数过多，请稍后再试",
            ),
            Self::Internal(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "服务器内部错误",
            ),
        };

        if status.is_server_error() {
            tracing::error!(error = ?self, "request failed");
        }

        (status, Json(ErrorResponse { code, message })).into_response()
    }
}

fn classify_database_error(error: &DbErr) -> (StatusCode, &'static str, &'static str) {
    match error.sql_err() {
        Some(SqlErr::UniqueConstraintViolation(_)) => {
            return (StatusCode::CONFLICT, "conflict", "数据已经存在");
        }
        Some(SqlErr::ForeignKeyConstraintViolation(_)) => {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                "invalid_reference",
                "引用的数据不存在或仍在使用",
            );
        }
        Some(_) | None => {}
    }

    if let Some(code) = postgres_error_code(error) {
        return classify_postgres_code(&code);
    }

    if matches!(error, DbErr::ConnectionAcquire(_) | DbErr::Conn(_)) {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "database_unavailable",
            "数据库暂时不可用",
        );
    }

    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "database_error",
        "数据库操作失败",
    )
}

fn postgres_error_code(error: &DbErr) -> Option<String> {
    let runtime_error = match error {
        DbErr::Conn(error) | DbErr::Exec(error) | DbErr::Query(error) => error,
        _ => return None,
    };
    let RuntimeErr::SqlxError(sqlx::Error::Database(error)) = runtime_error else {
        return None;
    };
    error.code().map(|code| code.into_owned())
}

fn classify_postgres_code(code: &str) -> (StatusCode, &'static str, &'static str) {
    match code {
        "23505" => (StatusCode::CONFLICT, "conflict", "数据已经存在"),
        "23502" | "23503" | "23514" | "22001" | "22P02" => (
            StatusCode::UNPROCESSABLE_ENTITY,
            "invalid_data",
            "数据不符合约束",
        ),
        code if code.starts_with("08") || matches!(code, "57P01" | "57P02" | "57P03") => (
            StatusCode::SERVICE_UNAVAILABLE,
            "database_unavailable",
            "数据库暂时不可用",
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "database_error",
            "数据库操作失败",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_postgres_constraint_codes() {
        assert_eq!(classify_postgres_code("23505").0, StatusCode::CONFLICT);
        assert_eq!(
            classify_postgres_code("23514").0,
            StatusCode::UNPROCESSABLE_ENTITY
        );
    }

    #[test]
    fn maps_postgres_connection_codes() {
        assert_eq!(
            classify_postgres_code("08006").0,
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            classify_postgres_code("57P01").0,
            StatusCode::SERVICE_UNAVAILABLE
        );
    }
}
