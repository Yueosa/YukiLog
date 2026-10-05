import { describe, expect, it } from 'vitest';
import type { PublicComment } from './api.js';
import { buildCommentTree } from './comment-tree.js';

function comment(id: string, parentId: string | null, name = `用户${id}`): PublicComment {
  return {
    id,
    parentId,
    displayName: name,
    avatarUrl: '',
    website: null,
    contentHtml: `<p>${id}</p>`,
    createdAt: '2026-10-05T12:00:00+08:00',
  };
}

describe('buildCommentTree', () => {
  it('groups replies under their top-level ancestor with direct reply names', () => {
    const roots = buildCommentTree([
      comment('a', null, '远岸'),
      comment('b', 'a', '栖迟'),
      comment('c', 'b', '恋'),
      comment('d', null, '窗边'),
    ]);
    expect(roots.map((node) => node.comment.id)).toEqual(['a', 'd']);
    const thread = roots[0];
    expect(thread.children.map((node) => node.comment.id)).toEqual(['b', 'c']);
    expect(thread.children[0].replyToName).toBe('远岸');
    expect(thread.children[1].replyToName).toBe('栖迟');
  });

  it('keeps order and treats missing parents as top-level', () => {
    const roots = buildCommentTree([comment('x', 'ghost'), comment('y', null)]);
    expect(roots.map((node) => node.comment.id)).toEqual(['x', 'y']);
    expect(roots[0].replyToName).toBeNull();
  });

  it('degrades comments without ids (pre-contract responses) to flat roots', () => {
    const legacy = [
      { ...comment('', null), id: '' },
      { ...comment('', null), id: '' },
    ];
    const roots = buildCommentTree(legacy);
    expect(roots).toHaveLength(2);
  });

  it('survives parent cycles', () => {
    const roots = buildCommentTree([comment('a', 'b'), comment('b', 'a')]);
    expect(roots.length).toBeGreaterThan(0);
  });
});
