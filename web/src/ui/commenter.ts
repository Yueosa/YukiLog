// 评论者身份记忆：与 SSR 公开页脚本共用同一个 localStorage key 和字段结构。

const STORAGE_KEY = 'yukilog-commenter';

export interface Commenter {
  display_name: string;
  email: string;
  website: string;
}

export function loadCommenter(): Commenter {
  const empty: Commenter = { display_name: '', email: '', website: '' };
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty;
    const data = parsed as Record<string, unknown>;
    return {
      display_name: typeof data.display_name === 'string' ? data.display_name : '',
      email: typeof data.email === 'string' ? data.email : '',
      website: typeof data.website === 'string' ? data.website : '',
    };
  } catch {
    return empty;
  }
}

export function saveCommenter(commenter: Commenter): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(commenter));
  } catch {
    // 隐私模式等场景下静默失败
  }
}
