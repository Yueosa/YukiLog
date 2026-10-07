//! 语法单元测试: 通过公开 API `parse` 做黑盒断言

use lianmarkup::parse;

fn html(input: &str) -> String {
    parse(input).html
}

// ---------- 标题与目录 ----------

#[test]
fn heading_levels_and_auto_id() {
    let doc = parse("# 一级\n\n###### 六级\n");
    assert!(doc.html.contains("<h1 id=\"h-1\">一级</h1>"));
    assert!(doc.html.contains("<h6 id=\"h-2\">六级</h6>"));
    assert_eq!(doc.toc.len(), 1);
    assert_eq!(doc.toc[0].text, "一级");
    assert_eq!(doc.toc[0].children[0].text, "六级");
}

#[test]
fn heading_requires_space() {
    // `#` 后没有 0x20 空格, 算正文
    let out = html("#没有空格\n");
    assert!(out.contains("<p>#没有空格</p>"));
    assert!(!out.contains("<h1"));
}

#[test]
fn heading_custom_id() {
    let doc = parse("## 2024 年终总结 {#year-2024}\n");
    assert!(doc.html.contains("<h2 id=\"year-2024\">2024 年终总结</h2>"));
    assert_eq!(doc.toc[0].id, "year-2024");
}

#[test]
fn toc_tree_nesting() {
    let doc = parse("# a\n\n## b\n\n### c\n\n## d\n");
    assert_eq!(doc.toc.len(), 1);
    let h1 = &doc.toc[0];
    assert_eq!(h1.children.len(), 2);
    assert_eq!(h1.children[0].children[0].text, "c");
    assert_eq!(h1.children[1].text, "d");
}

#[test]
fn toc_depth_directive() {
    // @toc 不产出 HTML, 只限制 toc 收集层级; 标题本身照常渲染
    let doc = parse("@toc depth=1\n\n# a\n\n## b\n");
    assert_eq!(doc.toc.len(), 1);
    assert!(doc.toc[0].children.is_empty());
    assert!(doc.html.contains("<h2 id=\"h-2\">b</h2>"));
}

#[test]
fn heading_toc_text_strips_inline_markup() {
    let doc = parse("## 这是 **加粗** 标题\n");
    assert_eq!(doc.toc[0].text, "这是 加粗 标题");
}

// ---------- 行内语法 ----------

#[test]
fn inline_basic_styles() {
    let out = html("**粗** *斜* ~~删~~ ==高亮== `代`\n");
    assert!(out.contains("<strong>粗</strong>"));
    assert!(out.contains("<em>斜</em>"));
    assert!(out.contains("<del>删</del>"));
    assert!(out.contains("<mark>高亮</mark>"));
    assert!(out.contains("<code>代</code>"));
}

#[test]
fn inline_bold_italic() {
    let out = html("***粗斜体***\n");
    assert!(out.contains("<strong><em>粗斜体</em></strong>"));
}

#[test]
fn unpaired_delimiter_falls_back() {
    // 规范 0x01: 不配对的 * 原样输出
    let out = html("2*3=6 不是斜体\n");
    assert!(out.contains("<p>2*3=6 不是斜体</p>"));
}

#[test]
fn empty_delimiter_falls_back() {
    let out = html("**** 不是加粗\n");
    assert!(!out.contains("<strong>"));
}

#[test]
fn inline_code_does_not_parse_inner() {
    let out = html("`**不会加粗**`\n");
    assert!(out.contains("<code>**不会加粗**</code>"));
}

#[test]
fn escape_only_for_syntax_chars() {
    let out = html("\\*\\*不是加粗\\*\\*\n");
    assert!(out.contains("<p>**不是加粗**</p>"));
    // U 不是语法符号, 反斜杠原样保留
    let out = html("路径 C:\\Users\n");
    assert!(out.contains("C:\\Users"));
}

