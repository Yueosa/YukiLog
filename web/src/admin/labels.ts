/** 管理端文案集中地：所有枚举 → 中文显示，时间格式化。 */

export function contentStatusLabel(item: {
  status: string;
  published_at: string | null;
}): string {
  if (item.status === 'published' && item.published_at && new Date(item.published_at) > new Date()) {
    return '已定时';
  }
  return item.status === 'published' ? '已发布' : '草稿';
}

export const commentStatusLabel: Record<string, string> = {
  pending: '待审核',
  visible: '已公开',
  hidden: '已隐藏',
};

export const subscriberStatusLabel: Record<string, string> = {
  pending: '待确认',
  active: '已订阅',
  unsubscribed: '已退订',
};

export const deliveryKindLabel: Record<string, string> = {
  confirm_subscription: '确认邮件',
  article_published: '文章发布',
  dynamic_published: '动态发布',
};

export const deliveryStatusLabel: Record<string, string> = {
  pending: '等待发送',
  sending: '发送中',
  sent: '已送达',
  failed: '发送失败',
  cancelled: '已取消',
  uncertain: '状态未知',
};

export const emailStatusLabel: Record<string, string> = {
  suppressed: '不发送',
  pending: '等待发送',
  sending: '发送中',
  sent: '已送达',
  failed: '发送失败',
  cancelled: '已取消',
  uncertain: '状态未知',
};

export const frequencyLabel: Record<string, string> = {
  immediate: '立即发送',
  hourly: '每小时聚合',
  daily: '每日摘要',
};

export const notificationKindLabel: Record<string, string> = {
  comment: '评论',
  friend_link_application: '友链申请',
  article_like: '点赞',
};

export const fontLabel: Record<string, string> = {
  system: '系统默认',
  serif: '衬线（宋体系）',
  rounded: '圆体',
  mono: '等宽',
};

export const maxWidthLabel: Record<string, string> = {
  content: '紧凑',
  wide: '宽版',
  full: '全宽',
};

export const motionLabel: Record<string, string> = {
  none: '无动效',
  subtle: '柔和',
  expressive: '丰富',
};

export function enumLabel(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDateTime(iso).slice(0, 10);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
