// ================================
// Markdown 渲染引擎
// 支持：GFM / 语法高亮 / 脚注 / 数学公式 / 标题锚点
// ================================

import { Marked, type MarkedExtension, type TokenizerAndRendererExtension } from "marked";
import { createHighlighter, type Highlighter } from "shiki";
import markedFootnote from "marked-footnote";
import katex from "katex";

// ---- Shiki 高亮器（单例） ----
let _highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!_highlighter) {
    _highlighter = await createHighlighter({
      themes: ["github-light"],
      langs: [
        "javascript",
        "typescript",
        "jsx",
        "tsx",
        "rust",
        "go",
        "python",
        "java",
        "c",
        "cpp",
        "csharp",
        "css",
        "scss",
        "html",
        "xml",
        "json",
        "jsonc",
        "yaml",
        "toml",
        "bash",
        "sh",
        "powershell",
        "sql",
        "markdown",
        "dockerfile",
        "nginx",
        "ini",
        "diff",
      ],
    });
  }
  return _highlighter;
}

// ---- KaTeX 数学公式扩展 ----
function createKatexExtension(): MarkedExtension {
  const blockMath: TokenizerAndRendererExtension = {
    name: "blockMath",
    level: "block",
    start(src: string) {
      return src.indexOf("$$");
    },
    tokenizer(src: string) {
      const match = src.match(/^\$\$\s*\n([\s\S]+?)\n\s*\$\$/);
      if (match) {
        return {
          type: "blockMath",
          raw: match[0],
          text: match[1].trim(),
        };
      }
    },
    renderer(token: any) {
      try {
        return `<div class="math-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`;
      } catch {
        return `<div class="math-block math-error">${token.text}</div>`;
      }
    },
  };

  const inlineMath: TokenizerAndRendererExtension = {
    name: "inlineMath",
    level: "inline",
    start(src: string) {
      return src.indexOf("$");
    },
    tokenizer(src: string) {
      const match = src.match(/^\$([^\$\n]+?)\$/);
      if (match) {
        return {
          type: "inlineMath",
          raw: match[0],
          text: match[1].trim(),
        };
      }
    },
    renderer(token: any) {
      try {
        return `<span class="math-inline">${katex.renderToString(token.text, { displayMode: false, throwOnError: false })}</span>`;
      } catch {
        return `<span class="math-inline math-error">${token.text}</span>`;
      }
    },
  };

  return { extensions: [blockMath, inlineMath] };
}

// ---- Marked 实例（单例，避免重复注册扩展） ----
let _marked: Marked | null = null;

async function getMarkedInstance(): Promise<Marked> {
  if (_marked) return _marked;

  const highlighter = await getHighlighter();

  _marked = new Marked();

  _marked.use({
    gfm: true,
    breaks: true,
    renderer: {
      // 代码块：shiki 语法高亮
      code({ text, lang }: { text: string; lang?: string }) {
        const language = lang || "text";
        // Mermaid 图表：输出专用容器，由客户端渲染
        if (language === "mermaid") {
          return `<pre class="mermaid">${text}</pre>`;
        }
        const loadedLangs = highlighter.getLoadedLanguages();
        if (loadedLangs.includes(language as any)) {
          const highlighted = highlighter.codeToHtml(text, {
            lang: language,
            theme: "github-light",
          });
          return `<div class="code-block" data-lang="${language}"><button class="copy-btn" aria-label="复制代码">复制</button>${highlighted}</div>`;
        }
        const escaped = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<div class="code-block" data-lang="${language}"><button class="copy-btn" aria-label="复制代码">复制</button><pre class="shiki"><code>${escaped}</code></pre></div>`;
      },

      // 链接：新标签页打开外部链接
      link({ href, title, tokens }: { href: string; title?: string | null; tokens: any[] }) {
        const text = this.parser.parseInline(tokens);
        const titleAttr = title ? ` title="${title}"` : "";
        // 外部链接新标签页打开
        if (href.startsWith("http")) {
          return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return `<a href="${href}"${titleAttr}>${text}</a>`;
      },

      // 图片：响应式包裹
      image({ href, title, text }: { href: string; title: string | null; text: string }) {
        const titleAttr = title ? ` title="${title}"` : "";
        return `<figure class="md-image"><img src="${href}" alt="${text}" loading="lazy"${titleAttr} />${text ? `<figcaption>${text}</figcaption>` : ""}</figure>`;
      },
    },
  });

  // 脚注
  _marked.use(markedFootnote());

  // 数学公式
  _marked.use(createKatexExtension());

  return _marked;
}

// ---- 主渲染函数 ----
export interface MarkdownResult {
  html: string;
  headings: { id: string; text: string; level: number }[];
}

export async function renderMarkdown(source: string): Promise<MarkdownResult> {
  const md = await getMarkedInstance();

  let html = (await md.parse(source)) as string;

  // ---- 后处理：标题锚点 + TOC 收集 ----
  const headings: MarkdownResult["headings"] = [];
  let counter = 0;
  html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    counter += 1;
    const id = `heading-${counter}`;
    const plainText = inner.replace(/<[^>]*>/g, "").trim();
    headings.push({ id, text: plainText, level: parseInt(level) });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

  // ---- 后处理：任务列表复选框美化 ----
  html = html.replace(
    /<li><input (checked="" )?disabled="" type="checkbox">\s*/g,
    (_, checked) =>
      checked
        ? `<li class="task-item"><span class="task-check checked">✓</span> `
        : `<li class="task-item"><span class="task-check unchecked"></span> `,
  );

  return { html, headings };
}

/** 列表预览：截断后做轻量 Markdown，不拉 Shiki / KaTeX */
const previewParser = new Marked({
  gfm: true,
  breaks: true,
});

export function renderMarkdownPreview(source: string): string {
  const truncated = source.length > 200 ? `${source.slice(0, 200)}…` : source;
  return previewParser.parse(truncated, { async: false }) as string;
}
