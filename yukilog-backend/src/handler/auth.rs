use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{extract::State, Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::handler::state::AppState;

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
) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = (Utc::now() + Duration::seconds(expires_in)).timestamp() as usize;

    let claims = Claims {
        sub: username.to_string(),
        exp,
    };

    encode(
        &Header::default(),
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
pub fn validate_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
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
    Json(req): Json<LoginRequest>,
) -> Result<Json<ApiResponse<LoginResponse>>, AuthError> {
    // 1. 验证用户名
    if req.username != state.config.admin_username {
        tracing::warn!("Login attempt rejected: unknown username");
        return Err(AuthError::InvalidCredentials);
    }

    // 2. 验证密码
    match verify_password(&req.password, &state.config.admin_password_hash) {
        Ok(true) => {
            // 密码正确
        }
        Ok(false) => {
            tracing::warn!("Login attempt rejected: incorrect password");
            return Err(AuthError::InvalidCredentials);
        }
        Err(e) => {
            tracing::error!("Password verification error: {:?}", e);
            return Err(AuthError::InvalidCredentials);
        }
    }

    // 3. 生成 JWT 令牌
    let token = generate_token(
        &req.username,
        &state.config.jwt_secret,
        state.config.jwt_expires_in,
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

        // 生成令牌
        let token = generate_token(username, secret, expires_in).unwrap();
        assert!(!token.is_empty());

        // 验证令牌
        let claims = validate_token(&token, secret).unwrap();
        assert_eq!(claims.sub, username);

        // 验证过期时间
        let now = Utc::now().timestamp() as usize;
        assert!(claims.exp > now);
        assert!(claims.exp <= now + expires_in as usize + 1);
    }

    #[test]
    fn test_invalid_token() {
        let secret = "test-secret-key";
        let invalid_token = "invalid.token.here";

        let result = validate_token(invalid_token, secret);
        assert!(result.is_err());
    }

    #[test]
    fn test_token_with_wrong_secret() {
        let secret1 = "secret1";
        let secret2 = "secret2";

        let token = generate_token("admin", secret1, 3600).unwrap();
        let result = validate_token(&token, secret2);
        assert!(result.is_err());
    }
}
