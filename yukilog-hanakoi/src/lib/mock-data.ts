// ================================
// Mock 数据 — 后端不可用时的本地开发 fallback
// ================================

import type {
  PaginatedData,
  PostWithRelations,
  Post,
  Theme,
  Tag,
  Comment,
  CommentNode,
  Link,
  SiteStats,
  Note,
  LoginResponse,
} from '../types';

// ===== 主题 =====
const mockThemes: Theme[] = [
  { id: 1, name: '技术笔记', slug: 'tech-notes', description: '编程与技术相关的学习笔记', post_count: 5, view_count: 1200, created_at: '2025-12-01T10:00:00+08:00' },
  { id: 2, name: '生活随想', slug: 'life-thoughts', description: '日常感悟与思考', post_count: 3, view_count: 800, created_at: '2025-12-15T10:00:00+08:00' },
  { id: 3, name: '项目实践', slug: 'projects', description: '项目开发实践记录', post_count: 2, view_count: 600, created_at: '2026-01-05T10:00:00+08:00' },
];

// ===== 标签 =====
const mockTags: Tag[] = [
  { id: 1, name: 'Rust', slug: 'rust', post_count: 3, view_count: 500, created_at: '2025-12-01T10:00:00+08:00' },
  { id: 2, name: 'SvelteKit', slug: 'sveltekit', post_count: 2, view_count: 400, created_at: '2025-12-10T10:00:00+08:00' },
  { id: 3, name: 'TypeScript', slug: 'typescript', post_count: 4, view_count: 600, created_at: '2025-12-05T10:00:00+08:00' },
  { id: 4, name: '数据库', slug: 'database', post_count: 2, view_count: 300, created_at: '2026-01-01T10:00:00+08:00' },
  { id: 5, name: 'CSS', slug: 'css', post_count: 1, view_count: 200, created_at: '2026-01-10T10:00:00+08:00' },
];

