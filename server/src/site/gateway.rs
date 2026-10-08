use std::path::Path;

use axum::{
    extract::{Path as AxumPath, Query, State},
    http::{HeaderMap, HeaderValue, Uri, header::USER_AGENT},
    response::{Html, IntoResponse, Response},
};

use crate::{AppState, error::AppError};

use super::{SiteView, article, escape_html, home, lists, load_site, series};

const BOT_MARKERS: &[&str] = &[
    "bot",
    "spider",
    "crawler",
    "slurp",
    "facebookexternalhit",
    "twitterbot",
    "telegrambot",
    "whatsapp",
    "discordbot",
    "google-inspectiontool",
    "baiduspider",
    "sogou",
    "yisouspider",
    "bytespider",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ShellAssets {
    script: String,
    css: Vec<String>,
}

#[derive(Clone)]
pub(crate) struct ShellState {
    assets: Option<ShellAssets>,
}

impl ShellState {
    pub(crate) fn from_env() -> Self {
        let dir = std::env::var("YUKILOG_WEB_DIR").unwrap_or_else(|_| "admin".to_owned());
        let assets = load_assets(Path::new(&dir));
        if assets.is_none() {
            tracing::warn!(dir, "visitor SPA bundle not found; all visitors get SSR");
        }
        Self { assets }
    }
}

pub async fn home_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, AppError> {
    if !wants_ssr(&headers, uri.query()) {
        if let Some(shell) = spa_shell(&state, &uri).await? {
            return Ok(shell.into_response());
        }
    }
    let query = Query::<home::HomeQuery>::try_from_uri(&uri)
        .map_err(|_| AppError::InvalidRequest("查询参数无效"))?;
    Ok(render_cookie_layer(
        home::home(State(state), query).await?.into_response(),
        uri.query(),
    ))
}

pub async fn article_list_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, AppError> {
    if !wants_ssr(&headers, uri.query()) {
        if let Some(shell) = spa_shell(&state, &uri).await? {
            return Ok(shell.into_response());
        }
    }
    let query = Query::<lists::ArticleListQuery>::try_from_uri(&uri)
        .map_err(|_| AppError::InvalidRequest("查询参数无效"))?;
    Ok(render_cookie_layer(
        lists::article_list(State(state), query).await?.into_response(),
        uri.query(),
    ))
}

pub async fn article_detail_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, AppError> {
    if !wants_ssr(&headers, uri.query()) {
        if let Some(shell) = spa_shell(&state, &uri).await? {
            return Ok(shell.into_response());
        }
    }
    let slug = uri
        .path()
        .strip_prefix("/articles/")
        .unwrap_or_default()
        .to_owned();
    Ok(render_cookie_layer(
        article::article_detail(
            State(state),
            AxumPath(slug),
            axum::extract::RawQuery(uri.query().map(str::to_owned)),
        )
        .await?
        .into_response(),
        uri.query(),
    ))
}

pub async fn dynamic_list_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, AppError> {
    if !wants_ssr(&headers, uri.query()) {
        if let Some(shell) = spa_shell(&state, &uri).await? {
            return Ok(shell.into_response());
        }
    }
    let query = Query::<lists::DynamicListQuery>::try_from_uri(&uri)
        .map_err(|_| AppError::InvalidRequest("查询参数无效"))?;
    Ok(render_cookie_layer(
        lists::dynamic_list(State(state), query).await?.into_response(),
        uri.query(),
    ))
}

pub async fn series_list_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, AppError> {
    if !wants_ssr(&headers, uri.query()) {
        if let Some(shell) = spa_shell(&state, &uri).await? {
            return Ok(shell.into_response());
        }
    }
    Ok(render_cookie_layer(
        series::series_list(State(state)).await?.into_response(),
        uri.query(),
    ))
}

pub async fn series_detail_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, AppError> {
    if !wants_ssr(&headers, uri.query()) {
        if let Some(shell) = spa_shell(&state, &uri).await? {
            return Ok(shell.into_response());
        }
    }
    let slug = uri
        .path()
        .strip_prefix("/series/")
        .unwrap_or_default()
        .to_owned();
    Ok(render_cookie_layer(
        series::series_detail(State(state), AxumPath(slug))
            .await?
            .into_response(),
        uri.query(),
    ))
}

pub async fn friend_list_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, AppError> {
    if !wants_ssr(&headers, uri.query()) {
        if let Some(shell) = spa_shell(&state, &uri).await? {
            return Ok(shell.into_response());
        }
    }
    Ok(render_cookie_layer(
        lists::friend_list(State(state), axum::extract::RawQuery(uri.query().map(str::to_owned)))
            .await?
            .into_response(),
        uri.query(),
    ))
}

pub async fn search_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, AppError> {
    if !wants_ssr(&headers, uri.query()) {
        if let Some(shell) = spa_shell(&state, &uri).await? {
            return Ok(shell.into_response());
        }
    }
    let query = Query::<lists::SearchQuery>::try_from_uri(&uri)
        .map_err(|_| AppError::InvalidRequest("查询参数无效"))?;
    Ok(render_cookie_layer(
        lists::search(State(state), query).await?.into_response(),
        uri.query(),
    ))
}

/// 渲染版本选择：?ssr=1/0 参数 > yukilog_render cookie > 爬虫 UA。
/// 显式参数会写入 cookie，站内后续跳转（无参链接）保持同一版本。
fn wants_ssr(headers: &HeaderMap, query: Option<&str>) -> bool {
    if let Some(query) = query {
        for pair in query.split('&') {
            if pair == "ssr=1" {
                return true;
            }
            if pair == "ssr=0" {
                return false;
            }
        }
    }
    if let Some(cookie) = headers
        .get(axum::http::header::COOKIE)
        .and_then(|value| value.to_str().ok())
    {
        for part in cookie.split(';') {
            if let Some(value) = part.trim().strip_prefix("yukilog_render=") {
                return value == "ssr";
            }
        }
    }
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    is_bot_user_agent(user_agent)
}

/// 显式 ?ssr=1/0 时把版本选择写进 cookie（30 天；ssr=0 立即清除）。
fn render_cookie_layer(response: Response, query: Option<&str>) -> Response {
    let Some(query) = query else {
        return response;
    };
    let value = if query.split('&').any(|pair| pair == "ssr=1") {
        Some("yukilog_render=ssr; Path=/; Max-Age=2592000; SameSite=Lax")
    } else if query.split('&').any(|pair| pair == "ssr=0") {
        Some("yukilog_render=; Path=/; Max-Age=0; SameSite=Lax")
    } else {
        None
    };
    if let Some(value) = value {
        let mut response = response;
        response
            .headers_mut()
            .insert(axum::http::header::SET_COOKIE, HeaderValue::from_static(value));
        response
    } else {
        response
    }
}

fn is_bot_user_agent(user_agent: &str) -> bool {
    let user_agent = user_agent.to_ascii_lowercase();
    BOT_MARKERS
        .iter()
        .any(|marker| user_agent.contains(marker))
}

async fn spa_shell(state: &AppState, uri: &Uri) -> Result<Option<Html<String>>, AppError> {
    let Some(assets) = &state.shell.assets else {
        return Ok(None);
    };
    let site = load_site(state).await?;
    let current = uri
        .path_and_query()
        .map(|part| part.as_str())
        .unwrap_or("/");
    Ok(Some(Html(render_shell(&site, assets, current))))
}

fn render_shell(site: &SiteView, assets: &ShellAssets, current: &str) -> String {
    let ssr_link = if current.contains('?') {
        format!("{current}&ssr=1")
    } else {
        format!("{current}?ssr=1")
    };
    let favicon = if site.favicon_url.is_empty() {
        String::new()
    } else {
        format!(
            r#"<link rel="icon" href="{}">"#,
            escape_html(&site.favicon_url)
        )
    };
    let css = assets
        .css
        .iter()
        .map(|href| format!(r#"<link rel="stylesheet" href="{}">"#, escape_html(href)))
        .collect::<String>();
    format!(
        r#"<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index,follow">
  <meta name="description" content="{}">
  {favicon}
  <title>{}</title>
  {css}
  <style>html,body{{margin:0;padding:0;background:#f7f8f7}}</style>
  <script type="module" crossorigin src="{}"></script>
</head>
<body>
  <yuki-app></yuki-app>
  <noscript><p>这个页面需要启用 JavaScript 才能完整浏览；也可以打开<a href="{}">无脚本版本</a>。</p></noscript>
</body>
</html>"#,
        escape_html(&site.description),
        escape_html(&site.title),
        escape_html(&assets.script),
        escape_html(&ssr_link),
    )
}

fn load_assets(dir: &Path) -> Option<ShellAssets> {
    let manifest = std::fs::read_to_string(dir.join(".vite/manifest.json")).ok()?;
    resolve_assets(&manifest)
}

static ENHANCE_URL: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();

/// 正文增强包（KaTeX/mermaid）的构建产物 URL；进程生命周期内缓存。
fn enhance_url() -> Option<&'static str> {
    ENHANCE_URL
        .get_or_init(|| {
            let dir = std::env::var("YUKILOG_WEB_DIR").unwrap_or_else(|_| "admin".to_owned());
            let manifest =
                std::fs::read_to_string(Path::new(&dir).join(".vite/manifest.json")).ok()?;
            let manifest: serde_json::Value = serde_json::from_str(&manifest).ok()?;
            let entry = manifest.as_object()?.values().find(|entry| {
                entry.get("name").and_then(serde_json::Value::as_str) == Some("enhance")
                    || entry.get("src").and_then(serde_json::Value::as_str)
                        == Some("src/ui/enhance.ts")
            })?;
            let file = entry.get("file").and_then(serde_json::Value::as_str)?;
            Some(format!("/admin/{file}"))
        })
        .as_deref()
}

/// 正文含 KaTeX/mermaid 标记时在页面尾部注入增强加载器（SSR 文章/动态页用）。
pub(crate) fn inject_enhance(content: &mut String) {
    if !content.contains("lm-math") && !content.contains("lm-mermaid") {
        return;
    }
    if let Some(url) = enhance_url() {
        content.push_str(&format!(
            r#"<script type="module">import("{url}").then((m)=>m.enhanceProse(document))</script>"#
        ));
    }
}

fn resolve_assets(manifest: &str) -> Option<ShellAssets> {
    let manifest: serde_json::Value = serde_json::from_str(manifest).ok()?;
    let entry = manifest.as_object()?.values().find(|entry| {
        entry.get("name").and_then(serde_json::Value::as_str) == Some("yuki-app")
            || entry.get("src").and_then(serde_json::Value::as_str) == Some("src/ui/yuki-app.ts")
    })?;
    let file = entry.get("file").and_then(serde_json::Value::as_str)?;
    let css = entry
        .get("css")
        .and_then(serde_json::Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(serde_json::Value::as_str)
                .map(|file| format!("/admin/{file}"))
                .collect()
        })
        .unwrap_or_default();
    Some(ShellAssets {
        script: format!("/admin/{file}"),
        css,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::{ArticleSort, FeedFields};

    fn headers(user_agent: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if !user_agent.is_empty() {
            headers.insert(USER_AGENT, user_agent.parse().unwrap());
        }
        headers
    }

    fn site_view() -> SiteView {
        SiteView {
            title: "YukiLog".to_owned(),
            brand_text: "YukiLog".to_owned(),
            hero_title: crate::content::parts::DEFAULT_HERO_TITLE.to_owned(),
            hero_accent: crate::content::parts::DEFAULT_HERO_ACCENT.to_owned(),
            part_vars: String::new(),
            identity_traits: crate::content::parts::DEFAULT_IDENTITY_TRAITS.to_owned(),
            default_sort: ArticleSort::Featured,
            feed_fields: FeedFields {
                cover: true,
                category: true,
                date: true,
                summary: true,
                tags: true,
                views: true,
                likes: true,
            },
            description: "夜航西飞".to_owned(),
            owner_name: "Sakurine".to_owned(),
            owner_bio: String::new(),
            avatar_url: String::new(),
            masthead_url: String::new(),
            hero_backgrounds: Vec::new(),
            hero_quote: String::new(),
            favicon_url: "/media/ab/favicon.png".to_owned(),
            origin: "https://blog.example.com".to_owned(),
            social_links: Vec::new(),
            navigation_class: "topbar",
            navigation_options: String::new(),
            nav_corners_class: "",
            enter_class: "",
            page_width_class: "width-wide",
            show_search: true,
            mail_enabled: false,
            font_class: "font-system",
            background: "#ffffff".to_owned(),
            surface: "#ffffff".to_owned(),
            surface_muted: "#f2f4f8".to_owned(),
            text: "#20232a".to_owned(),
            text_muted: "#667085".to_owned(),
            primary: "#3278d4".to_owned(),
            secondary: "#ef78ac".to_owned(),
            border: "#dfe3ea".to_owned(),
            radius: 16,
            scale: 1.0,
            masthead_tint: 58,
            masthead_position: "center".to_owned(),
            masthead_fit: "cover".to_owned(),
        }
    }

    #[test]
    fn render_version_prefers_query_then_cookie_then_ua() {
        // 查询参数优先
        assert!(wants_ssr(&headers("Mozilla/5.0"), Some("ssr=1")));
        assert!(!wants_ssr(&headers("Mozilla/5.0"), Some("ssr=0")));
        // cookie 次之：ssr cookie 让普通浏览器保持阅读版
        let mut jar_headers = headers("Mozilla/5.0");
        jar_headers.insert(
            axum::http::header::COOKIE,
            "yukilog_render=ssr".parse().unwrap(),
        );
        assert!(wants_ssr(&jar_headers, None));
        // 显式 ssr=0 覆盖 cookie
        assert!(!wants_ssr(&jar_headers, Some("ssr=0")));
        // 无 cookie 无参数回退 UA（普通浏览器走 Lit）
        assert!(!wants_ssr(&headers("Mozilla/5.0"), None));
    }

    #[test]
    fn render_cookie_written_on_explicit_choice() {
        let set = render_cookie_layer(Response::new(axum::body::Body::empty()), Some("ssr=1"));
        let cookie = set
            .headers()
            .get(axum::http::header::SET_COOKIE)
            .unwrap()
            .to_str()
            .unwrap();
        assert!(cookie.contains("yukilog_render=ssr"));
        let clear = render_cookie_layer(Response::new(axum::body::Body::empty()), Some("ssr=0"));
        let cookie = clear
            .headers()
            .get(axum::http::header::SET_COOKIE)
            .unwrap()
            .to_str()
            .unwrap();
        assert!(cookie.contains("Max-Age=0"));
        // 无参数不动 cookie
        let none = render_cookie_layer(Response::new(axum::body::Body::empty()), None);
        assert!(none.headers().get(axum::http::header::SET_COOKIE).is_none());
    }

    #[test]
    fn ssr_query_param_forces_ssr() {
        assert!(wants_ssr(&headers("Mozilla/5.0"), Some("ssr=1")));
        assert!(wants_ssr(&headers("Mozilla/5.0"), Some("page=2&ssr=1")));
        assert!(!wants_ssr(&headers("Mozilla/5.0"), Some("ssr=0")));
        assert!(!wants_ssr(&headers("Mozilla/5.0"), Some("q=ssr%3D1")));
    }

    #[test]
    fn crawler_user_agents_get_ssr() {
        for user_agent in [
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Baiduspider+(+http://www.baidu.com/search/spider.htm)",
            "Sogou web spider/4.0",
            "Mozilla/5.0 (compatible; Bytespider; spider@bytedance.com)",
            "Mozilla/5.0 (compatible; YisouSpider/5.0)",
            "facebookexternalhit/1.1",
            "Twitterbot/1.0",
            "TelegramBot (like TwitterBot)",
            "WhatsApp/2.23",
            "Discordbot/2.0",
            "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)",
            "DuckDuckBot/1.1",
            "YandexBot/3.0",
            "Slurp",
            "bingbot/2.0",
            "Applebot/0.1",
        ] {
            assert!(wants_ssr(&headers(user_agent), None), "expected SSR for {user_agent}");
        }
    }

    #[test]
    fn human_user_agents_get_spa() {
        for user_agent in [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
            "curl/8.7.1",
            "",
        ] {
            assert!(!wants_ssr(&headers(user_agent), None), "expected SPA for {user_agent}");
        }
    }

    #[test]
    fn resolves_yuki_app_chunk_from_manifest() {
        let manifest = r#"{
            "index.html": {"file": "assets/index-AAA.js", "src": "index.html", "isEntry": true},
            "src/ui/yuki-app.ts": {
                "file": "assets/yuki-app-BBB.js",
                "name": "yuki-app",
                "src": "src/ui/yuki-app.ts",
                "isEntry": true,
                "css": ["assets/yuki-app-BBB.css"]
            }
        }"#;
        let assets = resolve_assets(manifest).unwrap();
        assert_eq!(
            assets,
            ShellAssets {
                script: "/admin/assets/yuki-app-BBB.js".to_owned(),
                css: vec!["/admin/assets/yuki-app-BBB.css".to_owned()],
            }
        );
        assert!(resolve_assets("{}").is_none());
        assert!(resolve_assets("not json").is_none());
    }

    #[test]
    fn shell_html_carries_meta_and_noscript_fallback() {
        let assets = ShellAssets {
            script: "/admin/assets/yuki-app-BBB.js".to_owned(),
            css: vec![],
        };
        let html = render_shell(&site_view(), &assets, "/articles?page=2");
        assert!(html.contains(r#"<meta name="robots" content="index,follow">"#));
        assert!(html.contains(r#"<title>YukiLog</title>"#));
        assert!(html.contains(r#"<meta name="description" content="夜航西飞">"#));
        assert!(html.contains(r#"<link rel="icon" href="/media/ab/favicon.png">"#));
        assert!(html.contains(r#"src="/admin/assets/yuki-app-BBB.js""#));
        assert!(html.contains("<yuki-app></yuki-app>"));
        assert!(html.contains(r#"href="/articles?page=2&amp;ssr=1""#));
        let html = render_shell(&site_view(), &assets, "/friends");
        assert!(html.contains(r#"href="/friends?ssr=1""#));
    }
}
