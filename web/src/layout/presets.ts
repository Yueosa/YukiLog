import type { LayoutDocument } from './types.js';

export const layoutPresets: LayoutDocument[] = [
  {
    schemaVersion: 1,
    id: 'hanakoi-continuum',
    label: 'A · 花恋延续',
    description: '全屏壁纸、透明顶栏、双面个人卡与旧站式交错文章卡。',
    theme: 'hanakoi',
    shell: {
      schemaVersion: 1,
      navigation: 'topbar',
      brandPosition: 'start',
      showSearch: true,
      translucent: true,
      maxWidth: 'wide',
    },
    root: {
      id: 'hanakoi-root',
      type: 'stack',
      props: { gap: 'none', maxWidth: 'full' },
      children: [
        {
          id: 'hanakoi-hero',
          type: 'hero',
          props: {
            variant: 'cinematic',
            title: '愿每一次相遇都有回声',
            lead: '把风、未说完的话，以及偶尔降临的温柔，都留在这里。',
            showSocials: true,
            showEnter: true,
          },
        },
        {
          id: 'hanakoi-content',
          type: 'split',
          props: { sidebarWidth: '270px', side: 'left', gap: 'lg', sticky: true },
          responsive: { mobile: { columns: '1fr', sticky: false } },
          children: [
            {
              id: 'hanakoi-profile',
              type: 'profile-card',
              props: { variant: 'portrait', flip: true, showSocials: true, showStatus: true },
            },
            {
              id: 'hanakoi-feed',
              type: 'article-feed',
              props: {
                variant: 'alternating',
                fields: ['cover', 'title', 'summary', 'date', 'category', 'tags'],
                columns: 1,
                limit: 6,
                sort: 'latest',
              },
            },
          ],
        },
      ],
    },
  },
  {
    schemaVersion: 1,
    id: 'moonlit-letter',
    label: 'B · 月下书简',
    description: '固定左侧导航、没有全屏首屏，以文字刊头和杂志式排版直接进入阅读。',
    theme: 'moonletter',
    shell: {
      schemaVersion: 1,
      navigation: 'sidebar',
      brandPosition: 'start',
      showSearch: true,
      translucent: false,
      maxWidth: 'content',
    },
    root: {
      id: 'letter-root',
      type: 'grid',
      props: { columns: 'minmax(0, 1fr) 280px', gap: 'xl', maxWidth: '1120px' },
      responsive: { mobile: { columns: '1fr' } },
      children: [
        {
          id: 'letter-main',
          type: 'stack',
          props: { gap: 'xl' },
          children: [
            {
              id: 'letter-masthead',
              type: 'masthead',
              props: {
                variant: 'editorial',
                title: '写给时间的长信',
                lead: '没有算法推送，也不急着抵达。请从任意一页开始读。',
                alignment: 'left',
              },
            },
            {
              id: 'letter-feed',
              type: 'article-feed',
              props: {
                variant: 'editorial',
                fields: ['title', 'summary', 'date', 'category', 'likes'],
                columns: 2,
                limit: 8,
                sort: 'latest',
              },
            },
            {
              id: 'letter-dynamics',
              type: 'dynamic-strip',
              props: { limit: 3, variant: 'handwritten' },
            },
          ],
        },
        {
          id: 'letter-aside',
          type: 'stack',
          props: { gap: 'md', sticky: true },
          children: [
            {
              id: 'letter-profile',
              type: 'profile-card',
              props: { variant: 'letter', flip: true, showSocials: false, showStatus: false },
            },
            {
              id: 'letter-quote',
              type: 'quote',
              props: {
                text: '博客不必证明我多么正确，它只需要诚实地证明：我曾经这样生活过。',
                attribution: 'Sakurine',
              },
            },
          ],
        },
      ],
    },
  },
  {
    schemaVersion: 1,
    id: 'orbit-editorial',
    label: 'C · 星轨编辑部',
    description: '底部浮动 Dock、紧凑分屏首区与自由 Bento 内容版面。',
    theme: 'orbit',
    shell: {
      schemaVersion: 1,
      navigation: 'floating-dock',
      brandPosition: 'center',
      showSearch: true,
      translucent: true,
      maxWidth: 'full',
    },
    root: {
      id: 'orbit-root',
      type: 'bento',
      props: { columns: 12, rowHeight: '84px', gap: 'md', maxWidth: '1240px' },
      responsive: { mobile: { columns: 1, rowHeight: 'auto' } },
      children: [
        {
          id: 'orbit-hero',
          type: 'hero',
          props: {
            variant: 'split',
            title: '在自己的轨道上写作',
            lead: '文章、动态与片刻灵感，像星体一样各自运行。',
            showSocials: false,
            showEnter: false,
            area: 'span 8 / span 5',
          },
        },
        {
          id: 'orbit-profile',
          type: 'profile-card',
          props: {
            variant: 'compact',
            flip: true,
            showSocials: true,
            showStatus: true,
            area: 'span 4 / span 5',
          },
        },
        {
          id: 'orbit-feed',
          type: 'article-feed',
          props: {
            variant: 'cover-overlay',
            fields: ['cover', 'title', 'date', 'category', 'views', 'likes'],
            columns: 3,
            limit: 6,
            sort: 'popular',
            area: 'span 9 / span 7',
          },
        },
        {
          id: 'orbit-side',
          type: 'stack',
          props: { gap: 'md', area: 'span 3 / span 7' },
          children: [
            {
              id: 'orbit-stats',
              type: 'stats',
              props: { fields: ['articles', 'dynamics', 'words'], compact: true },
            },
            {
              id: 'orbit-dynamics',
              type: 'dynamic-strip',
              props: { limit: 4, variant: 'timeline' },
            },
          ],
        },
      ],
    },
  },
];
