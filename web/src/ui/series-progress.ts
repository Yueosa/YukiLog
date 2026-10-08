// 系列阅读进度：纯客户端 localStorage 记录，不上报。
// 结构 {[seriesSlug]: string[]}——该系列下已读文章的 slug 数组。
// 这里是纯函数层（可注入 storage，vitest 下无 localStorage），组件经 PublicStore 消费。

export const SERIES_READ_KEY = 'yukilog.seriesRead';

export type SeriesReadMap = Record<string, string[]>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | null;

function defaultStorage(): StorageLike {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 读出进度表；损坏/形状不符时回退空表，绝不让坏数据卡死渲染。 */
export function loadSeriesRead(storage: StorageLike = defaultStorage()): SeriesReadMap {
  if (!storage) return {};
  let raw: string | null = null;
  try {
    raw = storage.getItem(SERIES_READ_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: SeriesReadMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      const slugs = value.filter((item): item is string => typeof item === 'string');
      if (slugs.length > 0) map[key] = [...new Set(slugs)];
    }
    return map;
  } catch {
    return {};
  }
}

/** 记录一章已读：返回新表（不可变更新），重复记录返回原表。 */
export function markChapterRead(
  map: SeriesReadMap,
  seriesSlug: string,
  articleSlug: string,
): SeriesReadMap {
  const current = map[seriesSlug] ?? [];
  if (current.includes(articleSlug)) return map;
  return { ...map, [seriesSlug]: [...current, articleSlug] };
}

export function persistSeriesRead(
  map: SeriesReadMap,
  storage: StorageLike = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(SERIES_READ_KEY, JSON.stringify(map));
  } catch {
    // 隐私模式/配额满：静默放弃，阅读不依赖持久化成功
  }
}

/** 该系列已读章数（只数仍存在于章节表里的 slug，剔除已撤稿的残留）。 */
export function countReadChapters(
  map: SeriesReadMap,
  seriesSlug: string,
  chapterSlugs: string[],
): number {
  const read = map[seriesSlug];
  if (!read || read.length === 0) return 0;
  const known = new Set(chapterSlugs);
  return read.filter((slug) => known.has(slug)).length;
}

/**
 * 续读位置：章节表（已按系列顺序排好）里第一个未读章的下标；
 * 全部读过返回 -1，空表返回 -1。
 */
export function nextUnreadIndex(chapterSlugs: string[], readSlugs: string[]): number {
  const read = new Set(readSlugs);
  return chapterSlugs.findIndex((slug) => !read.has(slug));
}
