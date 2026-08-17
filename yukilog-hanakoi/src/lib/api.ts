// ================================
// YukiLog API 调用封装
// 基于后端 RESTful API
// ================================

import type {
  ApiResponse,
  PaginatedData,
  Post,
  PostWithRelations,
  PostListParams,
  CreatePostRequest,
  UpdatePostRequest,
  SearchQuery,
  Theme,
  CreateThemeRequest,
  UpdateThemeRequest,
  Tag,
  CreateTagRequest,
  UpdateTagRequest,
  MergeTagsRequest,
  CommentNode,
  Comment,
  CommentListParams,
  CreateCommentRequest,
  CreateCommentResponse,
  UpdateCommentRequest,
  Link,
  SubmitLinkRequest,
  SubmitLinkResponse,
  UpdateLinkRequest,
  LoginRequest,
  LoginResponse,
  SiteStats,
  Note,
  NoteListParams,
  AdminNoteListParams,
  CreateNoteRequest,
  UpdateNoteRequest,
} from '../types';

import type { getMockResponse as GetMockResponseFn } from './mock-data';
import { API_BASE_URL } from './config';

const API_BASE = API_BASE_URL;

let useMock = import.meta.env.PUBLIC_USE_MOCK === 'true';
let _getMockResponse: typeof GetMockResponseFn | null = null;

/** 按需加载 mock 模块 */
async function loadMock(endpoint: string, options?: RequestInit) {
  if (!_getMockResponse) {
    const mod = await import('./mock-data');
    _getMockResponse = mod.getMockResponse;
  }
  return _getMockResponse(endpoint, options);
}

/**
 * 通用 fetch 封装
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // 如果已知后端不可用，直接走 mock
  if (useMock) {
    const mock = await loadMock(endpoint, options);
    if (mock !== undefined) return mock as T;
    throw new Error(`Mock: 没有匹配的路由 ${endpoint}`);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result: ApiResponse<T> = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'API 请求失败');
    }

    return result.data!;
  } catch (err: any) {
    // 连接被拒 → 自动切换 mock 模式
    if (err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
      console.warn(`[API] 后端不可用，自动切换 Mock 模式`);
      useMock = true;
      const mock = await loadMock(endpoint, options);
      if (mock !== undefined) return mock as T;
    }
    throw err;
  }
}

// ================================
// 文章 API
// ================================

export const postsApi = {
  /**
   * 获取文章列表（支持分页、筛选、排序）
   */
  async list(params?: PostListParams): Promise<PaginatedData<PostWithRelations>> {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<PaginatedData<PostWithRelations>>(`/api/public/posts?${query}`);
  },

  /**
   * 获取文章详情
   */
  async getBySlug(slug: string): Promise<PostWithRelations> {
    return fetchApi<PostWithRelations>(`/api/public/posts/${slug}`);
  },

  /**
   * 增加文章浏览计数（无需返回）
   */
  async incrementView(slug: string): Promise<void> {
    await fetch(`${API_BASE}/api/public/posts/${slug}/view`, {
      method: 'POST',
    });
  },

  /**
   * 全文搜索文章
   * 搜索结果中 title/summary/content 的关键词会被 <mark> 标签包裹
   * content 被截取为关键词附近的摘要
   */
  async search(params: SearchQuery): Promise<PaginatedData<PostWithRelations>> {
    const query = new URLSearchParams({
      q: params.q,
      ...(params.page && { page: String(params.page) }),
      ...(params.page_size && { page_size: String(params.page_size) }),
    }).toString();
    return fetchApi<PaginatedData<PostWithRelations>>(`/api/public/search?${query}`);
  },
};

// ================================
// 主题 API
// ================================

export const themesApi = {
  /**
   * 获取主题列表
   */
  async list(
    sort?: 'post_count' | 'view_count' | 'created_at'
  ): Promise<Theme[]> {
    const query = sort ? `?sort=${sort}` : '';
    return fetchApi<Theme[]>(`/api/public/themes${query}`);
  },

  /**
   * 获取主题详情
   */
  async getBySlug(slug: string): Promise<Theme> {
    return fetchApi<Theme>(`/api/public/themes/${slug}`);
  },

  /**
   * 增加主题浏览计数
   */
  async incrementView(slug: string): Promise<void> {
    await fetch(`${API_BASE}/api/public/themes/${slug}/view`, {
      method: 'POST',
    });
  },
};

// ================================
// 标签 API
// ================================