#[test]
fn html_is_escaped_everywhere() {
    // 语言禁止内嵌 HTML
    let out = html("<div>标签</div>\n");
    assert!(out.contains("&lt;div&gt;标签&lt;/div&gt;"));
    assert!(!out.contains("<div>标签"));
}

#[test]
fn link_and_image() {
    let out = html("[文字](https://example.com) ![描述](a.jpg)\n");
    assert!(out.contains("<a href=\"https://example.com\">文字</a>"));
    assert!(out.contains("<img src=\"a.jpg\" alt=\"描述\">"));
}

#[test]
fn image_attrs_go_to_data_attributes() {
    let out = html("![竖图](cover.jpg){width=60% group=旅行}\n");
    assert!(out.contains("data-width=\"60%\""));
    assert!(out.contains("data-group=\"旅行\""));
}

#[test]
fn image_followed_by_non_attr_brace_is_kept() {
    // `{}` 里没有 `=` 就不是图片属性, 按注音/文本处理
    let out = html("![a](b.jpg){漢字|かんじ}\n");
    assert!(out.contains("<ruby class=\"lm-ruby\">漢字<rt>かんじ</rt></ruby>"));
}

#[test]
fn note_reference_and_collection() {
    let doc = parse("三次握手[^SYN、SYN-ACK、ACK] 之后传输数据。\n");
    assert!(doc.html.contains(
        "<sup class=\"lm-noteref\"><a href=\"#note-1\" id=\"noteref-1\">1</a></sup>"
    ));
    assert_eq!(doc.notes.len(), 1);
    assert_eq!(doc.notes[0].index, 1);
    assert_eq!(doc.notes[0].anchor, "note-1");
    assert_eq!(doc.notes[0].html, "SYN、SYN-ACK、ACK");
}

#[test]
fn note_indices_increment() {
    let doc = parse("甲[^一] 乙[^二]\n");
    assert!(doc.html.contains("#note-2"));
    assert_eq!(doc.notes.len(), 2);
}

#[test]
fn spoiler() {
    let out = html("凶手其实是||管家||。\n");
    assert!(out.contains("<span class=\"lm-spoiler\">管家</span>"));
}

#[test]
fn math_inline_keeps_tex() {
    let out = html("质能方程 $E=mc^2$ 很熟悉。\n");
    assert!(out.contains("<span class=\"lm-math\">$E=mc^2$</span>"));
}

#[test]
fn math_price_falls_back() {
    // 内容首尾带空格的 $ 不生效
    let out = html("苹果 $5 和 $6 美元\n");
    assert!(!out.contains("lm-math"));
}

#[test]
fn math_block() {
    let out = html("$$\n\\int e^{-x^2} dx\n$$\n");
    assert!(out.contains("<div class=\"lm-math\">$$\n\\int e^{-x^2} dx\n$$</div>"));
}

#[test]
fn ruby_annotation() {
    let out = html("{漢字|かんじ} 和 {汉字|hàn zì}\n");
    assert!(out.contains("<ruby class=\"lm-ruby\">漢字<rt>かんじ</rt></ruby>"));
    assert!(out.contains("<ruby class=\"lm-ruby\">汉字<rt>hàn zì</rt></ruby>"));
}

#[test]
fn ruby_escaped_pipe() {
    let out = html("{a\\|b|c}\n");
    assert!(out.contains("<ruby class=\"lm-ruby\">a|b<rt>c</rt></ruby>"));
}

#[test]
fn double_bracket_falls_back() {
    // 双方括号不是语法, 原样输出
    let out = html("参见 [[other-post]] 和 [[a|b]]\n");
    assert!(out.contains("[[other-post]]"));
    assert!(!out.contains("<a href"));
}

// ---------- 块级语法 ----------

#[test]
fn quote_block() {
    let out = html("> 引用内容\n> 可以有多行\n");
    assert!(out.contains("<blockquote><p>引用内容\n可以有多行</p>"));
}

