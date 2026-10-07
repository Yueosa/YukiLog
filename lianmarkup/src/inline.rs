//! 行内解析: 在块内容中二次扫描
//!
//! 核心歧义规则 (规范 0x01): 定界符必须成对且内容非空才生效, 否则原样输出

use crate::escape::{escape_html, push_escaped};
use crate::{Note, Parser};

impl Parser {
    pub(crate) fn parse_inline(&mut self, text: &str) -> String {
        let chars: Vec<char> = text.chars().collect();
        let mut out = String::new();
        let mut i = 0;
        while i < chars.len() {
            let c = chars[i];
            // 转义是最后手段: `\` 仅对语法符号生效, 否则原样保留
            if c == '\\' && chars.get(i + 1).is_some_and(|&n| is_syntax_char(n)) {
                push_escaped(&mut out, chars[i + 1]);
                i += 2;
                continue;
            }
            match c {
                '`' => {
                    if let Some(end) = self.inline_code(&chars, i, &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '*' => {
                    if let Some(end) = self.bold_italic(&chars, i, &mut out) {
                        i = end;
                    } else if let Some(end) = self.paired(&chars, i, &['*', '*'], "strong", &mut out) {
                        i = end;
                    } else if let Some(end) = self.paired(&chars, i, &['*'], "em", &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '~' => {
                    if let Some(end) = self.paired(&chars, i, &['~', '~'], "del", &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '=' => {
                    if let Some(end) = self.paired(&chars, i, &['=', '='], "mark", &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '|' => {
                    if let Some(end) = self.spoiler(&chars, i, &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '!' if chars.get(i + 1) == Some(&'[') => {
                    if let Some(end) = self.image(&chars, i, &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '[' if chars.get(i + 1) == Some(&'^') => {
                    if let Some(end) = self.note(&chars, i, &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '[' => {
                    // 双方括号不是语法, 靠回退规则原样输出
                    if let Some(end) = self.link(&chars, i, &mut out) {
                        i = end;
                    } else if let Some(end) = self.span(&chars, i, &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '$' => {
                    if let Some(end) = self.math(&chars, i, &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                '{' => {
                    if let Some(end) = self.ruby(&chars, i, &mut out) {
                        i = end;
                    } else {
                        push_escaped(&mut out, c);
                        i += 1;
                    }
                }
                _ => {
                    push_escaped(&mut out, c);
                    i += 1;
                }
            }
        }
        out
    }

    /// `***粗斜体***`: 渲染为 <strong><em> 嵌套, 先于 `**` 尝试
    fn bold_italic(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        if chars[i..].len() < 3 || chars[i..i + 3] != ['*', '*', '*'] {
            return None;
        }
        let close = find_close(chars, i + 3, &['*', '*', '*'])?;
        if close == i + 3 {
            return None;
        }
        let inner = self.parse_inline(&slice(chars, i + 3, close));
        out.push_str("<strong><em>");
        out.push_str(&inner);
        out.push_str("</em></strong>");
        Some(close + 3)
    }

    /// 行内代码: 内部不解析任何语法
    fn inline_code(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        let close = find_close(chars, i + 1, &['`'])?;
        (close > i + 1).then(|| {
            out.push_str("<code>");
            out.push_str(&escape_html(&slice(chars, i + 1, close)));
            out.push_str("</code>");
            close + 1
        })
    }

    /// 成对定界符的通用处理: 内容非空才生效, 内部递归解析行内语法
    fn paired(
        &mut self,
        chars: &[char],
        i: usize,
        delim: &[char],
        tag: &str,
        out: &mut String,
    ) -> Option<usize> {
        if chars[i..].len() < delim.len() || chars[i..i + delim.len()] != *delim {
            return None;
        }
        let close = find_close(chars, i + delim.len(), delim)?;
        if close == i + delim.len() {
            return None;
        }
        let content = slice(chars, i + delim.len(), close);
        let inner = self.parse_inline(&content);
        out.push('<');
        out.push_str(tag);
        out.push('>');
        out.push_str(&inner);
        out.push_str("</");
        out.push_str(tag);
        out.push('>');
        Some(close + delim.len())
    }

    /// `||剧透||`
    fn spoiler(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        if chars.get(i + 1) != Some(&'|') {
            return None;
        }
        let close = find_close(chars, i + 2, &['|', '|'])?;
        (close > i + 2).then(|| {
            let inner = self.parse_inline(&slice(chars, i + 2, close));
            out.push_str("<span class=\"lm-spoiler\">");
            out.push_str(&inner);
            out.push_str("</span>");
            close + 2
        })
    }

    /// `![alt](src)` 及可选属性 `{width=60% group=名}` (进 data 属性)
    fn image(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        let alt_close = find_close(chars, i + 2, &[']'])?;
        if chars.get(alt_close + 1) != Some(&'(') {
            return None;
        }
        let src_close = find_close(chars, alt_close + 2, &[')'])?;
        let alt = slice(chars, i + 2, alt_close);
        let src = slice(chars, alt_close + 2, src_close);
        let mut next = src_close + 1;
        let mut attrs = String::new();
        if chars.get(next) == Some(&'{')
            && let Some(attr_close) = find_close(chars, next + 1, &['}'])
        {
            let attr_text = slice(chars, next + 1, attr_close);
            // 内容里没有 `=` 就不是属性 (可能是 `{#id}` 或注音), 不消费
            if attr_text.contains('=') {
                attrs = parse_img_attrs(&attr_text);
                next = attr_close + 1;
            }
        }
        out.push_str("<img src=\"");
        out.push_str(&escape_html(&src));
        out.push_str("\" alt=\"");
        out.push_str(&escape_html(&alt));
        out.push('"');
        out.push_str(&attrs);
        out.push('>');
        Some(next)
    }

    /// `[^备注内容]` 旁注: 正文处输出上标引用点, 内容收进 Document.notes
    fn note(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        // 内容里可能嵌套 [链接](url), 闭合括号要按方括号深度配对
        let close = find_close_bracket(chars, i + 2)?;
        if close == i + 2 {
            return None;
        }
        self.note_count += 1;
        let n = self.note_count;
        let content = slice(chars, i + 2, close);
        let html = self.parse_inline(&content);
        self.notes.push(Note {
            index: n,
            html,
            anchor: format!("note-{n}"),
        });
        out.push_str("<sup class=\"lm-noteref\"><a href=\"#note-");
        out.push_str(&n.to_string());
        out.push_str("\" id=\"noteref-");
        out.push_str(&n.to_string());
        out.push_str("\">");
        out.push_str(&n.to_string());
        out.push_str("</a></sup>");
        Some(close + 1)
    }

    /// `[文字](url)`
    fn link(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        let text_close = find_close(chars, i + 1, &[']'])?;
        if text_close == i + 1 || chars.get(text_close + 1) != Some(&'(') {
            return None;
        }
        let url_close = find_close(chars, text_close + 2, &[')'])?;
        let inner = self.parse_inline(&slice(chars, i + 1, text_close));
        out.push_str("<a href=\"");
        out.push_str(&escape_html(&slice(chars, text_close + 2, url_close)));
        out.push_str("\">");
        out.push_str(&inner);
        out.push_str("</a>");
        Some(url_close + 1)
    }

    /// `[文字]{.class k=v}`: 行内容器, 渲染为 lm- 类名的 span, 参数变 CSS 自定义属性
    fn span(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        let text_close = find_close_bracket(chars, i + 1)?;
        if text_close == i + 1 || chars.get(text_close + 1) != Some(&'{') {
            return None;
        }
        let attr_close = find_close(chars, text_close + 2, &['}'])?;
        let (class, style) = parse_span_spec(&slice(chars, text_close + 2, attr_close))?;
        let inner = self.parse_inline(&slice(chars, i + 1, text_close));
        out.push_str("<span class=\"lm-");
        out.push_str(&class);
        out.push('"');
        out.push_str(&style);
        out.push('>');
        out.push_str(&inner);
        out.push_str("</span>");
        Some(attr_close + 1)
    }

    /// `$...$` 行内公式: 原样保留 TeX。内容首尾是空格则不生效 (价格等场景靠这条兜底)
    fn math(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        let close = find_close(chars, i + 1, &['$'])?;
        if close == i + 1 {
            return None;
        }
        let content = slice(chars, i + 1, close);
        if content.starts_with(' ') || content.ends_with(' ') || content.contains('\n') {
            return None;
        }
        out.push_str("<span class=\"lm-math\">$");
        out.push_str(&escape_html(&content));
        out.push_str("$</span>");
        Some(close + 1)
    }

    /// `{漢字|かんじ}` 注音, 注音里 `\|` 是字面量 `|`
    fn ruby(&mut self, chars: &[char], i: usize, out: &mut String) -> Option<usize> {
        let mut j = i + 1;
        let pipe = loop {
            match chars.get(j) {
                Some('\\') => j += 2,
                Some('|') => break Some(j),
                Some('}') | Some('\n') | None => break None,
                _ => j += 1,
            }
        }?;
        let close = find_close(chars, pipe + 1, &['}'])?;
        if pipe == i + 1 || close == pipe + 1 {
            return None;
        }
        let base = slice(chars, i + 1, pipe).replace("\\|", "|");
        let ann = slice(chars, pipe + 1, close).replace("\\|", "|");
        out.push_str("<ruby class=\"lm-ruby\">");
        out.push_str(&escape_html(&base));
        out.push_str("<rt>");
        out.push_str(&escape_html(&ann));
        out.push_str("</rt></ruby>");
        Some(close + 1)
    }
}

/// 从 from 开始找未转义的定界符
fn find_close(chars: &[char], from: usize, delim: &[char]) -> Option<usize> {
    let mut i = from;
    while i + delim.len() <= chars.len() {
        if chars[i] == '\\' {
            i += 2;
            continue;
        }
        if chars[i..i + delim.len()] == *delim {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// 从 from 开始找与 `[` 配对的 `]`: 嵌套方括号计深度, 转义符跳过
fn find_close_bracket(chars: &[char], from: usize) -> Option<usize> {
    let mut depth = 1usize;
    let mut i = from;
    while i < chars.len() {
        if chars[i] == '\\' {
            i += 2;
            continue;
        }
        match chars[i] {
            '[' => depth += 1,
            ']' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

fn slice(chars: &[char], a: usize, b: usize) -> String {
    chars[a..b].iter().collect()
}

/// 转义符作用的语法符号集合
fn is_syntax_char(c: char) -> bool {
    matches!(
        c,
        '\\' | '`' | '*' | '~' | '=' | '[' | ']' | '(' | ')' | '!' | '|' | '$' | '{' | '}' | '#'
            | '>'
    )
}

/// 图片属性 `{width=60% group=旅行}` → ` data-width="60%" data-group="旅行"`
fn parse_img_attrs(text: &str) -> String {
    let mut out = String::new();
    for tok in text.split_whitespace() {
        if let Some((key, value)) = tok.split_once('=')
            && !key.is_empty()
            && key
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            out.push_str(" data-");
            out.push_str(key);
            out.push_str("=\"");
            out.push_str(&escape_html(value));
            out.push('"');
        }
    }
    out
}

/// 行内容器声明 `{.class k=v ...}` → (类名, style 属性串), 首 token 不以 `.` 开头则不是类
fn parse_span_spec(spec: &str) -> Option<(String, String)> {
    let is_key = |k: &str| {
        !k.is_empty()
            && k.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    };
    let mut tokens = spec.split_whitespace();
    let class = tokens.next()?.strip_prefix('.')?;
    if !is_key(class) {
        return None;
    }
    let mut props = String::new();
    for tok in tokens {
        let (key, value) = tok.split_once('=')?;
        if !is_key(key) {
            return None;
        }
        props.push_str("--");
        props.push_str(key);
        props.push(':');
        props.push_str(&escape_html(value));
        props.push(';');
    }
    let style = if props.is_empty() {
        String::new()
    } else {
        format!(" style=\"{}\"", props.trim_end_matches(';'))
    };
    Some((class.to_string(), style))
}
