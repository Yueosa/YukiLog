pub mod admin;
pub mod design;
pub mod public;

use std::{
    collections::HashMap,
    hash::{Hash, Hasher},
    net::{IpAddr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant},
};

use axum::http::HeaderMap;
use sea_orm::prelude::Uuid;
use tokio::sync::Mutex;

#[derive(Clone, Default)]
pub struct ContentState {
    limiter: Arc<InteractionLimiter>,
}

#[derive(Default)]
struct InteractionLimiter {
    entries: Mutex<HashMap<RateKey, Instant>>,
}

#[derive(Clone, Eq)]
struct RateKey {
    address: IpAddr,
    target: Uuid,
    action: &'static str,
}

impl PartialEq for RateKey {
    fn eq(&self, other: &Self) -> bool {
        self.address == other.address && self.target == other.target && self.action == other.action
    }
}

impl Hash for RateKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.address.hash(state);
        self.target.hash(state);
        self.action.hash(state);
    }
}

impl ContentState {
    pub async fn allow(
        &self,
        address: IpAddr,
        target: Uuid,
        action: &'static str,
        cooldown: Duration,
    ) -> bool {
        let now = Instant::now();
        let mut entries = self.limiter.entries.lock().await;
        if entries.len() > 10_000 {
            entries.retain(|_, seen| now.duration_since(*seen) < Duration::from_secs(3600));
        }
        let key = RateKey {
            address,
            target,
            action,
        };
        if entries
            .get(&key)
            .is_some_and(|seen| now.duration_since(*seen) < cooldown)
        {
            return false;
        }
        entries.insert(key, now);
        true
    }
}

pub fn client_ip(headers: &HeaderMap, peer: SocketAddr) -> IpAddr {
    if peer.ip().is_loopback() {
        if let Some(address) = headers
            .get("x-real-ip")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse().ok())
        {
            return address;
        }
    }
    peer.ip()
}

#[cfg(test)]
mod tests {
    use axum::http::HeaderValue;

    use super::*;

    #[test]
    fn trusts_real_ip_only_from_loopback_proxy() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", HeaderValue::from_static("203.0.113.10"));
        assert_eq!(
            client_ip(&headers, "127.0.0.1:1234".parse().unwrap()),
            "203.0.113.10".parse::<IpAddr>().unwrap()
        );
        assert_eq!(
            client_ip(&headers, "192.0.2.20:1234".parse().unwrap()),
            "192.0.2.20".parse::<IpAddr>().unwrap()
        );
    }

    #[tokio::test]
    async fn limiter_applies_per_action_and_target() {
        let state = ContentState::default();
        let address = "127.0.0.1".parse().unwrap();
        let target = Uuid::nil();
        assert!(
            state
                .allow(address, target, "view", Duration::from_secs(30))
                .await
        );
        assert!(
            !state
                .allow(address, target, "view", Duration::from_secs(30))
                .await
        );
        assert!(
            state
                .allow(address, target, "comment", Duration::from_secs(30))
                .await
        );
    }
}
