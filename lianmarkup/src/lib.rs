//! LianMarkup 解析器: 纯函数无 IO, 产物对齐 `docs/产物契约.md`
//!
//! 语法定义以 `docs/语法规范.md` 为准。

use serde::Serialize;

mod block;
mod escape;
mod inline;

/// 解析产物: HTML 字符串 + 结构化元数据旁挂
#[derive(Debug, Clone, Serialize)]
pub struct Document {
    pub html: String,
    pub toc: Vec<TocItem>,
    pub notes: Vec<Note>,
}

/// 目录树条目
#[derive(Debug, Clone, Serialize)]
pub struct TocItem {
    pub level: u8,
    pub text: String,
    pub id: String,
    pub children: Vec<TocItem>,
}

/// 旁注: 正文处输出上标引用点, 内容收进这里
#[derive(Debug, Clone, Serialize)]
pub struct Note {
    pub index: u32,
    pub html: String,
    /// 形如 `note-1`
    pub anchor: String,
}

/// 解析入口, 永不报错: 无法匹配的行优雅回退为正文段落
pub fn parse(input: &str) -> Document {
    let normalized = input.replace("\r\n", "\n");
    let body = strip_front_matter(&normalized);
    let mut parser = Parser::default();
    let html = parser.parse_blocks(body);
    Document {
        html,
        toc: parser.build_toc(),
        notes: parser.notes,
    }
}

/// 文件顶部的 YAML front matter 跳过不解析 (仅导入/迁移工具用)
fn strip_front_matter(text: &str) -> &str {
    let Some(rest) = text.strip_prefix("---\n") else {
        return text;
    };
    let mut consumed = 0;
    for line in rest.split('\n') {
        consumed += line.len() + 1;
        if line.trim_end() == "---" {
            return rest.get(consumed..).unwrap_or("");
        }
    }
    // 没有闭合标记, 当作普通内容
    text
}

/// 解析器状态: 标题编号、旁注收集、目录深度
#[derive(Default)]
pub(crate) struct Parser {
    pub heading_count: u32,
    pub note_count: u32,
    pub notes: Vec<Note>,
    /// (级别, 纯文本, 锚点)
    pub headings: Vec<(u8, String, String)>,
    /// `@toc depth=N` 指令, 默认收集全部六级
    pub toc_depth: Option<u8>,
}

impl Parser {
    /// 把扁平标题列表组装成树, 并按 `@toc depth=N` 限制收集层级
    fn build_toc(&self) -> Vec<TocItem> {
        let entries: Vec<&(u8, String, String)> = self
            .headings
            .iter()
            .filter(|(level, _, _)| self.toc_depth.is_none_or(|d| *level <= d))
            .collect();
        fn rec(entries: &[&(u8, String, String)], i: &mut usize, parent: u8) -> Vec<TocItem> {
            let mut out = Vec::new();
            while *i < entries.len() {
                let &(level, ref text, ref id) = entries[*i];
                if level <= parent {
                    break;
                }
                *i += 1;
                let children = rec(entries, i, level);
                out.push(TocItem {
                    level,
                    text: text.clone(),
                    id: id.clone(),
                    children,
                });
            }
            out
        }
        let mut i = 0;
        rec(&entries, &mut i, 0)
    }
}

/// 从行内 HTML 中提取纯文本 (目录条目用)
pub(crate) fn plain_text(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
}
