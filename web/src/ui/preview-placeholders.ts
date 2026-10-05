import type { ArticleSummary, DynamicItem } from './api.js';

// 仅用于布局工作室预览（?preview=1）：让文章流、最近动态等组件在没有
// 后端数据时也能渲染出接近真实的占位排版。公开运行时不会用到这些数据。

export const previewArticles: ArticleSummary[] = [
  {
    id: 'preview-1',
    slug: 'preview-one',
    title: '占位文章 · 夜航里的第一封信',
    summary: '这是布局预览用的占位摘要，用来观察两行文字在卡片里的呼吸感。',
    coverUrl: '',
    category: { name: '生活随笔', slug: 'life' },
    tags: [
      { name: '夜色', slug: 'night' },
      { name: '重逢', slug: 'reunion' },
    ],
    publishedAt: '2026-10-04T22:00:00+08:00',
    views: 128,
    likes: 16,
    featured: true,
  },
  {
    id: 'preview-2',
    slug: 'preview-two',
    title: '占位文章 · 一套不替创作者做决定的系统',
    summary: '组件、布局和设计语言应当可以被更换，而内容不必跟着重新搬家。',
    coverUrl: '',
    category: { name: '开发手记', slug: 'dev' },
    tags: [{ name: '组件引擎', slug: 'layout' }],
    publishedAt: '2026-08-11T21:00:00+08:00',
    views: 184,
    likes: 28,
    featured: false,
  },
  {
    id: 'preview-3',
    slug: 'preview-three',
    title: '占位文章 · 把动态写成散落在时间里的星',
    summary: '短句不再是假装完整的文章，它们只是当天留下的一点光。',
    coverUrl: '',
    category: { name: '动态', slug: 'moments' },
    tags: [{ name: '星轨', slug: 'stars' }],
    publishedAt: '2026-08-29T23:00:00+08:00',
    views: 73,
    likes: 12,
    featured: false,
  },
];

export const previewDynamics: DynamicItem[] = [
  {
    id: 'preview-dyn-1',
    contentHtml: '<p>雨停以后，窗沿留下了一小段很亮的晚霞。</p>',
    mood: null,
    mediaUrls: [],
    likes: 12,
    commentCount: 2,
    createdAt: '2026-10-04T22:17:00+08:00',
  },
  {
    id: 'preview-dyn-2',
    contentHtml: '<p>正在为新的 YukiLog 选择它应有的样子。</p>',
    mood: '期待',
    mediaUrls: [],
    likes: 21,
    commentCount: 1,
    createdAt: '2026-09-28T23:05:00+08:00',
  },
];

export const previewStats = { articles: 6, dynamics: 5, friends: 4, views: 604 };
