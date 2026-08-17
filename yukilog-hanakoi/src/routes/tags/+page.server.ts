import type { PageServerLoad } from './$types';
import { tagsApi, postsApi } from '$lib/api';
import type { PostWithRelations, Tag } from '$types/api';

function mapPosts(items: PostWithRelations[]) {
  return items.map((item) => ({
    ...item.post,
    theme: item.theme,
    tags: item.tags,
  }));
}

export const load: PageServerLoad = async ({ url }) => {
  const requested = url.searchParams
    .getAll('tag')
    .map((slug) => slug.trim())
    .filter(Boolean);

  try {
    const tags = await tagsApi.list();
    const known = new Set(tags.map((tag: Tag) => tag.slug));
    const selectedSlugs = requested.filter((slug) => known.has(slug));

    const response = await postsApi.list({
      page: 1,
      page_size: 100,
      sort: 'created_at',
      ...(selectedSlugs.length ? { tag_slugs: selectedSlugs.join(',') } : {}),
    });

    return {
      tags,
      posts: mapPosts(response.items || []),
      total: response.total ?? 0,
    };
  } catch (err) {
    console.error('获取标签页数据失败：', err);
    return { tags: [], posts: [], total: 0 };
  }
};
