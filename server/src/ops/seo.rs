use axum::{
    extract::State,
    http::{Response, header::CONTENT_TYPE},
    response::IntoResponse,
};
use chrono::Utc;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};

use crate::{AppState, entities::{articles, series}, error::AppError};

pub async fn sitemap(State(state): State<AppState>) -> Result<Response<axum::body::Body>, AppError> {
    let models = articles::Entity::find()
        .filter(articles::Column::Status.eq("published"))
        .filter(articles::Column::PublishedAt.lte(Utc::now().fixed_offset()))
        .order_by_desc(articles::Column::PublishedAt)
        .all(&state.database)
        .await?;
    let entries = models
        .into_iter()
        .map(|article| {
            let lastmod = article
                .published_at
                .map(|published| published.max(article.updated_at))
                .unwrap_or(article.updated_at);
            (article.slug, lastmod.format("%Y-%m-%d").to_string())
        })
        .collect::<Vec<_>>();
    let series_slugs = series::Entity::find()
        .order_by_asc(series::Column::Slug)
        .all(&state.database)
        .await?
        .into_iter()
        .map(|model| model.slug)
        .collect::<Vec<_>>();
    let body = sitemap_xml(state.auth.public_origin(), &entries, &series_slugs);
    Ok(([(CONTENT_TYPE, "application/xml; charset=utf-8")], body).into_response())
}

pub async fn robots(State(state): State<AppState>) -> Response<axum::body::Body> {
    (
        [(CONTENT_TYPE, "text/plain; charset=utf-8")],
        robots_txt(state.auth.public_origin()),
    )
        .into_response()
}

fn sitemap_xml(origin: &str, articles: &[(String, String)], series: &[String]) -> String {
    let mut xml = String::from(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
"#,
    );
    for (path, changefreq) in [
        ("/", "daily"),
        ("/articles", "daily"),
        ("/dynamics", "hourly"),
        ("/series", "weekly"),
        ("/friends", "weekly"),
    ] {
        xml.push_str(&format!(
            "  <url><loc>{}</loc><changefreq>{changefreq}</changefreq></url>\n",
            xml_escape(&format!("{origin}{path}"))
        ));
    }
    for slug in series {
        xml.push_str(&format!(
            "  <url><loc>{}</loc><changefreq>weekly</changefreq></url>\n",
            xml_escape(&format!("{origin}/series/{slug}"))
        ));
    }
    for (slug, lastmod) in articles {
        xml.push_str(&format!(
            "  <url><loc>{}</loc><lastmod>{}</lastmod><changefreq>monthly</changefreq></url>\n",
            xml_escape(&format!("{origin}/articles/{slug}")),
            xml_escape(lastmod)
        ));
    }
    xml.push_str("</urlset>\n");
    xml
}

fn robots_txt(origin: &str) -> String {
    format!(
        "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: {origin}/sitemap.xml\n"
    )
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sitemap_lists_static_pages_series_and_articles() {
        let xml = sitemap_xml(
            "https://blog.example.com",
            &[
                ("first-post".to_owned(), "2026-10-01".to_owned()),
                ("night-flight".to_owned(), "2026-09-20".to_owned()),
            ],
            &["nightflight-notes".to_owned()],
        );
        assert!(xml.contains("<loc>https://blog.example.com/</loc>"));
        assert!(xml.contains("<loc>https://blog.example.com/articles</loc>"));
        assert!(xml.contains("<loc>https://blog.example.com/dynamics</loc>"));
        assert!(xml.contains("<loc>https://blog.example.com/friends</loc>"));
        assert!(xml.contains("<loc>https://blog.example.com/series</loc>"));
        assert!(xml.contains("<loc>https://blog.example.com/series/nightflight-notes</loc>"));
        assert!(!xml.contains("/search</loc>"));
        assert!(xml.contains("<loc>https://blog.example.com/articles/first-post</loc>"));
        assert!(xml.contains("<lastmod>2026-10-01</lastmod>"));
        assert!(xml.contains("<loc>https://blog.example.com/articles/night-flight</loc>"));
        assert!(xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
        assert!(xml.contains("xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\""));
    }

    #[test]
    fn robots_allows_public_and_points_at_sitemap() {
        let text = robots_txt("https://blog.example.com");
        assert!(text.contains("User-agent: *"));
        assert!(text.contains("Allow: /"));
        assert!(text.contains("Disallow: /admin"));
        assert!(text.contains("Disallow: /api"));
        assert!(text.contains("Sitemap: https://blog.example.com/sitemap.xml"));
    }
}
