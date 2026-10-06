//! 端到端测试: 用示范文章做夹具, 验证整条解析管线

use lianmarkup::parse;

fn fixture() -> String {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/examples/first-post.ly");
    std::fs::read_to_string(path).expect("读取 examples/first-post.ly 失败")
}

#[test]
fn first_post_parses_without_panic() {
    let src = fixture();
    let doc = parse(&src);
    assert!(!doc.html.is_empty(), "html 不应为空");
    assert!(!doc.toc.is_empty(), "toc 不应为空");
    assert!(!doc.notes.is_empty(), "notes 不应为空");
}

#[test]
fn first_post_covers_core_constructs() {
    let src = fixture();
    let doc = parse(&src);
    // front matter 被剥离
    assert!(!doc.html.contains("slug: hello-lianmarkup"));
    // 标题锚点 h-N 顺序分配
    assert!(doc.html.contains("<h1 id=\"h-1\">LianMarkup 语法漫游</h1>"));
    // 旁注引用点与收集
    assert!(doc.html.contains("href=\"#note-1\""));
    assert_eq!(doc.notes[0].anchor, "note-1");
    // 示范文章里出现的构造
    assert!(doc.html.contains("lm-callout"), "应有 callout");
    assert!(doc.html.contains("lm-verbatim"), "应有原样块");
    assert!(doc.html.contains("<details class=\"lm-fold\""), "应有折叠块");
    assert!(doc.html.contains("lm-spoiler"), "应有剧透");
    assert!(doc.html.contains("<div class=\"lm-math\">"), "应有块级公式");
    assert!(doc.html.contains("lm-ruby"), "应有注音");
    assert!(doc.html.contains("<table>"), "应有表格");
    assert!(doc.html.contains("<hr>"), "应有分割线");
}
