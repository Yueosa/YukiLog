use std::sync::LazyLock;

use ammonia::Builder;
use syntect::{highlighting::Theme, highlighting::ThemeSet, parsing::SyntaxSet};

#[derive(Clone, Debug, serde::Serialize)]
pub struct Heading {
    pub level: u8,
    pub text: String,
    pub id: String,
}

pub struct Rendered {
    pub html: String,
    pub headings: Vec<Heading>,
    /// 旁注（正文上标锚点 note-N 指向它们）。文章页渲染为右侧栏/文末区块；
    /// 其他消费方（邮件、feed 摘要）直接忽略。
    pub notes: Vec<lianmarkup::Note>,
}

static SYNTAX_SET: LazyLock<SyntaxSet> = LazyLock::new(SyntaxSet::load_defaults_newlines);
static CODE_THEME: LazyLock<Theme> =
    LazyLock::new(|| ThemeSet::load_defaults().themes["InspiredGitHub"].clone());

/// 正文渲染入口：LianMarkup(.ly) 解析 → 代码块服务端高亮 → 消毒。
/// 产物契约见 lianmarkup/docs/产物契约.md；调用方只依赖此接口。
pub fn render(source: &str) -> Rendered {
    let document = lianmarkup::parse(source);
    let html = highlight_code_blocks(&document.html);
    let html = sanitize(&html);
    Rendered {
        html,
        headings: flatten_toc(&document.toc),
        notes: document
            .notes
            .into_iter()
            .map(|note| lianmarkup::Note {
                html: sanitize(&note.html),
                ..note
            })
            .collect(),
    }
}

fn flatten_toc(items: &[lianmarkup::TocItem]) -> Vec<Heading> {
    let mut headings = Vec::new();
    fn walk(items: &[lianmarkup::TocItem], headings: &mut Vec<Heading>) {
        for item in items {
            headings.push(Heading {
                level: item.level,
                text: item.text.clone(),
                id: item.id.clone(),
            });
            walk(&item.children, headings);
        }
    }
    walk(items, &mut headings);
    headings
}

/// LianMarkup 对代码块输出 `<pre><code class="language-X">…</code></pre>`
/// （mermaid/原样块/数学块是别的类名，不受影响）。逐个替换为 syntect
/// 服务端高亮（内联样式，RSS 里也能看）。
fn highlight_code_blocks(html: &str) -> String {
    const OPEN: &str = "<pre><code class=\"language-";
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(start) = rest.find(OPEN) {
        out.push_str(&rest[..start]);
        let after_open = &rest[start + OPEN.len()..];
        let Some(lang_end) = after_open.find('"') else {
            out.push_str(&rest[start..]);
            return out;
        };
        let language = &after_open[..lang_end];
        let Some(code_start) = after_open.find('>') else {
            out.push_str(&rest[start..]);
            return out;
        };
        let body = &after_open[code_start + 1..];
        let Some(code_end) = body.find("</code></pre>") else {
            out.push_str(&rest[start..]);
            return out;
        };
        let code = unescape_html(&body[..code_end]);
        match highlight_code_block(&code, language) {
            Some(highlighted) => out.push_str(&highlighted),
            None => {
                out.push_str(&rest[start..start + OPEN.len()]);
                out.push_str(&after_open[..code_start + 1 + code_end + "</code></pre>".len()]);
            }
        }
        rest = &body[code_end + "</code></pre>".len()..];
    }
    out.push_str(rest);
    out
}

fn highlight_code_block(code: &str, language: &str) -> Option<String> {
    let syntax = SYNTAX_SET.find_syntax_by_token(language)?;
    syntect::html::highlighted_html_for_string(code, &SYNTAX_SET, syntax, &CODE_THEME).ok()
}

/// LianMarkup 的转义集（& < > "）的逆运算，用于还原代码块原文。
fn unescape_html(text: &str) -> String {
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
}

