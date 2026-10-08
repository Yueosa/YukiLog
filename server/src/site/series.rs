use axum::{
    extract::{Path, State},
    response::Html,
};
use chrono::{DateTime, FixedOffset, Utc};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};

use crate::{
    AppState,
    entities::{articles, series},
    error::AppError,
};

use super::{PageMeta, cover_media_url, date, escape_html, load_site, page, page_head};

struct SeriesCard {
    slug: String,
    name: String,
    description: String,
    cover_url: String,
    chapter_count: usize,
    latest: String,
    featured: bool,
}

/// 一个系列的已发布章节：series_order 升序、NULL 排最后，平局按发布时间次序。
/// 与公开 API 的 series_chapters_query 同口径。
async fn load_chapters(
    state: &AppState,
    series_id: sea_orm::prelude::Uuid,
) -> Result<Vec<articles::Model>, AppError> {
    Ok(articles::Entity::find()
        .filter(articles::Column::SeriesId.eq(series_id))
        .filter(articles::Column::Status.eq("published"))
        .filter(articles::Column::PublishedAt.lte(Utc::now().fixed_offset()))
        .order_by_with_nulls(
            articles::Column::SeriesOrder,
            sea_orm::sea_query::Order::Asc,
            sea_orm::sea_query::NullOrdering::Last,
        )
        .order_by_asc(articles::Column::PublishedAt)
        .all(&state.database)
        .await?)
}

/// 系列封面：自身封面优先（card 变体），没有则回退第一章封面。
async fn series_cover(
    state: &AppState,
    model: &series::Model,
    chapters: &[articles::Model],
) -> Result<String, AppError> {
    if model.cover_media_id.is_some() {
        let url = cover_media_url(state, model.cover_media_id).await?;
        if !url.is_empty() {
            return Ok(url);
        }
    }
    if let Some(first) = chapters.first() {
        return cover_media_url(state, first.cover_media_id).await;
    }
    Ok(String::new())
}

pub async fn series_list(State(state): State<AppState>) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let models = series::Entity::find()
        .order_by_asc(series::Column::Name)
        .all(&state.database)
        .await?;
    let mut rows: Vec<(SeriesCard, Option<DateTime<FixedOffset>>)> = Vec::with_capacity(models.len());
    for model in models {
        let chapters = load_chapters(&state, model.id).await?;
        let latest_at = chapters.iter().filter_map(|chapter| chapter.published_at).max();
        let cover_url = series_cover(&state, &model, &chapters).await?;
        rows.push((
            SeriesCard {
                slug: model.slug.clone(),
                name: model.name.clone(),
                description: model.description.clone().unwrap_or_default(),
                cover_url,
                chapter_count: chapters.len(),
                latest: latest_at.map(date).unwrap_or_default(),
                featured: model.featured_at.is_some(),
            },
            latest_at,
        ));
    }
    // featured 在前，其余按最近章节发布倒序（无章节排最后）
    rows.sort_by(|a, b| {
        b.0.featured
            .cmp(&a.0.featured)
            .then_with(|| b.1.cmp(&a.1))
            .then_with(|| a.0.name.cmp(&b.0.name))
    });
    let mut content = page_head(
        &site,
        "YukiLog — Series",
        "系列",
        "连载与专题，按章节从头读起。",
        false,
    );
    if rows.is_empty() {
        content.push_str(r#"<p class="empty">这里还没有系列。</p>"#);
    }
    for (card, _) in &rows {
        let cover = if card.cover_url.is_empty() {
            String::new()
        } else {
            format!(
                r#"<i class="archive-cover" role="img" aria-label="{}" style="background-image:url({})"></i>"#,
                escape_html(&card.name),
                escape_html(&card.cover_url)
            )
        };
        let featured = if card.featured {
            r#"<span class="cat cat-p">精选</span>"#
        } else {
            ""
        };
        content.push_str(&format!(
            r#"<a class="archive-row" data-reveal href="/series/{}"><time>{}</time><h3><span>{}</span></h3><div class="meta">{}<span>{} 章</span></div><div class="archive-more"><div class="archive-more-in">{}<p class="archive-summary">{}</p></div></div></a>"#,
            escape_html(&card.slug),
            escape_html(&card.latest),
            escape_html(&card.name),
            featured,
            card.chapter_count,
            cover,
            escape_html(&card.description)
        ));
    }
    page(&site, &PageMeta::new(&site, "系列", "/series"), &content)
}

pub async fn series_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    let model = series::Entity::find()
        .filter(series::Column::Slug.eq(slug))
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    let chapters = load_chapters(&state, model.id).await?;
    let cover_url = series_cover(&state, &model, &chapters).await?;
    let description = model.description.clone().unwrap_or_default();
    let lede = if description.is_empty() {
        format!("共 {} 章，按章节次序排列。", chapters.len())
    } else {
        description.clone()
    };
    let mut content = page_head(
        &site,
        "YukiLog — Series",
        &model.name,
        &lede,
        false,
    );
    if chapters.is_empty() {
        content.push_str(r#"<p class="empty">这个系列还没有公开章节。</p>"#);
    }
    for (index, chapter) in chapters.iter().enumerate() {
        let display_title = chapter.series_title.as_deref().unwrap_or(&chapter.title);
        let published = chapter
            .published_at
            .expect("published article has timestamp");
        let chapter_label = match chapter.series_order {
            Some(order) => format!("第 {order} 章"),
            None => format!("第 {} 章", index + 1),
        };
        let cover = if chapter.cover_media_id.is_some() {
            let url = cover_media_url(&state, chapter.cover_media_id).await?;
            if url.is_empty() {
                String::new()
            } else {
                format!(
                    r#"<i class="archive-cover" role="img" aria-label="{}" style="background-image:url({})"></i>"#,
                    escape_html(display_title),
                    escape_html(&url)
                )
            }
        } else {
            String::new()
        };
        content.push_str(&format!(
            r#"<a class="archive-row" data-reveal href="/articles/{}"><time>{}</time><h3><span>{}</span></h3><div class="meta"><span class="cat cat-b">{}</span></div><div class="archive-more"><div class="archive-more-in">{}<p class="archive-summary">{}</p></div></div></a>"#,
            escape_html(&chapter.slug),
            escape_html(&date(published)),
            escape_html(display_title),
            escape_html(&chapter_label),
            cover,
            escape_html(chapter.summary.as_deref().unwrap_or_default())
        ));
    }
    let mut meta = PageMeta::new(&site, &model.name, &format!("/series/{}", model.slug));
    if !description.is_empty() {
        meta.description = description;
    }
    if !cover_url.is_empty() {
        meta.og_image = super::absolute_url(&site.origin, &cover_url);
    }
    page(&site, &meta, &content)
}