#[test]
fn quote_without_space_is_paragraph() {
    // 行首关键字后必须紧跟 0x20
    let out = html(">没有空格\n");
    assert!(out.contains("<p>&gt;没有空格</p>"));
}

#[test]
fn callout_family() {
    for (mark, kind) in [
        (">?", "question"),
        (">!", "important"),
        (">+", "tip"),
        (">x", "error"),
        (">i", "info"),
    ] {
        let out = html(&format!("{mark} 标题\n正文行\n\n"));
        assert!(
            out.contains(&format!("<div class=\"lm-callout\" data-kind=\"{kind}\">")),
            "{mark} 应输出 data-kind={kind}: {out}"
        );
        assert!(out.contains("<p class=\"lm-callout-title\">标题</p>"));
        assert!(out.contains("<p>正文行</p>"));
    }
}

#[test]
fn callout_continuation_without_space() {
    // 示例文章里的写法: 后续行 `>` 后不带空格
    let out = html(">i 小提示\n>正文内容。\n");
    assert!(out.contains("<p>正文内容。</p>"));
}

#[test]
fn callout_inline_in_body() {
    let out = html(">+ 技巧\n>里面能嵌套 **行内语法**。\n");
    assert!(out.contains("<strong>行内语法</strong>"));
}

#[test]
fn fold_explicit_mode() {
    let out = html(">>> 点击展开\n这段内容默认折叠。\n<<<\n");
    assert!(out.contains("<details class=\"lm-fold\"><summary>点击展开</summary>"));
    assert!(out.contains("<p>这段内容默认折叠。</p>"));
    assert!(out.contains("</details>"));
    assert!(!out.contains("open"));
}

#[test]
fn fold_explicit_mode_allows_blank_lines() {
    let out = html(">>> 推导\n第一段。\n\n第二段。\n<<<\n");
    assert!(out.contains("第一段") && out.contains("第二段"));
}

#[test]
fn fold_indent_mode_ends_on_dedent() {
    let out = html(">>> 展开\n\t属于折叠块。\n回到行首。\n");
    assert!(out.contains("<details class=\"lm-fold\""));
    assert!(out.contains("<p>属于折叠块。</p>"));
    // 回退的行在折叠块之外恢复正常解析
    assert!(out.contains("</details>\n<p>回到行首。</p>"));
}

#[test]
fn fold_indent_mode_marker_is_text() {
    // 缩进模式下 `<<<` 永远只是文本
    let out = html(">>> 展开\n\t内容\n<<< 这行只是文本\n");
    assert!(out.contains("</details>\n<p>&lt;&lt;&lt; 这行只是文本</p>"));
}

#[test]
fn fold_indent_mode_blank_line_inside() {
    let out = html(">>> 展开\n\t第一段。\n\n\t空行后仍属于块内。\n外面。\n");
    assert!(out.contains("空行后仍属于块内。"));
    assert!(out.contains("</details>\n<p>外面。</p>"));
}

#[test]
fn fold_open_by_default() {
    let out = html(">>>+ 默认展开\n<<<\n");
    assert!(out.contains("<details class=\"lm-fold\" open>"));
}

#[test]
fn fold_contains_nested_blocks() {
    let out = html(">>> 展开\n\n```rust\nfn main() {}\n```\n\n<<<\n");
    assert!(out.contains("<pre><code class=\"language-rust\">"));
}

#[test]
fn code_fence_with_language() {
    let out = html("```rust\nfn main() {\n    println!(\"hi\");\n}\n```\n");
    assert!(
        out.contains("<pre><code class=\"language-rust\">fn main() {\n    println!(&quot;hi&quot;);\n}</code></pre>")
    );
}

#[test]
fn code_fence_escapes_html() {
    let out = html("```html\n<div>x</div>\n```\n");
    assert!(out.contains("&lt;div&gt;x&lt;/div&gt;"));
}

#[test]
fn code_fence_mermaid_passthrough() {
    let out = html("```mermaid\ngraph TD;\n```\n");
    assert!(out.contains("<pre class=\"lm-mermaid\">graph TD;</pre>"));
}

