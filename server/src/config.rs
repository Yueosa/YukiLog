use std::{env, net::SocketAddr, path::PathBuf};

use axum::http::Uri;
use thiserror::Error;

const DEFAULT_LISTEN_ADDR: &str = "127.0.0.1:3000";

#[derive(Clone, PartialEq, Eq)]
pub struct AppConfig {
    pub listen_addr: SocketAddr,
    pub database_url: String,
    pub public_origin: String,
    pub media_dir: PathBuf,
    pub subscription_secret: String,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("YUKILOG_LISTEN_ADDR 不是有效的监听地址：{value}")]
    InvalidListenAddr { value: String },
    #[error("缺少 DATABASE_URL")]
    MissingDatabaseUrl,
    #[error("缺少 YUKILOG_PUBLIC_ORIGIN")]
    MissingPublicOrigin,
    #[error("YUKILOG_PUBLIC_ORIGIN 必须是无路径的 http(s) origin：{value}")]
    InvalidPublicOrigin { value: String },
    #[error("缺少 YUKILOG_MEDIA_DIR")]
    MissingMediaDir,
    #[error("YUKILOG_SUBSCRIPTION_SECRET 必须至少包含 32 个字节")]
    InvalidSubscriptionSecret,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let listen_addr =
            env::var("YUKILOG_LISTEN_ADDR").unwrap_or_else(|_| DEFAULT_LISTEN_ADDR.to_owned());
        let database_url = env::var("DATABASE_URL").unwrap_or_default();
        let public_origin = env::var("YUKILOG_PUBLIC_ORIGIN").unwrap_or_default();
        let media_dir = env::var("YUKILOG_MEDIA_DIR").unwrap_or_default();
        let subscription_secret = env::var("YUKILOG_SUBSCRIPTION_SECRET").unwrap_or_default();
        Self::from_values(
            &listen_addr,
            &database_url,
            &public_origin,
            &media_dir,
            &subscription_secret,
        )
    }

    fn from_values(
        listen_addr: &str,
        database_url: &str,
        public_origin: &str,
        media_dir: &str,
        subscription_secret: &str,
    ) -> Result<Self, ConfigError> {
        let listen_addr = listen_addr
            .parse()
            .map_err(|_| ConfigError::InvalidListenAddr {
                value: listen_addr.to_owned(),
            })?;
        if database_url.trim().is_empty() {
            return Err(ConfigError::MissingDatabaseUrl);
        }
        if public_origin.trim().is_empty() {
            return Err(ConfigError::MissingPublicOrigin);
        }
        let public_origin = normalize_origin(public_origin)?;
        if media_dir.trim().is_empty() {
            return Err(ConfigError::MissingMediaDir);
        }
        if subscription_secret.len() < 32 {
            return Err(ConfigError::InvalidSubscriptionSecret);
        }
        Ok(Self {
            listen_addr,
            database_url: database_url.to_owned(),
            public_origin,
            media_dir: PathBuf::from(media_dir),
            subscription_secret: subscription_secret.to_owned(),
        })
    }
}

fn normalize_origin(value: &str) -> Result<String, ConfigError> {
    let uri = value
        .parse::<Uri>()
        .map_err(|_| ConfigError::InvalidPublicOrigin {
            value: value.to_owned(),
        })?;
    let scheme = uri.scheme_str();
    let authority = uri.authority();
    let has_path_or_query = uri
        .path_and_query()
        .is_some_and(|part| part.as_str() != "/");

    match (scheme, authority, has_path_or_query) {
        (Some(scheme @ ("http" | "https")), Some(authority), false) => {
            Ok(format!("{scheme}://{authority}"))
        }
        _ => Err(ConfigError::InvalidPublicOrigin {
            value: value.to_owned(),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_listen_address() {
        let config = AppConfig::from_values(
            "127.0.0.1:8080",
            "postgresql://localhost/yukilog",
            "https://blog.yeastar.xin/",
            "/var/lib/yukilog/media",
            "test subscription secret with 32+ bytes",
        )
        .unwrap();
        assert_eq!(config.listen_addr.to_string(), "127.0.0.1:8080");
        assert_eq!(config.database_url, "postgresql://localhost/yukilog");
        assert_eq!(config.public_origin, "https://blog.yeastar.xin");
        assert_eq!(config.media_dir, PathBuf::from("/var/lib/yukilog/media"));
    }

    #[test]
    fn rejects_invalid_listen_address() {
        assert!(
            AppConfig::from_values(
                "localhost",
                "postgresql://localhost/yukilog",
                "https://blog.yeastar.xin",
                "/var/lib/yukilog/media",
                "test subscription secret with 32+ bytes",
            )
            .is_err()
        );
    }

    #[test]
    fn rejects_missing_database_url() {
        assert!(
            AppConfig::from_values(
                "127.0.0.1:3000",
                "",
                "https://blog.yeastar.xin",
                "/var/lib/yukilog/media",
                "test subscription secret with 32+ bytes",
            )
            .is_err()
        );
    }

    #[test]
    fn rejects_public_origin_with_path() {
        assert!(
            AppConfig::from_values(
                "127.0.0.1:3000",
                "postgresql://localhost/yukilog",
                "https://blog.yeastar.xin/admin",
                "/var/lib/yukilog/media",
                "test subscription secret with 32+ bytes",
            )
            .is_err()
        );
    }

    #[test]
    fn rejects_missing_media_directory() {
        assert!(
            AppConfig::from_values(
                "127.0.0.1:3000",
                "postgresql://localhost/yukilog",
                "https://blog.yeastar.xin",
                "",
                "test subscription secret with 32+ bytes",
            )
            .is_err()
        );
    }

    #[test]
    fn rejects_short_subscription_secret() {
        assert!(
            AppConfig::from_values(
                "127.0.0.1:3000",
                "postgresql://localhost/yukilog",
                "https://blog.yeastar.xin",
                "/var/lib/yukilog/media",
                "too-short",
            )
            .is_err()
        );
    }
}
