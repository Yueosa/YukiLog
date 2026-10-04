use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    extract::{ConnectInfo, State},
    http::HeaderMap,
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::handler::{
    state::AppState,
    utils::{check_rate_limit_window, get_client_ip},
};

use super::error::AuthError;
use super::response::ApiResponse;

// ================================
// JWT Claims
// ================================

/// JWT 令牌中的声明
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// 用户名（subject）
    pub sub: String,
    /// 签发者
    pub iss: String,
    /// 受众
    pub aud: String,
    /// 签发时间（Unix 时间戳）
    pub iat: usize,
    /// 过期时间（Unix 时间戳）
    pub exp: usize,
}

// ================================
// 登录相关 DTO
// ================================

/// 登录请求
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// 登录响应
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    /// JWT 令牌
    pub token: String,
    /// 过期时间（秒）
    pub expires_in: i64,
}

// ================================
// JWT 工具函数
// ================================

/// 生成 JWT 令牌
///
/// # 参数
///
/// * `username` - 用户名
/// * `secret` - JWT 密钥
/// * `expires_in` - 过期时间（秒）
///
/// # 返回
///
/// 生成的 JWT 令牌字符串
pub fn generate_token(
    username: &str,
    secret: &str,
    expires_in: i64,
    issuer: &str,
    audience: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = (now + Duration::seconds(expires_in)).timestamp() as usize;

    let claims = Claims {
        sub: username.to_string(),
        iss: issuer.to_string(),
        aud: audience.to_string(),
        iat: now.timestamp() as usize,
        exp,
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
}

/// 验证并解析 JWT 令牌
///
/// # 参数
///
/// * `token` - JWT 令牌字符串
/// * `secret` - JWT 密钥
///
/// # 返回
///
/// 解析后的 Claims
pub fn validate_token(
    token: &str,
    secret: &str,
    issuer: &str,
    audience: &str,
    expected_subject: &str,
) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&[issuer]);
    validation.set_audience(&[audience]);
    validation.sub = Some(expected_subject.to_string());

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &validation,
    )?;

    Ok(token_data.claims)
}

/// 验证密码
///
/// # 参数
///
/// * `password` - 明文密码
/// * `hash` - Argon2 密码哈希
///
/// # 返回
///
/// 密码是否匹配
pub fn verify_password(password: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(hash)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

// ================================
// 登录处理函数
// ================================

/// 管理员登录接口
///
/// POST /api/admin/login
///
/// # 请求体
///
/// ```json
/// {
///   "username": "admin",
///   "password": "your_password"
/// }
/// ```
///
/// # 响应
///
/// ```json
/// {
///   "success": true,
///   "data": {
///     "token": "eyJ...",
///     "expires_in": 86400
///   }
/// }
/// ```
pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Result<Json<ApiResponse<LoginResponse>>, AuthError> {
    let ip = get_client_ip(&headers, addr, state.config.trust_proxy_headers);
    let cache_key = format!("login:{}", ip);
    let allowed = check_rate_limit_window(&state.redis, &cache_key, 5, 15 * 60)
        .await
        .map_err(|error| {
            tracing::error!("Login rate limit unavailable: {:?}", error);
            AuthError::TemporarilyUnavailable
        })?;
    if !allowed {
        tracing::warn!("Login rate limit exceeded for {}", ip);
        return Err(AuthError::RateLimited);
    }

    if req.username.len() > 128 || req.password.len() > 1024 {
        return Err(AuthError::InvalidCredentials);
    }

    // 无论用户名是否正确都执行 Argon2，避免用户名枚举的明显时序差异。
    let password_valid = match verify_password(&req.password, &state.config.admin_password_hash) {
        Ok(valid) => valid,
        Err(e) => {
            tracing::error!("Password verification error: {:?}", e);
            false
        }
    };
    if req.username != state.config.admin_username || !password_valid {
        tracing::warn!("Login attempt rejected for {}", ip);
        return Err(AuthError::InvalidCredentials);
    }

    let token = generate_token(
        &req.username,
        &state.config.jwt_secret,
        state.config.jwt_expires_in,
        &state.config.jwt_issuer,
        &state.config.jwt_audience,
    )?;

    tracing::info!("User {} logged in successfully", req.username);

    Ok(Json(ApiResponse::success(LoginResponse {
        token,
        expires_in: state.config.jwt_expires_in,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_validate_token() {
        let secret = "test-secret-key";
        let username = "admin";
        let expires_in = 3600;
        let issuer = "yukilog";
        let audience = "yukilog-admin";

        // 生成令牌
        let token = generate_token(username, secret, expires_in, issuer, audience).unwrap();
        assert!(!token.is_empty());

        // 验证令牌
        let claims = validate_token(&token, secret, issuer, audience, username).unwrap();
        assert_eq!(claims.sub, username);
        assert_eq!(claims.iss, issuer);
        assert_eq!(claims.aud, audience);

        // 验证过期时间
        let now = Utc::now().timestamp() as usize;
        assert!(claims.exp > now);
        assert!(claims.exp <= now + expires_in as usize + 1);
    }

    #[test]
    fn test_invalid_token() {
        let secret = "test-secret-key";
        let invalid_token = "invalid.token.here";

        let result = validate_token(invalid_token, secret, "yukilog", "yukilog-admin", "admin");
        assert!(result.is_err());
    }

    #[test]
    fn test_token_with_wrong_secret() {
        let secret1 = "secret1";
        let secret2 = "secret2";

        let token = generate_token("admin", secret1, 3600, "yukilog", "yukilog-admin").unwrap();
        let result = validate_token(&token, secret2, "yukilog", "yukilog-admin", "admin");
        assert!(result.is_err());
    }

    #[test]
    fn test_token_rejects_wrong_subject_or_audience() {
        let token =
            generate_token("admin", "test-secret-key", 3600, "yukilog", "yukilog-admin").unwrap();

        assert!(validate_token(
            &token,
            "test-secret-key",
            "yukilog",
            "yukilog-admin",
            "another-admin",
        )
        .is_err());
        assert!(validate_token(
            &token,
            "test-secret-key",
            "yukilog",
            "another-audience",
            "admin",
        )
        .is_err());
    }
}
