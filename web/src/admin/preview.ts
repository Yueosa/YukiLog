import type {
  Admin,
  AdminNotification,
  AdminOverview,
  Article,
  Category,
  Comment,
  Delivery,
  Dynamic,
  FriendLink,
  LayoutRecord,
  MediaAsset,
  NotificationSettings,
  SiteSettings,
  Subscriber,
  Tag,
} from './types.js';

// 管理页离线预览：仅 vite 开发环境使用（后端不可达时自动进入，或登录页手动进入）。
// 数据是假的，任何写操作都会被 run() 拦截。

export const previewAdmin: Admin = { id: 'preview', username: 'lian', display_name: '恋' };

const now = '2026-10-05T15:00:00+08:00';

export const previewCategories: Category[] = [
  { id: 'cat-1', name: '生活随笔', slug: 'life', description: '日常、情绪与生活碎片', sort_order: 1 },
  { id: 'cat-2', name: '开发手记', slug: 'dev', description: '代码和还没写完的实验', sort_order: 2 },
];

export const previewTags: Tag[] = [
  { id: 'tag-1', name: '夜色', slug: 'night' },
  { id: 'tag-2', name: '重逢', slug: 'reunion' },
  { id: 'tag-3', name: 'Rust', slug: 'rust' },
];

export const previewArticles: Article[] = [
  {
    id: 'art-1',
    category_id: 'cat-1',
    cover_media_id: 'med-1',
    title: '在十月的晚风里，重新搭一座小小的站',
    slug: 'october-wind',
    summary: '旧服务器消失以后，我终于有机会重新想一遍：一个博客究竟应该留下什么。',
    body_markdown: '## 旧站的问题，我一直都知道\n\n旧的前端是写死的……',
    status: 'published',
    allow_comments: true,
    published_at: '2026-10-04T22:00:00+08:00',
    featured_at: '2026-10-04T22:30:00+08:00',
    created_at: now,
    updated_at: now,
    tag_ids: ['tag-1', 'tag-2'],
  },
  {
    id: 'art-2',
    category_id: 'cat-2',
    cover_media_id: null,
    title: '一套不替创作者做决定的博客系统',
    slug: 'blog-system',
    summary: '组件、布局和设计语言应当可以被更换，而内容不必跟着重新搬家。',
    body_markdown: '## 为什么重写\n\n修补只能解决「坏了」的问题……',
    status: 'draft',
    allow_comments: true,
    published_at: null,
    featured_at: null,
    created_at: now,
    updated_at: now,
    tag_ids: ['tag-3'],
  },
];

export const previewDynamics: Dynamic[] = [
  {
    id: 'dyn-1',
    content_markdown: '雨停以后，窗沿留下了一小段很亮的晚霞。',
    mood: '🌙 平静',
    status: 'published',
    allow_comments: true,
    published_at: '2026-10-04T19:30:00+08:00',
    created_at: now,
    updated_at: now,
    media: [],
  },
  {
    id: 'dyn-2',
    content_markdown: '凌晨两点，终于把恢复演练完整跑通。睡个好觉。',
    mood: null,
    status: 'published',
    allow_comments: true,
    published_at: '2026-09-20T02:03:00+08:00',
    created_at: now,
    updated_at: now,
    media: [
      {
        id: 'med-1',
        url: '/media/seed/october-wind.jpg',
        original_name: 'october-wind.jpg',
        media_type: 'image/jpeg',
        width: 1600,
        height: 1000,
      },
    ],
  },
];

export const previewComments: Comment[] = [
  {
    id: 'com-1',
    article_id: 'art-1',
    dynamic_id: null,
    parent_id: null,
    display_name: '远岸',
    email: null,
    website: 'https://yeastar.xin',
    content: '「旧服务器消失」这句话看得心里一沉，但读到最后又觉得很轻。欢迎回来。',
    status: 'pending',
    created_at: '2026-10-04T23:14:00+08:00',
  },
  {
    id: 'com-2',
    article_id: 'art-1',
    dynamic_id: null,
    parent_id: null,
    display_name: '栖迟',
    email: 'qichi@example.com',
    website: null,
    content: '备份那一段太真实了……我也是丢了数据之后，才学会给自己写备份脚本的。',
    status: 'visible',
    created_at: '2026-10-05T01:02:00+08:00',
  },
];

