import type { PublicComment } from './api.js';

/** 两层评论树节点：replyToName 是直接回复对象，children 是该顶层串下的所有回复。 */
export interface CommentNode {
  comment: PublicComment;
  replyToName: string | null;
  children: CommentNode[];
}

/**
 * 平铺评论（id/parentId）组两层树：
 * 每条回复挂到最近的顶层祖先下，并记住直接回复对象（「回复 @某人」）；
 * 无 id（旧契约）、父级缺失或成环时一律安全降级为顶层。
 */
export function buildCommentTree(items: PublicComment[]): CommentNode[] {
  const byId = new Map(items.filter((item) => item.id).map((item) => [item.id, item]));
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  items.forEach((comment) => {
    if (!comment.id) {
      roots.push({ comment, replyToName: null, children: [] });
      return;
    }
    nodes.set(comment.id, { comment, replyToName: null, children: [] });
  });
  const rootOf = (comment: PublicComment): PublicComment => {
    let current = comment;
    const guard = new Set<string>([comment.id]);
    while (current.parentId && byId.has(current.parentId) && !guard.has(current.parentId)) {
      guard.add(current.id);
      current = byId.get(current.parentId)!;
    }
    return current;
  };
  nodes.forEach((node) => {
    const parent = node.comment.parentId ? byId.get(node.comment.parentId) : undefined;
    if (!parent || parent.id === node.comment.id) {
      roots.push(node);
      return;
    }
    node.replyToName = parent.displayName;
    const root = rootOf(parent);
    if (root.id === node.comment.id) {
      roots.push(node);
      return;
    }
    const host = nodes.get(root.id);
    if (host) host.children.push(node);
    else roots.push(node);
  });
  return roots;
}