#[test]
fn verbatim_block_parses_nothing() {
    let out = html("~~~\n**不会加粗**, # 也不是标题\n~~~\n");
    assert!(out.contains("<pre class=\"lm-verbatim\">**不会加粗**, # 也不是标题</pre>"));
}

#[test]
fn verbatim_opener_accepts_suffix() {
    // 示例文章里的 `~~~text` 写法
    let out = html("~~~text\n内容 *x*\n~~~\n");
    assert!(out.contains("<pre class=\"lm-verbatim\">内容 *x*</pre>"));
}

#[test]
fn unclosed_blocks_consume_to_eof() {
    // 优雅回退: 不闭合也不报错
    let out = html("```rust\nfn main() {}\n");
    assert!(out.contains("language-rust"));
    let out = html("~~~\n内容\n");
    assert!(out.contains("lm-verbatim"));
    let out = html(">>> 展开\n内容\n");
    assert!(out.contains("lm-fold"));
}

#[test]
fn unordered_list() {
    let out = html("- 甲\n- 乙\n");
    assert!(out.contains("<ul><li>甲</li><li>乙</li></ul>"));
}

#[test]
fn ordered_list() {
    let out = html("1. 甲\n2. 乙\n");
    assert!(out.contains("<ol><li>甲</li><li>乙</li></ol>"));
}

#[test]
fn nested_list_with_tab() {
    let out = html("- 外\n\t- 内\n- 外二\n");
    assert!(out.contains("<li>外<ul><li>内</li></ul>"));
}

#[test]
fn task_list() {
    let out = html("- [ ] 待办\n- [x] 已完成\n");
    assert!(out.contains("<li class=\"lm-task\"><input type=\"checkbox\" disabled> 待办</li>"));
    assert!(out.contains("<li class=\"lm-task\"><input type=\"checkbox\" disabled checked> 已完成</li>"));
}

#[test]
fn horizontal_rule() {
    let out = html("上文\n\n---\n\n下文\n");
    assert!(out.contains("<hr>"));
}

#[test]
fn pipe_table() {
    let out = html("| 名称 | 说明 |\n|-|-|\n| toc | 目录 |\n");
    assert!(out.contains("<table><thead><tr><th>名称</th><th>说明</th></tr></thead>"));
    assert!(out.contains("<tbody><tr><td>toc</td><td>目录</td></tr></tbody></table>"));
}

#[test]
fn table_cells_parse_inline() {
    let out = html("| 语法 |\n|-|\n| `**x**` |\n");
    assert!(out.contains("<td><code>**x**</code></td>"));
}

// ---------- 预处理与杂项 ----------

#[test]
fn front_matter_is_skipped() {
    let doc = parse("---\ntitle: 标题\nslug: s\n---\n\n# 正文标题\n");
    assert!(!doc.html.contains("title"));
    assert!(doc.html.contains("<h1 id=\"h-1\">正文标题</h1>"));
}

#[test]
fn unclosed_front_matter_is_content() {
    // 没有闭合的 front matter 不当元信息处理
    let doc = parse("---\ntitle: 标题\n");
    assert!(doc.html.contains("title"));
}

#[test]
fn paragraph_merges_consecutive_lines() {
    let out = html("第一行\n第二行\n");
    assert!(out.contains("<p>第一行\n第二行</p>"));
}

#[test]
fn crlf_is_tolerated() {
    let out = html("# 标题\r\n\r\n正文\r\n");
    assert!(out.contains("<h1 id=\"h-1\">标题</h1>"));
}

// ---------- 产物契约 ----------

#[test]
fn document_serializes_to_contract_shape() {
    let doc = parse("# 标题\n\n旁注[^内容]。\n");
    let json = serde_json::to_value(&doc).unwrap();
    assert!(json.get("html").is_some());
    assert_eq!(json["toc"][0]["id"], "h-1");
    assert_eq!(json["toc"][0]["level"], 1);
    assert_eq!(json["notes"][0]["anchor"], "note-1");
    assert_eq!(json["notes"][0]["index"], 1);
}

