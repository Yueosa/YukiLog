/**
 * Slug 生成工具
 * 支持中文拼音映射和英文转换
 */

// 常用中文词汇拼音映射表
const pinyinMap: Record<string, string> = {
  // 技术类
  '前端': 'frontend',
  '后端': 'backend',
  '全栈': 'fullstack',
  '技术': 'tech',
  '编程': 'coding',
  '开发': 'dev',
  '设计': 'design',
  '架构': 'arch',
  '算法': 'algorithm',
  '数据库': 'database',
  '网络': 'network',
  '安全': 'security',
  
  // 内容类型
  '教程': 'tutorial',
  '笔记': 'notes',
  '随笔': 'essay',
  '分享': 'share',
  '总结': 'summary',
  '回顾': 'review',
  '思考': 'thinking',
  '实践': 'practice',
  
  // 时间相关
  '年终': 'year-end',
  '月度': 'monthly',
  '周记': 'weekly',
  '日记': 'diary',
  
  // 其他
  '博客': 'blog',
  '文章': 'article',
  '指南': 'guide',
  '入门': 'intro',
  '进阶': 'advanced',
  '深入': 'deep-dive',
};

/**
 * 生成 URL 友好的 slug
 * @param text 原始文本（标题）
 * @param fallbackPrefix 无法从文本生成时的前缀，默认 post
 * @returns slug 字符串
 */
export function generateSlug(text: string, fallbackPrefix = 'post'): string {
  if (!text) return '';

  // 1. 尝试匹配中文关键词
  let slug = text;
  for (const [chinese, pinyin] of Object.entries(pinyinMap)) {
    slug = slug.replace(new RegExp(chinese, 'g'), pinyin);
  }

  // 2. 转小写
  slug = slug.toLowerCase();

  // 3. 替换空格为连字符
  slug = slug.replace(/\s+/g, '-');

  // 4. 移除非字母数字连字符字符（保留中文）
  slug = slug.replace(/[^\u4e00-\u9fa5a-z0-9-]/g, '');

  // 5. 如果还有中文，转拼音首字母
  if (/[\u4e00-\u9fa5]/.test(slug)) {
    // 简单处理：移除中文（实际项目可接入 pinyin 库）
    slug = slug.replace(/[\u4e00-\u9fa5]/g, '');
  }

  // 6. 移除多余连字符
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-|-$/g, '');

  // 7. 如果结果为空，生成时间戳 slug
  if (!slug) {
    slug = `${fallbackPrefix}-${Date.now()}`;
  }

  return slug;
}

/**
 * 验证 slug 格式是否合法
 * @param slug 待验证的 slug
 * @returns 是否合法
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}
