import * as api from './api.js';
import { fallbackQuote, type LocalQuote } from './quotes.js';

// 公开站数据层：每个视图一片 Slice（status/data/error），组件订阅后按 Slice 渲染
// 骨架屏、错误重试与真实内容。所有加载都做了去重与竞态丢弃（后发的请求覆盖先发的）。

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Slice<T> {
  status: LoadStatus;
  data: T | null;
  error: string | null;
  notFound: boolean;
}

function fresh<T>(): Slice<T> {
  return { status: 'idle', data: null, error: null, notFound: false };
}

export interface DynamicsState {
  items: api.DynamicItem[];
  page: number;
  totalPages: number;
  total: number;
}

export interface SiteStats {
  articles: number | null;
  dynamics: number | null;
  friends: number | null;
  views: number | null;
}

export const HOME_FEED_SIZE = 5;
export const ARCHIVE_PAGE_SIZE = 12;
export const DYNAMICS_PAGE_SIZE = 10;

export class PublicStore {
  private readonly listeners = new Set<() => void>();
  private readonly generation = new Map<string, number>();

  site: Slice<api.PublicSite> = fresh();
  hitokoto: Slice<api.Hitokoto> = fresh();
  friends: Slice<api.FriendLinkItem[]> = fresh();
  dynamics: Slice<DynamicsState> = fresh();
  archive: Slice<api.ArticleList> & { key: string } = { ...fresh(), key: '' };
  search: Slice<api.SearchResults> & { key: string } = { ...fresh(), key: '' };
  facets: Slice<api.ArticleList> = fresh();
  readonly homeFeeds = new Map<api.FeedSort, Slice<api.ArticleList>>();
  readonly articlesBySlug = new Map<string, Slice<api.ArticleDetail>>();
  readonly commentsByTarget = new Map<string, Slice<api.CommentList>>();
  readonly articleMetrics = new Map<string, api.ArticleMetrics>();
  readonly dynamicMetrics = new Map<string, api.DynamicMetrics>();
  readonly likeBusy = new Set<string>();
  private readonly viewsRecorded = new Set<string>();
  private readonly metricsLoading = new Set<string>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  /** 竞态守卫：同一 key 只认最后一次发起的结果。 */
  private begin(key: string): number {
    const gen = (this.generation.get(key) ?? 0) + 1;
    this.generation.set(key, gen);
    return gen;
  }

  private current(key: string, gen: number): boolean {
    return this.generation.get(key) === gen;
  }

  private async run<T>(key: string, slice: Slice<T>, task: () => Promise<T>): Promise<T | null> {
    const gen = this.begin(key);
    slice.status = 'loading';
    slice.error = null;
    slice.notFound = false;
    this.notify();
    try {
      const data = await task();
      if (!this.current(key, gen)) return null;
      slice.data = data;
      slice.status = 'ready';
      this.notify();
      return data;
    } catch (error) {
      if (!this.current(key, gen)) return null;
      slice.status = 'error';
      slice.error = api.errorMessage(error);
      slice.notFound = api.isNotFound(error);
      this.notify();
      return null;
    }
  }

  /* ---------- 站点与一言 ---------- */

  ensureSite(force = false) {
    if (!force && (this.site.status === 'loading' || this.site.status === 'ready')) return;
    void this.run('site', this.site, () => api.fetchSite());
  }

  ensureHitokoto(force = false) {
    if (!force && (this.hitokoto.status === 'loading' || this.hitokoto.status === 'ready')) {
      return;
    }
    // 一言失败不打扰阅读：静默回退本地句库
    void this.run('hitokoto', this.hitokoto, () => api.fetchHitokoto()).then((data) => {
      if (data === null && this.hitokoto.status === 'error') {
        this.hitokoto.status = 'ready';
        this.hitokoto.error = null;
        this.notify();
      }
    });
  }

  hitokotoQuote(): LocalQuote {
    const data = this.hitokoto.data;
    if (data && data.text) return { text: data.text, from: data.from ?? '' };
    return fallbackQuote();
  }

  /* ---------- 首页 ---------- */

