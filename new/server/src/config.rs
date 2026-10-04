use std::{env, net::SocketAddr};

use thiserror::Error;

const DEFAULT_LISTEN_ADDR: &str = "127.0.0.1:3000";

#[derive(Clone, PartialEq, Eq)]
pub struct AppConfig {
    pub listen_addr: SocketAddr,
    pub database_url: String,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("YUKILOG_LISTEN_ADDR 不是有效的监听地址：{value}")]
    InvalidListenAddr { value: String },
    #[error("缺少 DATABASE_URL")]
    MissingDatabaseUrl,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let listen_addr =
            env::var("YUKILOG_LISTEN_ADDR").unwrap_or_else(|_| DEFAULT_LISTEN_ADDR.to_owned());
        let database_url = env::var("DATABASE_URL").unwrap_or_default();
        Self::from_values(&listen_addr, &database_url)
    }

    fn from_values(listen_addr: &str, database_url: &str) -> Result<Self, ConfigError> {
        let listen_addr = listen_addr
            .parse()
            .map_err(|_| ConfigError::InvalidListenAddr {
                value: listen_addr.to_owned(),
            })?;
        if database_url.trim().is_empty() {
            return Err(ConfigError::MissingDatabaseUrl);
        }
        Ok(Self {
            listen_addr,
            database_url: database_url.to_owned(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_listen_address() {
        let config =
            AppConfig::from_values("127.0.0.1:8080", "postgresql://localhost/yukilog").unwrap();
        assert_eq!(config.listen_addr.to_string(), "127.0.0.1:8080");
        assert_eq!(config.database_url, "postgresql://localhost/yukilog");
    }

    #[test]
    fn rejects_invalid_listen_address() {
        assert!(AppConfig::from_values("localhost", "postgresql://localhost/yukilog").is_err());
    }

    #[test]
    fn rejects_missing_database_url() {
        assert!(AppConfig::from_values("127.0.0.1:3000", "").is_err());
    }
}
