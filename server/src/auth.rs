use std::{
    collections::{HashMap, VecDeque},
    net::IpAddr,
    sync::Arc,
    time::{Duration, Instant},
};

use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::{SaltString, rand_core::OsRng as PasswordOsRng},
};
use axum::{
    Json,
    extract::{ConnectInfo, State},
    http::{HeaderMap, header},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{Duration as ChronoDuration, Utc};
use cookie::time::Duration as CookieDuration;
use rand::{RngCore, rngs::OsRng};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, EntityTrait, IntoActiveModel, QueryFilter,
    Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use tokio::sync::Mutex;

use crate::{
    AppState,
    content::client_ip,
    entities::{admin_accounts, admin_sessions},
    error::AppError,
};

const SESSION_DAYS: i64 = 7;
const LOGIN_WINDOW: Duration = Duration::from_secs(15 * 60);
const LOGIN_ATTEMPTS: usize = 10;
const PASSWORD_MIN_BYTES: usize = 12;
const PASSWORD_MAX_BYTES: usize = 256;

#[derive(Clone)]
pub struct AuthState {
    public_origin: Arc<str>,
    secure_cookies: bool,
    session_cookie_name: Arc<str>,
    csrf_cookie_name: Arc<str>,
    dummy_password_hash: Arc<str>,
    login_limiter: Arc<LoginLimiter>,
}

impl AuthState {
    pub async fn new(public_origin: String) -> Result<Self, AppError> {
        let secure_cookies = public_origin.starts_with("https://");
        let dummy_password_hash =
            hash_password_async("YukiLog dummy password which is never accepted".to_owned())
                .await?;
        Ok(Self {
            public_origin: public_origin.into(),
            secure_cookies,
            session_cookie_name: if secure_cookies {
                "__Host-yukilog_session".into()
            } else {
                "yukilog_session".into()
            },
            csrf_cookie_name: if secure_cookies {
                "__Host-yukilog_csrf".into()
            } else {
                "yukilog_csrf".into()
            },
            dummy_password_hash: dummy_password_hash.into(),
            login_limiter: Arc::new(LoginLimiter::default()),
        })
    }

    pub(crate) fn public_origin(&self) -> &str {
        &self.public_origin
    }

    #[cfg(test)]
    pub(crate) fn for_test() -> Self {
        Self {
            public_origin: "http://127.0.0.1:3000".into(),
            secure_cookies: false,
            session_cookie_name: "yukilog_session".into(),
            csrf_cookie_name: "yukilog_csrf".into(),
            dummy_password_hash: "".into(),
            login_limiter: Arc::new(LoginLimiter::default()),
        }
    }

    fn session_cookie(&self, value: String) -> Cookie<'static> {
        Cookie::build((self.session_cookie_name.to_string(), value))
            .path("/")
            .http_only(true)
            .secure(self.secure_cookies)
            .same_site(SameSite::Strict)
            .max_age(CookieDuration::days(SESSION_DAYS))
            .build()
    }

    fn csrf_cookie(&self, value: String) -> Cookie<'static> {
        Cookie::build((self.csrf_cookie_name.to_string(), value))
            .path("/")
            .http_only(false)
            .secure(self.secure_cookies)
            .same_site(SameSite::Strict)
            .max_age(CookieDuration::days(SESSION_DAYS))
            .build()
    }

    fn removal_cookie(&self, name: &str, http_only: bool) -> Cookie<'static> {
        Cookie::build((name.to_owned(), ""))
            .path("/")
            .http_only(http_only)
            .secure(self.secure_cookies)
            .same_site(SameSite::Strict)
            .build()
    }
}

#[derive(Default)]
struct LoginLimiter {
    attempts: Mutex<HashMap<IpAddr, VecDeque<Instant>>>,
}

impl LoginLimiter {
    async fn register(&self, address: IpAddr) -> bool {
        let now = Instant::now();
        let mut all_attempts = self.attempts.lock().await;
        let attempts = all_attempts.entry(address).or_default();
        while attempts
            .front()
            .is_some_and(|attempt| now.duration_since(*attempt) >= LOGIN_WINDOW)
        {
            attempts.pop_front();
        }
        if attempts.len() >= LOGIN_ATTEMPTS {
            return false;
        }
        attempts.push_back(now);
        true
    }

    async fn clear(&self, address: IpAddr) {
        self.attempts.lock().await.remove(&address);
    }
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    current_password: String,
    new_password: String,
}

#[derive(Debug, Serialize)]
pub struct AdminResponse {
    id: sea_orm::prelude::Uuid,
    username: String,
    display_name: String,
}

#[derive(Debug)]
struct AuthenticatedAdmin {
    account: admin_accounts::Model,
    session: admin_sessions::Model,
}

pub(crate) async fn authorize_write(
    state: &AppState,
    headers: &HeaderMap,
    jar: &CookieJar,
) -> Result<sea_orm::prelude::Uuid, AppError> {
    let authenticated = authenticate(state, jar).await?;
    verify_csrf(&state.auth, headers, jar, &authenticated.session)?;
    Ok(authenticated.account.id)
}

