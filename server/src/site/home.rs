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
};

use super::{
    ArticleFilter, ArticleSort, HOME_ARTICLE_LIMIT, HOME_DYNAMIC_LIMIT, HomeStats, PageMeta,
    components::{RenderContext, render_home},
    load_articles, load_dynamics, load_pulse, load_site, page,
};

#[derive(Debug, Deserialize)]
pub struct HomeQuery {
    sort: Option<String>,
}

pub async fn home(
    State(state): State<AppState>,
    Query(query): Query<HomeQuery>,
) -> Result<Html<String>, AppError> {
    let site = load_site(&state).await?;
    // 无 ?sort= 参数时用 masthead default-sort 旋钮（默认精选）
    let sort = match query.sort.as_deref() {
        None => site.default_sort,
        Some("featured") => ArticleSort::Featured,
        Some("popular") => ArticleSort::Popular,
        Some("recent") => ArticleSort::Recent,
        Some(_) => return Err(AppError::InvalidRequest("无效的排序方式")),
    };
    let articles = load_articles(
        &state,
        HOME_ARTICLE_LIMIT,
        0,
        None,
        &ArticleFilter::default(),
        sort,
    )
    .await?;
    let dynamics = load_dynamics(&state, 0, HOME_DYNAMIC_LIMIT).await?;
    let stats = load_home_stats(&state).await?;
    let pulse = load_pulse(&state, 6).await?;
    let content = render_home(&RenderContext {
        site: &site,
        articles: &articles,
        dynamics: &dynamics,
        stats: &stats,
        pulse: &pulse,
        sort,
    })?;
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
