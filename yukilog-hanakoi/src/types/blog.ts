// ================================
// 前端专属类型定义
// ================================

import type { NavIconKey, SocialIconKey } from '../lib/svg-icons';

/**
 * 导航项配置
 */
export type NavIconName = NavIconKey;

export interface NavItem {
  label: string;
  href: string;
  icon?: NavIconName; // 统一导航图标 key
}

/**
 * 社交链接配置
 */
export type SocialIconName = SocialIconKey;

export interface SocialLink {
  name: string;
  url: string;
  icon: SocialIconName; // 统一社交图标 key
  color?: string; // 品牌色
}

/**
 * 站点配置
 */
export interface SiteConfig {
  // 基本信息
  name: string;
  lang: string;        // BCP 47 语言标签，如 "zh-CN"
  themeColor: string;  // PWA/浏览器主题色，如 "#E8A4B4"
  title: string;
  description: string;
  welcomeText: string;
  
  // 作者信息
  author: {
    name: string;
    nickname: string;
    avatar: string;
    bio: string;
    birthday: string;
    genderIdentity: string;
    systemLog: {
      timestamp: string;
      message: string;
    };
  };
  
  // 社交链接
  social: SocialLink[];
  
  // 站点统计
  startDate: string; // 启动日期，格式：2026-02-12
  
  // SEO
  seo: {
    keywords: string[];
    ogImage: string;
  };
}

/**
 * 文章卡片数据（列表展示用）
 */
export interface PostCardData {
  title: string;
  slug: string;
  summary: string | null;
  cover_image: string | null;
  created_at: string;
  view_count: number;
  // 扩展字段（前端组装）
  theme?: {
    name: string;
    slug: string;
  } | null;
  tags?: Array<{
    name: string;
    slug: string;
  }>;
}