pub(crate) async fn authorize_read(
    state: &AppState,
    jar: &CookieJar,
) -> Result<sea_orm::prelude::Uuid, AppError> {
    Ok(authenticate(state, jar).await?.account.id)
}

pub(crate) fn verify_public_origin(auth: &AuthState, headers: &HeaderMap) -> Result<(), AppError> {
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok());
    if origin == Some(auth.public_origin.as_ref()) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

pub(crate) fn secure_cookies(auth: &AuthState) -> bool {
    auth.secure_cookies
}

pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<std::net::SocketAddr>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(request): Json<LoginRequest>,
) -> Result<(CookieJar, Json<AdminResponse>), AppError> {
    let client = client_ip(&headers, peer);
    if !state.auth.login_limiter.register(client).await {
        return Err(AppError::RateLimited);
    }

    let account = admin_accounts::Entity::find()
        .filter(admin_accounts::Column::Username.eq(request.username.trim()))
        .one(&state.database)
        .await?;
    let password_has_valid_size =
        (PASSWORD_MIN_BYTES..=PASSWORD_MAX_BYTES).contains(&request.password.len());
    let candidate_hash = account
        .as_ref()
        .map(|account| account.password_hash.as_str())
        .unwrap_or(state.auth.dummy_password_hash.as_ref())
        .to_owned();
    let password = if password_has_valid_size {
        request.password
    } else {
        String::new()
    };
    let password_valid =
        verify_password_async(password, candidate_hash).await? && password_has_valid_size;

    let Some(account) = account.filter(|account| account.is_active && password_valid) else {
        return Err(AppError::Unauthorized);
    };

    state.auth.login_limiter.clear(client).await;
    admin_sessions::Entity::delete_many()
        .filter(admin_sessions::Column::ExpiresAt.lte(Utc::now().fixed_offset()))
        .exec(&state.database)
        .await?;

    let session_token = random_token();
    let csrf_token = random_token();
    let now = Utc::now().fixed_offset();
    let transaction = state.database.begin().await?;
    admin_sessions::ActiveModel {
        id: NotSet,
        account_id: Set(account.id),
        token_hash: Set(token_hash(&session_token)),
        csrf_token_hash: Set(token_hash(&csrf_token)),
        expires_at: Set(now + ChronoDuration::days(SESSION_DAYS)),
        last_seen_at: Set(now),
        created_at: NotSet,
    }
    .insert(&transaction)
    .await?;

    let mut active_account = account.clone().into_active_model();
    active_account.last_login_at = Set(Some(now));
    active_account.update(&transaction).await?;
    transaction.commit().await?;

    let jar = jar
        .add(state.auth.session_cookie(session_token))
        .add(state.auth.csrf_cookie(csrf_token));
    Ok((jar, Json(AdminResponse::from(account))))
}

pub async fn session(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<AdminResponse>, AppError> {
    let authenticated = authenticate(&state, &jar).await?;
    Ok(Json(AdminResponse::from(authenticated.account)))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
) -> Result<(CookieJar, Json<AdminResponse>), AppError> {
    let authenticated = authenticate(&state, &jar).await?;
    verify_csrf(&state.auth, &headers, &jar, &authenticated.session)?;
    admin_sessions::Entity::delete_by_id(authenticated.session.id)
        .exec(&state.database)
        .await?;

    let response = AdminResponse::from(authenticated.account);
    let jar = clear_auth_cookies(&state.auth, jar);
    Ok((jar, Json(response)))
}

pub async fn change_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(request): Json<ChangePasswordRequest>,
) -> Result<CookieJar, AppError> {
    validate_password(&request.new_password)?;
    let authenticated = authenticate(&state, &jar).await?;
    verify_csrf(&state.auth, &headers, &jar, &authenticated.session)?;

    if !verify_password_async(
        request.current_password,
        authenticated.account.password_hash.clone(),
    )
    .await?
    {
        return Err(AppError::Unauthorized);
    }
    let new_hash = hash_password_async(request.new_password).await?;

    let transaction = state.database.begin().await?;
    admin_accounts::Entity::update_many()
        .filter(admin_accounts::Column::Id.eq(authenticated.account.id))
        .col_expr(
            admin_accounts::Column::PasswordHash,
            sea_orm::sea_query::Expr::value(new_hash),
        )
        .exec(&transaction)
        .await?;
    admin_sessions::Entity::delete_many()
        .filter(admin_sessions::Column::AccountId.eq(authenticated.account.id))
        .exec(&transaction)
        .await?;
    transaction.commit().await?;

    Ok(clear_auth_cookies(&state.auth, jar))
}

async fn authenticate(state: &AppState, jar: &CookieJar) -> Result<AuthenticatedAdmin, AppError> {
    let raw_token = jar
        .get(state.auth.session_cookie_name.as_ref())
        .map(Cookie::value)
        .ok_or(AppError::Unauthorized)?;
    let token_hash = token_hash(raw_token);
    let Some(session) = admin_sessions::Entity::find()
        .filter(admin_sessions::Column::TokenHash.eq(token_hash))
        .one(&state.database)
        .await?
    else {
        return Err(AppError::Unauthorized);
    };

    let now = Utc::now().fixed_offset();
    if session.expires_at <= now {
        admin_sessions::Entity::delete_by_id(session.id)
            .exec(&state.database)
            .await?;
        return Err(AppError::Unauthorized);
    }

    let Some(account) = admin_accounts::Entity::find_by_id(session.account_id)
        .one(&state.database)
        .await?
        .filter(|account| account.is_active)
    else {
        return Err(AppError::Unauthorized);
    };

    Ok(AuthenticatedAdmin { account, session })
}