/// 纵深防御：LianMarkup 禁止内嵌 HTML（源文本一律转义），但高亮与模板
/// 都在服务端拼 HTML，白名单照跑。lm-* 构造的标签/属性在这里登记。
fn sanitize(html: &str) -> String {
    Builder::default()
        .link_rel(Some("noopener noreferrer"))
        .add_tags(["input", "section", "span", "details", "summary", "ruby", "rp", "rt"])
        .add_tag_attributes("input", ["type", "checked", "disabled"])
        .add_tag_attributes("details", ["open"])
        .add_tag_attributes("pre", ["style"])
        .add_tag_attributes("span", ["style"])
        .add_tag_attributes("div", ["data-kind"])
        .add_generic_attributes(["id", "class"])
        .clean(html)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_headings_with_ids_and_toc() {
        let rendered = render("# Title\n\n## 第二节\n\n正文\n");
        assert!(rendered.html.contains("<h1 id=\"h-1\">Title</h1>"), "{}", rendered.html);
        assert!(rendered.html.contains("<h2 id=\"h-2\">第二节</h2>"));
        assert_eq!(rendered.headings.len(), 2);
        assert_eq!(rendered.headings[1].id, "h-2");
        assert_eq!(rendered.headings[1].text, "第二节");
    }

    #[test]
    fn escapes_inline_html_in_source() {
        let rendered = render("正文 <script>alert(1)</script>\n");
        assert!(!rendered.html.contains("<script>"));
        assert!(rendered.html.contains("&lt;script&gt;"));
    }

    #[test]
    fn highlights_known_language_code_block() {
        let rendered = render("```rust\nfn main() {}\n```\n");
        assert!(rendered.html.contains("style="), "{}", rendered.html);
    }

    #[test]
    fn keeps_unknown_language_code_block_plain() {
        let rendered = render("```notalanguage\nsome code\n```\n");
        assert!(rendered.html.contains("<code class=\"language-notalanguage\">"));
    }

    #[test]
    fn mermaid_block_passes_through_for_client_render() {
        let rendered = render("```mermaid\ngraph TD; A-->B;\n```\n");
        assert!(rendered.html.contains("<pre class=\"lm-mermaid\">"), "{}", rendered.html);
    }

    #[test]
    fn callout_fold_spoiler_ruby_survive_sanitizer() {
        let source = ">? 问题\n> 内容\n\n>>> 折叠标题\n折叠内容\n<<<\n\n||剧透|| 与 {汉字|かんじ}\n";
        let rendered = render(source);
        assert!(rendered.html.contains("class=\"lm-callout\""), "{}", rendered.html);
        assert!(rendered.html.contains("data-kind="));
        assert!(rendered.html.contains("<details class=\"lm-fold\""));
        assert!(rendered.html.contains("class=\"lm-spoiler\""));
        assert!(rendered.html.contains("<ruby class=\"lm-ruby\">"));
    }

    #[test]
    fn fold_open_marker_survives_sanitizer() {
        let rendered = render(">>>+ 默认展开\n内容\n<<<\n");
        // ammonia 把布尔属性序列化为 open=""，存在即展开
        assert!(rendered.html.contains("<details class=\"lm-fold\" open=\"\">"), "{}", rendered.html);
    }

    #[test]
    fn notes_are_returned_for_rail_rendering() {
        let rendered = render("正文[^一条旁注]继续\n");
        assert!(rendered.html.contains("class=\"lm-noteref\""), "{}", rendered.html);
        assert!(rendered.html.contains("href=\"#note-1\""));
        // 旁注不再拼进正文 HTML，由文章页渲染为右栏/文末区块
        assert!(!rendered.html.contains("lm-notes"));
        assert_eq!(rendered.notes.len(), 1);
        assert_eq!(rendered.notes[0].anchor, "note-1");
        assert!(rendered.notes[0].html.contains("一条旁注"));
    }
}
