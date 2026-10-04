import {
  applyLayoutCommand,
  indexLayout,
  LayoutCommandError,
  type DropPosition,
  type LayoutCommand,
} from './commands.js';
import { validatePageLayout } from './registry.js';
import type { LayoutNode, PageLayoutDocument } from './types.js';

interface StudioSnapshot<T extends PageLayoutDocument> {
  document: T;
  selectedNodeId: string;
}

export interface StudioMutation {
  changed: boolean;
  announcement: string;
}

export class LayoutStudioStore<T extends PageLayoutDocument> {
  private past: StudioSnapshot<T>[] = [];
  private present: StudioSnapshot<T>;
  private future: StudioSnapshot<T>[] = [];

  constructor(
    document: T,
    private readonly historyLimit = 100,
  ) {
    this.present = snapshot(document, document.root.id);
  }

  get document(): T {
    return this.present.document;
  }

  get selectedNodeId(): string {
    return this.present.selectedNodeId;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  select(nodeId: string): boolean {
    if (!indexLayout(this.document.root).has(nodeId) || nodeId === this.selectedNodeId) return false;
    this.present = { ...this.present, selectedNodeId: nodeId };
    return true;
  }

  reset(document: T, selectedNodeId = document.root.id): void {
    const selected = indexLayout(document.root).has(selectedNodeId)
      ? selectedNodeId
      : document.root.id;
    this.present = snapshot(document, selected);
    this.past = [];
    this.future = [];
  }

  execute(command: LayoutCommand): StudioMutation {
    const before = this.present;
    const entries = indexLayout(before.document.root);
    const removedParentId =
      command.type === 'remove-node' ? entries.get(command.nodeId)?.parentId : undefined;
    const document = applyLayoutCommand(before.document, command);
    if (document === before.document) return { changed: false, announcement: '' };

    const selectedNodeId =
      command.type === 'insert-node'
        ? command.node.id
        : command.type === 'remove-node'
          ? (removedParentId ?? document.root.id)
          : 'nodeId' in command
            ? command.nodeId
            : before.selectedNodeId;

    this.commit({ document, selectedNodeId });
    return { changed: true, announcement: describeCommand(command, entries) };
  }

  updateDocument(update: (document: T) => T, announcement: string): StudioMutation {
    const document = update(this.document);
    if (document === this.document) return { changed: false, announcement: '' };
    const errors = validatePageLayout(document);
    if (errors.length > 0) throw new LayoutCommandError(errors.join('；'));
    this.commit({ document, selectedNodeId: this.selectedNodeId });
    return { changed: true, announcement };
  }

  moveSibling(nodeId: string, direction: -1 | 1): StudioMutation {
    const entries = indexLayout(this.document.root);
    const entry = entries.get(nodeId);
    if (!entry?.parentId) return { changed: false, announcement: '' };
    const parent = entries.get(entry.parentId)?.node;
    if (!parent) return { changed: false, announcement: '' };
    const target = parent.children?.[entry.index + direction];
    if (!target) return { changed: false, announcement: '' };

    return this.execute({
      type: 'move-node',
      nodeId,
      targetId: target.id,
      position: direction < 0 ? 'before' : 'after',
    });
  }

  moveTo(nodeId: string, targetId: string, position: DropPosition): StudioMutation {
    return this.execute({ type: 'move-node', nodeId, targetId, position });
  }

  undo(): StudioMutation {
    const previous = this.past.pop();
    if (!previous) return { changed: false, announcement: '' };
    this.future.push(this.present);
    this.present = previous;
    return { changed: true, announcement: '已撤销上一步布局修改' };
  }

  redo(): StudioMutation {
    const next = this.future.pop();
    if (!next) return { changed: false, announcement: '' };
    this.past.push(this.present);
    this.present = next;
    return { changed: true, announcement: '已恢复下一步布局修改' };
  }

  private commit(next: StudioSnapshot<T>): void {
    this.past.push(this.present);
    if (this.past.length > this.historyLimit) this.past.shift();
    this.present = next;
    this.future = [];
  }
}

function snapshot<T extends PageLayoutDocument>(
  document: T,
  selectedNodeId: string,
): StudioSnapshot<T> {
  return {
    document: structuredClone(document),
    selectedNodeId,
  };
}

function describeCommand(
  command: LayoutCommand,
  entries: Map<string, { node: LayoutNode }>,
): string {
  const label = (nodeId: string) => {
    const node = entries.get(nodeId)?.node;
    return node ? node.id : nodeId;
  };

  switch (command.type) {
    case 'insert-node':
      return `已添加 ${command.node.id}`;
    case 'move-node':
      return `已将 ${label(command.nodeId)} 移动到 ${label(command.targetId)} ${dropLabel(
        command.position,
      )}`;
    case 'remove-node':
      return `已删除 ${label(command.nodeId)}`;
    case 'set-prop':
      return `已更新 ${label(command.nodeId)} 的 ${command.name}`;
    case 'set-responsive-prop':
      return `已更新 ${label(command.nodeId)} 的${command.breakpoint}断点 ${command.name}`;
  }
}

function dropLabel(position: DropPosition): string {
  if (position === 'before') return '之前';
  if (position === 'after') return '之后';
  return '内部';
}
