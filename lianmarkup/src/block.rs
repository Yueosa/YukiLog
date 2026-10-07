//! 块级解析: 先按行首扫描, 段落是默认语法

use crate::escape::escape_html;
use crate::{Parser, plain_text};

/// 列表项: (TAB 层级, 是否有序, 任务勾选状态, 内容)
type ListEntry = (usize, bool, Option<bool>, String);

impl Parser {
    pub(crate) fn parse_blocks(&mut self, text: &str) -> String {
        let lines: Vec<&str> = text.split('\n').collect();
        let mut out = String::new();
        let mut i = 0;
        while i < lines.len() {
            let line = lines[i];
            if line.trim().is_empty() {
                i += 1;
                continue;
            }
            if is_comment(line) {
                i += 1;
                continue;
            }
            if line.starts_with("```") {
                i = self.parse_code_fence(&lines, i, &mut out);
            } else if line.starts_with("~~~") {
                i = self.parse_verbatim(&lines, i, &mut out);
            } else if line.trim() == "$$" {
                i = self.parse_math_block(&lines, i, &mut out);
            } else if let Some((open, summary)) = fold_header(line) {
                i = self.parse_fold(&lines, i, open, summary, &mut out);
            } else if let Some((kind, title)) = callout_header(line) {
                i = self.parse_callout(&lines, i, kind, title, &mut out);
            } else if line == ">" || line.starts_with("> ") {
                i = self.parse_quote(&lines, i, &mut out);
            } else if let Some((level, heading_text)) = heading(line) {
                self.emit_heading(level, heading_text, &mut out);
                i += 1;
            } else if line.trim_end() == "---" {
                out.push_str("<hr>\n");
                i += 1;
            } else if line.trim_end() == "___" {
                // 幕间转换线: 比 --- 更重的分隔
                out.push_str("<hr class=\"lm-break\">\n");
                i += 1;
            } else if is_toc_directive(line) {
                self.toc_depth = toc_directive_depth(line);
                i += 1;
            } else if list_item(line).is_some() {
                i = self.parse_list(&lines, i, &mut out);
            } else if line.starts_with('|')
                && lines.get(i + 1).is_some_and(|n| table_separator(n).is_some())
            {
                i = self.parse_table(&lines, i, &mut out);
            } else {
                i = self.parse_paragraph(&lines, i, &mut out);
            }
        }
        out
    }

    /// 围栏代码块: 内部 HTML 转义, 不做高亮 (syntect 是集成方的事)
    fn parse_code_fence(&mut self, lines: &[&str], start: usize, out: &mut String) -> usize {
        let lang = lines[start][3..].trim();
        let mut body: Vec<&str> = Vec::new();
        let mut i = start + 1;
        while i < lines.len() {
            if lines[i].trim() == "```" {
                i += 1;
                break;
            }
            body.push(lines[i]);
            i += 1;
        }
        let code = escape_html(&body.join("\n"));
        if lang == "mermaid" {
            // 契约: mermaid 透传源码, 前端增强
            out.push_str("<pre class=\"lm-mermaid\">");
            out.push_str(&code);
            out.push_str("</pre>\n");
        } else if lang.is_empty() {
            out.push_str("<pre><code>");
            out.push_str(&code);
            out.push_str("</code></pre>\n");
        } else {
            out.push_str("<pre><code class=\"language-");
            out.push_str(&escape_html(lang));
            out.push_str("\">");
            out.push_str(&code);
            out.push_str("</code></pre>\n");
        }
        i
    }

    /// 原样块: 内部零解析。起始行可带后缀 (如 `~~~text`), 结束行必须是单独的 `~~~`
    fn parse_verbatim(&mut self, lines: &[&str], start: usize, out: &mut String) -> usize {
        let mut body: Vec<&str> = Vec::new();
        let mut i = start + 1;
        while i < lines.len() {
            if lines[i].trim() == "~~~" {
                i += 1;
                break;
            }
            body.push(lines[i]);
            i += 1;
        }
        out.push_str("<pre class=\"lm-verbatim\">");
        out.push_str(&escape_html(&body.join("\n")));
        out.push_str("</pre>\n");
        i
    }

