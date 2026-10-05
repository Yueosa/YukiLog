use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const MAX_NODES: usize = 128;
const MAX_DEPTH: usize = 12;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PageLayoutDocument {
    pub schema_version: u8,
    pub id: String,
    pub label: String,
    pub description: String,
    pub root: LayoutNode,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LayoutNode {
    pub id: String,
    #[serde(rename = "type")]
    pub component_type: ComponentType,
    pub props: Map<String, Value>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub responsive: HashMap<String, Map<String, Value>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<LayoutNode>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ComponentType {
    Stack,
    Grid,
    Split,
    Bento,
    Card,
    Hero,
    Masthead,
    Avatar,
    TextBlock,
    SocialLinks,
    StatusLine,
    ProfileCard,
    ArticleFeed,
    Quote,
    Stats,
    DynamicStrip,
}

impl PageLayoutDocument {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.schema_version != 1 {
            return Err("不支持的布局 schemaVersion");
        }
        if !valid_identifier(&self.id) {
            return Err("布局 ID 格式无效");
        }
        if !(1..=80).contains(&self.label.chars().count()) {
            return Err("布局名称长度无效");
        }
        if self.description.chars().count() > 300 {
            return Err("布局说明过长");
        }

        let mut ids = HashSet::new();
        let mut count = 0;
        validate_node(&self.root, 1, &mut count, &mut ids)
    }

    pub fn media_ids(&self) -> Vec<&str> {
        let mut ids = Vec::new();
        collect_media_ids(&self.root, &mut ids);
        ids
    }
}

fn collect_media_ids<'a>(node: &'a LayoutNode, ids: &mut Vec<&'a str>) {
    if let Some(id) = node.props.get("backgroundMediaId").and_then(Value::as_str) {
        ids.push(id);
    }
    for child in &node.children {
        collect_media_ids(child, ids);
    }
}

fn validate_node(
    node: &LayoutNode,
    depth: usize,
    count: &mut usize,
    ids: &mut HashSet<String>,
) -> Result<(), &'static str> {
    *count += 1;
    if *count > MAX_NODES {
        return Err("布局节点不能超过 128 个");
    }
    if depth > MAX_DEPTH {
        return Err("布局嵌套不能超过 12 层");
    }
    if !valid_identifier(&node.id) {
        return Err("节点 ID 格式无效");
    }
    if !ids.insert(node.id.clone()) {
        return Err("布局包含重复节点 ID");
    }
    if !node.component_type.accepts_children() && !node.children.is_empty() {
        return Err("叶组件不能包含子节点");
    }

    validate_properties(node.component_type, &node.props)?;
    for (breakpoint, properties) in &node.responsive {
        if !matches!(breakpoint.as_str(), "tablet" | "mobile") {
            return Err("布局包含未知响应式断点");
        }
        if properties.contains_key("backgroundMediaId") {
            return Err("响应式覆盖不能修改首屏背景媒体");
        }
        validate_properties(node.component_type, properties)?;
    }
    for child in &node.children {
        validate_node(child, depth + 1, count, ids)?;
    }
    Ok(())
}

