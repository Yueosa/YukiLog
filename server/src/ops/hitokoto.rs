use std::{
    sync::LazyLock,
    time::{Duration, Instant},
};

use axum::Json;
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

const REMOTE_URL: &str = "https://v1.hitokoto.cn";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);
const CACHE_TTL: Duration = Duration::from_secs(60);

const FALLBACKS: &[(&str, &str)] = &[
    ("愿你走出半生，归来仍是少年。", "网络"),
    ("凡是过往，皆为序章。", "莎士比亚"),
    ("星光不问赶路人，时光不负有心人。", "网络"),
    ("人生如逆旅，我亦是行人。", "苏轼"),
    ("且视他人之疑目如盏盏鬼火，大胆地去走你的夜路。", "史铁生"),
    ("世界上只有一种英雄主义，就是看清生活的真相之后依然热爱生活。", "罗曼·罗兰"),
    ("落霞与孤鹜齐飞，秋水共长天一色。", "王勃"),
];

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hitokoto {
    text: String,
    from: String,
}

#[derive(Debug, Deserialize)]
struct RemoteHitokoto {
    hitokoto: String,
    from: Option<String>,
}

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .unwrap_or_default()
});
static CACHE: LazyLock<Mutex<Option<(Instant, Hitokoto)>>> = LazyLock::new(|| Mutex::new(None));

pub async fn hitokoto() -> Json<Hitokoto> {
    Json(current().await)
}

async fn current() -> Hitokoto {
    {
        let cache = CACHE.lock().await;
        if let Some((seen, value)) = &*cache {
            if seen.elapsed() < CACHE_TTL {
                return value.clone();
            }
        }
    }
    let value = fetch_remote(&CLIENT, REMOTE_URL)
        .await
        .unwrap_or_else(|_| fallback());
    *CACHE.lock().await = Some((Instant::now(), value.clone()));
    value
}

async fn fetch_remote(client: &reqwest::Client, url: &str) -> Result<Hitokoto, ()> {
    let remote: RemoteHitokoto = client
        .get(url)
        .send()
        .await
        .map_err(|_| ())?
        .error_for_status()
        .map_err(|_| ())?
        .json()
        .await
        .map_err(|_| ())?;
    let text = remote.hitokoto.trim().to_owned();
    if text.is_empty() || text.chars().count() > 200 {
        return Err(());
    }
    let from = remote
        .from
        .unwrap_or_default()
        .trim()
        .chars()
        .take(60)
        .collect();
    Ok(Hitokoto { text, from })
}

fn fallback() -> Hitokoto {
    let index = (OsRng.next_u64() as usize) % FALLBACKS.len();
    let (text, from) = FALLBACKS[index];
    Hitokoto {
        text: text.to_owned(),
        from: from.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_picks_from_builtin_pool() {
        let value = fallback();
        assert!(FALLBACKS
            .iter()
            .any(|(text, from)| value.text == *text && value.from == *from));
    }

    #[tokio::test]
    async fn unreachable_remote_is_an_error() {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(300))
            .build()
            .unwrap();
        assert!(fetch_remote(&client, "http://127.0.0.1:9/hitokoto").await.is_err());
    }

    #[tokio::test]
    async fn remote_failure_still_yields_a_sentence() {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(300))
            .build()
            .unwrap();
        let value = fetch_remote(&client, "http://127.0.0.1:9/hitokoto")
            .await
            .unwrap_or_else(|_| fallback());
        assert!(!value.text.is_empty());
        let json = serde_json::to_value(&value).unwrap();
        assert!(json.get("text").is_some());
        assert!(json.get("from").is_some());
    }
}
