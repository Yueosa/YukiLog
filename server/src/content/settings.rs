use std::collections::HashSet;

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, Uri},
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, FixedOffset};
use sea_orm::{
    ActiveModelTrait, ActiveValue::NotSet, EntityTrait, IntoActiveModel, Set, prelude::Uuid,
};
use serde::{Deserialize, Serialize};

use crate::{
    AppState, auth,
    entities::{media_assets, site_settings},
    error::AppError,
};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SiteSettingsWrite {
    pub site_title: String,
    pub site_description: Option<String>,
    pub owner_name: String,
    pub owner_bio: String,
    pub avatar_media_id: Option<Uuid>,
    pub social_links: Vec<SocialLink>,
    pub theme: ThemeTokens,
    pub shell_layout: ShellLayout,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SocialLink {
    pub label: String,
    pub url: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThemeTokens {
    pub schema_version: u8,
    pub colors: ThemeColors,
    pub typography: ThemeTypography,
    pub shape: ThemeShape,
    pub motion: MotionLevel,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThemeColors {
    pub background: String,
    pub surface: String,
    pub surface_muted: String,
    pub text: String,
    pub text_muted: String,
    pub primary: String,
    pub secondary: String,
    pub border: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThemeTypography {
    pub body: FontFamily,
    pub display: FontFamily,
    pub scale: f32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThemeShape {
    pub radius: u8,
    pub bordered_cards: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum FontFamily {
    System,
    Serif,
    Rounded,
    Mono,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MotionLevel {
    None,
    Subtle,
    Expressive,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShellLayout {
    pub schema_version: u8,
    pub navigation: NavigationVariant,
    pub brand_position: BrandPosition,
    pub show_search: bool,
    pub translucent: bool,
    pub max_width: ShellWidth,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum NavigationVariant {
    Topbar,
    Sidebar,
    FloatingDock,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum BrandPosition {
    Start,
    Center,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShellWidth {
    Content,
    Wide,
    Full,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteSettingsResponse {
    #[serde(flatten)]
    settings: SiteSettingsWrite,
    updated_at: DateTime<FixedOffset>,
}

pub async fn get_settings(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<SiteSettingsResponse>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    let model = site_settings::Entity::find_by_id(true)
        .one(&state.database)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(model.try_into()?))
}

pub async fn put_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(settings): Json<SiteSettingsWrite>,
) -> Result<Json<SiteSettingsResponse>, AppError> {
    auth::authorize_write(&state, &headers, &jar).await?;
    settings.validate()?;
    validate_avatar(&state, settings.avatar_media_id).await?;
    let social_links = serde_json::to_value(&settings.social_links)
        .map_err(|_| AppError::Internal("serialize social links"))?;
    let theme =
        serde_json::to_value(&settings.theme).map_err(|_| AppError::Internal("serialize theme"))?;
    let shell_layout = serde_json::to_value(&settings.shell_layout)
        .map_err(|_| AppError::Internal("serialize shell layout"))?;

    let model = if let Some(model) = site_settings::Entity::find_by_id(true)
        .one(&state.database)
        .await?
    {
        let mut active = model.into_active_model();
        active.site_title = Set(settings.site_title);
        active.site_description = Set(settings.site_description);
        active.owner_name = Set(settings.owner_name);
        active.owner_bio = Set(settings.owner_bio);
        active.avatar_media_id = Set(settings.avatar_media_id);
        active.social_links = Set(social_links);
        active.theme = Set(theme);
        active.shell_layout = Set(shell_layout);
        active.update(&state.database).await?
    } else {
        site_settings::ActiveModel {
            singleton: Set(true),
            site_title: Set(settings.site_title),
            site_description: Set(settings.site_description),
            owner_name: Set(settings.owner_name),
            owner_bio: Set(settings.owner_bio),
            avatar_media_id: Set(settings.avatar_media_id),
            social_links: Set(social_links),
            theme: Set(theme),
            shell_layout: Set(shell_layout),
            updated_at: NotSet,
        }
        .insert(&state.database)
        .await?
    };
    Ok(Json(model.try_into()?))
}

impl SiteSettingsWrite {
    pub(crate) fn validate(&self) -> Result<(), AppError> {
        if self.theme.schema_version != 1 || self.shell_layout.schema_version != 1 {
            return Err(AppError::InvalidRequest("不支持的配置 schemaVersion"));
        }
        if self.social_links.len() > 12 {
            return Err(AppError::InvalidRequest("社交链接不能超过 12 个"));
        }
        let mut labels = HashSet::new();
        for link in &self.social_links {
            if !(1..=40).contains(&link.label.chars().count())
                || link.url.len() > 2048
                || !labels.insert(link.label.to_lowercase())
                || !valid_public_url(&link.url)
            {
                return Err(AppError::InvalidRequest("社交链接无效"));
            }
        }
        if !self.theme.colors.values().into_iter().all(valid_hex_color) {
            return Err(AppError::InvalidRequest("主题颜色必须使用十六进制格式"));
        }
        if !self.theme.typography.scale.is_finite()
            || !(0.8..=1.4).contains(&self.theme.typography.scale)
        {
            return Err(AppError::InvalidRequest("主题字号比例无效"));
        }
        if self.theme.shape.radius > 32 {
            return Err(AppError::InvalidRequest("主题圆角不能超过 32"));
        }
        Ok(())
    }
}

impl ThemeColors {
    fn values(&self) -> [&str; 8] {
        [
            &self.background,
            &self.surface,
            &self.surface_muted,
            &self.text,
            &self.text_muted,
            &self.primary,
            &self.secondary,
            &self.border,
        ]
    }
}

impl TryFrom<site_settings::Model> for SiteSettingsResponse {
    type Error = AppError;

    fn try_from(model: site_settings::Model) -> Result<Self, Self::Error> {
        let social_links = serde_json::from_value(model.social_links)
            .map_err(|_| AppError::Internal("stored social links do not match schema"))?;
        let theme = serde_json::from_value(model.theme)
            .map_err(|_| AppError::Internal("stored theme does not match schema"))?;
        let shell_layout = serde_json::from_value(model.shell_layout)
            .map_err(|_| AppError::Internal("stored shell layout does not match schema"))?;
        let settings = SiteSettingsWrite {
            site_title: model.site_title,
            site_description: model.site_description,
            owner_name: model.owner_name,
            owner_bio: model.owner_bio,
            avatar_media_id: model.avatar_media_id,
            social_links,
            theme,
            shell_layout,
        };
        settings
            .validate()
            .map_err(|_| AppError::Internal("stored site settings failed validation"))?;
        Ok(Self {
            settings,
            updated_at: model.updated_at,
        })
    }
}

async fn validate_avatar(state: &AppState, id: Option<Uuid>) -> Result<(), AppError> {
    let Some(id) = id else {
        return Ok(());
    };
    let media = media_assets::Entity::find_by_id(id)
        .one(&state.database)
        .await?
        .ok_or(AppError::InvalidRequest("头像媒体不存在"))?;
    if !media.media_type.starts_with("image/") {
        return Err(AppError::InvalidRequest("头像媒体必须是图片"));
    }
    Ok(())
}

fn valid_public_url(value: &str) -> bool {
    if let Some(address) = value.strip_prefix("mailto:") {
        return address.len() <= 254
            && address
                .split_once('@')
                .is_some_and(|(local, domain)| !local.is_empty() && domain.contains('.'));
    }
    value.parse::<Uri>().is_ok_and(|uri| {
        matches!(uri.scheme_str(), Some("http" | "https")) && uri.authority().is_some()
    })
}

fn valid_hex_color(value: &str) -> bool {
    matches!(value.len(), 7 | 9)
        && value.starts_with('#')
        && value[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings() -> SiteSettingsWrite {
        serde_json::from_value(serde_json::json!({
            "siteTitle": "YukiLog",
            "siteDescription": "A blog",
            "ownerName": "Sakurine",
            "ownerBio": "Hello",
            "avatarMediaId": null,
            "socialLinks": [
                {"label": "GitHub", "url": "https://github.com/example"},
                {"label": "Mail", "url": "mailto:hello@example.com"}
            ],
            "theme": {
                "schemaVersion": 1,
                "colors": {
                    "background": "#ffffff",
                    "surface": "#fff8fc",
                    "surfaceMuted": "#f2f4f8",
                    "text": "#20232a",
                    "textMuted": "#667085",
                    "primary": "#3278d4",
                    "secondary": "#ef78ac",
                    "border": "#dfe3ea"
                },
                "typography": {"body": "system", "display": "serif", "scale": 1.0},
                "shape": {"radius": 16, "borderedCards": true},
                "motion": "subtle"
            },
            "shellLayout": {
                "schemaVersion": 1,
                "navigation": "topbar",
                "brandPosition": "start",
                "showSearch": true,
                "translucent": true,
                "maxWidth": "wide"
            }
        }))
        .unwrap()
    }

    #[test]
    fn accepts_safe_site_settings() {
        assert!(settings().validate().is_ok());
    }

    #[test]
    fn rejects_css_and_unsafe_links() {
        let mut input = settings();
        input.theme.colors.primary = "red; background:url(x)".into();
        assert!(input.validate().is_err());

        let mut input = settings();
        input.social_links[0].url = "javascript:alert(1)".into();
        assert!(input.validate().is_err());
    }
}
