const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'a',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

const VOID_TAGS = new Set(['br', 'hr']);

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pickAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = attrs.match(re);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/**
 * 评论 HTML 出口：只保留常见 Markdown 标签，去掉事件属性和危险协议。
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag: string, attrs: string) => {
      const closing = full.startsWith('</');
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (closing) return `</${tag}>`;
      if (VOID_TAGS.has(tag)) return `<${tag}>`;
      if (tag === 'a') {
        const href = pickAttr(attrs, 'href');
        if (!href || !/^https?:\/\//i.test(href.trim())) {
          return '<a>';
        }
        return `<a href="${escapeAttr(href.trim())}" rel="noopener noreferrer" target="_blank">`;
      }
      return `<${tag}>`;
    });
}

export type HighlightPart = {
  text: string;
  mark: boolean;
};

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * 把后端高亮结果拆成文本节点。只认 <mark>，其余当纯文本。
 */
export function splitHighlights(html: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  const re = /<mark>(.*?)<\/mark>/gi;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    if (match.index > last) {
      parts.push({ text: unescapeHtml(html.slice(last, match.index)), mark: false });
    }
    parts.push({ text: unescapeHtml(match[1]), mark: true });
    last = match.index + match[0].length;
  }

  if (last < html.length) {
    parts.push({ text: unescapeHtml(html.slice(last)), mark: false });
  }

  return parts;
}
