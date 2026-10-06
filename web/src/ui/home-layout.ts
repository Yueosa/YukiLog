/**
 * 首页固定布局：原布局工作室「夜航」节点树的硬编码版本。
 * 2026-10 大重构后布局不可编辑；渲染 walker 在 yuki-app.ts，
 * 根区域按节点 id 挂 data-part，供部件 token 使用。
 */

export type ArticleField =
  | 'cover'
  | 'title'
  | 'summary'
  | 'date'
  | 'category'
  | 'tags'
  | 'views'
  | 'likes';

export interface HomeNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: HomeNode[];
}

export const homeLayout: HomeNode = {
  id: 'nf-root',
  type: 'stack',
  props: { gap: 'none', maxWidth: 'full' },
  children: [
    {
      id: 'nf-hero',
      type: 'hero',
      props: {
        lead: '这里分享她所热爱的技术、思考，以及情绪、挣扎',
        title: '欢迎来看恋的博客',
        accent: '恋',
        overlay: 'medium',
        variant: 'cinematic',
        showEnter: true,
        showSocials: true,
        backgroundPosition: 'center',
      },
    },
    {
      id: 'nf-identity',
      type: 'grid',
      props: { gap: 'lg', align: 'center', columns: 'auto minmax(0, 1fr) auto', maxWidth: 'full' },
      children: [
        {
          id: 'nf-avatar',
          type: 'avatar',
          props: { size: 'xl', label: '恋的头像', shape: 'circle', source: 'site-owner' },
        },
        {
          id: 'nf-who',
          type: 'stack',
          props: { gap: 'sm', maxWidth: 'full' },
          children: [
            {
              id: 'nf-name',
              type: 'text-block',
              props: { text: 'Lian（恋）', source: 'owner-name', variant: 'heading', alignment: 'left' },
            },
            {
              id: 'nf-bio',
              type: 'text-block',
              props: {
                text: '我能走到这里，是因为你没有放弃',
                source: 'owner-bio',
                variant: 'body',
                alignment: 'left',
              },
            },
            {
              id: 'nf-traits',
              type: 'text-block',
              props: { text: '灵魂 · 夜航 · 记忆', source: 'literal', variant: 'caption', alignment: 'left' },
            },
          ],
        },
        {
          id: 'nf-syslog',
          type: 'status-line',
          props: {
            text: 'system.log\n这不是你亲手开启的故事吗？\n[2024-06-09 08:48:29]\n',
            tone: 'neutral',
          },
        },
      ],
    },
    {
      id: 'nf-stage',
      type: 'grid',
      props: { gap: 'xl', align: 'start', columns: 'minmax(0, 1fr) 300px', maxWidth: 'full' },
      children: [
        {
          id: 'nf-main',
          type: 'stack',
          props: { gap: 'xl', maxWidth: 'full' },
          children: [
            {
              id: 'nf-masthead',
              type: 'masthead',
              props: { lead: 'ARCHIVE / 6', title: '最近文章', kicker: '01', variant: 'minimal', alignment: 'left' },
            },
            {
              id: 'nf-feed',
              type: 'article-feed',
              props: {
                sort: 'latest',
                limit: 5,
                fields: ['cover', 'title', 'summary', 'date', 'category', 'tags', 'views', 'likes'],
                columns: 1,
                variant: 'alternating',
              },
            },
          ],
        },
        {
          id: 'nf-rail',
          type: 'stack',
          props: { gap: 'lg', sticky: true, maxWidth: 'full' },
          children: [
            {
              id: 'nf-stats',
              type: 'stats',
              props: { fields: ['articles', 'dynamics', 'friends', 'views'], compact: true },
            },
            {
              id: 'nf-hitokoto',
              type: 'quote',
              props: {
                text: '把每一个今天过得比昨天好一点，这样就够了。',
                alignment: 'left',
                attribution: '—— 《比宇宙更远的地方》',
              },
            },
            {
              id: 'nf-dynamics',
              type: 'dynamic-strip',
              props: { limit: 4, variant: 'compact' },
            },
            {
              id: 'nf-pulse',
              type: 'pulse-panel',
              props: { limit: 6 },
            },
          ],
        },
      ],
    },
  ],
};

/** 节点 id → 部件 id（部件 token 的挂载点；未列出的节点不属于独立部件）。 */
const partNames: Record<string, string> = {
  'nf-hero': 'hero',
  'nf-identity': 'identity-band',
  'nf-masthead': 'masthead',
  'nf-feed': 'article-feed',
  'nf-stats': 'stats-panel',
  'nf-hitokoto': 'free-panel',
  'nf-dynamics': 'dynamic-strip',
  'nf-pulse': 'pulse-panel',
};

export function partNameOf(nodeId: string): string | null {
  return partNames[nodeId] ?? null;
}
