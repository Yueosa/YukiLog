// ================================
// YukiLog 后端 API 响应类型
// 对应后端统一响应格式
// ================================

/**
 * 后端统一响应格式
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
}

/**
 * 分页数据响应
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ================================
// 主题（Themes）
// ================================

export interface Theme {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  post_count: number;
  view_count: number;
  created_at: string;
}

// ================================
// 标签（Tags）
// ================================

export interface Tag {
  id: number;
  name: string;
  slug: string;
  post_count: number;
  view_count: number;
  created_at: string;
}

// ================================
// 文章（Posts）
// ================================

export type PostStatus = 'draft' | 'published';

export interface Post {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  cover_image: string | null;
  status: PostStatus;
  is_featured: boolean;
  theme_id: number | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 文章（含关联数据）
 */
export interface PostWithRelations {
  post: Post;
  theme: Theme | null;
  tags: Tag[];
}

/**
 * 创建文章请求体
 */
export interface CreatePostRequest {
  title: string;
  slug: string;
  content: string;
  summary?: string | null;
  cover_image?: string | null;
  status: PostStatus;
  is_featured?: boolean;
  theme_slug?: string | null;
  tag_slugs: string[];  // 必填，无标签时传空数组 []
}

/**
 * 更新文章请求体
 */
export interface UpdatePostRequest {
  title?: string;
  slug?: string;
  content?: string;
  summary?: string | null;
  cover_image?: string | null;
  status?: PostStatus;
  is_featured?: boolean;
  theme_slug?: string | null;
  tag_slugs?: string[];
}

/**
 * 文章列表查询参数
 */
export interface PostListParams {
  page?: number;
  page_size?: number;
  sort?: 'created_at' | 'updated_at' | 'view_count';
  status?: PostStatus; // 仅管理端使用
  theme_slugs?: string;  // 逗号分隔
  tag_slugs?: string;    // 逗号分隔，AND 关系
  is_featured?: boolean;
}

// ================================
// 评论（Comments）
// ================================

export type CommentStatus = 'approved' | 'pending' | 'spam';

export interface Comment {
  id: number;
  post_id: number;
  content: string;
  guest_nick: string;
  guest_website: string | null;
  parent_id: number | null;
  root_id: number | null;
  status: CommentStatus;
  visitor_info: string | null;
  avatar_url?: string | null;
  created_at: string;
  /** 仅管理端返回 */
  guest_email?: string | null;
  ip?: string | null;
  ua?: string | null;
  post_title?: string;
  post_slug?: string;
}

/**
 * 评论树节点（包含子评论）
 */
export interface CommentNode {
  comment: Comment;
  children: CommentNode[];
}

/**
 * 创建评论请求体
 */
export interface CreateCommentRequest {
  nickname: string;
  email: string;
  content: string;
  parent_id?: number | null;
  website?: string | null;
}

/**
 * 创建评论响应
 */
export interface CreateCommentResponse {
  id: number;
  created_at: string;
}

/**
 * 更新评论请求体（管理端）
 */
export interface UpdateCommentRequest {
  content?: string;
  guest_nick?: string;
  guest_email?: string;
  guest_website?: string | null;
}

/**
 * 评论列表查询参数（管理端）
 */
export interface CommentListParams {
  page?: number;
  page_size?: number;
  sort?: 'created_at_asc' | 'created_at_desc';
  post_slug?: string;
  status?: CommentStatus;
}

// ================================
// 友链（Links）
// ================================

export type LinkStatus = 'active' | 'pending' | 'broken';

export interface Link {
  id: number;
  title: string;
  url: string;
  avatar: string | null;
  description: string | null;
  status: LinkStatus;
  created_at: string;
}

/**
 * 提交友链请求体
 */
export interface SubmitLinkRequest {
  title: string;
  url: string;
  avatar?: string | null;
  description?: string | null;
}

/**
 * 提交友链响应
 */
export interface SubmitLinkResponse {
  id: number;
  message: string;
}

/**
 * 更新友链请求体（管理端）
 */
export interface UpdateLinkRequest {
  title?: string;
  url?: string;
  avatar?: string | null;
  description?: string | null;
}

// ================================
// 认证（Auth）
// ================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires_in: number; // 秒
}

// ================================
// 搜索（Search）
// ================================

/**
 * 搜索查询参数
 */
export interface SearchQuery {
  q: string;
  page?: number;
  page_size?: number;
}

/**
 * 搜索响应 = PaginatedData<PostWithRelations>
 * 特殊说明：搜索结果中的 content 是高亮摘要（非完整内容），
 * title 和 summary 中的关键词被 <mark> 标签包裹。
 */
export type SearchResponse = PaginatedData<PostWithRelations>;

// ================================
// 管理端 DTO（Admin）
// ================================

/**
 * 创建主题请求体
 */
export interface CreateThemeRequest {
  name: string;
  slug: string;
  description?: string | null;
}

/**
 * 更新主题请求体
 */
export interface UpdateThemeRequest {
  name?: string;
  slug?: string;
  description?: string | null;
}

/**
 * 创建标签请求体
 */
export interface CreateTagRequest {
  name: string;
  slug: string;
}

/**
 * 更新标签请求体
 */
export interface UpdateTagRequest {
  name?: string;
  slug?: string;
}

/**
 * 合并标签请求体
 */
export interface MergeTagsRequest {
  source_id: number;
  target_id: number;
}

// ================================
// 随记（Notes）
// ================================

export type NoteStatus = 'published' | 'draft' | 'private';

export interface Note {
  id: number;
  content: string;
  mood: string | null;
  status: NoteStatus;
  created_at: string;
  updated_at: string;
}

/**
 * 随记列表查询参数（前台）
 */
export interface NoteListParams {
  page?: number;
  page_size?: number;
}

/**
 * 随记列表查询参数（管理端）
 */
export interface AdminNoteListParams {
  page?: number;
  page_size?: number;
  status?: NoteStatus;
}

/**
 * 创建随记请求体
 */
export interface CreateNoteRequest {
  content: string;
  mood?: string | null;
  status?: string | null;
}

/**
 * 更新随记请求体
 */
export interface UpdateNoteRequest {
  content?: string;
  mood?: string | null;
  status?: string;
}

// ================================
// 站点统计（Site Stats）
// ================================

/**
 * 站点统计数据
 */
export interface SiteStats {
  /** 已发布文章总数 */
  total_posts: number;
  /** 所有文章浏览量总和 */
  total_views: number;
  /** 所有文章内容字符总长度 */
  total_words: number;
}