export const tagsApi = {
  /**
   * 获取标签列表
   */
  async list(
    sort?: 'post_count' | 'view_count' | 'created_at' | 'name'
  ): Promise<Tag[]> {
    const query = sort ? `?sort=${sort}` : '';
    return fetchApi<Tag[]>(`/api/public/tags${query}`);
  },

  /**
   * 获取标签详情
   */
  async getBySlug(slug: string): Promise<Tag> {
    return fetchApi<Tag>(`/api/public/tags/${slug}`);
  },

  /**
   * 增加标签浏览计数
   */
  async incrementView(slug: string): Promise<void> {
    await fetch(`${API_BASE}/api/public/tags/${slug}/view`, {
      method: 'POST',
    });
  },
};

// ================================
// 评论 API
// ================================

export const commentsApi = {
  /**
   * 获取文章评论树（包含所有层级）
   */
  async getPostComments(slug: string): Promise<CommentNode[]> {
    return fetchApi<CommentNode[]>(`/api/public/posts/${slug}/comments`);
  },

  /**
   * 获取某条评论的直接回复列表
   */
  async getCommentReplies(slug: string, id: number): Promise<Comment[]> {
    return fetchApi<Comment[]>(`/api/public/posts/${slug}/comments/${id}`);
  },

  /**
   * 提交评论
   */
  async submit(
    slug: string,
    data: CreateCommentRequest
  ): Promise<CreateCommentResponse> {
    return fetchApi<CreateCommentResponse>(
      `/api/public/posts/${slug}/comments`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },
};

// ================================
// 友链 API
// ================================

export const linksApi = {
  /**
   * 获取友链列表（仅显示 active 状态）
   */
  async list(): Promise<Link[]> {
    return fetchApi<Link[]>('/api/public/links');
  },

  /**
   * 提交友链申请
   */
  async submit(data: SubmitLinkRequest): Promise<SubmitLinkResponse> {
    return fetchApi<SubmitLinkResponse>('/api/public/links/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ================================
// 站点统计 API
// ================================

export const statsApi = {
  /**
   * 获取站点统计数据（文章总数、总浏览量、总字数）
   */
  async get(): Promise<SiteStats> {
    return fetchApi<SiteStats>('/api/public/stats');
  },
};

// ================================
// 随记 API
// ================================

export const notesApi = {
  /**
   * 获取随记列表（分页，仅已发布）
   */
  async list(params?: NoteListParams): Promise<PaginatedData<Note>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    const qs = query.toString();
    return fetchApi<PaginatedData<Note>>(`/api/public/notes${qs ? `?${qs}` : ''}`);
  },

  /**
   * 获取随记详情（仅已发布）
   */
  async getById(id: number): Promise<Note> {
    return fetchApi<Note>(`/api/public/notes/${id}`);
  },
};

// ================================
// 认证 API（管理端）
// ================================

export const authApi = {
  /**
   * 管理员登录
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    return fetchApi<LoginResponse>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ================================
// 管理端 API（需要 JWT）
// ================================

/**
 * 创建带 JWT 的请求配置
 */
function createAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('yukilog_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export const adminApi = {
  // ===== 文章管理 =====
  posts: {
    async list(params?: PostListParams): Promise<PaginatedData<PostWithRelations>> {
      const query = new URLSearchParams(params as any).toString();
      const headers = createAuthHeaders();
      return fetchApi<PaginatedData<PostWithRelations>>(`/api/admin/posts?${query}`, { headers });
    },
    
    async getBySlug(slug: string): Promise<PostWithRelations> {
      const headers = createAuthHeaders();
      return fetchApi<PostWithRelations>(`/api/admin/posts/${slug}`, { headers });
    },
    
    async create(data: CreatePostRequest): Promise<Post> {
      const headers = createAuthHeaders();
      return fetchApi<Post>('/api/admin/posts', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async update(slug: string, data: UpdatePostRequest): Promise<Post> {
      const headers = createAuthHeaders();
      return fetchApi<Post>(`/api/admin/posts/${slug}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async delete(slug: string): Promise<void> {
      const headers = createAuthHeaders();
      await fetchApi<void>(`/api/admin/posts/${slug}`, {
        method: 'DELETE',
        headers,
      });
    },
  },

  // ===== 评论管理 =====
  comments: {
    async list(params?: CommentListParams): Promise<PaginatedData<Comment>> {
      const query = params ? new URLSearchParams(params as any).toString() : '';
      const headers = createAuthHeaders();
      return fetchApi<PaginatedData<Comment>>(`/api/admin/comments?${query}`, { headers });
    },
    
    async pending(): Promise<Comment[]> {
      const headers = createAuthHeaders();
      return fetchApi<Comment[]>('/api/admin/comments/pending', { headers });
    },
    
    async approve(id: number): Promise<Comment> {
      const headers = createAuthHeaders();
      return fetchApi<Comment>(`/api/admin/comments/${id}/approve`, {
        method: 'PUT',
        headers,
      });
    },
    
    async reject(id: number): Promise<void> {
      const headers = createAuthHeaders();
      await fetchApi<void>(`/api/admin/comments/${id}/reject`, {
        method: 'PUT',
        headers,
      });
    },
    
    async update(id: number, data: UpdateCommentRequest): Promise<Comment> {
      const headers = createAuthHeaders();
      return fetchApi<Comment>(`/api/admin/comments/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: number): Promise<void> {
      const headers = createAuthHeaders();
      await fetchApi<void>(`/api/admin/comments/${id}`, {
        method: 'DELETE',
        headers,
      });
    },
  },

  // ===== 主题管理 =====
  themes: {
    async create(data: CreateThemeRequest): Promise<Theme> {
      const headers = createAuthHeaders();
      return fetchApi<Theme>('/api/admin/themes', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async update(id: number, data: UpdateThemeRequest): Promise<Theme> {
      const headers = createAuthHeaders();
      return fetchApi<Theme>(`/api/admin/themes/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: number): Promise<void> {
      const headers = createAuthHeaders();
      await fetchApi<void>(`/api/admin/themes/${id}`, {
        method: 'DELETE',
        headers,
      });
    },
  },

  // ===== 标签管理 =====
  tags: {
    async create(data: CreateTagRequest): Promise<Tag> {
      const headers = createAuthHeaders();
      return fetchApi<Tag>('/api/admin/tags', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async update(id: number, data: UpdateTagRequest): Promise<Tag> {
      const headers = createAuthHeaders();
      return fetchApi<Tag>(`/api/admin/tags/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: number): Promise<void> {
      const headers = createAuthHeaders();
      await fetchApi<void>(`/api/admin/tags/${id}`, {
        method: 'DELETE',
        headers,
      });
    },
    
    async merge(data: MergeTagsRequest): Promise<Tag> {
      const headers = createAuthHeaders();
      return fetchApi<Tag>('/api/admin/tags/merge', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
    },
  },

  // ===== 友链管理 =====
  links: {
    async list(): Promise<Link[]> {
      const headers = createAuthHeaders();
      return fetchApi<Link[]>('/api/admin/links', { headers });
    },

    async create(data: SubmitLinkRequest): Promise<Link> {
      const headers = createAuthHeaders();
      return fetchApi<Link>('/api/admin/links', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async pending(): Promise<Link[]> {
      const headers = createAuthHeaders();
      return fetchApi<Link[]>('/api/admin/links/pending', { headers });
    },
    
    async approve(id: number): Promise<Link> {
      const headers = createAuthHeaders();
      return fetchApi<Link>(`/api/admin/links/${id}/approve`, {
        method: 'PUT',
        headers,
      });
    },
    
    async markBroken(id: number): Promise<Link> {
      const headers = createAuthHeaders();
      return fetchApi<Link>(`/api/admin/links/${id}/broken`, {
        method: 'PUT',
        headers,
      });
    },
    
    async update(id: number, data: UpdateLinkRequest): Promise<Link> {
      const headers = createAuthHeaders();
      return fetchApi<Link>(`/api/admin/links/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: number): Promise<void> {
      const headers = createAuthHeaders();
      await fetchApi<void>(`/api/admin/links/${id}`, {
        method: 'DELETE',
        headers,
      });
    },
  },

  // ===== 随记管理 =====
  notes: {
    async list(params?: AdminNoteListParams): Promise<PaginatedData<Note>> {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.page_size) query.set('page_size', String(params.page_size));
      if (params?.status) query.set('status', params.status);
      const qs = query.toString();
      const headers = createAuthHeaders();
      return fetchApi<PaginatedData<Note>>(`/api/admin/notes${qs ? `?${qs}` : ''}`, { headers });
    },

    async create(data: CreateNoteRequest): Promise<Note> {
      const headers = createAuthHeaders();
      return fetchApi<Note>('/api/admin/notes', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
    },

    async update(id: number, data: UpdateNoteRequest): Promise<Note> {
      const headers = createAuthHeaders();
      return fetchApi<Note>(`/api/admin/notes/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
    },

    async delete(id: number): Promise<void> {
      const headers = createAuthHeaders();
      await fetchApi<void>(`/api/admin/notes/${id}`, {
        method: 'DELETE',
        headers,
      });
    },
  },
};
