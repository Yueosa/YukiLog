import { componentRegistry, validatePageLayout } from './registry.js';
import type { LayoutNode, PageLayoutDocument } from './types.js';

export type DropPosition = 'before' | 'inside' | 'after';

export interface LayoutIndexEntry {
  node: LayoutNode;
  parentId: string | null;
  index: number;
  depth: number;
}

export type LayoutCommand =
  | {
      type: 'insert-node';
      parentId: string;
      index?: number;
      node: LayoutNode;
    }
  | {
      type: 'move-node';
      nodeId: string;
      targetId: string;
      position: DropPosition;
    }
  | {
      type: 'remove-node';
      nodeId: string;
    }
  | {
      type: 'set-prop';
      nodeId: string;
      name: string;
      value: unknown;
    }
  | {
      type: 'set-responsive-prop';
      nodeId: string;
      breakpoint: 'tablet' | 'mobile';
      name: string;
      value: unknown;
    };

export class LayoutCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutCommandError';
  }
}

export function indexLayout(root: LayoutNode): Map<string, LayoutIndexEntry> {
  const entries = new Map<string, LayoutIndexEntry>();

  const visit = (node: LayoutNode, parentId: string | null, index: number, depth: number) => {
    if (entries.has(node.id)) {
      throw new LayoutCommandError(`布局中存在重复节点 ID：${node.id}`);
    }
    entries.set(node.id, { node, parentId, index, depth });
    node.children?.forEach((child, childIndex) => visit(child, node.id, childIndex, depth + 1));
  };

  visit(root, null, 0, 0);
  return entries;
}

export function findLayoutNode(root: LayoutNode, nodeId: string): LayoutNode | undefined {
  return indexLayout(root).get(nodeId)?.node;
}

export function validDropPositions(
  root: LayoutNode,
  nodeId: string,
  targetId: string,
): DropPosition[] {
  const entries = indexLayout(root);
  const source = entries.get(nodeId);
  const target = entries.get(targetId);
  if (!source || !target || source.parentId === null || nodeId === targetId) return [];
  if (containsNode(source.node, targetId)) return [];

  const positions: DropPosition[] = [];
  if (target.parentId !== null) positions.push('before', 'after');
  if (componentRegistry[target.node.type].acceptsChildren) positions.splice(1, 0, 'inside');
  return positions;
}

export function applyLayoutCommand<T extends PageLayoutDocument>(
  document: T,
  command: LayoutCommand,
): T {
  const root = applyTreeCommand(document.root, command);
  if (root === document.root) return document;

  const next = { ...document, root };
  const errors = validatePageLayout(next);
  if (errors.length > 0) {
    throw new LayoutCommandError(errors.join('；'));
  }
  return next;
}

function applyTreeCommand(root: LayoutNode, command: LayoutCommand): LayoutNode {
  switch (command.type) {
    case 'insert-node':
      return insertNode(root, command.parentId, command.node, command.index);
    case 'move-node':
      return moveNode(root, command.nodeId, command.targetId, command.position);
    case 'remove-node':
      return removeNode(root, command.nodeId);
    case 'set-prop':
      return updateNode(root, command.nodeId, (node) => ({
        ...node,
        props: setRecordValue(node.props, command.name, command.value),
      }));
    case 'set-responsive-prop':
      return updateNode(root, command.nodeId, (node) => {
        const breakpoint = setRecordValue(
          node.responsive?.[command.breakpoint] ?? {},
          command.name,
          command.value,
        );
        const responsive = { ...node.responsive };
        if (Object.keys(breakpoint).length === 0) delete responsive[command.breakpoint];
        else responsive[command.breakpoint] = breakpoint;
        return {
          ...node,
          responsive: Object.keys(responsive).length > 0 ? responsive : undefined,
        };
      });
  }
}

