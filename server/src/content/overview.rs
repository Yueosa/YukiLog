use axum::{Json, extract::State};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, FixedOffset};
use sea_orm::{
    ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, QuerySelect, Statement, prelude::Uuid,
};
use serde::Serialize;
use std::collections::HashMap;

use crate::{
    AppState, auth,
    entities::{
        admin_notifications, article_metrics, articles, comments, dynamic_metrics, dynamics,
        email_deliveries, media_assets, subscribers,
    },
    error::AppError,
    ops::notifications::NotificationResponse,
};

#[derive(Debug, Serialize)]
pub struct OverviewResponse {
    counts: OverviewCounts,
    totals: OverviewTotals,
    top_viewed: Vec<OverviewTopArticle>,
    top_liked_articles: Vec<OverviewTopArticle>,
    top_liked_dynamics: Vec<OverviewTopDynamic>,
    recent_comments: Vec<OverviewRecentComment>,
    recent_notifications: Vec<NotificationResponse>,
}

#[derive(Debug, Serialize)]
struct OverviewCounts {
    articles: u64,
    articles_published: u64,
    dynamics: u64,
    comments_pending: u64,
    media: u64,
    subscribers_active: u64,
    deliveries_failed: u64,
    notifications_unread: u64,
}

#[derive(Debug, Serialize)]
struct OverviewTotals {
    views: i64,
    likes: i64,
}

#[derive(Debug, Serialize)]
struct OverviewTopArticle {
    id: Uuid,
    title: String,
    slug: String,
    value: i64,
}

#[derive(Debug, Serialize)]
struct OverviewTopDynamic {
    id: Uuid,
    excerpt: String,
    like_count: i64,
}

#[derive(Debug, Serialize)]
struct OverviewRecentComment {
    id: Uuid,
    display_name: String,
    excerpt: String,
    status: String,
    created_at: DateTime<FixedOffset>,
    target_title: String,
}

