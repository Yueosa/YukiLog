use axum::http::HeaderMap;
use std::net::SocketAddr;

/// 从请求中提取客户端真实 IP
///
/// # 优先级
///
/// 1. `X-Forwarded-For` header（Nginx/Cloudflare 反向代理）
/// 2. `X-Real-IP` header（Nginx）
/// 3. 连接 IP（直连）
///
/// # 参数
///
/// * `headers` - HTTP 请求头
/// * `addr` - 连接地址
///
/// # 返回
///
/// 客户端 IP 字符串
///
/// # 示例
///
/// ```rust
/// let ip = get_client_ip(&headers, addr);  // "192.168.1.100"
/// ```
pub fn get_client_ip(headers: &HeaderMap, addr: SocketAddr) -> String {
    // 1. 优先从 X-Forwarded-For 读取（标准反向代理头）
    if let Some(forwarded) = headers.get("X-Forwarded-For") {
        if let Ok(forwarded_str) = forwarded.to_str() {
            // 取第一个 IP（客户端真实 IP）
            if let Some(ip) = forwarded_str.split(',').next() {
                return ip.trim().to_string();
            }
        }
    }

    // 2. 尝试从 X-Real-IP 读取（Nginx 单独配置）
    if let Some(real_ip) = headers.get("X-Real-IP") {
        if let Ok(ip_str) = real_ip.to_str() {
            return ip_str.trim().to_string();
        }
    }

    // 3. 回退到连接 IP
    addr.ip().to_string()
}

/// 检查 IP限流（基于 Redis）
///
/// 使用 Redis 的 `SET key value EX ttl NX` 原子命令实现限流
///
/// # 原子性保证
///
/// 使用单个 Redis 命令完成 "设置值 + 设置过期时间 + 仅当不存在时设置"，
/// 避免 SETNX + EXPIRE 两步操作的竞态条件：
/// - 如果在 SETNX 后、EXPIRE 前进程崩溃，key 会永久存在
/// - 原子命令确保要么全部成功，要么全部失败
///
/// # 参数
///
/// * `redis` - Redis 客户端
/// * `cache_key` - 缓存键（如 `view:post:{slug}:{ip}`）
/// * `ttl` - 过期时间（秒）
///
/// # 返回
///
/// * `Ok(true)` - 允许访问（首次或已过期）
/// * `Ok(false)` - 限流中（TTL 内重复访问）
/// * `Err` - Redis 错误
///
/// # 示例
///
/// ```rust
/// // 10 分钟内同一 IP 只计数一次
/// if !check_rate_limit(&redis, "view:post:hello-world:192.168.1.1", 600).await? {
///     return Ok(/* 已访问，不重复计数 */);
/// }
/// ```
pub async fn check_rate_limit(
    redis: &redis::Client,
    cache_key: &str,
    ttl: u64,
) -> Result<bool, redis::RedisError> {
    let mut conn = redis.get_async_connection().await?;

    // 原子命令：SET key value EX ttl NX
    // - NX: 仅当 key 不存在时设置
    // - EX: 设置过期时间（秒）
    // 返回值：Some("OK") 表示成功设置，None 表示 key 已存在
    let result: Option<String> = redis::cmd("SET")
        .arg(cache_key)
        .arg("1")
        .arg("EX")
        .arg(ttl)
        .arg("NX")
        .query_async(&mut conn)
        .await?;

    // Some("OK") = 首次访问或已过期，允许访问
    // None = key 存在，限流中
    Ok(result.is_some())
}

/// 生成 Gravatar 头像 URL
///
/// 基于邮箱计算 MD5 哈希，生成 Gravatar 头像链接
///
/// # 参数
///
/// * `email` - 用户邮箱
///
/// # 返回
///
/// Gravatar URL 字符串
///
/// # 默认头像
///
/// 使用 `d=identicon` 参数，当邮箱无头像时显示几何图案：
/// - 每个邮箱生成唯一的几何图案
/// - 即使邮箱不存在也能显示独特头像
///
/// 其他可选值：
/// - `monsterid` - 小怪物头像
/// - `wavatar` - 卡通脸
/// - `retro` - 8位像素风格
/// - `robohash` - 机器人
/// - `mp` - 神秘人剪影（Gravatar 默认）
///
/// # 示例
///
/// ```rust
/// let url = generate_gravatar_url("user@example.com");
/// // https://www.gravatar.com/avatar/b58996c504c5638798eb6b511e6f49af?s=80&d=identicon
/// ```
pub fn generate_gravatar_url(email: &str) -> String {
    use md5;

    // 1. 规范化邮箱（trim + lowercase）
    let email_normalized = email.trim().to_lowercase();

    // 2. 计算 MD5 哈希
    let hash = format!("{:x}", md5::compute(email_normalized.as_bytes()));

    // 3. 生成 URL
    // s=80: 图片大小 80x80 像素
    // d=identicon: 默认使用几何图案
    format!(
        "https://www.gravatar.com/avatar/{}?s=80&d=identicon",
        hash
    )
}

/// 从 headers 中提取 User-Agent
///
/// # 参数
///
/// * `headers` - HTTP 请求头
///
/// # 返回
///
/// User-Agent 字符串（如果存在）
pub fn get_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get("User-Agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;
    use std::net::{IpAddr, Ipv4Addr};

    #[test]
    fn test_get_client_ip_from_x_forwarded_for() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "X-Forwarded-For",
            HeaderValue::from_static("203.0.113.1, 192.168.1.1"),
        );

        let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
        let ip = get_client_ip(&headers, addr);

        // 应该取第一个 IP（客户端真实 IP）
        assert_eq!(ip, "203.0.113.1");
    }

    #[test]
    fn test_get_client_ip_from_x_real_ip() {
        let mut headers = HeaderMap::new();
        headers.insert("X-Real-IP", HeaderValue::from_static("203.0.113.1"));

        let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
        let ip = get_client_ip(&headers, addr);

        assert_eq!(ip, "203.0.113.1");
    }

    #[test]
    fn test_get_client_ip_fallback_to_connection() {
        let headers = HeaderMap::new();
        let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100)), 8080);
        let ip = get_client_ip(&headers, addr);

        assert_eq!(ip, "192.168.1.100");
    }

    #[test]
    fn test_generate_gravatar_url() {
        let url = generate_gravatar_url("MyEmailAddress@example.com ");

        // 测试 MD5 哈希计算正确性
        // myemailaddress@example.com 的 MD5 = 0bc83cb571cd1c50ba6f3e8a78ef1346
        assert!(url.contains("0bc83cb571cd1c50ba6f3e8a78ef1346"));
        assert!(url.contains("?s=80&d=identicon"));
    }

    #[test]
    fn test_generate_gravatar_url_case_insensitive() {
        let url1 = generate_gravatar_url("User@Example.COM");
        let url2 = generate_gravatar_url("user@example.com");

        // 大小写应该生成相同的 URL
        assert_eq!(url1, url2);
    }

    #[test]
    fn test_get_user_agent() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "User-Agent",
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
        );

        let ua = get_user_agent(&headers);
        assert!(ua.is_some());
        assert!(ua.unwrap().contains("Mozilla"));
    }

    #[test]
    fn test_get_user_agent_missing() {
        let headers = HeaderMap::new();
        let ua = get_user_agent(&headers);
        assert!(ua.is_none());
    }
}
