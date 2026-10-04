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
  created_at: string;
  updated_at: string;
  tag_ids: string[];
};

export type Dynamic = {
  id: string;
  content_markdown: string;
  status: 'draft' | 'published';
  allow_comments: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: string;
  article_id: string | null;
  dynamic_id: string | null;
  parent_id: string | null;
  display_name: string;
  email: string;
  website: string | null;
  content: string;
  status: 'pending' | 'visible' | 'hidden';
  created_at: string;
};

export type FriendLink = {
  id: string;
  avatar_media_id: string | null;
  name: string;
  url: string;
  description: string | null;
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
};

export type SiteSettings = {
  siteTitle: string;
  siteDescription: string | null;
  ownerName: string;
  ownerBio: string;
  avatarMediaId: string | null;
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