    /// 块级公式: 原样保留 TeX (含 $$ 定界符), 交给浏览器端 KaTeX
    fn parse_math_block(&mut self, lines: &[&str], start: usize, out: &mut String) -> usize {
        let mut body: Vec<&str> = Vec::new();
        let mut i = start + 1;
        while i < lines.len() {
            if lines[i].trim() == "$$" {
                i += 1;
                break;
            }
            body.push(lines[i]);
            i += 1;
        }
        out.push_str("<div class=\"lm-math\">$$\n");
        out.push_str(&escape_html(&body.join("\n")));
        out.push_str("\n$$</div>\n");
        i
    }

    /// 折叠块: 模式在 `>>>` 处一次性判定 —— 下一行以 TAB 开头即缩进作用域模式
    fn parse_fold(
        &mut self,
        lines: &[&str],
        start: usize,
        open: bool,
        summary: &str,
        out: &mut String,
    ) -> usize {
        let indent_mode = lines
            .get(start + 1)
            .is_some_and(|l| l.starts_with('\t'));
        let mut content: Vec<&str> = Vec::new();
        let mut i = start + 1;
        if indent_mode {
            // 缩进作用域模式: `<<<` 永远只是文本, 缩进回退即结束
            while i < lines.len() {
                let l = lines[i];
                if let Some(c) = l.strip_prefix('\t') {
                    content.push(c);
                    i += 1;
                } else if l.trim().is_empty()
                    && lines.get(i + 1).is_some_and(|n| n.starts_with('\t'))
                {
                    // 块内的空行不影响归属
                    content.push("");
                    i += 1;
                } else {
                    break;
                }
            }
        } else {
            // 显式配对模式: 只有行首的 `<<<` 是结束符
            while i < lines.len() && !lines[i].starts_with("<<<") {
                content.push(lines[i]);
                i += 1;
            }
            if i < lines.len() {
                i += 1;
            }
        }
        let inner = self.parse_blocks(&content.join("\n"));
        out.push_str("<details class=\"lm-fold\"");
        if open {
            out.push_str(" open");
        }
        out.push_str("><summary>");
        out.push_str(&self.parse_inline(summary));
        out.push_str("</summary>");
        out.push_str(&inner);
        out.push_str("</details>\n");
        i
    }

    /// Callout 家族: 首行标题, 后续 `>` 行是正文, 空行结束
    fn parse_callout(
        &mut self,
        lines: &[&str],
        start: usize,
        kind: &str,
        title: &str,
        out: &mut String,
    ) -> usize {
        let mut body: Vec<&str> = Vec::new();
        let mut i = start + 1;
        while i < lines.len() {
            let l = lines[i];
            if l.trim().is_empty() {
                break;
            }
            match l.strip_prefix('>') {
                Some(c) => {
                    body.push(c.strip_prefix(' ').unwrap_or(c));
                    i += 1;
                }
                None => break,
            }
        }
        out.push_str("<div class=\"lm-callout\" data-kind=\"");
        out.push_str(kind);
        out.push_str("\"><p class=\"lm-callout-title\">");
        out.push_str(&self.parse_inline(title));
        out.push_str("</p>");
        if !body.is_empty() {
            out.push_str(&self.parse_blocks(&body.join("\n")));
        }
        out.push_str("</div>\n");
        i
    }

    fn parse_quote(&mut self, lines: &[&str], start: usize, out: &mut String) -> usize {
        let mut content: Vec<&str> = Vec::new();
        let mut i = start;
        while i < lines.len() {
            let l = lines[i];
            if l == ">" {
                content.push("");
                i += 1;
            } else if let Some(c) = l.strip_prefix("> ") {
                content.push(c);
                i += 1;
            } else {
                break;
            }
        }
        out.push_str("<blockquote>");
        out.push_str(&self.parse_blocks(&content.join("\n")));
        out.push_str("</blockquote>\n");
        i
    }

    fn emit_heading(&mut self, level: u8, text: &str, out: &mut String) {
        let (text, custom_id) = split_custom_id(text);
        self.heading_count += 1;
        let id = custom_id.unwrap_or_else(|| format!("h-{}", self.heading_count));
        let inner = self.parse_inline(text);
        self.headings.push((level, plain_text(&inner), id.clone()));
        out.push_str("<h");
        out.push(char::from(b'0' + level));
        out.push_str(" id=\"");
        out.push_str(&escape_html(&id));
        out.push_str("\">");
        out.push_str(&inner);
        out.push_str("</h");
        out.push(char::from(b'0' + level));
        out.push_str(">\n");
    }