fn validate_properties(
    component_type: ComponentType,
    properties: &Map<String, Value>,
) -> Result<(), &'static str> {
    for (name, value) in properties {
        let valid = match (component_type, name.as_str()) {
            (_, "area") => string_in(
                value,
                &[
                    "span 3 / span 7",
                    "span 4 / span 5",
                    "span 8 / span 5",
                    "span 9 / span 7",
                ],
            ),
            (ComponentType::Stack, "gap") => spacing(value),
            (ComponentType::Stack, "maxWidth") => string_in(value, &["full", "content", "wide"]),
            (ComponentType::Stack, "align") => string_in(value, &["start", "center", "stretch"]),
            (ComponentType::Stack, "sticky") => value.is_boolean(),
            (ComponentType::Grid, "columns") => string_in(
                value,
                &[
                    "1fr",
                    "minmax(0, 1fr) 280px",
                    "280px minmax(0, 1fr)",
                    "240px minmax(0, 1fr) 240px",
                    "auto minmax(0, 1fr) auto",
                    "minmax(0, 1fr) 300px",
                ],
            ),
            (ComponentType::Grid, "gap") => spacing(value),
            (ComponentType::Grid, "align") => string_in(value, &["start", "center", "stretch"]),
            (ComponentType::Grid, "maxWidth") | (ComponentType::Bento, "maxWidth") => {
                string_in(value, &["1120px", "1240px", "full"])
            }
            (ComponentType::Split, "sidebarWidth") => {
                string_in(value, &["240px", "270px", "320px"])
            }
            (ComponentType::Split, "side") => string_in(value, &["left", "right"]),
            (ComponentType::Split, "gap") => spacing(value),
            (ComponentType::Split, "sticky") => value.is_boolean(),
            (ComponentType::Split, "columns") => string_in(value, &["1fr"]),
            (ComponentType::Bento, "columns") => integer_between(value, 1, 12),
            (ComponentType::Bento, "rowHeight") => string_in(value, &["auto", "84px"]),
            (ComponentType::Bento, "gap") => spacing(value),
            (ComponentType::Card, "variant") => {
                string_in(value, &["plain", "glass", "outlined", "paper"])
            }
            (ComponentType::Card, "padding") => spacing(value),
            (ComponentType::Card, "radius") => {
                string_in(value, &["none", "sm", "md", "lg", "pill"])
            }
            (ComponentType::Card, "shadow") => string_in(value, &["none", "soft", "blue", "pink"]),
            (ComponentType::Card, "align") => string_in(value, &["start", "center", "stretch"]),
            (ComponentType::Card, "sticky") => value.is_boolean(),
            (ComponentType::Hero, "variant") => {
                string_in(value, &["cinematic", "compact", "split"])
            }
            (ComponentType::Hero, "title") | (ComponentType::Masthead, "title") => {
                short_string(value, 120)
            }
            (ComponentType::Hero, "accent") => short_string(value, 8),
            (ComponentType::Masthead, "kicker") => short_string(value, 80),
            (ComponentType::Hero, "lead") | (ComponentType::Masthead, "lead") => {
                short_string(value, 500)
            }
            (ComponentType::Hero, "backgroundMediaId") => uuid_string(value),
            (ComponentType::Hero, "backgroundPosition") => {
                string_in(value, &["center", "top", "bottom", "left", "right"])
            }
            (ComponentType::Hero, "overlay") => string_in(value, &["soft", "medium", "strong"]),
            (ComponentType::Hero, "showSocials")
            | (ComponentType::Hero, "showEnter")
            | (ComponentType::ProfileCard, "flip")
            | (ComponentType::ProfileCard, "showSocials")
            | (ComponentType::ProfileCard, "showStatus")
            | (ComponentType::Stats, "compact") => value.is_boolean(),
            (ComponentType::Masthead, "variant") => string_in(value, &["editorial", "minimal"]),
            (ComponentType::Masthead, "alignment") | (ComponentType::Quote, "alignment") => {
                string_in(value, &["left", "center", "right"])
            }
            (ComponentType::Avatar, "source") => string_in(value, &["site-owner", "placeholder"]),
            (ComponentType::Avatar, "size") => string_in(value, &["sm", "md", "lg", "xl"]),
            (ComponentType::Avatar, "shape") => string_in(value, &["circle", "rounded", "square"]),
            (ComponentType::Avatar, "label") => short_string(value, 80),
            (ComponentType::TextBlock, "source") => string_in(
                value,
                &[
                    "literal",
                    "owner-name",
                    "owner-bio",
                    "site-title",
                    "site-description",
                ],
            ),
            (ComponentType::TextBlock, "variant") => {
                string_in(value, &["eyebrow", "heading", "body", "caption"])
            }
            (ComponentType::TextBlock, "text") => short_string(value, 500),
            (ComponentType::TextBlock, "alignment") | (ComponentType::SocialLinks, "alignment") => {
                string_in(value, &["left", "center", "right"])
            }
            (ComponentType::SocialLinks, "variant") => {
                string_in(value, &["icons", "labels", "pills"])
            }
            (ComponentType::StatusLine, "text") => short_string(value, 160),
            (ComponentType::StatusLine, "tone") => {
                string_in(value, &["neutral", "online", "accent"])
            }
            (ComponentType::ProfileCard, "variant") => {
                string_in(value, &["portrait", "letter", "compact"])
            }
            (ComponentType::ArticleFeed, "variant") => string_in(
                value,
                &["alternating", "editorial", "cover-overlay", "compact"],
            ),
            (ComponentType::ArticleFeed, "fields") => string_array(
                value,
                &[
                    "cover", "title", "summary", "date", "category", "tags", "views", "likes",
                ],
                8,
            ),
            (ComponentType::ArticleFeed, "columns") => integer_between(value, 1, 4),
            (ComponentType::ArticleFeed, "limit") => integer_between(value, 1, 24),
            (ComponentType::ArticleFeed, "sort") => {
                string_in(value, &["latest", "popular", "featured", "recent"])
            }
            (ComponentType::Quote, "text") => short_string(value, 500),
            (ComponentType::Quote, "attribution") => short_string(value, 80),
            (ComponentType::Stats, "fields") => {
                string_array(value, &["articles", "dynamics", "friends", "views"], 4)
            }
            (ComponentType::DynamicStrip, "limit") => integer_between(value, 1, 12),
            (ComponentType::DynamicStrip, "variant") => {
                string_in(value, &["handwritten", "timeline", "compact"])
            }
            _ => false,
        };
        if !valid {
            return Err("布局包含未知属性或无效属性值");
        }
    }
    Ok(())
}