export const previewMedia: MediaAsset[] = [
  {
    id: 'med-1',
    url: '/media/seed/october-wind.jpg',
    original_name: 'october-wind.jpg',
    media_type: 'image/jpeg',
    byte_size: 482_011,
    width: 1600,
    height: 1000,
  },
  {
    id: 'med-2',
    url: '/media/seed/avatar.png',
    original_name: 'avatar.png',
    media_type: 'image/png',
    byte_size: 88_204,
    width: 512,
    height: 512,
  },
  {
    id: 'med-3',
    url: '/media/seed/night-hero.jpg',
    original_name: 'night-hero.jpg',
    media_type: 'image/jpeg',
    byte_size: 1_203_448,
    width: 2400,
    height: 1350,
  },
  {
    id: 'med-4',
    url: '/media/seed/masthead-strip.gif',
    original_name: 'masthead-strip.gif',
    media_type: 'image/gif',
    byte_size: 645_120,
    width: 1200,
    height: 300,
  },
  {
    id: 'med-5',
    url: '/media/seed/rainy-window.jpg',
    original_name: 'rainy-window.jpg',
    media_type: 'image/jpeg',
    byte_size: 356_812,
    width: 1080,
    height: 1350,
  },
];

export const previewLayouts: LayoutRecord[] = [
  {
    pageKey: 'home',
    updatedAt: now,
    layout: {
      schemaVersion: 1,
      id: 'home',
      label: '首页',
      description: '预览用首页布局',
      root: {
        id: 'root',
        type: 'stack',
        props: {},
        children: [
          {
            id: 'home-hero',
            type: 'hero',
            props: { variant: 'cinematic', backgroundMediaId: 'med-3' },
          },
          {
            id: 'home-masthead',
            type: 'masthead',
            props: { variant: 'editorial', backgroundMediaId: 'med-4' },
          },
        ],
      },
    },
  },
];

export const previewFriends: FriendLink[] = [
  {
    id: 'fri-1',
    avatar_media_id: null,
    avatar_url: null,
    name: '星港',
    url: 'https://yeastar.xin',
    description: '另一处慢慢更新的主站。',
    application_email: null,
    is_visible: true,
    sort_order: 1,
  },
  {
    id: 'fri-2',
    avatar_media_id: null,
    avatar_url: 'https://blog.example.com/icon.png',
    name: '远岸的小站',
    url: 'https://blog.example.com',
    description: '想和你交换友链～这里记录一些后端和咖啡。',
    application_email: 'yuanan@example.com',
    is_visible: false,
    sort_order: 0,
  },
];

export const previewSubscribers: Subscriber[] = [
  {
    id: 'sub-1',
    email: 'reader@example.com',
    subscribe_articles: true,
    subscribe_dynamics: true,
    status: 'active',
    confirmation_sent_at: now,
    confirmed_at: now,
    unsubscribed_at: null,
    created_at: now,
  },
  {
    id: 'sub-2',
    email: 'waiting@example.com',
    subscribe_articles: true,
    subscribe_dynamics: false,
    status: 'pending',
    confirmation_sent_at: now,
    confirmed_at: null,
    unsubscribed_at: null,
    created_at: now,
  },
];

export const previewDeliveries: Delivery[] = [
  {
    id: 'del-1',
    subscriber_id: 'sub-1',
    kind: 'article_published',
    article_id: 'art-1',
    dynamic_id: null,
    status: 'sent',
    attempt_count: 1,
    next_attempt_at: now,
    last_error: null,
    created_at: now,
    sent_at: now,
  },
  {
    id: 'del-2',
    subscriber_id: 'sub-2',
    kind: 'confirm_subscription',
    article_id: null,
    dynamic_id: null,
    status: 'failed',
    attempt_count: 3,
    next_attempt_at: now,
    last_error: 'SMTP 连接超时',
    created_at: now,
    sent_at: null,
  },
];