// ===== 文章 =====
const mockPosts: Post[] = [
  {
    id: 1, title: '用 Rust 构建高性能 Web 后端', slug: 'rust-web-backend',
    summary: '探索如何使用 Axum 框架和 SeaORM 构建一个完整的博客后端 API 系统。',
    content: '# 用 Rust 构建高性能 Web 后端\n\n## 为什么选择 Rust？\n\nRust 以其安全性和性能著称...\n\n## Axum 框架\n\nAxum 是一个现代化的 Rust Web 框架...\n\n```rust\nuse axum::{Router, routing::get};\n\n#[tokio::main]\nasync fn main() {\n    let app = Router::new().route("/", get(|| async { "Hello!" }));\n    // ...\n}\n```\n\n## 总结\n\n使用 Rust 构建后端是一个不错的选择。',
    cover_image: null, status: 'published', is_featured: true, theme_id: 1, view_count: 342,
    created_at: '2026-03-10T14:00:00+08:00', updated_at: '2026-03-10T14:00:00+08:00',
  },
  {
    id: 2, title: 'SvelteKit 迁移实录', slug: 'sveltekit-migration',
    summary: '从 Astro 迁移到 SvelteKit 的完整记录，包括踩坑和最佳实践。',
    content: '# SvelteKit 迁移实录\n\n## 背景\n\n我们的博客原来使用 Astro 构建...\n\n## 迁移步骤\n\n### 1. 项目初始化\n\n使用 `pnpm create svelte` 创建新项目...\n\n### 2. 路由迁移\n\nSvelteKit 使用文件路由...\n\n## 总结\n\n迁移过程虽然有一些挑战，但总体顺利。',
    cover_image: null, status: 'published', is_featured: true, theme_id: 1, view_count: 256,
    created_at: '2026-03-08T10:00:00+08:00', updated_at: '2026-03-08T10:00:00+08:00',
  },
  {
    id: 3, title: '春日散步有感', slug: 'spring-walk',
    summary: '在樱花盛开的季节，记录一些关于生活的感悟。',
    content: '# 春日散步有感\n\n三月的风带着温暖的气息...\n\n> 生活就像一场漫步，重要的不是目的地，而是沿途的风景。\n\n樱花树下，时间仿佛静止了...',
    cover_image: null, status: 'published', is_featured: true, theme_id: 2, view_count: 189,
    created_at: '2026-03-05T16:30:00+08:00', updated_at: '2026-03-05T16:30:00+08:00',
  },
  {
    id: 4, title: 'PostgreSQL 查询优化技巧', slug: 'postgres-optimization',
    summary: '分享一些常用的 PostgreSQL 查询优化方法。',
    content: '# PostgreSQL 查询优化技巧\n\n## 索引优化\n\n合理使用索引是优化查询的关键...\n\n```sql\nCREATE INDEX idx_posts_status ON posts(status, created_at DESC);\n```\n\n## EXPLAIN 分析\n\n使用 EXPLAIN ANALYZE 查看查询执行计划...',
    cover_image: null, status: 'published', is_featured: false, theme_id: 1, view_count: 145,
    created_at: '2026-02-20T09:00:00+08:00', updated_at: '2026-02-20T09:00:00+08:00',
  },
  {
    id: 5, title: 'CSS 原生嵌套语法实战', slug: 'css-nesting',
    summary: '告别预处理器，拥抱 CSS 原生嵌套。',
    content: '# CSS 原生嵌套语法实战\n\n## 基本语法\n\n```css\n.card {\n  background: white;\n  \n  & .title {\n    font-size: 1.5rem;\n  }\n  \n  &:hover {\n    box-shadow: 0 4px 12px rgba(0,0,0,0.1);\n  }\n}\n```\n\n浏览器支持已经足够好了。',
    cover_image: null, status: 'published', is_featured: true, theme_id: 3, view_count: 98,
    created_at: '2026-02-10T11:00:00+08:00', updated_at: '2026-02-10T11:00:00+08:00',
  },
  {
    id: 6, title: '草稿：Tauri 桌面应用', slug: 'tauri-desktop-app',
    summary: '探索 Tauri 构建跨平台桌面应用的可能性。',
    content: '# Tauri 桌面应用\n\n（草稿内容...）',
    cover_image: null, status: 'draft', is_featured: false, theme_id: 3, view_count: 0,
    created_at: '2026-03-09T20:00:00+08:00', updated_at: '2026-03-09T20:00:00+08:00',
  },
];

// ===== 文章（含关联） =====
const mockPostsWithRelations: PostWithRelations[] = mockPosts.map((post) => ({
  post,
  theme: mockThemes.find((t) => t.id === post.theme_id) ?? null,
  tags: post.id === 1 ? [mockTags[0], mockTags[3]] :
        post.id === 2 ? [mockTags[1], mockTags[2]] :
        post.id === 4 ? [mockTags[3]] :
        post.id === 5 ? [mockTags[4]] : [],
}));

// ===== 评论 =====
const mockComments: CommentNode[] = [
  {
    comment: {
      id: 1, post_id: 1, content: '写得真好！Rust 确实是后端开发的利器。',
      guest_nick: '路人甲', guest_email: 'visitor@example.com', guest_website: null,
      parent_id: null, root_id: null, status: 'approved',
      visitor_info: 'Desktop Chrome 136.0 · macOS 15',
      avatar_url: null,
      created_at: '2026-03-10T16:00:00+08:00',
    },
    children: [
      {
        comment: {
          id: 2, post_id: 1, content: '谢谢！后续会继续分享更多 Rust 内容。',
          guest_nick: '博主', guest_email: 'admin@example.com', guest_website: 'https://blog.yeastar.xin',
          parent_id: 1, root_id: 1, status: 'approved',
          visitor_info: null,
          avatar_url: null,
          created_at: '2026-03-10T17:00:00+08:00',
        },
        children: [],
      },
    ],
  },
  {
    comment: {
      id: 3, post_id: 1, content: '请问 SeaORM 和 Diesel 相比有什么优势？',
      guest_nick: '好奇猫', guest_email: 'curious@example.com', guest_website: null,
      parent_id: null, root_id: null, status: 'approved',
      visitor_info: 'Mobile Safari · iOS 19',
      avatar_url: null,
      created_at: '2026-03-11T09:00:00+08:00',
    },
    children: [],
  },
];