  homeFeed(sort: api.FeedSort): Slice<api.ArticleList> {
    let slice = this.homeFeeds.get(sort);
    if (!slice) {
      slice = fresh();
      this.homeFeeds.set(sort, slice);
    }
    return slice;
  }

  loadHomeFeed(sort: api.FeedSort, force = false) {
    const slice = this.homeFeed(sort);
    if (!force && (slice.status === 'loading' || slice.status === 'ready')) return;
    void this.run(`home:${sort}`, slice, () =>
      api.fetchArticles({ sort, pageSize: HOME_FEED_SIZE }),
    );
  }

  /* ---------- 文章列表 / 筛选 ---------- */

  loadArchive(
    query: { page?: number; category?: string; tag?: string },
    force = false,
  ): void {
    const key = JSON.stringify({
      page: query.page ?? 1,
      category: query.category ?? '',
      tag: query.tag ?? '',
    });
    if (!force && this.archive.key === key && this.archive.status !== 'error') {
      if (this.archive.status === 'loading' || this.archive.status === 'ready') return;
    }
    this.archive.key = key;
    void this.run(`archive`, this.archive, () =>
      api.fetchArticles({
        page: query.page ?? 1,
        pageSize: ARCHIVE_PAGE_SIZE,
        category: query.category || undefined,
        tag: query.tag || undefined,
      }),
    );
  }

  /** 搜索页的筛选 chips 来源：近期文章里出现过的分类与标签。 */
  loadFacets(force = false) {
    if (!force && (this.facets.status === 'loading' || this.facets.status === 'ready')) return;
    void this.run('facets', this.facets, () =>
      api.fetchArticles({ sort: 'recent', pageSize: 20 }),
    );
  }

  /* ---------- 文章详情 ---------- */

  article(slug: string): Slice<api.ArticleDetail> {
    let slice = this.articlesBySlug.get(slug);
    if (!slice) {
      slice = fresh();
      this.articlesBySlug.set(slug, slice);
    }
    return slice;
  }

  loadArticle(slug: string, force = false) {
    const slice = this.article(slug);
    if (!force && (slice.status === 'loading' || slice.status === 'ready')) return;
    void this.run(`article:${slug}`, slice, () => api.fetchArticle(slug)).then((detail) => {
      if (!detail) return;
      this.loadArticleComments(slug);
      if (!detail.id) {
        // 契约之外的安全网：写端点按 UUID 寻址，详情缺少 id 时跳过计数/点赞。
        return;
      }
      if (this.viewsRecorded.has(slug)) {
        void this.refreshArticleMetrics(slug, detail.id);
      } else {
        this.viewsRecorded.add(slug);
        void api
          .recordArticleView(detail.id)
          .then((metrics) => this.setArticleMetrics(slug, metrics))
          .catch(() => this.refreshArticleMetrics(slug, detail.id));
      }
    });
  }

  private refreshArticleMetrics(slug: string, id: string) {
    void api
      .fetchArticleMetrics(id)
      .then((metrics) => this.setArticleMetrics(slug, metrics))
      .catch(() => undefined);
  }

  private setArticleMetrics(slug: string, metrics: api.ArticleMetrics) {
    this.articleMetrics.set(slug, metrics);
    this.notify();
  }

  async toggleArticleLike(slug: string): Promise<void> {
    const detail = this.articlesBySlug.get(slug)?.data;
    if (!detail?.id || this.likeBusy.has(slug)) return;
    const current = this.articleMetrics.get(slug);
    this.likeBusy.add(slug);
    this.notify();
    try {
      const metrics = current?.liked
        ? await api.unlikeArticle(detail.id)
        : await api.likeArticle(detail.id);
      this.setArticleMetrics(slug, metrics);
    } catch {
      // 失败保持原样（与 SSR 行为一致）
    } finally {
      this.likeBusy.delete(slug);
      this.notify();
    }
  }

  /* ---------- 评论 ---------- */

  comments(target: string): Slice<api.CommentList> {
    let slice = this.commentsByTarget.get(target);
    if (!slice) {
      slice = fresh();
      this.commentsByTarget.set(target, slice);
    }
    return slice;
  }

