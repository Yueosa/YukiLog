/**
 * 生成评论头像 URL
 * 优先级：① 后端 avatar_url → ② website favicon → ③ Gravatar → ④ 默认头像
 */

const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?s=80&d=mp';

function getGravatarUrl(email: string, size: number = 80): string {
  const hash = simpleHash(email.toLowerCase().trim());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

export function getCommentAvatar(
  website: string | null | undefined,
  email?: string | null,
  avatarUrl?: string | null,
): string {
  if (avatarUrl) return avatarUrl;

  if (website) {
    const trimmedUrl = website.trim().replace(/\/+$/, '');
    return `${trimmedUrl}/favicon.ico`;
  }

  if (email?.trim()) {
    return getGravatarUrl(email, 80);
  }

  return DEFAULT_AVATAR;
}