// ===== 随记 =====
const mockNotes: Note[] = [
  {
    id: 1, content: '今天把博客从 Astro 迁移到了 SvelteKit，整体体验好了很多。Svelte 5 的 rune 语法真的很优雅。\n\n```ts\nlet count = $state(0);\nconst doubled = $derived(count * 2);\n```',
    mood: 'excited', status: 'published',
    created_at: '2026-03-11T10:00:00+08:00', updated_at: '2026-03-11T10:00:00+08:00',
  },
  {
    id: 2, content: '学习了 Rust 的 lifetime 标注，终于理解了为什么编译器需要这些信息。所有权系统虽然严格，但确实能在编译期捕获很多潜在 bug。',
    mood: 'thinking', status: 'published',
    created_at: '2026-03-10T14:30:00+08:00', updated_at: '2026-03-10T14:30:00+08:00',
  },
  {
    id: 3, content: '> 代码如诗，简洁才是终极的复杂。\n\n重构了一下 API 层的代码，减少了 30% 的重复逻辑。感觉清爽了很多。',
    mood: 'calm', status: 'published',
    created_at: '2026-03-09T20:00:00+08:00', updated_at: '2026-03-09T20:00:00+08:00',
  },
  {
    id: 4, content: '春天来了，窗外的樱花开了。泡了一杯茶，坐在阳台上看了一下午的书。\n\n人生得意须尽欢 🌸',
    mood: 'happy', status: 'published',
    created_at: '2026-03-08T16:00:00+08:00', updated_at: '2026-03-08T16:00:00+08:00',
  },
  {
    id: 5, content: '这条是草稿，不应该在前台显示。',
    mood: null, status: 'draft',
    created_at: '2026-03-07T10:00:00+08:00', updated_at: '2026-03-07T10:00:00+08:00',
  },
];

// ===== 友链 =====
const mockLinks: Link[] = [
  { id: 1, title: 'Sakurine 的小站', url: 'https://example.com', avatar: null, description: '一个热爱编程的少女', status: 'active', created_at: '2025-12-01T10:00:00+08:00' },
  { id: 2, title: '代码花园', url: 'https://codegarden.dev', avatar: null, description: '分享前端技术和开源项目', status: 'active', created_at: '2026-01-15T10:00:00+08:00' },
  { id: 3, title: '待审核的链接', url: 'https://pending.example.com', avatar: null, description: '等待审核', status: 'pending', created_at: '2026-03-10T10:00:00+08:00' },
];

// ===== 站点统计 =====
const mockStats: SiteStats = { total_posts: 5, total_views: 1030, total_words: 12800 };

// ================================
// Mock API 路由表
// ================================

type MockHandler = (endpoint: string, options?: RequestInit) => unknown | null;

