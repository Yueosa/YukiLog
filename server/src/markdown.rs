use ammonia::Builder;
use pulldown_cmark::{Options, Parser, html};

pub fn render(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);

    let mut rendered = String::new();
    html::push_html(&mut rendered, Parser::new_ext(markdown, options));
    Builder::default()
        .link_rel(Some("noopener noreferrer"))
        .clean(&rendered)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_markdown_features() {
        let rendered = render("# Title\n\n| A | B |\n| - | - |\n| 1 | 2 |");
        assert!(rendered.contains("<h1>Title</h1>"));
        assert!(rendered.contains("<table>"));
    }

    #[test]
    fn removes_scripts_and_dangerous_links() {
        let rendered = render(
            "<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))",
        );
        assert!(!rendered.contains("<script"));
        assert!(!rendered.contains("onerror"));
        assert!(!rendered.contains("javascript:"));
    }
}
