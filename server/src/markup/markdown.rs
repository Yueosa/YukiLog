use std::sync::LazyLock;

use ammonia::Builder;
use pulldown_cmark::{
    CodeBlockKind, CowStr, Event, HeadingLevel, Options, Parser, Tag, TagEnd, html,
};
use syntect::{highlighting::Theme, highlighting::ThemeSet, parsing::SyntaxSet};

pub struct Heading {
    pub level: u8,
    pub text: String,
    pub id: String,
}

pub struct Rendered {
    pub html: String,
    pub headings: Vec<Heading>,
}

static SYNTAX_SET: LazyLock<SyntaxSet> = LazyLock::new(SyntaxSet::load_defaults_newlines);
static CODE_THEME: LazyLock<Theme> =
    LazyLock::new(|| ThemeSet::load_defaults().themes["InspiredGitHub"].clone());

// 未来会替换为用户自研标记语言 LianMarkup（Markdown 超集）；调用方只依赖此接口。
pub fn render(markdown: &str) -> Rendered {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

    let mut events = Vec::new();
    let mut headings = Vec::new();
    let mut parser = Parser::new_ext(markdown, options);
    while let Some(event) = parser.next() {
        match event {
            Event::Start(Tag::CodeBlock(kind)) => {
                let mut code = String::new();
                for inner_event in parser.by_ref() {
                    match inner_event {
                        Event::End(TagEnd::CodeBlock) => break,
                        Event::Text(fragment) => code.push_str(&fragment),
                        _ => {}
                    }
                }
                let language = match &kind {
                    CodeBlockKind::Fenced(language) => language.trim(),
                    CodeBlockKind::Indented => "",
                };
                let highlighted = if language.is_empty() || language == "mermaid" {
                    None
                } else {
                    highlight_code_block(&code, language)
                };
                if let Some(block) = highlighted {
                    events.push(Event::Html(CowStr::from(block)));
                } else {
                    events.push(Event::Start(Tag::CodeBlock(kind)));
                    events.push(Event::Text(CowStr::from(code)));
                    events.push(Event::End(TagEnd::CodeBlock));
                }
            }
            Event::Start(Tag::Heading {
                level,
                id,
                classes,
                attrs,
            }) => {
                let mut inner = Vec::new();
                let mut text = String::new();
                for inner_event in parser.by_ref() {
                    match &inner_event {
                        Event::End(TagEnd::Heading(_)) => break,
                        Event::Text(fragment) | Event::Code(fragment) => {
                            text.push_str(fragment);
                            inner.push(inner_event);
                        }
                        _ => inner.push(inner_event),
                    }
                }
                let heading_id = if matches!(
                    level,
                    HeadingLevel::H1 | HeadingLevel::H2 | HeadingLevel::H3
                ) {
                    let heading_id = id
                        .as_ref()
                        .map(|custom| sanitize_heading_id(custom))
                        .unwrap_or_else(|| format!("h-{}", headings.len() + 1));
                    headings.push(Heading {
                        level: level as u8,
                        text: text.trim().to_owned(),
                        id: heading_id.clone(),
                    });
                    Some(CowStr::from(heading_id))
                } else {
                    id
                };
                events.push(Event::Start(Tag::Heading {
                    level,
                    id: heading_id,
                    classes,
                    attrs,
                }));
                events.extend(inner);
                events.push(Event::End(TagEnd::Heading(level)));
            }
            _ => events.push(event),
        }
    }

    let mut rendered = String::new();
    html::push_html(&mut rendered, events.into_iter());
    let html = Builder::default()
        .link_rel(Some("noopener noreferrer"))
        .add_tags(["input", "section", "span"])
        .add_tag_attributes("input", ["type", "checked", "disabled"])
        .add_tag_attributes("pre", ["style"])
        .add_tag_attributes("span", ["style"])
        .add_generic_attributes(["id", "class"])
        .clean(&rendered)
        .to_string();
    Rendered { html, headings }
}

fn highlight_code_block(code: &str, language: &str) -> Option<String> {
    let syntax = SYNTAX_SET.find_syntax_by_token(language)?;
    syntect::html::highlighted_html_for_string(code, &SYNTAX_SET, syntax, &CODE_THEME).ok()
}

fn sanitize_heading_id(custom: &str) -> String {
    let filtered: String = custom
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':')
        })
        .collect();
    if filtered.is_empty() {
        "h-x".to_owned()
    } else {
        filtered
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_markdown_features() {
        let rendered = render("# Title\n\n| A | B |\n| - | - |\n| 1 | 2 |");
        assert!(rendered.html.contains("<h1 id=\"h-1\">Title</h1>"));
        assert!(rendered.html.contains("<table>"));
        assert_eq!(rendered.headings.len(), 1);
        assert_eq!(rendered.headings[0].text, "Title");
        assert_eq!(rendered.headings[0].id, "h-1");
        assert_eq!(rendered.headings[0].level, 1);
    }

    #[test]
    fn collects_headings_with_stable_ids() {
        let rendered = render("# 一级\n\n#### 跳过四级\n\n## 二级 {#custom-id}\n\n### 三级");
        let ids: Vec<&str> = rendered
            .headings
            .iter()
            .map(|heading| heading.id.as_str())
            .collect();
        assert_eq!(ids, ["h-1", "custom-id", "h-3"]);
        assert!(rendered.html.contains("<h4>跳过四级</h4>"));
    }

    #[test]
    fn keeps_tasklists_footnotes_and_math_source() {
        let rendered = render("- [x] done\n- [ ] todo\n\n脚注[^1]\n\n[^1]: 内容\n\n$E = mc^2$");
        assert!(rendered.html.contains("checkbox"));
        assert!(rendered.html.contains("footnote"));
        assert!(rendered.html.contains("$E = mc^2$"));
    }

    #[test]
    fn keeps_mermaid_as_plain_code_block() {
        let rendered = render("```mermaid\ngraph LR\n    A --> B\n```");
        assert!(rendered.html.contains("graph LR"));
        assert!(rendered.html.contains("A --&gt; B"));
    }

    #[test]
    fn highlights_rust_code_block() {
        let rendered = render("```rust\nfn main() { let x = 1; }\n```");
        assert!(rendered.html.contains("<pre style="));
        assert!(rendered.html.contains("<span style="));
        assert!(rendered.html.contains("fn"));
        assert!(!rendered.html.contains("language-rust"));
    }

    #[test]
    fn unknown_language_falls_back_to_plain_code_block() {
        let rendered = render("```notalanguage\nplain <code> & <>\n```");
        assert!(rendered
            .html
            .contains("<code class=\"language-notalanguage\">"));
        assert!(rendered.html.contains("plain &lt;code&gt; &amp; &lt;&gt;"));
        assert!(!rendered.html.contains("<span style="));
    }

    #[test]
    fn unlabeled_code_block_stays_plain() {
        let rendered = render("```\nfn main() {}\n```");
        assert!(rendered.html.contains("<pre><code>"));
        assert!(!rendered.html.contains("<span style="));
    }

    #[test]
    fn removes_scripts_and_dangerous_links() {
        let rendered = render(
            "<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))",
        );
        assert!(!rendered.html.contains("<script"));
        assert!(!rendered.html.contains("onerror"));
        assert!(!rendered.html.contains("javascript:"));
    }
}
