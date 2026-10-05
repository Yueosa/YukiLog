use axum::{
    extract::{Query, State},
    response::Html,
};
use chrono::Utc;
use sea_orm::{ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter};
use serde::Deserialize;

use crate::{
    AppState,
    entities::{article_metrics, articles, dynamics, friend_links},
    error::AppError,
    layout::ComponentType,
};

use super::{
    ArticleFilter, ArticleSort, HOME_ARTICLE_LIMIT, HOME_DYNAMIC_LIMIT, HomeStats,
    components::{RenderContext, load_layout_media, render_node},
    PageMeta, load_articles, load_dynamics, load_layout, load_site, page,
};

#[derive(Debug, Deserialize)]
pub struct HomeQuery {
    sort: Option<String>,
}

pub async fn home(
    State(state): State<AppState>,
    Query(query): Query<HomeQuery>,
) -> Result<Html<String>, AppError> {
    let sort = match query.sort.as_deref() {
        None | Some("featured") => ArticleSort::Featured,
        Some("popular") => ArticleSort::Popular,
        Some("recent") => ArticleSort::Recent,
        Some(_) => return Err(AppError::InvalidRequest("无效的排序方式")),
    };
    let site = load_site(&state).await?;
    let layout = load_layout(&state, "home").await?;
    let articles = load_articles(
        &state,
        HOME_ARTICLE_LIMIT,
        0,
        None,
        &ArticleFilter::default(),
        sort,
    )
    .await?;
    let dynamics = load_dynamics(&state, HOME_DYNAMIC_LIMIT).await?;
    let stats = load_home_stats(&state).await?;
    let media_urls = load_layout_media(&state, &layout.root).await?;
    let home_content_id = layout
        .root
        .children
        .iter()
        .find(|node| !matches!(node.component_type, ComponentType::Hero))
        .map(|node| node.id.as_str())
        .unwrap_or(layout.root.id.as_str());
    let content = render_node(
        &layout.root,
        &RenderContext {
            site: &site,
            articles: &articles,
            dynamics: &dynamics,
            stats: &stats,
            media_urls: &media_urls,
            home_content_id,
            sort,
        },
    )?;
    page(&site, &PageMeta::new(&site, "首页", "/"), &content)
}

async fn load_home_stats(state: &AppState) -> Result<HomeStats, AppError> {
    let now = Utc::now().fixed_offset();
    let articles = articles::Entity::find()
        .filter(articles::Column::Status.eq("published"))
        .filter(articles::Column::PublishedAt.lte(now))
        .count(&state.database)
        .await?;
    let dynamics = dynamics::Entity::find()
        .filter(dynamics::Column::Status.eq("published"))
        .filter(dynamics::Column::PublishedAt.lte(now))
        .count(&state.database)
        .await?;
    let friends = friend_links::Entity::find()
        .filter(friend_links::Column::IsVisible.eq(true))
        .count(&state.database)
        .await?;
    let views = article_metrics::Entity::find()
        .all(&state.database)
        .await?
        .iter()
        .map(|metric| metric.view_count)
        .sum();
    Ok(HomeStats {
        articles: articles as i64,
        dynamics: dynamics as i64,
        friends: friends as i64,
        views,
    })
}
