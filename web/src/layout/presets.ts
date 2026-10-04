import type { LayoutDocument } from './types.js';

// 首发只提供旧版花恋主题；第二主题等有真实需求时再加入。
export const layoutPresets: LayoutDocument[] = [
  {
    schemaVersion: 1,
    id: 'hanakoi-continuum',
    label: '花恋',
    description: '电影感首屏、透明顶栏、双面个人卡与旧站式交错文章流。',
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
            title: '风会记得，每一次认真生活',
            lead: '写代码，也收藏长夜、晚风和那些没来得及说完的话。',
            showSocials: true,
            showEnter: true,
            backgroundPosition: 'center',
            overlay: 'medium',
          },
        },
        {
          id: 'hanakoi-content',
          type: 'grid',
          props: {
            columns: '240px minmax(0, 1fr) 240px',
            gap: 'lg',
            align: 'start',
            maxWidth: 'full',
          },
          responsive: { mobile: { columns: '1fr' } },
          children: [
            {
              id: 'hanakoi-profile',
              type: 'card',
              props: {
                variant: 'plain',
                padding: 'lg',
                radius: 'lg',
                shadow: 'pink',
                align: 'center',
                sticky: true,
              },
              children: [
                {
                  id: 'hanakoi-avatar',
                  type: 'avatar',
                  props: { source: 'site-owner', size: 'xl', shape: 'circle', label: 'Sakurine' },
                },
                {
                  id: 'hanakoi-name',
                  type: 'text-block',
                  props: {
                    source: 'owner-name',
                    variant: 'heading',
                    text: 'Sakurine',
                    alignment: 'center',
                  },
                },
                {
                  id: 'hanakoi-bio',
                  type: 'text-block',
                  props: {
                    source: 'owner-bio',
                    variant: 'body',
                    text: '写代码，也收藏深夜、长风和不肯消失的心动。',
                    alignment: 'center',
                  },
                },
                {
                  id: 'hanakoi-socials',
                  type: 'social-links',
                  props: { variant: 'labels', alignment: 'left' },
                },
                {
                  id: 'hanakoi-status',
                  type: 'status-line',
                  props: { text: 'system.log · rebuilding YukiLog', tone: 'accent' },
                },
              ],
            },
            {
              id: 'hanakoi-main',
              type: 'stack',
              props: { gap: 'lg', maxWidth: 'wide' },
              children: [
                {
                  id: 'hanakoi-masthead',
                  type: 'masthead',
                  props: {
                    variant: 'minimal',
                    title: '最近写下',
                    lead: '一些关于技术、生活，以及如何与时间相处的记录。',
                    alignment: 'left',
                  },
                },
                {
                  id: 'hanakoi-feed',
                  type: 'article-feed',
                  props: {
                    variant: 'alternating',
                    fields: ['cover', 'title', 'summary', 'date', 'category', 'tags'],
                    columns: 1,
                    limit: 5,
                    sort: 'latest',
                  },
                },
                {
                  id: 'hanakoi-dynamics',
                  type: 'dynamic-strip',
                  props: { limit: 3, variant: 'compact' },
                },
              ],
            },
            {
              id: 'hanakoi-right-rail',
              type: 'stack',
              props: { gap: 'lg', sticky: true },
              children: [
                {
                  id: 'hanakoi-quote-card',
                  type: 'card',
                  props: {
                    variant: 'plain',
                    padding: 'lg',
                    radius: 'lg',
                    shadow: 'pink',
                    align: 'stretch',
                  },
                  children: [
                    {
                      id: 'hanakoi-quote',
                      type: 'quote',
                      props: {
                        text: '愿你在漫长的时间里，仍然保有认真感受世界的能力。',
                        attribution: '今日一言',
                        alignment: 'left',
                      },
                    },
                  ],
                },
                {
                  id: 'hanakoi-stats-card',
                  type: 'card',
                  props: {
                    variant: 'plain',
                    padding: 'lg',
                    radius: 'lg',
                    shadow: 'blue',
                    align: 'stretch',
                  },
                  children: [
                    {
                      id: 'hanakoi-stats-title',
                      type: 'text-block',
                      props: {
                        source: 'literal',
                        variant: 'eyebrow',
                        text: 'SITE INFO',
                        alignment: 'left',
                      },
                    },
                    {
                      id: 'hanakoi-stats',
                      type: 'stats',
                      props: { fields: ['articles', 'dynamics', 'words'], compact: true },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
];