  loadArticleComments(slug: string, force = false) {
    const target = `article:${slug}`;
    const slice = this.comments(target);
    if (!force && (slice.status === 'loading' || slice.status === 'ready')) return;
    void this.run(`comments:${target}`, slice, () => api.fetchArticleComments(slug));
  }

  loadDynamicComments(id: string, force = false) {
    const target = `dynamic:${id}`;
    const slice = this.comments(target);
    if (!force && (slice.status === 'loading' || slice.status === 'ready')) return;
    void this.run(`comments:${target}`, slice, () => api.fetchDynamicComments(id));
  }

  /* ---------- 动态 ---------- */

  loadDynamics(page = 1, force = false): void {
    const state = this.dynamics;
    if (page === 1) {
      if (!force && (state.status === 'loading' || state.status === 'ready')) return;
      void this.run('dynamics', state, async () => {
        const list = await api.fetchDynamics(1, DYNAMICS_PAGE_SIZE);
        return { items: list.items, page: list.page, totalPages: list.totalPages, total: list.total };
      });
      return;
    }
    if (state.status === 'loading' || !state.data || page <= state.data.page) return;
    const gen = this.begin('dynamics');
    state.status = 'loading';
    state.error = null;
    this.notify();
    api
      .fetchDynamics(page, DYNAMICS_PAGE_SIZE)
      .then((list) => {
        if (!this.current('dynamics', gen)) return;
        const known = new Set(state.data!.items.map((item) => item.id));
        state.data = {
          items: [...state.data!.items, ...list.items.filter((item) => !known.has(item.id))],
          page: list.page,
          totalPages: list.totalPages,
          total: list.total,
        };
        state.status = 'ready';
        this.notify();
      })
      .catch((error) => {
        if (!this.current('dynamics', gen)) return;
        state.status = 'error';
        state.error = api.errorMessage(error);
        this.notify();
      });
  }

  loadDynamicMetrics(id: string) {
    if (this.dynamicMetrics.has(id) || this.metricsLoading.has(id)) return;
    this.metricsLoading.add(id);
    void api
      .fetchDynamicMetrics(id)
      .then((metrics) => {
        this.dynamicMetrics.set(id, metrics);
        this.notify();
      })
      .catch(() => undefined)
      .finally(() => this.metricsLoading.delete(id));
  }

  async toggleDynamicLike(id: string): Promise<void> {
    if (this.likeBusy.has(id)) return;
    const current = this.dynamicMetrics.get(id);
    this.likeBusy.add(id);
    this.notify();
    try {
      const metrics = current?.liked ? await api.unlikeDynamic(id) : await api.likeDynamic(id);
      this.dynamicMetrics.set(id, metrics);
    } catch {
      // 失败保持原样
    } finally {
      this.likeBusy.delete(id);
      this.notify();
    }
  }

  /* ---------- 友链 / 搜索 ---------- */

  ensureFriends(force = false) {
    if (!force && (this.friends.status === 'loading' || this.friends.status === 'ready')) return;
    void this.run('friends', this.friends, async () => (await api.fetchFriends()).items);
  }

  loadSearch(q: string, page = 1, force = false) {
    const key = JSON.stringify({ q, page });
    if (!force && this.search.key === key) {
      if (this.search.status === 'loading' || this.search.status === 'ready') return;
    }
    this.search.key = key;
    void this.run('search', this.search, () => api.fetchSearch(q, page));
  }

  /* ---------- 派生统计 ---------- */

  get stats(): SiteStats {
    const home = this.homeFeeds.get('featured')?.data ?? this.homeFeeds.get('recent')?.data;
    return {
      articles: home?.total ?? (this.archive.status === 'ready' ? this.archive.data?.total : null) ?? null,
      // 动态数优先用站点接口的 dynamicCount，与动态列表请求解耦
      dynamics: this.site.data?.dynamicCount ?? this.dynamics.data?.total ?? null,
      friends: this.friends.data?.length ?? null,
      views: null,
    };
  }
}