fn verify_csrf(
    auth: &AuthState,
    headers: &HeaderMap,
    jar: &CookieJar,
    session: &admin_sessions::Model,
) -> Result<(), AppError> {
    verify_public_origin(auth, headers)?;

    let cookie_token = jar
        .get(auth.csrf_cookie_name.as_ref())
        .map(Cookie::value)
        .ok_or(AppError::Forbidden)?;
    let header_token = headers
        .get("x-csrf-token")
        .and_then(|value| value.to_str().ok())
        .ok_or(AppError::Forbidden)?;
    if cookie_token
        .as_bytes()
        .ct_eq(header_token.as_bytes())
        .unwrap_u8()
        != 1
    {
        return Err(AppError::Forbidden);
    }
    let supplied_hash = token_hash(header_token);
    if supplied_hash
        .as_slice()
        .ct_eq(session.csrf_token_hash.as_slice())
        .unwrap_u8()
        != 1
    {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

fn clear_auth_cookies(auth: &AuthState, jar: CookieJar) -> CookieJar {
    jar.remove(auth.removal_cookie(auth.session_cookie_name.as_ref(), true))
        .remove(auth.removal_cookie(auth.csrf_cookie_name.as_ref(), false))
}

fn random_token() -> String {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn token_hash(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

pub fn validate_password(password: &str) -> Result<(), AppError> {
    if !(PASSWORD_MIN_BYTES..=PASSWORD_MAX_BYTES).contains(&password.len()) {
        return Err(AppError::InvalidRequest("密码长度必须为 12–256 字节"));
    }
    Ok(())
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    validate_password(password)?;
    let salt = SaltString::generate(&mut PasswordOsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| AppError::Internal("password hashing"))
}

fn verify_password(password: &str, encoded_hash: &str) -> bool {
    PasswordHash::new(encoded_hash).ok().is_some_and(|hash| {
        Argon2::default()
            .verify_password(password.as_bytes(), &hash)
            .is_ok()
    })
}

async fn hash_password_async(password: String) -> Result<String, AppError> {
    tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|_| AppError::Internal("password hashing task"))?
}

async fn verify_password_async(password: String, encoded_hash: String) -> Result<bool, AppError> {
    tokio::task::spawn_blocking(move || verify_password(&password, &encoded_hash))
        .await
        .map_err(|_| AppError::Internal("password verification task"))
}

impl From<admin_accounts::Model> for AdminResponse {
    fn from(account: admin_accounts::Model) -> Self {
        Self {
            id: account.id,
            username: account.username,
            display_name: account.display_name,
        }
    }
}

#[cfg(test)]
mod tests {
    use axum::http::HeaderValue;
    use sea_orm::prelude::Uuid;

    use super::*;

    #[test]
    fn password_hash_round_trip() {
        let hash = hash_password("correct horse battery staple").unwrap();
        assert!(verify_password("correct horse battery staple", &hash));
        assert!(!verify_password("wrong password", &hash));
    }

    #[test]
    fn rejects_short_password() {
        assert!(validate_password("short").is_err());
    }

    #[test]
    fn tokens_are_random_and_hash_to_sha256() {
        let first = random_token();
        let second = random_token();
        assert_ne!(first, second);
        assert_eq!(token_hash(&first).len(), 32);
    }

    #[test]
    fn csrf_requires_matching_origin_cookie_header_and_session_hash() {
        let auth = AuthState::for_test();
        let token = random_token();
        let jar = CookieJar::new().add(auth.csrf_cookie(token.clone()));
        let mut headers = HeaderMap::new();
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("http://127.0.0.1:3000"),
        );
        headers.insert("x-csrf-token", HeaderValue::from_str(&token).unwrap());
        let now = Utc::now().fixed_offset();
        let session = admin_sessions::Model {
            id: Uuid::nil(),
            account_id: Uuid::nil(),
            token_hash: vec![0; 32],
            csrf_token_hash: token_hash(&token),
            expires_at: now + ChronoDuration::days(1),
            last_seen_at: now,
            created_at: now,
        };

        assert!(verify_csrf(&auth, &headers, &jar, &session).is_ok());
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("https://evil.test"),
        );
        assert!(verify_csrf(&auth, &headers, &jar, &session).is_err());
    }

    #[tokio::test]
    async fn login_limiter_rejects_eleventh_attempt() {
        let limiter = LoginLimiter::default();
        let address = "127.0.0.1".parse().unwrap();
        for _ in 0..LOGIN_ATTEMPTS {
            assert!(limiter.register(address).await);
        }
        assert!(!limiter.register(address).await);
    }
}
