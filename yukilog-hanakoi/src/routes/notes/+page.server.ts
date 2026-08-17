import type { PageServerLoad } from './$types';
import { notesApi } from '$lib/api';
import { renderMarkdownPreview } from '$lib/markdown';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async () => {
  try {
    const response = await notesApi.list({ page: 1, page_size: PAGE_SIZE });

    const notes = response.items.map((note) => ({
      ...note,
      renderedContent: renderMarkdownPreview(note.content),
    }));

    return {
      notes,
      totalPages: response.total_pages,
      pageSize: PAGE_SIZE,
    };
  } catch (err) {
    console.error('获取随记列表失败：', err);
  }

  return {
    notes: [],
    totalPages: 1,
    pageSize: PAGE_SIZE,
  };
};