pub async fn overview(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<OverviewResponse>, AppError> {
    let account_id = auth::authorize_read(&state, &jar).await?;
    let database = &state.database;

    let counts = OverviewCounts {
        articles: articles::Entity::find().count(database).await?,
        articles_published: articles::Entity::find()
            .filter(articles::Column::Status.eq("published"))
            .count(database)
            .await?,
        dynamics: dynamics::Entity::find().count(database).await?,
        comments_pending: comments::Entity::find()
            .filter(comments::Column::Status.eq("pending"))
            .count(database)
            .await?,
        media: media_assets::Entity::find().count(database).await?,
        subscribers_active: subscribers::Entity::find()
            .filter(subscribers::Column::Status.eq("active"))
            .count(database)
            .await?,
        deliveries_failed: email_deliveries::Entity::find()
            .filter(email_deliveries::Column::Status.eq("failed"))
            .count(database)
            .await?,
        notifications_unread: admin_notifications::Entity::find()
            .filter(admin_notifications::Column::AccountId.eq(account_id))
            .filter(admin_notifications::Column::ReadAt.is_null())
            .count(database)
            .await?,
    };

    let totals = database
        .query_one(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"SELECT COALESCE((SELECT SUM(view_count) FROM article_metrics), 0)::bigint AS views,
                      COALESCE((SELECT SUM(like_count) FROM article_metrics), 0)::bigint
                    + COALESCE((SELECT SUM(like_count) FROM dynamic_metrics), 0)::bigint AS likes"#
                .to_owned(),
        ))
        .await?
        .map(|row| {
            Ok::<_, sea_orm::DbErr>(OverviewTotals {
                views: row.try_get("", "views")?,
                likes: row.try_get("", "likes")?,
            })
        })
        .transpose()?
        .unwrap_or(OverviewTotals { views: 0, likes: 0 });

    let viewed_metrics = article_metrics::Entity::find()
        .order_by_desc(article_metrics::Column::ViewCount)
        .limit(5)
        .all(database)
        .await?;
    let liked_article_metrics = article_metrics::Entity::find()
        .order_by_desc(article_metrics::Column::LikeCount)
        .limit(5)
        .all(database)
        .await?;
    let liked_dynamic_metrics = dynamic_metrics::Entity::find()
        .order_by_desc(dynamic_metrics::Column::LikeCount)
        .limit(5)
        .all(database)
        .await?;

    let article_ids = viewed_metrics
        .iter()
        .chain(liked_article_metrics.iter())
        .map(|metric| metric.article_id)
        .collect::<Vec<_>>();
    let articles_by_id = articles::Entity::find()
        .filter(articles::Column::Id.is_in(article_ids))
        .all(database)
        .await?
        .into_iter()
        .map(|article| (article.id, article))
        .collect::<HashMap<_, _>>();
    let dynamics_by_id = dynamics::Entity::find()
        .filter(
            dynamics::Column::Id.is_in(liked_dynamic_metrics.iter().map(|m| m.dynamic_id).collect::<Vec<_>>()),
        )
        .all(database)
        .await?
        .into_iter()
        .map(|dynamic| (dynamic.id, dynamic))
        .collect::<HashMap<_, _>>();

    let top_article = |metric: &article_metrics::Model, value: i64| {
        articles_by_id
            .get(&metric.article_id)
            .map(|article| OverviewTopArticle {
                id: article.id,
                title: article.title.clone(),
                slug: article.slug.clone(),
                value,
            })
    };
    let top_viewed = viewed_metrics
        .iter()
        .filter_map(|metric| top_article(metric, metric.view_count))
        .collect();
    let top_liked_articles = liked_article_metrics
        .iter()
        .filter_map(|metric| top_article(metric, metric.like_count))
        .collect();
    let top_liked_dynamics = liked_dynamic_metrics
        .iter()
        .filter_map(|metric| {
            dynamics_by_id
                .get(&metric.dynamic_id)
                .map(|dynamic| OverviewTopDynamic {
                    id: dynamic.id,
                    excerpt: excerpt(&dynamic.content_markdown, 40),
                    like_count: metric.like_count,
                })
        })
        .collect();

    let recent = comments::Entity::find()
        .order_by_desc(comments::Column::CreatedAt)
        .limit(5)
        .all(database)
        .await?;
    let comment_articles = articles::Entity::find()
        .filter(
            articles::Column::Id.is_in(recent.iter().filter_map(|c| c.article_id).collect::<Vec<_>>()),
        )
        .all(database)
        .await?
        .into_iter()
        .map(|article| (article.id, article.title))
        .collect::<HashMap<_, _>>();
    let comment_dynamics = dynamics::Entity::find()
        .filter(
            dynamics::Column::Id.is_in(recent.iter().filter_map(|c| c.dynamic_id).collect::<Vec<_>>()),
        )
        .all(database)
        .await?
        .into_iter()
        .map(|dynamic| (dynamic.id, dynamic.content_markdown))
        .collect::<HashMap<_, _>>();
    let recent_comments = recent
        .into_iter()
        .map(|comment| {
            let target_title = comment
                .article_id
                .and_then(|id| comment_articles.get(&id).cloned())
                .or_else(|| {
                    comment
                        .dynamic_id
                        .and_then(|id| comment_dynamics.get(&id))
                        .map(|content| excerpt(content, 40))
                })
                .unwrap_or_default();
            OverviewRecentComment {
                id: comment.id,
                display_name: comment.display_name,
                excerpt: excerpt(&comment.content, 80),
                status: comment.status,
                created_at: comment.created_at,
                target_title,
            }
        })
        .collect();

    let recent_notifications = admin_notifications::Entity::find()
        .filter(admin_notifications::Column::AccountId.eq(account_id))
        .order_by_desc(admin_notifications::Column::UpdatedAt)
        .limit(5)
        .all(database)
        .await?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(Json(OverviewResponse {
        counts,
        totals,
        top_viewed,
        top_liked_articles,
        top_liked_dynamics,
        recent_comments,
        recent_notifications,
    }))
}

fn excerpt(text: &str, max: usize) -> String {
    let mut taken = text.trim().chars().take(max + 1).collect::<String>();
    if taken.chars().count() > max {
        taken = taken.chars().take(max).collect();
        taken.push('…');
    }
    taken
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn excerpt_truncates_by_characters() {
        assert_eq!(excerpt("  你好世界  ", 40), "你好世界");
        assert_eq!(excerpt("abcdefghij", 4), "abcd…");
        assert_eq!(excerpt("短", 40), "短");
    }
}
