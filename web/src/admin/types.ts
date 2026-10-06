import type { PageLayoutDocument, ShellLayout } from '../layout/types.js';

export type Admin = {
  id: string;
  username: string;
  display_name: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
};

export type Article = {
  id: string;
  category_id: string;
  cover_media_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  body_markdown: string;
  status: 'draft' | 'published';
  allow_comments: boolean;
  published_at: string | null;
  featured_at: string | null;
  created_at: string;
  updated_at: string;
  tag_ids: string[];
};

export type DynamicMediaItem = {
  id: string;
  url: string;
  original_name: string;
  media_type: string;
  width: number | null;
  height: number | null;
};

export type Dynamic = {
  id: string;
  content_markdown: string;
  mood: string | null;
  status: 'draft' | 'published';
  allow_comments: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  media: DynamicMediaItem[];
};

export type Comment = {
  id: string;
  article_id: string | null;
  dynamic_id: string | null;
  parent_id: string | null;
  display_name: string;
  email: string | null;
  website: string | null;
  user_agent?: string | null;
  content: string;
  status: 'pending' | 'visible' | 'hidden';
  created_at: string;
};

export type FriendLink = {
  id: string;
  avatar_media_id: string | null;
  avatar_url: string | null;
  name: string;
  url: string;
  description: string | null;
  application_email: string | null;
  is_visible: boolean;
  sort_order: number;
};

export type MediaAsset = {
  id: string;
  url: string;
  original_name: string;
  media_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
};

export type LayoutRecord = {
  pageKey: string;
  layout: PageLayoutDocument;
  updatedAt: string;
};

export type ThemeTokens = {
  schemaVersion: 1;
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    primary: string;
    secondary: string;
    border: string;
  };
  typography: {
    body: 'system' | 'serif' | 'rounded' | 'mono';
    display: 'system' | 'serif' | 'rounded' | 'mono';
    scale: number;
  };
  shape: { radius: number; borderedCards: boolean };
  motion: 'none' | 'subtle' | 'expressive';
  /** 刊头背景深色蒙版强度（0-0.95），null 时前端默认 0（不压暗）。 */
  mastheadOverlay?: number | null;
  /** 首屏背景对齐。 */
  heroBackgroundPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right' | null;
  /** 首屏背景适应。 */
  heroBackgroundFit?: 'cover' | 'contain' | 'stretch' | null;
  /** 刊头背景对齐。 */
  mastheadPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right' | null;
  /** 刊头背景适应。 */
  mastheadFit?: 'cover' | 'contain' | 'stretch' | null;
};

/** 首屏背景项：纯媒体 id（居中）或带焦点位置的对象。 */
export type HeroBackgroundSetting = string | { mediaId: string; position: string };

export type SiteSettings = {
  siteTitle: string;
  siteDescription: string | null;
  ownerName: string;
  ownerBio: string;
  avatarMediaId: string | null;
  avatarExternalUrl: string | null;
  mastheadMediaId: string | null;
  heroBackgroundMediaIds: HeroBackgroundSetting[];
  heroQuote: string | null;
  socialLinks: Array<{ label: string; url: string }>;
  theme: ThemeTokens;
  shellLayout: ShellLayout;
  updatedAt?: string;
};

export type Subscriber = {
  id: string;
  email: string;
  subscribe_articles: boolean;
  subscribe_dynamics: boolean;
  status: string;
  confirmation_sent_at: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

export type Delivery = {
  id: string;
  subscriber_id: string;
  kind: string;
  article_id: string | null;
  dynamic_id: string | null;
  status: string;
  attempt_count: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

export type AdminNotification = {
  id: string;
  kind: 'comment' | 'friend_link_application' | 'article_like';
  article_id: string | null;
  comment_id: string | null;
  friend_link_id: string | null;
  title: string;
  message: string;
  target_url: string;
  event_count: number;
  read_at: string | null;
  email_status: string;
  email_attempt_count: number;
  email_last_error: string | null;
  emailed_event_count: number;
  email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationSettings = {
  notification_email: string | null;
  email_notifications_enabled: boolean;
  notify_on_comments: boolean;
  notify_on_friend_links: boolean;
  notify_on_likes: boolean;
  notification_frequency: 'immediate' | 'hourly' | 'daily';
};

export type OverviewCounts = {
  articles: number;
  articles_published: number;
  dynamics: number;
  comments_pending: number;
  media: number;
  subscribers_active: number;
  deliveries_failed: number;
  notifications_unread: number;
};

export type OverviewTopArticle = {
  id: string;
  title: string;
  slug: string;
  value: number;
};

export type OverviewTopDynamic = {
  id: string;
  excerpt: string;
  like_count: number;
};

export type OverviewRecentComment = {
  id: string;
  display_name: string;
  excerpt: string;
  status: string;
  created_at: string;
  target_title: string;
};

export type AdminOverview = {
  counts: OverviewCounts;
  totals: { views: number; likes: number };
  top_viewed: OverviewTopArticle[];
  top_liked_articles: OverviewTopArticle[];
  top_liked_dynamics: OverviewTopDynamic[];
  recent_comments: OverviewRecentComment[];
  recent_notifications: AdminNotification[];
};
