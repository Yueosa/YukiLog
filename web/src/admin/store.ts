import { api, ApiError } from './api.js';
import {
  previewAdmin,
  previewArticles,
  previewCategories,
  previewComments,
  previewDeliveries,
  previewDynamics,
  previewFriends,
  previewLayouts,
  previewMedia,
  previewNotificationSettings,
  previewNotifications,
  previewOverview,
  previewSettings,
  previewSubscribers,
  previewTags,
} from './preview.js';
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

export const defaultSettings: SiteSettings = {
  siteTitle: 'YukiLog',
  siteDescription: '',
  ownerName: 'Sakurine',
  ownerBio: '',
  avatarMediaId: null,
  avatarExternalUrl: null,
  mastheadMediaId: null,
  socialLinks: [],
  theme: {
    schemaVersion: 1,
    colors: {
      background: '#f7f8f7',
      surface: '#ffffff',
      surfaceMuted: '#eef2f5',
      text: '#1c2733',
      textMuted: '#6d7f90',
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

export type Toast = { id: number; kind: 'ok' | 'err' | 'info'; message: string };

export type ModalField = { name: string; label: string; value?: string; type?: string; required?: boolean };

export type ModalRequest = {
  title: string;
  message?: string;
  danger?: boolean;
  confirmLabel?: string;
  fields?: ModalField[];
  resolve: (value: Record<string, string> | null) => void;
};

/**
 * 管理端数据中心。视图组件订阅 'change' 事件刷新；
 * 所有写操作在这里统一处理预览拦截、busy、toast。
 */
export class AdminStore extends EventTarget {
  admin: Admin | null = null;
  previewMode = false;
  busy = false;

  categories: Category[] = [];
  tags: Tag[] = [];
  articles: Article[] = [];
  dynamics: Dynamic[] = [];
  comments: Comment[] = [];
  media: MediaAsset[] = [];
  friends: FriendLink[] = [];
  layouts: LayoutRecord[] = [];
  subscribers: Subscriber[] = [];
  deliveries: Delivery[] = [];
  notifications: AdminNotification[] = [];
  notificationSettings: NotificationSettings = {
    notification_email: null,
    email_notifications_enabled: false,
    notify_on_comments: true,
    notify_on_friend_links: true,
    notify_on_likes: false,
    notification_frequency: 'hourly',
  };
  settings: SiteSettings = structuredClone(defaultSettings);
  overview: AdminOverview | null = null;

  toasts: Toast[] = [];
  modal: ModalRequest | null = null;
  private toastSeq = 0;

  emit() {
    this.dispatchEvent(new Event('change'));
  }

  toast(message: string, kind: Toast['kind'] = 'ok') {
    const id = ++this.toastSeq;
    this.toasts = [...this.toasts, { id, kind, message }];
    this.emit();
    setTimeout(() => {
      this.toasts = this.toasts.filter((item) => item.id !== id);
      this.emit();
    }, 3600);
  }

  confirm(title: string, message?: string, confirmLabel = '确定', danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      this.modal = {
        title,
        message,
        confirmLabel,
        danger,
        resolve: (value) => resolve(value !== null),
      };
      this.emit();
    });
  }

  prompt(title: string, fields: ModalField[], confirmLabel = '保存'): Promise<Record<string, string> | null> {
    return new Promise((resolve) => {
      this.modal = { title, fields, confirmLabel, resolve };
      this.emit();
    });
  }

  closeModal(value: Record<string, string> | null) {
    this.modal?.resolve(value);
    this.modal = null;
    this.emit();
  }

  /** 所有写操作的统一入口：预览拦截 + busy + toast + 错误提示。 */
  async run(action: () => Promise<void>, notice: string | (() => string) = '已保存') {
    if (this.previewMode) {
      this.toast('预览模式：改动不会保存', 'info');
      return;
    }
    if (this.busy) return;
    this.busy = true;
    this.emit();
    try {
      await action();
      this.toast(typeof notice === 'function' ? notice() : notice, 'ok');
    } catch (error) {
      this.toast(error instanceof Error ? error.message : '发生未知错误', 'err');
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  async restoreSession(): Promise<void> {
    try {
      this.admin = await api<Admin>('/api/admin/auth/session');
      await this.refreshAll();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // 未登录：留在登录页。
      } else if (import.meta.env.DEV) {
        this.enterPreview();
      } else {
        throw error;
      }
    }
  }

  enterPreview() {
    this.previewMode = true;
    this.admin = previewAdmin;
    Object.assign(this, {
      categories: previewCategories,
      tags: previewTags,
      articles: previewArticles,
      dynamics: previewDynamics,
      comments: previewComments,
      media: previewMedia,
      friends: previewFriends,
      subscribers: previewSubscribers,
      deliveries: previewDeliveries,
      notifications: previewNotifications,
      notificationSettings: previewNotificationSettings,
      settings: structuredClone(previewSettings),
      overview: structuredClone(previewOverview),
      layouts: previewLayouts,
    });
    this.emit();
  }

  async login(username: FormDataEntryValue | null, password: FormDataEntryValue | null) {
    await this.run(async () => {
      this.admin = await api<Admin>('/api/admin/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      await this.refreshAll();
    }, '登录成功');
  }

  async logout() {
    await this.run(async () => {
      await api('/api/admin/auth/logout', { method: 'POST' });
      this.admin = null;
    });
  }

  async refreshAll() {
    const [
      categories,
      tags,
      articles,
      dynamics,
      comments,
      media,
      friends,
      layouts,
      subscribers,
      deliveries,
      notifications,
      notificationSettings,
      settings,
      overview,
    ] = await Promise.all([
      api<Category[]>('/api/admin/categories'),
      api<Tag[]>('/api/admin/tags'),
      api<Article[]>('/api/admin/articles'),
      api<Dynamic[]>('/api/admin/dynamics'),
      api<Comment[]>('/api/admin/comments'),
      api<MediaAsset[]>('/api/admin/media'),
      api<FriendLink[]>('/api/admin/friend-links'),
      api<LayoutRecord[]>('/api/admin/layouts'),
      api<Subscriber[]>('/api/admin/subscribers'),
      api<Delivery[]>('/api/admin/deliveries'),
      api<AdminNotification[]>('/api/admin/notifications'),
      api<NotificationSettings>('/api/admin/notification-settings'),
      api<SiteSettings>('/api/admin/settings').catch((error) => {
        if (error instanceof ApiError && error.status === 404) return structuredClone(defaultSettings);
        throw error;
      }),
      api<AdminOverview>('/api/admin/overview').catch(() => null),
    ]);
    Object.assign(this, {
      categories, tags, articles, dynamics, comments, media, friends, layouts,
      subscribers, deliveries, notifications, notificationSettings, settings, overview,
    });
    this.emit();
  }

  // ---------- 文章 ----------

  async saveArticle(id: string | null, body: unknown): Promise<Article | null> {
    let saved: Article | null = null;
    await this.run(async () => {
      saved = await api<Article>(id ? `/api/admin/articles/${id}` : '/api/admin/articles', {
        method: id ? 'PUT' : 'POST',
        body,
      });
      this.articles = await api('/api/admin/articles');
    });
    return saved;
  }

  async articleAction(id: string, action: 'publish' | 'withdraw', publishedAt?: string) {
    await this.run(async () => {
      await api(`/api/admin/articles/${id}/${action}`, {
        method: 'POST',
        body: action === 'publish' ? (publishedAt ? { published_at: publishedAt } : {}) : undefined,
      });
      this.articles = await api('/api/admin/articles');
      this.overview = await api<AdminOverview>('/api/admin/overview').catch(() => this.overview);
    }, action === 'publish' ? '文章已发布' : '文章已撤回');
  }

  async setArticleFeatured(id: string, featured: boolean) {
    await this.run(async () => {
      await api(`/api/admin/articles/${id}/featured`, { method: 'PUT', body: { featured } });
      this.articles = await api('/api/admin/articles');
    }, featured ? '已设为精选' : '已取消精选');
  }

  async deleteArticle(id: string) {
    if (!(await this.confirm('删除文章', '文章与其评论会一并删除，此操作不可撤销。', '删除', true))) return;
    await this.run(async () => {
      await api(`/api/admin/articles/${id}`, { method: 'DELETE' });
      this.articles = await api('/api/admin/articles');
    }, '文章已删除');
  }

  // ---------- 动态 ----------

  async saveDynamic(id: string | null, body: unknown): Promise<Dynamic | null> {
    let saved: Dynamic | null = null;
    await this.run(async () => {
      saved = await api<Dynamic>(id ? `/api/admin/dynamics/${id}` : '/api/admin/dynamics', {
        method: id ? 'PUT' : 'POST',
        body,
      });
      this.dynamics = await api('/api/admin/dynamics');
    });
    return saved;
  }

  async dynamicAction(id: string, action: 'publish' | 'withdraw', publishedAt?: string) {
    await this.run(async () => {
      await api(`/api/admin/dynamics/${id}/${action}`, {
        method: 'POST',
        body: action === 'publish' ? (publishedAt ? { published_at: publishedAt } : {}) : undefined,
      });
      this.dynamics = await api('/api/admin/dynamics');
    }, action === 'publish' ? '动态已发布' : '动态已撤回');
  }

  async deleteDynamic(id: string) {
    if (!(await this.confirm('删除动态', '动态与其评论会一并删除，此操作不可撤销。', '删除', true))) return;
    await this.run(async () => {
      await api(`/api/admin/dynamics/${id}`, { method: 'DELETE' });
      this.dynamics = await api('/api/admin/dynamics');
    }, '动态已删除');
  }

  // ---------- 分类与标签 ----------

  async createCategory(body: unknown) {
    await this.run(async () => {
      await api('/api/admin/categories', { method: 'POST', body });
      this.categories = await api('/api/admin/categories');
    }, '分类已添加');
  }

  async updateCategory(id: string, body: unknown) {
    await this.run(async () => {
      await api(`/api/admin/categories/${id}`, { method: 'PUT', body });
      this.categories = await api('/api/admin/categories');
    });
  }

  async createTag(body: unknown): Promise<Tag | null> {
    let created: Tag | null = null;
    await this.run(async () => {
      created = await api<Tag>('/api/admin/tags', { method: 'POST', body });
      this.tags = await api('/api/admin/tags');
    }, '标签已添加');
    return created;
  }

  async updateTag(id: string, body: unknown) {
    await this.run(async () => {
      await api(`/api/admin/tags/${id}`, { method: 'PUT', body });
      this.tags = await api('/api/admin/tags');
    });
  }

  async removeTaxonomy(kind: 'categories' | 'tags', id: string) {
    if (!(await this.confirm('删除', '被内容引用时数据库会拒绝删除。', '删除', true))) return;
    await this.run(async () => {
      await api(`/api/admin/${kind}/${id}`, { method: 'DELETE' });
      if (kind === 'categories') this.categories = await api('/api/admin/categories');
      else this.tags = await api('/api/admin/tags');
    }, '已删除');
  }

  // ---------- 评论 ----------

  async setCommentStatus(id: string, status: 'visible' | 'hidden' | 'pending') {
    const notice = status === 'visible' ? '评论已公开' : status === 'hidden' ? '评论已隐藏' : '已退回待审核';
    await this.run(async () => {
      await api(`/api/admin/comments/${id}`, { method: 'PUT', body: { status } });
      this.comments = await api('/api/admin/comments');
    }, notice);
  }

  async deleteComment(id: string) {
    if (!(await this.confirm('删除评论', '此操作不可撤销。', '删除', true))) return;
    await this.run(async () => {
      await api(`/api/admin/comments/${id}`, { method: 'DELETE' });
      this.comments = await api('/api/admin/comments');
    }, '评论已删除');
  }

  // ---------- 媒体 ----------

  async uploadMedia(file: File): Promise<MediaAsset | null> {
    let uploaded: MediaAsset | null = null;
    const known = new Set(this.media.map((item) => item.id));
    const data = new FormData();
    data.append('file', file, file.name);
    await this.run(async () => {
      uploaded = await api<MediaAsset>('/api/admin/media', { method: 'POST', formData: data });
      this.media = await api('/api/admin/media');
    }, () => (uploaded && known.has(uploaded.id) ? '文件与已有媒体内容重复，已自动复用' : '上传成功'));
    return uploaded;
  }

  async deleteMedia(id: string) {
    if (!(await this.confirm('删除媒体文件', '文件会从磁盘删除，此操作不可撤销。', '删除', true))) return;
    await this.run(async () => {
      await api(`/api/admin/media/${id}`, { method: 'DELETE' });
      this.media = await api('/api/admin/media');
    }, '媒体已删除');
  }

  // ---------- 友链 ----------

  async saveFriend(id: string | null, body: unknown) {
    await this.run(async () => {
      await api(id ? `/api/admin/friend-links/${id}` : '/api/admin/friend-links', {
        method: id ? 'PUT' : 'POST',
        body,
      });
      this.friends = await api('/api/admin/friend-links');
    }, id ? '友链已更新' : '友链已添加');
  }

  async approveFriend(item: FriendLink) {
    await this.saveFriend(item.id, {
      name: item.name,
      url: item.url,
      description: item.description,
      avatar_media_id: item.avatar_media_id,
      is_visible: true,
      sort_order: item.sort_order,
    });
  }

  async deleteFriend(id: string) {
    if (!(await this.confirm('删除友链', '此操作不可撤销。', '删除', true))) return;
    await this.run(async () => {
      await api(`/api/admin/friend-links/${id}`, { method: 'DELETE' });
      this.friends = await api('/api/admin/friend-links');
    }, '友链已删除');
  }

  // ---------- 站点设置与布局 ----------

  async saveSettings(body: SiteSettings) {
    await this.run(async () => {
      this.settings = await api('/api/admin/settings', { method: 'PUT', body });
    }, '站点设置已保存');
  }

  async saveHomeLayout(layout: unknown) {
    await this.run(async () => {
      await api('/api/admin/layouts/home', { method: 'PUT', body: layout });
      this.layouts = await api('/api/admin/layouts');
    }, '首页布局已保存');
  }

  // ---------- 通知 ----------

  async markNotificationRead(id: string) {
    await this.run(async () => {
      await api(`/api/admin/notifications/${id}/read`, { method: 'POST' });
      this.notifications = await api('/api/admin/notifications');
    }, '消息已读');
  }

  async markAllNotificationsRead() {
    await this.run(async () => {
      await api('/api/admin/notifications/read-all', { method: 'POST' });
      this.notifications = await api('/api/admin/notifications');
    }, '全部消息已读');
  }

  async notificationEmailAction(item: AdminNotification, action: 'email-retry' | 'email-cancel') {
    if (
      action === 'email-retry' &&
      item.email_status === 'uncertain' &&
      !(await this.confirm('重试邮件', 'SMTP 可能已经接收过这封邮件，重试可能导致重复发送。', '仍然重试', true))
    ) {
      return;
    }
    await this.run(async () => {
      await api(`/api/admin/notifications/${item.id}/${action}`, { method: 'POST' });
      this.notifications = await api('/api/admin/notifications');
    });
  }

  async saveNotificationSettings(body: unknown) {
    await this.run(async () => {
      this.notificationSettings = await api('/api/admin/notification-settings', {
        method: 'PUT',
        body,
      });
    }, '通知设置已保存');
  }

  // ---------- 订阅与投递 ----------

  async deleteSubscriber(id: string) {
    if (!(await this.confirm('删除订阅者', '其投递记录会一并删除。', '删除', true))) return;
    await this.run(async () => {
      await api(`/api/admin/subscribers/${id}`, { method: 'DELETE' });
      this.subscribers = await api('/api/admin/subscribers');
    }, '订阅者已删除');
  }

  async deliveryAction(id: string, action: 'retry' | 'cancel') {
    const delivery = this.deliveries.find((item) => item.id === id);
    if (
      action === 'retry' &&
      delivery?.status === 'uncertain' &&
      !(await this.confirm('重试投递', 'SMTP 可能已经接收过这封邮件，重试可能导致重复发送。', '仍然重试', true))
    ) {
      return;
    }
    await this.run(async () => {
      await api(`/api/admin/deliveries/${id}/${action}`, { method: 'POST' });
      this.deliveries = await api('/api/admin/deliveries');
    });
  }

  get unreadNotifications() {
    return this.notifications.filter((item) => !item.read_at).length;
  }
}

export const store = new AdminStore();
