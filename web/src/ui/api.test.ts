import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  applyFriendLink,
  errorMessage,
  fetchArticles,
  fetchDynamics,
  isNotFound,
  submitArticleComment,
  subscribe,
} from './api.js';

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api request wrapper', () => {
  it('builds article list query strings from set params only', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return mockResponse(200, { items: [], page: 2, totalPages: 5, total: 48 });
      }),
    );
    await fetchArticles({ sort: 'popular', tag: 'night', page: 2, pageSize: 12 });
    expect(calls[0]).toBe('/api/public/articles?sort=popular&tag=night&page=2&pageSize=12');
    await fetchArticles({});
    expect(calls[1]).toBe('/api/public/articles');
  });

  it('unwraps server error bodies into ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockResponse(404, { code: 'not_found', message: '文章不存在' })),
    );
    const error = await fetchArticles({}).catch((caught: unknown) => caught);
    expect(isNotFound(error)).toBe(true);
    expect(errorMessage(error)).toBe('文章不存在');
  });

  it('reports network failures with a friendly message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const error = await fetchArticles({}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect(errorMessage(error)).toBe('网络异常，请稍后再试。');
  });

  it('posts snake_case comment bodies to the legacy endpoint', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return mockResponse(200, { id: 'c-1', status: 'pending' });
      }),
    );
    await submitArticleComment('art-1', {
      display_name: '远岸',
      email: null,
      website: 'https://yeastar.xin',
      content: '欢迎回来。',
      parent_id: 'c-0',
    });
    expect(calls[0].url).toBe('/api/articles/art-1/comments');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      display_name: '远岸',
      website: 'https://yeastar.xin',
      parent_id: 'c-0',
    });
  });

  it('normalizes malformed list responses to empty items instead of undefined', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(200, { page: 1 })));
    const list = await fetchDynamics(1);
    expect(list.items).toEqual([]);
    expect(list.totalPages).toBe(1);
  });

  it('posts subscription and friend-link payloads to their legacy endpoints', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? '{}')) });
        return mockResponse(200, { status: 'pending' });
      }),
    );
    await subscribe('a@b.co', true, false);
    expect(calls[0].url).toBe('/api/subscriptions');
    expect(calls[0].body).toMatchObject({
      email: 'a@b.co',
      subscribe_articles: true,
      subscribe_dynamics: false,
    });
    await applyFriendLink({
      name: '星港',
      url: 'https://yeastar.xin',
      email: 'a@b.co',
      description: null,
      avatar_url: null,
    });
    expect(calls[1].url).toBe('/api/friend-link-applications');
    expect(calls[1].body).toMatchObject({ name: '星港', url: 'https://yeastar.xin' });
  });
});