export const previewNotifications: AdminNotification[] = [
  {
    id: 'ntf-1',
    kind: 'comment',
    article_id: 'art-1',
    comment_id: 'com-1',
    friend_link_id: null,
    title: '新评论待审核',
    message: '远岸 在《在十月的晚风里，重新搭一座小小的站》留下了评论。',
    target_url: '/admin#comments',
    event_count: 1,
    read_at: null,
    email_status: 'suppressed',
    email_attempt_count: 0,
    email_last_error: null,
    emailed_event_count: 0,
    email_sent_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'ntf-2',
    kind: 'friend_link_application',
    article_id: null,
    comment_id: null,
    friend_link_id: 'fri-2',
    title: '新的友链申请',
    message: '远岸的小站（https://blog.example.com）申请交换友链。',
    target_url: '/admin#friends',
    event_count: 1,
    read_at: null,
    email_status: 'suppressed',
    email_attempt_count: 0,
    email_last_error: null,
    emailed_event_count: 0,
    email_sent_at: null,
    created_at: now,
    updated_at: now,
  },
];

export const previewNotificationSettings: NotificationSettings = {
  notification_email: null,
  email_notifications_enabled: false,
  notify_on_comments: true,
  notify_on_friend_links: true,
  notify_on_likes: false,
  notification_frequency: 'hourly',
};

export const previewSettings: SiteSettings = {
  siteTitle: 'YukiLog',
  siteDescription: '代码、记忆与夜航。',
  ownerName: '恋',
  ownerBio: '我能走到这里，是因为你没有放弃',
  avatarMediaId: 'med-2',
  avatarExternalUrl: 'https://q1.qlogo.cn/g?b=qq&nk=1303028790&s=640',
  mastheadMediaId: null,
  socialLinks: [
    { label: 'GitHub', url: 'https://github.com/Yueosa' },
    { label: '邮箱', url: 'mailto:lian@yeastar.xin' },
  ],
  theme: {
    schemaVersion: 1,
    colors: {
      background: '#f7f8f7',
      surface: '#ffffff',
      surfaceMuted: '#eef1f4',
      text: '#1c2733',
      textMuted: '#5d6b7a',
      primary: '#7eb6d9',
      secondary: '#e8a4b4',
      border: '#dde5ec',
    },
    typography: { body: 'system', display: 'serif', scale: 1 },
    shape: { radius: 14, borderedCards: true },
    motion: 'subtle',
  },
  shellLayout: {
    schemaVersion: 1,
    navigation: 'topbar',
    brandPosition: 'start',
    showSearch: true,
    translucent: true,
    maxWidth: 'wide',
  },
};

export const previewOverview: AdminOverview = {
  counts: {
    articles: 2,
    articles_published: 1,
    dynamics: 2,
    comments_pending: 1,
    media: 1,
    subscribers_active: 1,
    deliveries_failed: 1,
    notifications_unread: 2,
  },
  totals: { views: 1423, likes: 87 },
  top_viewed: [
    { id: 'art-1', title: '在十月的晚风里，重新搭一座小小的站', slug: 'october-wind', value: 968 },
    { id: 'art-2', title: '一套不替创作者做决定的博客系统', slug: 'blog-system', value: 455 },
  ],
  top_liked_articles: [
    { id: 'art-1', title: '在十月的晚风里，重新搭一座小小的站', slug: 'october-wind', value: 56 },
    { id: 'art-2', title: '一套不替创作者做决定的博客系统', slug: 'blog-system', value: 19 },
  ],
  top_liked_dynamics: [
    { id: 'dyn-2', excerpt: '凌晨两点，终于把恢复演练完整跑通。睡个好觉。', like_count: 16 },
    { id: 'dyn-1', excerpt: '雨停以后，窗沿留下了一小段很亮的晚霞。', like_count: 12 },
  ],
  recent_comments: [
    {
      id: 'com-2',
      display_name: '栖迟',
      excerpt: '备份那一段太真实了……我也是丢了数据之后，才学会给自己写备份脚本的。',
      status: 'visible',
      created_at: '2026-10-05T01:02:00+08:00',
      target_title: '在十月的晚风里，重新搭一座小小的站',
    },
    {
      id: 'com-1',
      display_name: '远岸',
      excerpt: '「旧服务器消失」这句话看得心里一沉，但读到最后又觉得很轻。欢迎回来。',
      status: 'pending',
      created_at: '2026-10-04T23:14:00+08:00',
      target_title: '在十月的晚风里，重新搭一座小小的站',
    },
  ],
  recent_notifications: previewNotifications,
};
