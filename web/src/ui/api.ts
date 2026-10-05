import type { ShellLayout } from '../layout/types.js';

// 公开站 API 客户端。GET 全部走 /api/public/*（camelCase 契约）；
// 写操作沿用既有端点（snake_case，与 SSR 公开页脚本同一批接口）。

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '网络异常，请稍后再试。';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, 'network', '网络异常，请稍后再试。');
  }
  if (!response.ok) {
    let code = 'error';
    let message = `请求失败（${response.status}）`;
    try {
      const data: unknown = await response.json();
      if (data && typeof data === 'object') {
        const body = data as Record<string, unknown>;
        if (typeof body.code === 'string') code = body.code;
        if (typeof body.message === 'string') message = body.message;
      }
    } catch {
      // 非 JSON 错误体：保留默认文案
    }
    throw new ApiError(response.status, code, message);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

/** 列表字段兜底：响应形状漂移时降级为空列表而不是 undefined（避免骨架屏卡死）。 */
function itemsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/* ---------- 契约类型（camelCase） ---------- */

export interface SocialLink {
  label: string;
  url: string;
}

/** 站点主题 token（管理端站点设置的只读投影；字段都可能缺省）。 */
export interface SiteTheme {
  schemaVersion?: number;
  colors?: Partial<{
    background: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    primary: string;
    secondary: string;
    border: string;
  }>;
  shape?: Partial<{ radius: number; borderedCards: boolean }>;
  /** 刊头背景蒙版强度（0-0.95），缺省前端用 0.58。 */
  mastheadOverlay?: number | null;
}

export interface PublicSite {
  siteTitle: string;
  siteDescription: string | null;
  ownerName: string;
  ownerBio: string;
  avatarUrl: string;
  mastheadUrl: string;
  socialLinks: SocialLink[];
  mailEnabled: boolean;
  theme: SiteTheme | null;
  shellLayout: ShellLayout | null;
  /** 动态总数（统计卡使用，独立于动态列表请求）。 */
  dynamicCount?: number;
  /** 首屏背景图池：多张时冷进入随机抽一张并每 8 秒淡切。 */
  heroBackgrounds?: string[];
  /** 首屏语录卡文本；为空时回退 siteDescription。 */
  heroQuote?: string | null;
}

export interface PublicTerm {
  name: string;
  slug: string;
}

export type FeedSort = 'featured' | 'popular' | 'recent';

export interface ArticleSummary {
  /** 既有写端点（view/metrics/like/comments）按 UUID 寻址，需要详情/列表带上 id。 */
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverUrl: string;
  category: PublicTerm | null;
  tags: PublicTerm[];
  publishedAt: string;
  views: number;
  likes: number;
  featured: boolean;
}

export interface ArticleList {
  items: ArticleSummary[];
  page: number;
  totalPages: number;
  total: number;
}

export interface ArticleHeading {
  level: number;
  text: string;
  id: string;
}

export interface ArticleDetail extends ArticleSummary {
  html: string;
  headings: ArticleHeading[];
  updatedAt: string;
  allowComments: boolean;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

export interface PublicComment {
  id: string;
  /** 平铺下发的父评论 id；顶层为 null。 */
  parentId: string | null;
  displayName: string;
  avatarUrl: string;
  website: string | null;
  contentHtml: string;
  createdAt: string;
}

export interface CommentList {
  items: PublicComment[];
  total: number;
}

export interface DynamicItem {
  id: string;
  contentHtml: string;
  mood: string | null;
  mediaUrls: string[];
  likes: number;
  commentCount: number;
  createdAt: string;
}

export interface DynamicList {
  items: DynamicItem[];
  page: number;
  totalPages: number;
  total: number;
}

export interface FriendLinkItem {
  name: string;
  url: string;
  description: string;
  avatarUrl: string;
  host: string;
}

export interface FriendList {
  items: FriendLinkItem[];
}

export interface SearchResults {
  articles: { items: ArticleSummary[]; total: number };
  dynamics: { items: DynamicItem[]; total: number };
}

export interface Hitokoto {
  text: string;
  from: string;
}

/* ---------- 既有写端点响应（snake_case） ---------- */

export interface ArticleMetrics {
  view_count: number;
  like_count: number;
  liked: boolean;
}

export interface DynamicMetrics {
  like_count: number;
  liked: boolean;
}

export interface CommentWrite {
  display_name: string;
  email: string | null;
  website: string | null;
  content: string;
  parent_id?: string | null;
}

export interface SubmittedComment {
  id: string;
  status: string;
}

/* ---------- 公开读端点 ---------- */

export function fetchSite(): Promise<PublicSite> {
  return get('/api/public/site');
}

export interface ArticleQuery {
  sort?: FeedSort;
  category?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export function fetchArticles(query: ArticleQuery = {}): Promise<ArticleList> {
  const params = new URLSearchParams();
  if (query.sort) params.set('sort', query.sort);
  if (query.category) params.set('category', query.category);
  if (query.tag) params.set('tag', query.tag);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const search = params.toString();
  return get<ArticleList>(`/api/public/articles${search ? `?${search}` : ''}`).then((list) => ({
    page: Number(list?.page) || 1,
    totalPages: Number(list?.totalPages) || 1,
    total: Number(list?.total) || 0,
    items: itemsOf<ArticleSummary>(list?.items),
  }));
}

export function fetchArticle(slug: string): Promise<ArticleDetail> {
  return get(`/api/public/articles/${encodeURIComponent(slug)}`);
}

export function fetchArticleComments(slug: string): Promise<CommentList> {
  return get<CommentList>(`/api/public/articles/${encodeURIComponent(slug)}/comments`).then(
    (list) => ({ items: itemsOf<PublicComment>(list?.items), total: Number(list?.total) || 0 }),
  );
}

export function fetchDynamics(page = 1, pageSize = 10): Promise<DynamicList> {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return get<DynamicList>(`/api/public/dynamics?${params.toString()}`).then((list) => ({
    page: Number(list?.page) || page,
    totalPages: Number(list?.totalPages) || 1,
    total: Number(list?.total) || 0,
    items: itemsOf<DynamicItem>(list?.items),
  }));
}

export function fetchDynamicComments(id: string): Promise<CommentList> {
  return get<CommentList>(`/api/public/dynamics/${encodeURIComponent(id)}/comments`).then(
    (list) => ({ items: itemsOf<PublicComment>(list?.items), total: Number(list?.total) || 0 }),
  );
}

export function fetchFriends(): Promise<FriendList> {
  return get<FriendList>('/api/public/friends').then((list) => ({
    items: itemsOf<FriendLinkItem>(list?.items),
  }));
}

export function fetchSearch(q: string, page = 1): Promise<SearchResults> {
  const params = new URLSearchParams({ q });
  if (page > 1) params.set('page', String(page));
  return get<SearchResults>(`/api/public/search?${params.toString()}`).then((results) => ({
    articles: {
      items: itemsOf<ArticleSummary>(results?.articles?.items),
      total: Number(results?.articles?.total) || 0,
    },
    dynamics: {
      items: itemsOf<DynamicItem>(results?.dynamics?.items),
      total: Number(results?.dynamics?.total) || 0,
    },
  }));
}

export function fetchHitokoto(): Promise<Hitokoto> {
  return get('/api/hitokoto');
}

/** 服务端搜索每节固定 10 条/页（SEARCH_LIMIT）。 */
export const SEARCH_PAGE_SIZE = 10;

/* ---------- 既有写端点 ---------- */

export function recordArticleView(id: string): Promise<ArticleMetrics> {
  return send('POST', `/api/articles/${encodeURIComponent(id)}/view`);
}

export function fetchArticleMetrics(id: string): Promise<ArticleMetrics> {
  return get(`/api/articles/${encodeURIComponent(id)}/metrics`);
}

export function likeArticle(id: string): Promise<ArticleMetrics> {
  return send('PUT', `/api/articles/${encodeURIComponent(id)}/like`);
}

export function unlikeArticle(id: string): Promise<ArticleMetrics> {
  return send('DELETE', `/api/articles/${encodeURIComponent(id)}/like`);
}

export function fetchDynamicMetrics(id: string): Promise<DynamicMetrics> {
  return get(`/api/dynamics/${encodeURIComponent(id)}/metrics`);
}

export function likeDynamic(id: string): Promise<DynamicMetrics> {
  return send('POST', `/api/dynamics/${encodeURIComponent(id)}/like`);
}

export function unlikeDynamic(id: string): Promise<DynamicMetrics> {
  return send('DELETE', `/api/dynamics/${encodeURIComponent(id)}/like`);
}

export function submitArticleComment(
  id: string,
  body: CommentWrite,
): Promise<SubmittedComment> {
  return send('POST', `/api/articles/${encodeURIComponent(id)}/comments`, body);
}

export function submitDynamicComment(
  id: string,
  body: CommentWrite,
): Promise<SubmittedComment> {
  return send('POST', `/api/dynamics/${encodeURIComponent(id)}/comments`, body);
}

export function subscribe(
  email: string,
  subscribeArticles: boolean,
  subscribeDynamics: boolean,
): Promise<unknown> {
  return send('POST', '/api/subscriptions', {
    email,
    subscribe_articles: subscribeArticles,
    subscribe_dynamics: subscribeDynamics,
  });
}

export function applyFriendLink(input: {
  name: string;
  url: string;
  email: string;
  description: string | null;
  avatar_url: string | null;
}): Promise<unknown> {
  return send('POST', '/api/friend-link-applications', input);
}
