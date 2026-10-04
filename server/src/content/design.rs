use std::collections::HashSet;

use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, FixedOffset};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, ColumnTrait, EntityTrait, IntoActiveModel, QueryFilter,
    QueryOrder, Set, prelude::Uuid,
};
use serde::Serialize;

use crate::{
    AppState, auth,
    entities::{media_assets, page_layouts},
    error::AppError,
    layout::PageLayoutDocument,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutResponse {
    page_key: String,
    layout: PageLayoutDocument,
    updated_at: DateTime<FixedOffset>,
}

pub async fn list_layouts(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<LayoutResponse>>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let models = page_layouts::Entity::find()
        .order_by_asc(page_layouts::Column::PageKey)
        .all(&state.database)
        .await?;
    let layouts = models
        .into_iter()
        .map(LayoutResponse::try_from)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Json(layouts))
}

pub async fn get_layout(
    State(state): State<AppState>,
    Path(page_key): Path<String>,
    jar: CookieJar,
) -> Result<Json<LayoutResponse>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let model = page_layouts::Entity::find_by_id(page_key)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(model.try_into()?))
}

pub async fn put_layout(
    State(state): State<AppState>,
    Path(page_key): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(layout): Json<PageLayoutDocument>,
) -> Result<Json<LayoutResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    layout.validate().map_err(AppError::InvalidRequest)?;
    validate_layout_media(&state, &layout).await?;
    let value =
        serde_json::to_value(&layout).map_err(|_| AppError::Internal("serialize layout"))?;

    let model = if let Some(model) = page_layouts::Entity::find_by_id(&page_key)
        .one(&state.database)
        .await?
    {
        let mut active = model.into_active_model();
        active.layout = Set(value);
        active.update(&state.database).await?
    } else {
        page_layouts::ActiveModel {
            page_key: Set(page_key),
            layout: Set(value),
            updated_at: NotSet,
        }
        .insert(&state.database)
        .await?
    };
    Ok(Json(model.try_into()?))
}

async fn validate_layout_media(
    state: &AppState,
    layout: &PageLayoutDocument,
) -> Result<(), AppError> {
    let ids = layout
        .media_ids()
        .into_iter()
        .filter_map(|id| Uuid::parse_str(id).ok())
        .collect::<HashSet<_>>();
    if ids.is_empty() {
        return Ok(());
    }
    let media = media_assets::Entity::find()
        .filter(media_assets::Column::Id.is_in(ids.iter().copied()))
        .all(&state.database)
        .await?;
    if media.len() != ids.len()
        || media
            .iter()
            .any(|item| !item.media_type.starts_with("image/"))
    {
        return Err(AppError::InvalidRequest("布局背景必须引用媒体库中的图片"));
    }
    Ok(())
}

impl TryFrom<page_layouts::Model> for LayoutResponse {
    type Error = AppError;

    fn try_from(model: page_layouts::Model) -> Result<Self, Self::Error> {
        let layout: PageLayoutDocument = serde_json::from_value(model.layout)
            .map_err(|_| AppError::Internal("stored layout does not match schema"))?;
        layout
            .validate()
            .map_err(|_| AppError::Internal("stored layout failed validation"))?;
        Ok(Self {
            page_key: model.page_key,
            layout,
            updated_at: model.updated_at,
        })
    }
}
