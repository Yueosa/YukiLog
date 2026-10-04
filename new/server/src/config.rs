use std::{env, net::SocketAddr};

use thiserror::Error;

const DEFAULT_LISTEN_ADDR: &str = "127.0.0.1:3000";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AppConfig {
    pub listen_addr: SocketAddr,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("YUKILOG_LISTEN_ADDR 不是有效的监听地址：{value}")]
    InvalidListenAddr { value: String },
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let value =
            env::var("YUKILOG_LISTEN_ADDR").unwrap_or_else(|_| DEFAULT_LISTEN_ADDR.to_owned());
        Self::from_listen_addr(&value)
    }

    fn from_listen_addr(value: &str) -> Result<Self, ConfigError> {
        let listen_addr = value.parse().map_err(|_| ConfigError::InvalidListenAddr {
            value: value.to_owned(),
        })?;
        Ok(Self { listen_addr })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_listen_address() {
        let config = AppConfig::from_listen_addr("127.0.0.1:8080").unwrap();
        assert_eq!(config.listen_addr.to_string(), "127.0.0.1:8080");
    }

    #[test]
    fn rejects_invalid_listen_address() {
        assert!(AppConfig::from_listen_addr("localhost").is_err());
    }
}