    fn parse_list(&mut self, lines: &[&str], start: usize, out: &mut String) -> usize {
        let mut items: Vec<ListEntry> = Vec::new();
        let mut i = start;
        while i < lines.len() {
            match list_item(lines[i]) {
                Some(entry) => {
                    items.push(entry);
                    i += 1;
                }
                None => break,
            }
        }
        let base = items.first().map_or(0, |e| e.0);
        let (html, _) = self.render_list_level(&items, 0, base);
        out.push_str(&html);
        i
    }

    /// 渲染同一 TAB 层级的一段列表, 连续同类项归在同一个 <ul>/<ol> 里
    fn render_list_level(
        &mut self,
        items: &[ListEntry],
        mut i: usize,
        depth: usize,
    ) -> (String, usize) {
        let mut html = String::new();
        while i < items.len() && items[i].0 == depth {
            let ordered = items[i].1;
            let tag = if ordered { "ol" } else { "ul" };
            html.push('<');
            html.push_str(tag);
            html.push('>');
            while i < items.len() && items[i].0 == depth && items[i].1 == ordered {
                let entry = items[i].clone();
                i += 1;
                html.push_str("<li");
                match entry.2 {
                    Some(checked) => {
                        html.push_str(" class=\"lm-task\"><input type=\"checkbox\" disabled");
                        if checked {
                            html.push_str(" checked");
                        }
                        html.push_str("> ");
                    }
                    None => html.push('>'),
                }
                html.push_str(&self.parse_inline(&entry.3));
                if i < items.len() && items[i].0 > depth {
                    let (sub, next) = self.render_list_level(items, i, items[i].0);
                    html.push_str(&sub);
                    i = next;
                }
                html.push_str("</li>");
            }
            html.push_str("</");
            html.push_str(tag);
            html.push_str(">\n");
        }
        (html, i)
    }

    fn parse_table(&mut self, lines: &[&str], start: usize, out: &mut String) -> usize {
        let headers = split_row(lines[start]);
        let mut rows: Vec<Vec<&str>> = Vec::new();
        let mut i = start + 2;
        while i < lines.len() && lines[i].starts_with('|') && !lines[i].trim().is_empty() {
            rows.push(split_row(lines[i]));
            i += 1;
        }
        out.push_str("<table><thead><tr>");
        for h in headers {
            out.push_str("<th>");
            out.push_str(&self.parse_inline(h));
            out.push_str("</th>");
        }
        out.push_str("</tr></thead><tbody>");
        for row in rows {
            out.push_str("<tr>");
            for cell in row {
                out.push_str("<td>");
                out.push_str(&self.parse_inline(cell));
                out.push_str("</td>");
            }
            out.push_str("</tr>");
        }
        out.push_str("</tbody></table>\n");
        i
    }

    /// 段落: 默认语法, 合并连续的非块级行直到空行, 注释行悄悄移除
    fn parse_paragraph(&mut self, lines: &[&str], start: usize, out: &mut String) -> usize {
        let mut end = start;
        let mut buf: Vec<&str> = Vec::new();
        while end < lines.len() && !lines[end].trim().is_empty() {
            if is_comment(lines[end]) {
                end += 1;
                continue;
            }
            if !buf.is_empty() && is_block_start(lines, end) {
                break;
            }
            buf.push(lines[end]);
            end += 1;
        }
        let text = buf.join("\n");
        out.push_str("<p>");
        out.push_str(&self.parse_inline(&text));
        out.push_str("</p>\n");
        end
    }
}

/// 注释行: 行首 `//` + 空格 (或整行只有 `//`), 不渲染
fn is_comment(line: &str) -> bool {
    line == "//" || line.starts_with("// ")
}

/// 折叠块头: `>>>` 或 `>>>+`, 关键字后必须跟空格或行尾
fn fold_header(line: &str) -> Option<(bool, &str)> {
    let rest = line.strip_prefix(">>>")?;
    let (open, rest) = match rest.strip_prefix('+') {
        Some(r) => (true, r),
        None => (false, rest),
    };
    match rest.strip_prefix(' ') {
        Some(s) => Some((open, s)),
        None if rest.is_empty() => Some((open, "")),
        None => None,
    }
}

