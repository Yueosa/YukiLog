use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::repo::error::RepoError;
use crate::service::error::ServiceError;

use super::response::ApiResponse;

// ================================
// ServiceError → HTTP 响应
// ================================

impl IntoResponse for ServiceError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ServiceError::NotFound => (StatusCode::NOT_FOUND, "资源不存在".to_string()),

            ServiceError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg),

            ServiceError::Unavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg),

            ServiceError::Repo(repo_error) => match repo_error {
                RepoError::Db(e) => {
                    // 数据库错误应该记录日志，不暴露具体错误给客户端
                    tracing::error!("Database error: {:?}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, "数据库错误".to_string())
                }

                RepoError::NotFound => (StatusCode::NOT_FOUND, "资源不存在".to_string()),

                RepoError::InvalidStatus(status) => {
                    (StatusCode::BAD_REQUEST, format!("无效的状态值: {}", status))
                }
            },
        };

        (status, Json(ApiResponse::<()>::error(message))).into_response()
    }
}

// ================================
// 认证错误
// ================================

#[derive(Debug)]
#[allow(dead_code)]
pub enum AuthError {
    /// 无效的令牌
    InvalidToken,
    /// 令牌已过期
    TokenExpired,
    /// 缺少认证令牌
    MissingToken,
    /// 用户名或密码错误
    InvalidCredentials,
    /// 登录尝试过于频繁
    RateLimited,
    /// 认证依赖暂时不可用
    TemporarilyUnavailable,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "无效的令牌"),
            AuthError::TokenExpired => (StatusCode::UNAUTHORIZED, "令牌已过期"),
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "缺少认证令牌"),
            AuthError::InvalidCredentials => (StatusCode::UNAUTHORIZED, "用户名或密码错误"),
            AuthError::RateLimited => (StatusCode::TOO_MANY_REQUESTS, "登录尝试过于频繁"),
            AuthError::TemporarilyUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "认证服务暂时不可用",
            ),
        };

        (status, Json(ApiResponse::<()>::error(message))).into_response()
    }
}

// 便于错误转换
impl From<jsonwebtoken::errors::Error> for AuthError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        use jsonwebtoken::errors::ErrorKind;
        match err.kind() {
            ErrorKind::ExpiredSignature => AuthError::TokenExpired,
            _ => AuthError::InvalidToken,
        }
    }
}

impl From<argon2::password_hash::Error> for AuthError {
    fn from(_: argon2::password_hash::Error) -> Self {
        AuthError::InvalidCredentials
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_error_conversion() {
        // 测试 JWT 错误转换
        let jwt_err =
            jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::ExpiredSignature);
        let auth_err = AuthError::from(jwt_err);
        matches!(auth_err, AuthError::TokenExpired);
    }
}
