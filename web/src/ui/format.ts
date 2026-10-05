// 展示层格式化工具：日期、相对时间、HTML 摘要。保持与 SSR 公开页一致的文案风格。

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

/** 把服务端渲染的 HTML 摘要成纯文本（用于动态列表条、搜索摘录等）。 */
export function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([a-zA-Z0-9#]+);/g, (match, name: string) => HTML_ENTITIES[name] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

/** 按字符数截断（感知码点），超出时补省略号。 */
export function excerpt(text: string, maximum: number): string {
  const trimmed = text.trim();
  const chars = [...trimmed];
  if (chars.length <= maximum) return trimmed;
  return `${chars.slice(0, Math.max(1, maximum - 1)).join('')}…`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** '2026 · 10 · 04'，与站内文章日期格式一致。 */
export function formatDate(iso: string): string {
  const date = parse(iso);
  if (!date) return iso;
  return `${date.getFullYear()} · ${pad(date.getMonth() + 1)} · ${pad(date.getDate())}`;
}

/** '2026 · 10 · 04 / 23:14'，评论区使用。 */
export function formatDateTime(iso: string): string {
  const date = parse(iso);
  if (!date) return iso;
  return `${formatDate(iso)} / ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** '10.04'，归档行使用。 */
export function formatMonthDay(iso: string): string {
  const date = parse(iso);
  if (!date) return '';
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export function yearOf(iso: string): string {
  const date = parse(iso);
  return date ? String(date.getFullYear()) : '';
}

/** 动态相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / N 周前 / 具体日期。 */
export function relTime(iso: string, now: number = Date.now()): string {
  const time = parse(iso)?.getTime();
  if (time === undefined) return iso;
  const elapsed = Math.max(0, now - time);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} 周前`;
  return formatDate(iso);
}

/** 粗略阅读时长：按正文纯文本字数约 400 字/分钟。 */
export function readingMinutes(html: string): number {
  return Math.max(1, Math.round([...textFromHtml(html)].length / 400));
}
