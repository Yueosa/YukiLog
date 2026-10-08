import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicStore } from './store.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(handler(String(input), init)),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PublicStore', () => {
  it('loads site data once and dedupes concurrent calls', async () => {
    const calls: string[] = [];
    stubFetch((url) => {
      calls.push(url);
      return jsonResponse(200, {
        siteTitle: 'YukiLog',
        siteDescription: '',
        ownerName: '恋',
        ownerBio: '',
        avatarUrl: '',
        mastheadUrl: '',
        socialLinks: [],
        mailEnabled: false,
        theme: null,
        shellLayout: null,
      });
    });
    const store = new PublicStore();
    store.ensureSite();
    store.ensureSite();
    await vi.waitFor(() => expect(store.site.status).toBe('ready'));
    store.ensureSite();
    expect(calls).toEqual(['/api/public/site']);
    expect(store.site.data?.ownerName).toBe('恋');
  });

  it('marks 404 article responses as notFound', async () => {
    stubFetch((url) => {
      if (url.includes('/api/public/articles/missing')) {
        return jsonResponse(404, { code: 'not_found', message: '文章不存在' });
      }
      return jsonResponse(200, {});
    });
    const store = new PublicStore();
    store.loadArticle('missing');
    await vi.waitFor(() => expect(store.article('missing').status).toBe('error'));
    expect(store.article('missing').notFound).toBe(true);
  });

  it('records a view once per slug and adopts returned metrics', async () => {
    const calls: string[] = [];
    stubFetch((url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/public/articles/wind') {
        return jsonResponse(200, {
          id: 'art-1',
          slug: 'wind',
          title: '晚风',
          summary: '',
          coverUrl: '',
          category: null,
          tags: [],
          publishedAt: '2026-10-04T00:00:00+08:00',
          views: 10,
          likes: 2,
          featured: false,
          html: '<p>正文</p>',
          headings: [],
          updatedAt: '2026-10-04T00:00:00+08:00',
          allowComments: true,
          prev: null,
          next: null,
        });
      }
      if (url === '/api/public/articles/wind/comments') {
        return jsonResponse(200, { items: [], total: 0 });
      }
      if (url === '/api/articles/art-1/view') {
        return jsonResponse(200, { view_count: 11, like_count: 2, liked: false });
      }
      return jsonResponse(404, { code: 'not_found', message: 'missing' });
    });
    const store = new PublicStore();
    store.loadArticle('wind');
    await vi.waitFor(() => expect(store.articleMetrics.get('wind')?.view_count).toBe(11));
    const viewCalls = calls.filter((call) => call === 'POST /api/articles/art-1/view');
    expect(viewCalls).toHaveLength(1);
    // 再次进入同一文章：只刷新 metrics，不再重复记 view
    store.loadArticle('wind', true);
    await vi.waitFor(() =>
      expect(calls.filter((call) => call === 'GET /api/articles/art-1/metrics').length).toBe(1),
    );
    expect(calls.filter((call) => call === 'POST /api/articles/art-1/view')).toHaveLength(1);
  });

  it('appends dynamics pages without duplicating items', async () => {
    stubFetch((url) => {
      const page = Number(new URL(url, 'http://x').searchParams.get('page') ?? '1');
      return jsonResponse(200, {
        items: [
          {
            id: `dyn-${page}`,
            contentHtml: '<p>片刻</p>',
            mood: null,
            mediaUrls: [],
            likes: 1,
            commentCount: 0,
            createdAt: '2026-10-04T00:00:00+08:00',
          },
        ],
        page,
        totalPages: 2,
        total: 2,
      });
    });
    const store = new PublicStore();
    store.loadDynamics(1);
    await vi.waitFor(() => expect(store.dynamics.status).toBe('ready'));
    store.loadDynamics(2);
    await vi.waitFor(() => expect(store.dynamics.data?.page).toBe(2));
    expect(store.dynamics.data?.items.map((item) => item.id)).toEqual(['dyn-1', 'dyn-2']);
  });

  it('falls back to a local quote when hitokoto fails', async () => {
    stubFetch(() => jsonResponse(502, { code: 'bad_gateway', message: 'down' }));
    const store = new PublicStore();
    store.ensureHitokoto();
    await vi.waitFor(() => expect(store.hitokoto.status).toBe('ready'));
    expect(store.hitokotoQuote().text.length).toBeGreaterThan(0);
  });

  it('toggles article likes through the legacy endpoints', async () => {
    const calls: string[] = [];
    stubFetch((url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/public/articles/wind') {
        return jsonResponse(200, {
          id: 'art-1',
          slug: 'wind',
          title: '晚风',
          summary: '',
          coverUrl: '',
          category: null,
          tags: [],
          publishedAt: '2026-10-04T00:00:00+08:00',
          views: 10,
          likes: 2,
          featured: false,
          html: '<p>正文</p>',
          headings: [],
          updatedAt: '2026-10-04T00:00:00+08:00',
          allowComments: false,
          prev: null,
          next: null,
        });
      }
      if (url.endsWith('/comments')) return jsonResponse(200, { items: [], total: 0 });
      if (url.endsWith('/view') || url.endsWith('/metrics')) {
        return jsonResponse(200, { view_count: 10, like_count: 2, liked: false });
      }
      if (url.endsWith('/like')) {
        return jsonResponse(200, { view_count: 10, like_count: 3, liked: true });
      }
      return jsonResponse(404, { code: 'not_found', message: 'missing' });
    });
    const store = new PublicStore();
    store.loadArticle('wind');
    await vi.waitFor(() => expect(store.article('wind').status).toBe('ready'));
    await store.toggleArticleLike('wind');
    expect(calls).toContain('PUT /api/articles/art-1/like');
    expect(store.articleMetrics.get('wind')?.liked).toBe(true);
  });

  it('marks series chapters as read and loads the series detail', async () => {
    stubFetch((url) => {
      if (url === '/api/public/articles/c1') {
        return jsonResponse(200, {
          id: 'art-c1',
          slug: 'c1',
          title: '第一章',
          summary: '',
          coverUrl: '',
          category: null,
          tags: [],
          publishedAt: '2026-10-04T00:00:00+08:00',
          views: 1,
          likes: 0,
          featured: false,
          html: '<p>正文</p>',
          headings: [],
          updatedAt: '2026-10-04T00:00:00+08:00',
          allowComments: true,
          prev: null,
          next: null,
          series: {
            slug: 'shells',
            name: '贝壳的故事',
            order: 0,
            total: 2,
            prev: null,
            next: { slug: 'c2', title: '第二章', seriesTitle: '价格' },
          },
        });
      }
      if (url === '/api/public/articles/c1/comments') {
        return jsonResponse(200, { items: [], total: 0 });
      }
      if (url === '/api/public/series/shells') {
        return jsonResponse(200, {
          slug: 'shells',
          name: '贝壳的故事',
          description: null,
          coverUrl: null,
          chapters: [],
        });
      }
      if (url.endsWith('/view') || url.endsWith('/metrics')) {
        return jsonResponse(200, { view_count: 2, like_count: 0, liked: false });
      }
      return jsonResponse(404, { code: 'not_found', message: 'missing' });
    });
    const store = new PublicStore();
    store.loadArticle('c1');
    await vi.waitFor(() => expect(store.article('c1').status).toBe('ready'));
    expect(store.seriesRead.shells).toEqual(['c1']);
    await vi.waitFor(() => expect(store.seriesDetail('shells').status).toBe('ready'));
    // 重复打开不重复记录
    store.markSeriesRead('shells', 'c1');
    expect(store.seriesRead.shells).toEqual(['c1']);
  });
});
