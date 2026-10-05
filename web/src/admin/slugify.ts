/**
 * Slug 生成工具（移植自旧版 yukilog-hanakoi 并升级）。
 *
 * 思路：常见中文词汇映射成英文词 → 小写 → 空格转连字符 → 丢弃剩余中文 →
 * 清理连字符 → 空结果回落 post-YYYY-MM-DD → 调用方负责查重（追加 -2、-3）。
 */

const wordMap: Record<string, string> = {
  // 技术类
  '前端': 'frontend',
  '后端': 'backend',
  '全栈': 'fullstack',
  '技术': 'tech',
  '编程': 'coding',
  '开发': 'dev',
  '设计': 'design',
  '架构': 'arch',
  '算法': 'algorithm',
  '数据库': 'database',
  '网络': 'network',
  '安全': 'security',
  '服务器': 'server',
  '部署': 'deploy',
  '重构': 'rebuild',
  '迁移': 'migration',

  // 内容类型
  '教程': 'tutorial',
  '笔记': 'notes',
  '随笔': 'essay',
  '分享': 'share',
  '总结': 'summary',
  '回顾': 'review',
  '思考': 'thinking',
  '实践': 'practice',
  '手记': 'notes',
  '记录': 'log',

  // 站点用语
  '夜航': 'nightflight',
  '博客': 'blog',
  '文章': 'article',
  '动态': 'moments',
  '友链': 'friends',
  '指南': 'guide',
  '入门': 'intro',
  '进阶': 'advanced',
  '深入': 'deep-dive',

  // 时间相关
  '年终': 'year-end',
  '月度': 'monthly',
  '周记': 'weekly',
  '日记': 'diary',

  // 生活类
  '生活': 'life',
  '音乐': 'music',
  '电影': 'movie',
  '读书': 'reading',
  '游戏': 'game',
  '旅行': 'travel',
  '心情': 'mood',
};

/** 根据标题生成 slug 候选（不查重）。 */
export function generateSlug(text: string): string {
  if (!text) return '';

  let slug = text;
  // 长词优先，避免「夜航手记」被「夜航」先吃掉
  for (const [chinese, english] of Object.entries(wordMap).sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    slug = slug.replaceAll(chinese, ` ${english} `);
  }

  slug = slug.toLowerCase();
  slug = slug.replace(/\s+/g, '-');
  slug = slug.replace(/[^a-z0-9-]/g, '');
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-|-$/g, '');

  if (!slug) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    slug = `post-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  return slug;
}

/** 在已占用 slug 集合中选出唯一 slug（必要时追加 -2、-3…）。 */
export function uniqueSlug(candidate: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((item) => item.toLowerCase()));
  if (!used.has(candidate.toLowerCase())) return candidate;
  for (let index = 2; ; index += 1) {
    const next = `${candidate}-${index}`;
    if (!used.has(next.toLowerCase())) return next;
  }
}

/** 与数据库 CHECK 约束一致的格式校验。 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
