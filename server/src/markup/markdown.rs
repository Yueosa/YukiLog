use ammonia::Builder;
use pulldown_cmark::{CowStr, Event, HeadingLevel, Options, Parser, Tag, TagEnd, html};

pub struct Heading {
    pub level: u8,
    pub text: String,
    pub id: String,
}

pub struct Rendered {
    pub html: String,
    pub headings: Vec<Heading>,
}

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
        let Event::Start(Tag::Heading {
            level,
            id,
            classes,
            attrs,
        }) = event
        else {
            events.push(event);
            continue;
        };
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

    let mut rendered = String::new();
    html::push_html(&mut rendered, events.into_iter());
    let html = Builder::default()
        .link_rel(Some("noopener noreferrer"))
        .add_tags(["input", "section"])
        .add_tag_attributes("input", ["type", "checked", "disabled"])
        .add_generic_attributes(["id", "class"])
        .clean(&rendered)
        .to_string();
    Rendered { html, headings }
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
    fn removes_scripts_and_dangerous_links() {
        let rendered = render(
            "<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))",
        );
        assert!(!rendered.html.contains("<script"));
        assert!(!rendered.html.contains("onerror"));
        assert!(!rendered.html.contains("javascript:"));
    }
}
