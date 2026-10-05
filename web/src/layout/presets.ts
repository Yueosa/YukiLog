import type { LayoutDocument } from './types.js';

// 首发只提供夜航主题；第二主题等有真实需求时再加入。
export const layoutPresets: LayoutDocument[] = [
  {
    schemaVersion: 1,
    id: 'nightflight-continuum',
    label: '夜航',
    description: '沉浸首屏、个人带、交错文章流与发丝线侧栏。',
    theme: 'nightflight',
    shell: {
      schemaVersion: 1,
      navigation: 'topbar',
      brandPosition: 'start',
      showSearch: true,
      translucent: true,
      maxWidth: 'wide',
    },
    root: {
      id: 'nf-root',
      type: 'stack',
      props: { gap: 'none', maxWidth: 'full' },
      children: [
        {
          id: 'nf-hero',
          type: 'hero',
          props: {
            variant: 'cinematic',
            title: '欢迎来看恋的博客',
            accent: '恋',
            lead: '这里分享她所热爱的技术、思考，以及情绪、挣扎',
            showSocials: true,
            showEnter: true,
            backgroundPosition: 'center',
            overlay: 'medium',
          },
        },
        {
          id: 'nf-identity',
          type: 'grid',
          props: { columns: 'auto minmax(0, 1fr) auto', gap: 'lg', align: 'center', maxWidth: 'full' },
          responsive: { mobile: { columns: '1fr' } },
          children: [
            {
              id: 'nf-avatar',
              type: 'avatar',
              props: { source: 'site-owner', size: 'xl', shape: 'circle', label: '恋的头像' },
            },
            {
              id: 'nf-who',
              type: 'stack',
              props: { gap: 'sm', maxWidth: 'full' },
              children: [
                {
                  id: 'nf-name',
                  type: 'text-block',
                  props: {
                    source: 'owner-name',
                    variant: 'heading',
                    text: 'Lian（恋）',
                    alignment: 'left',
                  },
                },
                {
                  id: 'nf-bio',
                  type: 'text-block',
                  props: {
                    source: 'owner-bio',
                    variant: 'body',
                    text: '我能走到这里，是因为你没有放弃',
                    alignment: 'left',
                  },
                },
                {
                  id: 'nf-traits',
                  type: 'text-block',
                  props: {
                    source: 'literal',
                    variant: 'caption',
                    text: '代码 · 记忆 · 夜航',
                    alignment: 'left',
                  },
                },
              ],
            },
            {
              id: 'nf-syslog',
              type: 'status-line',
              props: {
                text: 'system.log\n这不是你亲手开启的故事吗?\n[2024-06-09 08:48:29]\n',
                tone: 'neutral',
              },
            },
          ],
        },
        {
          id: 'nf-stage',
          type: 'grid',
          props: { columns: 'minmax(0, 1fr) 300px', gap: 'xl', align: 'start', maxWidth: 'full' },
          responsive: { mobile: { columns: '1fr' } },
          children: [
            {
              id: 'nf-main',
              type: 'stack',
              props: { gap: 'xl', maxWidth: 'full' },
              children: [
                {
                  id: 'nf-masthead',
                  type: 'masthead',
                  props: {
                    variant: 'minimal',
                    kicker: '01',
                    title: '最近文章',
                    lead: 'ARCHIVE / 6',
                    alignment: 'left',
                    backgroundMediaId: 'seed-mc',
                  },
                },
                {
                  id: 'nf-feed',
                  type: 'article-feed',
                  props: {
                    variant: 'alternating',
                    fields: ['cover', 'title', 'summary', 'date', 'category', 'tags', 'views', 'likes'],
                    columns: 1,
                    limit: 5,
                    sort: 'latest',
                  },
                },
              ],
            },
            {
              id: 'nf-rail',
              type: 'stack',
              props: { gap: 'lg', maxWidth: 'full', sticky: true },
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
                    attribution: '—— 《比宇宙更远的地方》',
                    alignment: 'left',
                  },
                },
                {
                  id: 'nf-dynamics',
                  type: 'dynamic-strip',
                  props: { limit: 4, variant: 'compact' },
                },
              ],
            },
          ],
        },
      ],
    },
  },
];
