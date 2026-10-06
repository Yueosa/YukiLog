//! 部件 token 注册表：theme.parts 的白名单、校验与 CSS 变量发射。
//!
//! 每个部件（part）挂一组旋钮（knob）。存储形态是
//! `theme.parts: { "<part-id>": { "<knob-key>": string | number | boolean } }`。
//! 写入站点设置时按本表校验（未知部件/旋钮、类型或范围不符一律 422）；
//! 渲染端（SSR `:root` 与 Lit styleMap）把旋钮原样落成 `--part-<id>-<key>`，
//! 结构性旋钮（文本、显隐、对齐类）由渲染器读取后作用到类名或文案上。

use axum::Json;
use axum_extra::extract::cookie::CookieJar;
use serde::Serialize;
use serde_json::{Map, Value};

use crate::{AppState, auth, error::AppError};

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum KnobKind {
    /// 自由文本（渲染为文案，不落 CSS 变量语义）
    Text { max_len: usize },
    /// 数值（如缩放倍率）
    Number { min: f64, max: f64 },
    /// 枚举（值为 options 之一）
    Select { options: &'static [&'static str] },
    /// 开关
    Boolean,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct KnobSpec {
    pub key: &'static str,
    pub label: &'static str,
    #[serde(flatten)]
    pub kind: KnobKind,
    /// 旋钮说明（管理端表单 hint）
    pub hint: &'static str,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct PartSpec {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub knobs: &'static [KnobSpec],
}

/// hero-title 旋钮留空时的默认欢迎语（Lit 端默认在 home-layout.ts）。
pub const DEFAULT_HERO_TITLE: &str = "欢迎来看恋的博客";

/// hero-title accent 旋钮留空时的默认高亮字符（Lit 端默认在 home-layout.ts）。
pub const DEFAULT_HERO_ACCENT: &str = "恋";

/// 部件白名单。新增部件/旋钮只改这里：写入校验、注册表下发、
/// CSS 变量发射全部以本表为准（渲染器对未登记的键一律忽略）。
pub const PARTS: &[PartSpec] = &[
    PartSpec {
        id: "brand",
        label: "品牌文字",
        description: "顶栏左上角的品牌标识。",
        knobs: &[
            KnobSpec {
                key: "text",
                label: "文字",
                kind: KnobKind::Text { max_len: 40 },
                hint: "留空则使用站点标题。",
            },
            KnobSpec {
                key: "scale",
                label: "字号倍率",
                kind: KnobKind::Number { min: 0.8, max: 2.0 },
                hint: "1 为现状大小。",
            },
        ],
    },
    PartSpec {
        id: "topnav",
        label: "顶部导航",
        description: "首屏角导航与内页胶囊顶栏（图标/文字显隐仅 Lit 端生效，SSR 导航只有文字）。",
        knobs: &[
            KnobSpec {
                key: "display",
                label: "显示内容",
                kind: KnobKind::Select {
                    options: &["both", "icons", "text"],
                },
                hint: "图标 + 文字、仅图标或仅文字。",
            },
            KnobSpec {
                key: "align",
                label: "对齐",
                kind: KnobKind::Select {
                    options: &["start", "center", "end"],
                },
                hint: "首屏角导航的对齐方式。",
            },
            KnobSpec {
                key: "align-mobile",
                label: "移动端对齐",
                kind: KnobKind::Select {
                    options: &["start", "center", "end"],
                },
                hint: "手机/平板胶囊顶栏的对齐（仅 Lit 端；右对齐可避开个人卡片）。",
            },
        ],
    },
    PartSpec {
        id: "hero-title",
        label: "欢迎大文字",
        description: "首屏中央的逐字标题。",
        knobs: &[
            KnobSpec {
                key: "text",
                label: "文字",
                kind: KnobKind::Text { max_len: 40 },
                hint: "留空则使用默认欢迎语。",
            },
            KnobSpec {
                key: "accent",
                label: "高亮字符",
                kind: KnobKind::Text { max_len: 8 },
                hint: "标题里要着色的字符（逐字匹配），留空默认为「恋」。",
            },
        ],
    },
];

fn find_part(id: &str) -> Option<&'static PartSpec> {
    PARTS.iter().find(|part| part.id == id)
}

fn find_knob<'a>(part: &'a PartSpec, key: &str) -> Option<&'a KnobSpec> {
    part.knobs.iter().find(|knob| knob.key == key)
}

fn knob_value_valid(knob: &KnobSpec, value: &Value) -> bool {
    match (&knob.kind, value) {
        (KnobKind::Text { max_len }, Value::String(text)) => text.chars().count() <= *max_len,
        (KnobKind::Number { min, max }, Value::Number(number)) => number
            .as_f64()
            .is_some_and(|value| value.is_finite() && value >= *min && value <= *max),
        (KnobKind::Select { options }, Value::String(choice)) => options.contains(&choice.as_str()),
        (KnobKind::Boolean, Value::Bool(_)) => true,
        _ => false,
    }
}