const mockRoutes: MockHandler[] = [
  // 文章列表
  (ep) => {
    if (ep.startsWith('/api/public/posts?') || ep === '/api/public/posts') {
      const url = new URL(ep, 'http://mock');
      const status = url.searchParams.get('status');
      const featured = url.searchParams.get('is_featured');
      let filtered = mockPostsWithRelations.filter((p) => p.post.status === 'published');
      if (featured === 'true') filtered = filtered.filter((p) => p.post.is_featured);
      return { items: filtered, total: filtered.length, page: 1, page_size: 20, total_pages: 1 } satisfies PaginatedData<PostWithRelations>;
    }
    return null;
  },
  // 文章详情
  (ep) => {
    const m = ep.match(/^\/api\/public\/posts\/([^/?]+)$/);
    if (m) {
      const found = mockPostsWithRelations.find((p) => p.post.slug === m[1] && p.post.status === 'published');
      return found ?? null;
    }
    return null;
  },
  // 文章浏览计数（静默成功）
  (ep, opts) => {
    if (ep.match(/^\/api\/public\/posts\/[^/]+\/view$/) && opts?.method === 'POST') return {};
    return null;
  },
  // 评论
  (ep) => {
    const m = ep.match(/^\/api\/public\/posts\/([^/]+)\/comments$/);
    if (m) return mockComments;
    return null;
  },
  // 主题列表
  (ep) => ep === '/api/public/themes' ? mockThemes : null,
  // 主题详情
  (ep) => {
    const m = ep.match(/^\/api\/public\/themes\/([^/?]+)$/);
    if (m) return mockThemes.find((t) => t.slug === m[1]) ?? null;
    return null;
  },
  // 标签列表
  (ep) => ep === '/api/public/tags' ? mockTags : null,
  // 友链列表
  (ep) => ep === '/api/public/links' ? mockLinks : null,
  // 站点统计
  (ep) => ep === '/api/public/stats' ? mockStats : null,
  // 随记列表
  (ep) => {
    if (ep.startsWith('/api/public/notes')) {
      const published = mockNotes.filter((n) => n.status === 'published');
      if (ep.match(/^\/api\/public\/notes\/(\d+)$/)) {
        const id = Number(ep.match(/\/(\d+)$/)![1]);
        return published.find((n) => n.id === id) ?? null;
      }
      return { items: published, total: published.length, page: 1, page_size: 10, total_pages: 1 } satisfies PaginatedData<Note>;
    }
    return null;
  },
  // 搜索
  (ep) => {
    if (ep.startsWith('/api/public/search?')) {
      const url = new URL(ep, 'http://mock');
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const results = mockPostsWithRelations.filter(
        (p) => p.post.status === 'published' && (p.post.title.toLowerCase().includes(q) || p.post.content.toLowerCase().includes(q))
      );
      return { items: results, total: results.length, page: 1, page_size: 10, total_pages: 1 };
    }
    return null;
  },
  // 登录
  (ep, opts) => {
    if (ep === '/api/admin/login' && opts?.method === 'POST') {
      return { token: 'mock-jwt-token-for-dev', expires_in: 86400 } satisfies LoginResponse;
    }
    return null;
  },
  // Admin: 文章列表
  (ep) => {
    if (ep.startsWith('/api/admin/posts')) {
      if (ep === '/api/admin/posts' || ep.includes('?')) {
        return { items: mockPostsWithRelations, total: mockPostsWithRelations.length, page: 1, page_size: 9999, total_pages: 1 };
      }
      const m = ep.match(/^\/api\/admin\/posts\/([^/?]+)$/);
      if (m) return mockPostsWithRelations.find((p) => p.post.slug === m[1]) ?? null;
    }
    return null;
  },
  // Admin: 评论列表
  (ep) => {
    if (ep.startsWith('/api/admin/comments')) {
      if (ep.includes('pending')) return [];
      const flat = mockComments.flatMap(function flatten(node: CommentNode): Comment[] {
        return [node.comment, ...node.children.flatMap(flatten)];
      });
      return { items: flat, total: flat.length, page: 1, page_size: 9999, total_pages: 1 };
    }
    return null;
  },
  // Admin: 随记列表
  (ep) => {
    if (ep.startsWith('/api/admin/notes')) {
      if (ep.match(/^\/api\/admin\/notes\/\d+$/)) return mockNotes[0];
      return { items: mockNotes, total: mockNotes.length, page: 1, page_size: 20, total_pages: 1 };
    }
    return null;
  },
  // Admin: 主题
  (ep) => {
    if (ep.startsWith('/api/admin/themes')) return mockThemes;
    return null;
  },
  // Admin: 标签
  (ep) => {
    if (ep.startsWith('/api/admin/tags')) return mockTags;
    return null;
  },
  // Admin: 友链
  (ep) => {
    if (ep.startsWith('/api/admin/links')) {
      if (ep.includes('pending')) return [];
      return mockLinks;
    }
    return null;
  },
  // Admin: 统计
  (ep) => ep === '/api/admin/stats' ? mockStats : null,
];

/**
 * 尝试匹配 mock 路由，返回 mock 数据
 * 找不到匹配路由时返回 undefined
 */
export function getMockResponse(endpoint: string, options?: RequestInit): unknown | undefined {
  for (const handler of mockRoutes) {
    const result = handler(endpoint, options);
    if (result !== null) return result;
  }
  return undefined;
}
