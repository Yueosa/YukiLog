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
    Hero,
    Masthead,
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
                &["1fr", "minmax(0, 1fr) 280px", "280px minmax(0, 1fr)"],
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
            (ComponentType::Hero, "variant") => {
                string_in(value, &["cinematic", "compact", "split"])
            }
            (ComponentType::Hero, "title") | (ComponentType::Masthead, "title") => {
                short_string(value, 120)
            }
            (ComponentType::Hero, "lead") | (ComponentType::Masthead, "lead") => {
                short_string(value, 500)
            }
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
            (ComponentType::ArticleFeed, "sort") => string_in(value, &["latest", "popular"]),
            (ComponentType::Quote, "text") => short_string(value, 500),
            (ComponentType::Quote, "attribution") => short_string(value, 80),
            (ComponentType::Stats, "fields") => {
                string_array(value, &["articles", "dynamics", "words"], 3)
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
    fn accepts_children(self) -> bool {
        matches!(self, Self::Stack | Self::Grid | Self::Split | Self::Bento)
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
}