impl ComponentType {
    pub(crate) fn accepts_children(self) -> bool {
        matches!(
            self,
            Self::Stack | Self::Grid | Self::Split | Self::Bento | Self::Card
        )
    }
}

fn valid_identifier(value: &str) -> bool {
    let mut chars = value.chars();
    matches!(chars.next(), Some('a'..='z'))
        && (2..=64).contains(&value.len())
        && chars.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
}

fn short_string(value: &Value, maximum: usize) -> bool {
    value
        .as_str()
        .is_some_and(|value| value.chars().count() <= maximum)
}

fn string_in(value: &Value, allowed: &[&str]) -> bool {
    value.as_str().is_some_and(|value| allowed.contains(&value))
}

fn uuid_string(value: &Value) -> bool {
    value.as_str().is_some_and(|value| {
        value.len() == 36
            && value
                .chars()
                .enumerate()
                .all(|(index, character)| match index {
                    8 | 13 | 18 | 23 => character == '-',
                    _ => character.is_ascii_hexdigit(),
                })
    })
}

fn spacing(value: &Value) -> bool {
    string_in(value, &["none", "sm", "md", "lg", "xl"])
}

fn integer_between(value: &Value, minimum: i64, maximum: i64) -> bool {
    value
        .as_i64()
        .is_some_and(|value| (minimum..=maximum).contains(&value))
}