/// Callout 头: `>?` `>!` `>+` `>x` `>i`, 关键字后必须跟空格或行尾
fn callout_header(line: &str) -> Option<(&'static str, &str)> {
    let (mark, kind) = [
        (">?", "question"),
        (">!", "important"),
        (">+", "tip"),
        (">x", "error"),
        (">i", "info"),
    ]
    .into_iter()
    .find(|(m, _)| line.starts_with(m))?;
    let rest = &line[mark.len()..];
    match rest.strip_prefix(' ') {
        Some(t) => Some((kind, t)),
        None if rest.is_empty() => Some((kind, "")),
        None => None,
    }
}

/// 标题: `#` 后必须有 0x20 空格, 否则算正文
fn heading(line: &str) -> Option<(u8, &str)> {
    let hashes = line.bytes().take_while(|&b| b == b'#').count();
    if (1..=6).contains(&hashes) && line[hashes..].starts_with(' ') {
        Some((hashes as u8, line[hashes + 1..].trim_end()))
    } else {
        None
    }
}

/// 标题尾部可选的 `{#custom-id}` 覆盖
fn split_custom_id(text: &str) -> (&str, Option<String>) {
    let t = text.trim_end();
    if t.ends_with('}')
        && let Some(pos) = t.rfind("{#")
    {
        let id = &t[pos + 2..t.len() - 1];
        if !id.is_empty()
            && id
                .chars()
                .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            return (t[..pos].trim_end(), Some(id.to_string()));
        }
    }
    (t, None)
}

/// 列表项: `-` / `1.` / `- [ ]` / `- [x]`, TAB 嵌套
fn list_item(line: &str) -> Option<ListEntry> {
    let tabs = line.bytes().take_while(|&b| b == b'\t').count();
    let rest = &line[tabs..];
    if let Some(r) = rest.strip_prefix("- ") {
        if let Some(t) = r.strip_prefix("[ ] ") {
            return Some((tabs, false, Some(false), t.to_string()));
        }
        if let Some(t) = r.strip_prefix("[x] ").or_else(|| r.strip_prefix("[X] ")) {
            return Some((tabs, false, Some(true), t.to_string()));
        }
        return Some((tabs, false, None, r.to_string()));
    }
    let digits = rest.bytes().take_while(|b| b.is_ascii_digit()).count();
    if digits > 0 && rest[digits..].starts_with(". ") {
        return Some((tabs, true, None, rest[digits + 2..].to_string()));
    }
    None
}

fn is_toc_directive(line: &str) -> bool {
    line == "@toc" || line.starts_with("@toc ")
}

fn toc_directive_depth(line: &str) -> Option<u8> {
    line.split_whitespace()
        .find_map(|tok| tok.strip_prefix("depth=")?.parse().ok())
}

/// 表格分隔行, 如 `|-|-|`, 返回列数
fn table_separator(line: &str) -> Option<usize> {
    let cells = split_row(line);
    if cells.is_empty() {
        return None;
    }
    if cells
        .iter()
        .all(|c| c.contains('-') && c.chars().all(|ch| ch == '-' || ch == ':'))
    {
        Some(cells.len())
    } else {
        None
    }
}

fn split_row(line: &str) -> Vec<&str> {
    let t = line.trim();
    let t = t.strip_prefix('|').unwrap_or(t);
    let t = t.strip_suffix('|').unwrap_or(t);
    t.split('|').map(str::trim).collect()
}

/// 判断一行是否是块级起点 (段落合并时用于断行)
fn is_block_start(lines: &[&str], i: usize) -> bool {
    let line = lines[i];
    line.starts_with("```")
        || line.starts_with("~~~")
        || line.trim() == "$$"
        || fold_header(line).is_some()
        || callout_header(line).is_some()
        || line == ">"
        || line.starts_with("> ")
        || heading(line).is_some()
        || line.trim_end() == "---"
        || line.trim_end() == "___"
        || is_toc_directive(line)
        || list_item(line).is_some()
        || (line.starts_with('|')
            && lines
                .get(i + 1)
                .is_some_and(|n| table_separator(n).is_some()))
}
