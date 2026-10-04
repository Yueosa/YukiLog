use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue, header},
};
use chrono::{DateTime, FixedOffset, Utc};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect};

use crate::{
    AppState,
    entities::{articles, dynamics, site_settings},
    error::AppError,
    markdown,
};

const FEED_LIMIT: u64 = 50;

#[derive(Clone, Copy)]
enum FeedKind {
    All,
    Articles,
    Dynamics,
}

struct FeedItem {
    title: String,
    link: String,
    guid: String,
    description_html: String,
    published_at: DateTime<FixedOffset>,
}

pub async fn all(State(state): State<AppState>) -> Result<(HeaderMap, String), AppError> {
    render_feed(&state, FeedKind::All, "/feed.xml").await
}

pub async fn articles(State(state): State<AppState>) -> Result<(HeaderMap, String), AppError> {
    render_feed(&state, FeedKind::Articles, "/feeds/articles.xml").await
}

pub async fn dynamics(State(state): State<AppState>) -> Result<(HeaderMap, String), AppError> {
    render_feed(&state, FeedKind::Dynamics, "/feeds/dynamics.xml").await
}

async fn render_feed(
    state: &AppState,
    kind: FeedKind,
    self_path: &str,
) -> Result<(HeaderMap, String), AppError> {
    let settings = site_settings::Entity::find_by_id(true)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotConfigured)?;
    let origin = state.auth.public_origin();
    let mut items = Vec::new();

    if matches!(kind, FeedKind::All | FeedKind::Articles) {
        let models = articles::Entity::find()
            .filter(articles::Column::Status.eq("published"))
            .filter(articles::Column::PublishedAt.lte(Utc::now().fixed_offset()))
            .order_by_desc(articles::Column::PublishedAt)
            .limit(FEED_LIMIT)
            .all(&state.database)
            .await?;
        items.extend(models.into_iter().map(|article| {
            let link = format!("{origin}/articles/{}", article.slug);
            FeedItem {
                title: article.title,
                link,
                guid: format!("urn:uuid:{}", article.id),
                description_html: article
                    .summary
                    .unwrap_or_else(|| markdown::render(&excerpt(&article.body_markdown, 500))),
                published_at: article
                    .published_at
                    .expect("published article has timestamp"),
            }
        }));
    }

    if matches!(kind, FeedKind::All | FeedKind::Dynamics) {
        let models = dynamics::Entity::find()
            .filter(dynamics::Column::Status.eq("published"))
            .filter(dynamics::Column::PublishedAt.lte(Utc::now().fixed_offset()))
            .order_by_desc(dynamics::Column::PublishedAt)
            .limit(FEED_LIMIT)
            .all(&state.database)
            .await?;
        items.extend(models.into_iter().map(|dynamic| {
            let link = format!("{origin}/dynamics#dynamic-{}", dynamic.id);
            let published_at = dynamic
                .published_at
                .expect("published dynamic has timestamp");
            FeedItem {
                title: format!("动态 · {}", published_at.format("%Y-%m-%d %H:%M")),
                link,
                guid: format!("urn:uuid:{}", dynamic.id),
                description_html: markdown::render(&dynamic.content_markdown),
                published_at,
            }
        }));
    }

    items.sort_by(|left, right| right.published_at.cmp(&left.published_at));
    items.truncate(FEED_LIMIT as usize);
    let title_suffix = match kind {
        FeedKind::All => "",
        FeedKind::Articles => " · 文章",
        FeedKind::Dynamics => " · 动态",
    };
    let description = settings.site_description.unwrap_or_default();
    let xml = build_xml(
        &format!("{}{title_suffix}", settings.site_title),
        &description,
        origin,
        &format!("{origin}{self_path}"),
        &items,
    );
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/rss+xml; charset=utf-8"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=300"),
    );
    Ok((headers, xml))
}

fn build_xml(
    title: &str,
    description: &str,
    origin: &str,
    self_url: &str,
    items: &[FeedItem],
) -> String {
    let mut xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>{}</title>
<link>{}</link>
<description>{}</description>
<language>zh-CN</language>
<atom:link href="{}" rel="self" type="application/rss+xml"/>
<lastBuildDate>{}</lastBuildDate>
"#,
        escape_xml(title),
        escape_xml(origin),
        escape_xml(description),
        escape_xml(self_url),
        Utc::now().to_rfc2822(),
    );
    for item in items {
        xml.push_str(&format!(
            "<item><title>{}</title><link>{}</link><guid isPermaLink=\"false\">{}</guid><description>{}</description><pubDate>{}</pubDate></item>\n",
            escape_xml(&item.title),
            escape_xml(&item.link),
            escape_xml(&item.guid),
            escape_xml(&item.description_html),
            item.published_at.to_rfc2822(),
        ));
    }
    xml.push_str("</channel>\n</rss>\n");
    xml
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn excerpt(value: &str, maximum: usize) -> String {
    let mut output = value.chars().take(maximum).collect::<String>();
    if value.chars().count() > maximum {
        output.push('…');
    }
    output
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    #[test]
    fn feed_is_well_formed_and_escapes_content() {
        let item = FeedItem {
            title: "A < B & C".into(),
            link: "https://example.com/articles/a".into(),
            guid: "urn:uuid:test".into(),
            description_html: "<p>Hello</p>".into(),
            published_at: FixedOffset::east_opt(0)
                .unwrap()
                .with_ymd_and_hms(2026, 10, 4, 12, 0, 0)
                .unwrap(),
        };
        let xml = build_xml(
            "Yuki & Log",
            "Description",
            "https://example.com",
            "https://example.com/feed.xml",
            &[item],
        );
        assert!(xml.starts_with("<?xml version=\"1.0\""));
        assert!(xml.contains("<title>A &lt; B &amp; C</title>"));
        assert!(xml.contains("&lt;p&gt;Hello&lt;/p&gt;"));
        assert!(xml.ends_with("</rss>\n"));
    }
}