/// 写入校验：theme.parts 里的每个部件、旋钮、值都要过白名单。
pub fn validate_parts(parts: &Map<String, Value>) -> Result<(), AppError> {
    for (part_id, knobs) in parts {
        let Some(spec) = find_part(part_id) else {
            return Err(AppError::InvalidRequest("部件配置包含未注册的部件"));
        };
        let Some(knobs) = knobs.as_object() else {
            return Err(AppError::InvalidRequest("部件配置的格式无效"));
        };
        for (key, value) in knobs {
            let Some(knob) = find_knob(spec, key) else {
                return Err(AppError::InvalidRequest("部件配置包含未注册的旋钮"));
            };
            if !knob_value_valid(knob, value) {
                return Err(AppError::InvalidRequest("部件配置的旋钮值无效"));
            }
        }
    }
    Ok(())
}

/// 读取某个旋钮值（渲染器用；未设置或类型漂移时回退 None）。
pub fn part_value<'a>(parts: &'a Map<String, Value>, part: &str, key: &str) -> Option<&'a Value> {
    parts.get(part)?.as_object()?.get(key)
}

pub fn part_text<'a>(parts: &'a Map<String, Value>, part: &str, key: &str) -> Option<&'a str> {
    part_value(parts, part, key)?.as_str().filter(|text| !text.is_empty())
}

/// 把部件旋钮落成 `--part-<id>-<key>` 声明串（SSR `:root` 内联）。
/// 只发射白名单内的键；字符串值剔除 CSS 注入面（`;{}<>` 与控制字符）。
pub fn part_vars_css(parts: &Map<String, Value>) -> String {
    let mut out = String::new();
    for spec in PARTS {
        let Some(knobs) = parts.get(spec.id).and_then(Value::as_object) else {
            continue;
        };
        for knob in spec.knobs {
            let Some(value) = knobs.get(knob.key) else {
                continue;
            };
            if !knob_value_valid(knob, value) {
                continue;
            }
            let rendered = match value {
                Value::String(text) => sanitize_css_value(text),
                Value::Number(number) => number.to_string(),
                Value::Bool(flag) => {
                    if *flag {
                        "1".to_owned()
                    } else {
                        "0".to_owned()
                    }
                }
                _ => continue,
            };
            if rendered.is_empty() {
                continue;
            }
            out.push_str(&format!("--part-{}-{}:{};", spec.id, knob.key, rendered));
        }
    }
    out
}

fn sanitize_css_value(text: &str) -> String {
    text.chars()
        .filter(|ch| !matches!(ch, ';' | '{' | '}' | '<' | '>' | '\\') && !ch.is_control())
        .take(120)
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartsRegistryResponse {
    parts: &'static [PartSpec],
}

/// 管理端外观页拉取的注册表（表单按此渲染，与写入校验同源）。
pub async fn registry(
    axum::extract::State(state): axum::extract::State<AppState>,
    jar: CookieJar,
) -> Result<Json<PartsRegistryResponse>, AppError> {
    auth::authorize_read(&state, &jar).await?;
    Ok(Json(PartsRegistryResponse { parts: PARTS }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn parts(value: Value) -> Map<String, Value> {
        value.as_object().unwrap().clone()
    }

    #[test]
    fn accepts_registered_knobs() {
        let value = parts(json!({
            "brand": { "text": "YukiLog", "scale": 1.2 },
            "topnav": { "display": "icons", "align": "end" },
        }));
        assert!(validate_parts(&value).is_ok());
    }

    #[test]
    fn rejects_unknown_part_and_knob() {
        assert!(validate_parts(&parts(json!({ "nope": {} }))).is_err());
        assert!(validate_parts(&parts(json!({ "brand": { "nope": 1 } }))).is_err());
    }

    #[test]
    fn rejects_out_of_range_values() {
        assert!(validate_parts(&parts(json!({ "brand": { "scale": 3.0 } }))).is_err());
        assert!(validate_parts(&parts(json!({ "brand": { "scale": "big" } }))).is_err());
        assert!(validate_parts(&parts(json!({ "topnav": { "align": "middle" } }))).is_err());
        assert!(
            validate_parts(&parts(json!({ "hero-title": { "text": "字".repeat(41) } }))).is_err()
        );
    }

    #[test]
    fn emits_sanitized_css_vars() {
        let value = parts(json!({
            "brand": { "text": "a;b}<script>", "scale": 1.5 },
            "topnav": { "align": "end", "display": "ghost" },
        }));
        let css = part_vars_css(&value);
        assert!(css.contains("--part-brand-text:abscript;"));
        assert!(css.contains("--part-brand-scale:1.5;"));
        assert!(css.contains("--part-topnav-align:end;"));
        assert!(!css.contains("ghost"));
        assert!(!css.contains("--part-topnav-display"));
    }
}