fn string_array(value: &Value, allowed: &[&str], maximum: usize) -> bool {
    let Some(items) = value.as_array() else {
        return false;
    };
    if items.len() > maximum {
        return false;
    }
    let mut seen = HashSet::new();
    items.iter().all(|item| {
        item.as_str()
            .is_some_and(|item| allowed.contains(&item) && seen.insert(item))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_layout() -> PageLayoutDocument {
        serde_json::from_value(serde_json::json!({
            "schemaVersion": 1,
            "id": "home-main",
            "label": "首页",
            "description": "首页布局",
            "root": {
                "id": "home-root",
                "type": "stack",
                "props": {"gap": "lg"},
                "children": [{
                    "id": "article-list",
                    "type": "article-feed",
                    "props": {
                        "variant": "alternating",
                        "fields": ["cover", "title", "summary"],
                        "columns": 1,
                        "limit": 6,
                        "sort": "latest"
                    }
                }]
            }
        }))
        .unwrap()
    }

    #[test]
    fn accepts_registered_component_tree() {
        assert!(valid_layout().validate().is_ok());
    }

    #[test]
    fn accepts_validated_hero_media_reference() {
        let mut layout = valid_layout();
        layout.root.children.insert(
            0,
            serde_json::from_value(serde_json::json!({
                "id": "home-hero",
                "type": "hero",
                "props": {
                    "variant": "cinematic",
                    "title": "欢迎",
                    "lead": "一段说明",
                    "backgroundMediaId": "67e55044-10b1-426f-9247-bb680e5fe0c8",
                    "backgroundPosition": "center",
                    "overlay": "medium",
                    "showSocials": true,
                    "showEnter": true
                }
            }))
            .unwrap(),
        );
        assert!(layout.validate().is_ok());

        layout.root.children[0].props.insert(
            "backgroundMediaId".into(),
            Value::String("../../secret".into()),
        );
        assert!(layout.validate().is_err());
    }

    #[test]
    fn rejects_hero_media_reference_in_responsive_override() {
        let mut layout: PageLayoutDocument = serde_json::from_value(serde_json::json!({
            "schemaVersion": 1,
            "id": "home-main",
            "label": "首页",
            "description": "首页布局",
            "root": {
                "id": "home-root",
                "type": "stack",
                "props": {},
                "children": [{
                    "id": "home-hero",
                    "type": "hero",
                    "props": {"title": "欢迎"},
                    "responsive": {
                        "mobile": {"backgroundMediaId": "67e55044-10b1-426f-9247-bb680e5fe0c8"}
                    }
                }]
            }
        }))
        .unwrap();
        assert!(layout.validate().is_err());

        layout.root.children[0]
            .responsive
            .insert("mobile".into(), serde_json::json!({"overlay": "strong"}).as_object().unwrap().clone());
        assert!(layout.validate().is_ok());
    }

    #[test]
    fn accepts_composed_card_content() {
        let layout: PageLayoutDocument = serde_json::from_value(serde_json::json!({
            "schemaVersion": 1,
            "id": "composed-home",
            "label": "组合首页",
            "description": "由通用卡片和内容原语组合",
            "root": {
                "id": "root-stack",
                "type": "stack",
                "props": {"gap": "lg"},
                "children": [{
                    "id": "profile-surface",
                    "type": "card",
                    "props": {
                        "variant": "plain",
                        "padding": "lg",
                        "radius": "lg",
                        "shadow": "pink",
                        "align": "center",
                        "sticky": true
                    },
                    "children": [
                        {
                            "id": "owner-avatar",
                            "type": "avatar",
                            "props": {
                                "source": "site-owner",
                                "size": "xl",
                                "shape": "circle",
                                "label": "站主头像"
                            }
                        },
                        {
                            "id": "owner-name",
                            "type": "text-block",
                            "props": {
                                "source": "owner-name",
                                "variant": "heading",
                                "text": "",
                                "alignment": "center"
                            }
                        },
                        {
                            "id": "owner-socials",
                            "type": "social-links",
                            "props": {"variant": "labels", "alignment": "left"}
                        },
                        {
                            "id": "owner-status",
                            "type": "status-line",
                            "props": {"text": "system.log · online", "tone": "online"}
                        }
                    ]
                }]
            }
        }))
        .unwrap();
        assert!(layout.validate().is_ok());
    }

    #[test]
    fn rejects_unknown_properties_and_duplicate_ids() {
        let mut layout = valid_layout();
        layout
            .root
            .props
            .insert("style".into(), Value::String("position:fixed".into()));
        assert!(layout.validate().is_err());

        let mut layout = valid_layout();
        layout.root.children[0].id = layout.root.id.clone();
        assert!(layout.validate().is_err());
    }

    #[test]
    fn rejects_children_on_leaf_components() {
        let mut layout = valid_layout();
        layout.root.children[0].children.push(LayoutNode {
            id: "nested-quote".into(),
            component_type: ComponentType::Quote,
            props: Map::new(),
            responsive: HashMap::new(),
            children: Vec::new(),
        });
        assert!(layout.validate().is_err());
    }

    #[test]
    fn accepts_nightflight_preset_properties() {
        let layout: PageLayoutDocument = serde_json::from_value(serde_json::json!({
            "schemaVersion": 1,
            "id": "nightflight-continuum",
            "label": "夜航",
            "description": "沉浸首屏、个人带、交错文章流与发丝线侧栏。",
            "root": {
                "id": "nf-root",
                "type": "stack",
                "props": {"gap": "none", "maxWidth": "full"},
                "children": [
                    {
                        "id": "nf-hero",
                        "type": "hero",
                        "props": {
                            "variant": "cinematic",
                            "title": "夜航西飞，雪落恋城",
                            "accent": "恋",
                            "lead": "我能走到这里，是因为你没有放弃。",
                            "showSocials": true,
                            "showEnter": true,
                            "backgroundPosition": "center",
                            "overlay": "medium"
                        }
                    },
                    {
                        "id": "nf-identity",
                        "type": "grid",
                        "props": {
                            "columns": "auto minmax(0, 1fr) auto",
                            "gap": "lg",
                            "align": "center",
                            "maxWidth": "full"
                        },
                        "children": [{
                            "id": "nf-syslog",
                            "type": "status-line",
                            "props": {"text": "system.log", "tone": "neutral"}
                        }]
                    },
                    {
                        "id": "nf-stage",
                        "type": "grid",
                        "props": {
                            "columns": "minmax(0, 1fr) 300px",
                            "gap": "xl",
                            "align": "start",
                            "maxWidth": "full"
                        },
                        "children": [
                            {
                                "id": "nf-masthead",
                                "type": "masthead",
                                "props": {
                                    "variant": "minimal",
                                    "kicker": "01",
                                    "title": "最近文章",
                                    "lead": "ARCHIVE / 6",
                                    "alignment": "left"
                                }
                            },
                            {
                                "id": "nf-stats",
                                "type": "stats",
                                "props": {
                                    "fields": ["articles", "dynamics", "friends", "views"],
                                    "compact": true
                                }
                            }
                        ]
                    }
                ]
            }
        }))
        .unwrap();
        assert!(layout.validate().is_ok());
    }

    #[test]
    fn accepts_seeded_home_layout() {
        // 与基线迁移中 page_layouts 的 home 种子保持一致；种子若无法通过校验，首装首页会直接 500。
        let layout: PageLayoutDocument = serde_json::from_str(
            r#"{"schemaVersion":1,"id":"nightflight-continuum","label":"夜航","description":"沉浸首屏、个人带、交错文章流与发丝线侧栏。","root":{"id":"nf-root","type":"stack","props":{"gap":"none","maxWidth":"full"},"children":[{"id":"nf-hero","type":"hero","props":{"variant":"cinematic","title":"欢迎来看恋的博客","accent":"恋","lead":"这里分享她所热爱的技术、思考，以及情绪、挣扎","showSocials":true,"showEnter":true,"backgroundPosition":"center","overlay":"medium"}},{"id":"nf-identity","type":"grid","props":{"columns":"auto minmax(0, 1fr) auto","gap":"lg","align":"center","maxWidth":"full"},"responsive":{"mobile":{"columns":"1fr"}},"children":[{"id":"nf-avatar","type":"avatar","props":{"source":"site-owner","size":"xl","shape":"circle","label":"恋的头像"}},{"id":"nf-who","type":"stack","props":{"gap":"sm","maxWidth":"full"},"children":[{"id":"nf-name","type":"text-block","props":{"source":"owner-name","variant":"heading","text":"Lian（恋）","alignment":"left"}},{"id":"nf-bio","type":"text-block","props":{"source":"owner-bio","variant":"body","text":"我能走到这里，是因为你没有放弃","alignment":"left"}},{"id":"nf-traits","type":"text-block","props":{"source":"literal","variant":"caption","text":"代码 · 记忆 · 夜航","alignment":"left"}}]},{"id":"nf-syslog","type":"status-line","props":{"text":"system.log\n这不是你亲手开启的故事吗？\n[2024-06-09 08:48:29]\n","tone":"neutral"}}]},{"id":"nf-stage","type":"grid","props":{"columns":"minmax(0, 1fr) 300px","gap":"xl","align":"start","maxWidth":"full"},"responsive":{"mobile":{"columns":"1fr"}},"children":[{"id":"nf-main","type":"stack","props":{"gap":"xl","maxWidth":"full"},"children":[{"id":"nf-masthead","type":"masthead","props":{"variant":"minimal","kicker":"01","title":"最近文章","lead":"ARCHIVE / 6","alignment":"left"}},{"id":"nf-feed","type":"article-feed","props":{"variant":"alternating","fields":["cover","title","summary","date","category","tags","views","likes"],"columns":1,"limit":5,"sort":"latest"}}]},{"id":"nf-rail","type":"stack","props":{"gap":"lg","maxWidth":"full","sticky":true},"children":[{"id":"nf-stats","type":"stats","props":{"fields":["articles","dynamics","friends","views"],"compact":true}},{"id":"nf-hitokoto","type":"quote","props":{"text":"把每一个今天过得比昨天好一点，这样就够了。","attribution":"—— 《比宇宙更远的地方》","alignment":"left"}},{"id":"nf-dynamics","type":"dynamic-strip","props":{"limit":4,"variant":"compact"}}]}]}]}}"#,
        )
        .unwrap();
        assert!(layout.validate().is_ok());
    }
}
