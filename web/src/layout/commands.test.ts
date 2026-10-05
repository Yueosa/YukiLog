import { describe, expect, it } from 'vitest';
import {
  applyLayoutCommand,
  indexLayout,
  LayoutCommandError,
  validDropPositions,
} from './commands.js';
import { LayoutStudioStore } from './studio-store.js';
import type { LayoutDocument, LayoutNode } from './types.js';

function node(id: string, type: LayoutNode['type'], children?: LayoutNode[]): LayoutNode {
  const defaults: Partial<Record<LayoutNode['type'], Record<string, unknown>>> = {
    stack: { gap: 'md' },
    card: { variant: 'plain' },
    quote: { text: id },
  };
  return { id, type, props: defaults[type] ?? {}, children };
}

function document(): LayoutDocument {
  return {
    schemaVersion: 1,
    id: 'test-layout',
    label: '测试布局',
    description: '',
    theme: 'nightflight',
    shell: {
      schemaVersion: 1,
      navigation: 'topbar',
      brandPosition: 'start',
      showSearch: true,
      translucent: true,
      maxWidth: 'wide',
    },
    root: node('root-node', 'stack', [
      node('left-stack', 'stack', [node('first-quote', 'quote')]),
      node('right-card', 'card', [node('second-quote', 'quote')]),
    ]),
  };
}

describe('layout commands', () => {
  it('builds parent, index and depth metadata without mutating the tree', () => {
    const source = document();
    const entries = indexLayout(source.root);

    expect(entries.get('root-node')).toMatchObject({ parentId: null, index: 0, depth: 0 });
    expect(entries.get('second-quote')).toMatchObject({
      parentId: 'right-card',
      index: 0,
      depth: 2,
    });
  });

  it('moves a node across containers at an explicit position', () => {
    const source = document();
    const next = applyLayoutCommand(source, {
      type: 'move-node',
      nodeId: 'first-quote',
      targetId: 'second-quote',
      position: 'after',
    });

    expect(source.root.children?.[0].children).toHaveLength(1);
    expect(next.root.children?.[0].children).toHaveLength(0);
    expect(next.root.children?.[1].children?.map((item) => item.id)).toEqual([
      'second-quote',
      'first-quote',
    ]);
  });

  it('rejects cycles and non-container inside drops', () => {
    const source = document();
    expect(validDropPositions(source.root, 'left-stack', 'first-quote')).toEqual([]);
    expect(validDropPositions(source.root, 'first-quote', 'second-quote')).toEqual([
      'before',
      'after',
    ]);
    expect(() =>
      applyLayoutCommand(source, {
        type: 'move-node',
        nodeId: 'first-quote',
        targetId: 'second-quote',
        position: 'inside',
      }),
    ).toThrow(LayoutCommandError);
  });

  it('updates props and responsive overrides immutably', () => {
    const source = document();
    const withText = applyLayoutCommand(source, {
      type: 'set-prop',
      nodeId: 'first-quote',
      name: 'text',
      value: '新的文字',
    });
    const responsive = applyLayoutCommand(withText, {
      type: 'set-responsive-prop',
      nodeId: 'left-stack',
      breakpoint: 'mobile',
      name: 'gap',
      value: 'sm',
    });

    expect(indexLayout(source.root).get('first-quote')?.node.props.text).toBe('first-quote');
    expect(indexLayout(responsive.root).get('first-quote')?.node.props.text).toBe('新的文字');
    expect(indexLayout(responsive.root).get('left-stack')?.node.responsive?.mobile).toEqual({
      gap: 'sm',
    });
  });

  it('accepts only UUID media references for hero backgrounds', () => {
    const source = document();
    source.root.children?.push({
      id: 'home-hero',
      type: 'hero',
      props: {
        variant: 'cinematic',
        title: '欢迎',
        lead: '',
        showSocials: true,
        showEnter: true,
      },
    });
    const valid = applyLayoutCommand(source, {
      type: 'set-prop',
      nodeId: 'home-hero',
      name: 'backgroundMediaId',
      value: '67e55044-10b1-426f-9247-bb680e5fe0c8',
    });
    expect(indexLayout(valid.root).get('home-hero')?.node.props.backgroundMediaId).toBe(
      '67e55044-10b1-426f-9247-bb680e5fe0c8',
    );
    expect(() =>
      applyLayoutCommand(source, {
        type: 'set-prop',
        nodeId: 'home-hero',
        name: 'backgroundMediaId',
        value: '../../secret',
      }),
    ).toThrow(LayoutCommandError);
  });
});

describe('layout studio history', () => {
  it('undoes and redoes document plus selection atomically', () => {
    const store = new LayoutStudioStore(document());
    store.execute({
      type: 'move-node',
      nodeId: 'first-quote',
      targetId: 'right-card',
      position: 'inside',
    });

    expect(store.selectedNodeId).toBe('first-quote');
    expect(indexLayout(store.document.root).get('first-quote')?.parentId).toBe('right-card');
    expect(store.canUndo).toBe(true);

    store.undo();
    expect(store.selectedNodeId).toBe('root-node');
    expect(indexLayout(store.document.root).get('first-quote')?.parentId).toBe('left-stack');

    store.redo();
    expect(store.selectedNodeId).toBe('first-quote');
    expect(indexLayout(store.document.root).get('first-quote')?.parentId).toBe('right-card');
  });

  it('clears redo after a new command and selects the parent after deletion', () => {
    const store = new LayoutStudioStore(document());
    store.execute({ type: 'remove-node', nodeId: 'first-quote' });
    expect(store.selectedNodeId).toBe('left-stack');

    store.undo();
    store.execute({
      type: 'set-prop',
      nodeId: 'first-quote',
      name: 'text',
      value: '替代修改',
    });
    expect(store.canRedo).toBe(false);
  });
});