// ---------- 注释 ----------

#[test]
fn comment_line_is_not_rendered() {
    let out = html("// 这行是注释\n可见文本\n");
    assert!(!out.contains("这行是注释"));
    assert!(out.contains("可见文本"));
}

#[test]
fn comment_inside_paragraph_is_skipped() {
    let out = html("第一段\n// 插入的注释\n第二行\n");
    assert!(out.contains("<p>第一段\n第二行</p>"));
}

#[test]
fn comment_inside_code_fence_is_preserved() {
    let out = html("```\n// 代码里的注释要保留\n```\n");
    assert!(out.contains("// 代码里的注释要保留"));
}

#[test]
fn comment_inside_quote_is_skipped() {
    let out = html("> // 引用里的悄悄话\n> 可见内容\n");
    assert!(out.contains("可见内容"));
    assert!(!out.contains("悄悄话"));
}

#[test]
fn note_with_nested_link_keeps_full_content() {
    // first-post.ly 踩到的真 bug: 旁注里嵌链接, 闭合 ] 必须按深度配对
    let doc = parse("正文[^备注里有 [GitHub](https://example.com) 链接]收尾\n");
    assert_eq!(doc.notes.len(), 1);
    assert!(doc.notes[0].html.contains("<a href=\"https://example.com\">GitHub</a>"));
    assert!(doc.notes[0].html.contains("链接"));
    assert!(doc.html.contains("收尾"));
    assert!(!doc.html.contains("https://example.com)"));
}

// ---------- 行内容器 {.class} ----------

#[test]
fn span_with_class() {
    let out = html("[抖动的文字]{.shake}\n");
    assert!(out.contains("<span class=\"lm-shake\">抖动的文字</span>"));
}

#[test]
fn span_with_params_becomes_custom_properties() {
    let out = html("[渐变]{.gradient from=#ff6b6b to=#4ecdc4}\n");
    assert!(out.contains("class=\"lm-gradient\""));
    assert!(out.contains("style=\"--from:#ff6b6b;--to:#4ecdc4\""));
}

#[test]
fn span_spec_without_dot_falls_back() {
    let out = html("[文字]{不是类名}\n");
    assert!(out.contains("[文字]{不是类名}"));
}

// ---------- 示例块 ----------

#[test]
fn example_block_shows_source_and_render() {
    let out = html(":::\n**加粗**\n:::\n");
    assert!(out.contains("<div class=\"lm-example\">"));
    assert!(out.contains("<pre class=\"lm-example-source\">**加粗**</pre>"));
    assert!(out.contains("<strong>加粗</strong>"));
}

#[test]
fn example_headings_do_not_pollute_toc() {
    let doc = parse("# 真标题\n\n:::\n## 示例标题\n:::\n");
    assert_eq!(doc.toc.len(), 1);
    assert_eq!(doc.toc[0].text, "真标题");
}

// ---------- 幕间转换线 ----------

#[test]
fn heavy_break_renders_lm_break() {
    let out = html("上一幕\n\n___\n\n下一幕\n");
    assert!(out.contains("<hr class=\"lm-break\">"));
}

#[test]
fn heavy_break_inside_paragraph_splits() {
    let out = html("第一段\n___\n第二段\n");
    assert!(out.contains("<hr class=\"lm-break\">"));
    assert!(out.contains("<p>第一段</p>"));
    assert!(out.contains("<p>第二段</p>"));
}

#[test]
fn nested_note_is_not_collected() {
    // 规范: 旁注不能嵌套 —— 内层 [^...] 应当只是外层内容的文本
    let doc = parse("外层[^旁注里有 [^嵌套] 内容]收尾\n");
    assert_eq!(doc.notes.len(), 1, "嵌套旁注不应产生第二条: {:?}", doc.notes);
}
