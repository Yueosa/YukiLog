import type { PageServerLoad } from './$types';
import { postsApi } from '$lib/api';

type ArchivePost = {
  title: string;
  slug: string;
  created_at: string;
  month: number;
  day: number;
};

export const load: PageServerLoad = async () => {
  try {
    const response = await postsApi.list({
      page_size: 999,
      status: 'published',
    });

    const allPosts = (response.items || []).map((item: any) => item.post);

    const yearMap = new Map<number, ArchivePost[]>();
    for (const post of allPosts) {
      const d = new Date(post.created_at);
      const year = d.getFullYear();
      if (!yearMap.has(year)) yearMap.set(year, []);
      yearMap.get(year)!.push({
        title: post.title,
        slug: post.slug,
        created_at: post.created_at,
        month: d.getMonth() + 1,
        day: d.getDate(),
      });
    }

    const archiveData = Array.from(yearMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, posts]) => {
        const sorted = posts.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const monthMap = new Map<number, ArchivePost[]>();
        for (const post of sorted) {
          if (!monthMap.has(post.month)) monthMap.set(post.month, []);
          monthMap.get(post.month)!.push(post);
        }
        const months = Array.from(monthMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([month, monthPosts]) => ({ month, posts: monthPosts }));

        return { year, count: sorted.length, months };
      });

    const totalPosts = archiveData.reduce((sum, y) => sum + y.count, 0);

    return { archiveData, totalPosts };
  } catch (err) {
    console.error('获取文章列表失败：', err);
  }

  return { archiveData: [], totalPosts: 0 };
};