function insertNode(
  root: LayoutNode,
  parentId: string,
  node: LayoutNode,
  requestedIndex?: number,
): LayoutNode {
  const entries = indexLayout(root);
  const parent = entries.get(parentId);
  if (!parent) throw new LayoutCommandError(`找不到目标容器：${parentId}`);
  if (!componentRegistry[parent.node.type].acceptsChildren) {
    throw new LayoutCommandError(`${componentRegistry[parent.node.type].label} 不能包含子组件`);
  }

  const insertedEntries = indexLayout(node);
  for (const nodeId of insertedEntries.keys()) {
    if (entries.has(nodeId)) throw new LayoutCommandError(`节点 ID 已存在：${nodeId}`);
  }

  return updateNode(root, parentId, (current) => {
    const children = [...(current.children ?? [])];
    const index = clampIndex(requestedIndex ?? children.length, children.length);
    children.splice(index, 0, structuredClone(node));
    return { ...current, children };
  });
}

function removeNode(root: LayoutNode, nodeId: string): LayoutNode {
  const entries = indexLayout(root);
  const entry = entries.get(nodeId);
  if (!entry) throw new LayoutCommandError(`找不到待删除节点：${nodeId}`);
  if (entry.parentId === null) throw new LayoutCommandError('页面根节点不能删除');

  return updateNode(root, entry.parentId, (parent) => ({
    ...parent,
    children: parent.children?.filter((child) => child.id !== nodeId),
  }));
}

function moveNode(
  root: LayoutNode,
  nodeId: string,
  targetId: string,
  position: DropPosition,
): LayoutNode {
  const entries = indexLayout(root);
  const source = entries.get(nodeId);
  const target = entries.get(targetId);
  if (!source) throw new LayoutCommandError(`找不到待移动节点：${nodeId}`);
  if (!target) throw new LayoutCommandError(`找不到放置目标：${targetId}`);
  if (source.parentId === null) throw new LayoutCommandError('页面根节点不能移动');
  if (!validDropPositions(root, nodeId, targetId).includes(position)) {
    throw new LayoutCommandError('该组件不能放在这里');
  }

  const detachedRoot = removeNode(root, nodeId);
  const detachedEntries = indexLayout(detachedRoot);
  const refreshedTarget = detachedEntries.get(targetId);
  if (!refreshedTarget) throw new LayoutCommandError('放置目标在移动过程中失效');

  if (position === 'inside') {
    return insertNode(detachedRoot, targetId, source.node);
  }

  if (refreshedTarget.parentId === null) {
    throw new LayoutCommandError('不能在页面根节点旁边放置组件');
  }
  const insertionIndex = refreshedTarget.index + (position === 'after' ? 1 : 0);
  return insertNode(detachedRoot, refreshedTarget.parentId, source.node, insertionIndex);
}

function updateNode(
  root: LayoutNode,
  nodeId: string,
  update: (node: LayoutNode) => LayoutNode,
): LayoutNode {
  let found = false;
  const visit = (node: LayoutNode): LayoutNode => {
    if (node.id === nodeId) {
      found = true;
      return update(node);
    }
    let childrenChanged = false;
    const children = node.children?.map((child) => {
      const next = visit(child);
      if (next !== child) childrenChanged = true;
      return next;
    });
    return childrenChanged ? { ...node, children } : node;
  };

  const next = visit(root);
  if (!found) throw new LayoutCommandError(`找不到节点：${nodeId}`);
  return next;
}

function containsNode(root: LayoutNode, nodeId: string): boolean {
  return root.id === nodeId || (root.children?.some((child) => containsNode(child, nodeId)) ?? false);
}

function setRecordValue(
  record: Record<string, unknown>,
  name: string,
  value: unknown,
): Record<string, unknown> {
  const next = { ...record };
  if (value === undefined) delete next[name];
  else next[name] = value;
  return next;
}

function clampIndex(index: number, length: number): number {
  if (!Number.isInteger(index)) throw new LayoutCommandError('插入位置必须是整数');
  return Math.max(0, Math.min(index, length));
}
