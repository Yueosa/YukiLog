import type {
  ComponentDefinition,
  ComponentType,
  LayoutDocument,
  LayoutNode,
  PageLayoutDocument,
  PropertySchema,
} from './types.js';

const spacing = ['none', 'sm', 'md', 'lg', 'xl'] as const;
const area: PropertySchema = {
  kind: 'string',
  values: [
    'span 3 / span 7',
    'span 4 / span 5',
    'span 8 / span 5',
    'span 9 / span 7',
  ],
};

export const componentRegistry: Record<ComponentType, ComponentDefinition> = {
  stack: {
    type: 'stack',
    label: '纵向堆叠',
    group: 'layout',
    acceptsChildren: true,
    defaultProps: { gap: 'md', maxWidth: 'full', align: 'stretch', sticky: false },
    configurableFields: ['gap', 'maxWidth', 'align'],
    properties: {
      gap: { kind: 'string', values: spacing },
      maxWidth: { kind: 'string', values: ['full', 'content', 'wide'] },
      align: { kind: 'string', values: ['start', 'center', 'stretch'] },
      sticky: { kind: 'boolean' },
      area,
    },
  },
  grid: {
    type: 'grid',
    label: '自由网格',
    group: 'layout',
    acceptsChildren: true,
    defaultProps: { columns: '1fr', gap: 'md', align: 'stretch', maxWidth: '1120px' },
    configurableFields: ['columns', 'gap', 'align'],
    properties: {
      columns: {
        kind: 'string',
        values: [
          '1fr',
          'minmax(0, 1fr) 280px',
          '280px minmax(0, 1fr)',
          '240px minmax(0, 1fr) 240px',
          'auto minmax(0, 1fr) auto',
          'minmax(0, 1fr) 300px',
        ],
      },
      gap: { kind: 'string', values: spacing },
      align: { kind: 'string', values: ['start', 'center', 'stretch'] },
      maxWidth: { kind: 'string', values: ['1120px', '1240px', 'full'] },
      area,
    },
  },
  split: {
    type: 'split',
    label: '主栏与侧栏',
    group: 'layout',
    acceptsChildren: true,
    defaultProps: { sidebarWidth: '270px', side: 'left', gap: 'lg', sticky: false },
    configurableFields: ['sidebarWidth', 'side', 'gap', 'sticky'],
    properties: {
      sidebarWidth: { kind: 'string', values: ['240px', '270px', '320px'] },
      side: { kind: 'string', values: ['left', 'right'] },
      gap: { kind: 'string', values: spacing },
      sticky: { kind: 'boolean' },
      columns: { kind: 'string', values: ['1fr'] },
      area,
    },
  },
  bento: {
    type: 'bento',
    label: 'Bento 区域',
    group: 'layout',
    acceptsChildren: true,
    defaultProps: { columns: 12, rowHeight: 'auto', gap: 'md', maxWidth: '1240px' },
    configurableFields: ['columns', 'rowHeight', 'gap'],
    properties: {
      columns: { kind: 'integer', minimum: 1, maximum: 12 },
      rowHeight: { kind: 'string', values: ['auto', '84px'] },
      gap: { kind: 'string', values: spacing },
      maxWidth: { kind: 'string', values: ['1120px', '1240px', 'full'] },
      area,
    },
  },
  card: {
    type: 'card',
    label: '通用卡片',
    group: 'layout',
    acceptsChildren: true,
    defaultProps: {
      variant: 'plain',
      padding: 'md',
      radius: 'md',
      shadow: 'soft',
      align: 'stretch',
      sticky: false,
    },
    variants: ['plain', 'glass', 'outlined', 'paper'],
    configurableFields: ['variant', 'padding', 'radius', 'shadow', 'align', 'sticky'],
    properties: {
      variant: { kind: 'string', values: ['plain', 'glass', 'outlined', 'paper'] },
      padding: { kind: 'string', values: spacing },
      radius: { kind: 'string', values: ['none', 'sm', 'md', 'lg', 'pill'] },
      shadow: { kind: 'string', values: ['none', 'soft', 'blue', 'pink'] },
      align: { kind: 'string', values: ['start', 'center', 'stretch'] },
      sticky: { kind: 'boolean' },
      area,
    },
  },
  hero: {
    type: 'hero',
    label: '沉浸式首屏',
    group: 'content',
    acceptsChildren: false,
    defaultProps: {
      variant: 'cinematic',
      title: '新的首屏',
      lead: '在属性面板中继续配置。',
      showSocials: true,
      showEnter: true,
      backgroundPosition: 'center',
      overlay: 'medium',
    },
    variants: ['cinematic', 'compact', 'split'],
    configurableFields: [
      'backgroundMediaId',
      'backgroundPosition',
      'overlay',
      'title',
      'accent',
      'lead',
      'showSocials',
      'showEnter',
    ],
    properties: {
      variant: { kind: 'string', values: ['cinematic', 'compact', 'split'] },
      backgroundMediaId: { kind: 'media-image' },
      backgroundPosition: {
        kind: 'string',
        values: ['center', 'top', 'bottom', 'left', 'right'],
      },
      overlay: { kind: 'string', values: ['soft', 'medium', 'strong'] },
      title: { kind: 'string', maxLength: 120 },
      accent: { kind: 'string', maxLength: 8 },
      lead: { kind: 'string', maxLength: 500 },
      showSocials: { kind: 'boolean' },
      showEnter: { kind: 'boolean' },
      area,
    },
  },
  masthead: {
    type: 'masthead',
    label: '文字刊头',
    group: 'content',
    acceptsChildren: false,
    defaultProps: {
      variant: 'minimal',
      title: '新的刊头',
      lead: '一段页面说明。',
      alignment: 'left',
    },
    variants: ['editorial', 'minimal'],
    configurableFields: ['backgroundMediaId', 'kicker', 'title', 'lead', 'alignment'],
    properties: {
      variant: { kind: 'string', values: ['editorial', 'minimal'] },
      backgroundMediaId: { kind: 'media-image' },
      kicker: { kind: 'string', maxLength: 80 },
      title: { kind: 'string', maxLength: 120 },
      lead: { kind: 'string', maxLength: 500 },
      alignment: { kind: 'string', values: ['left', 'center', 'right'] },
      area,
    },
  },
  avatar: {
    type: 'avatar',
    label: '头像',
    group: 'content',
    acceptsChildren: false,
    defaultProps: { source: 'site-owner', size: 'lg', shape: 'circle', label: '头像' },
    variants: ['circle', 'rounded', 'square'],
    configurableFields: ['source', 'size', 'shape', 'label'],
    properties: {
      source: { kind: 'string', values: ['site-owner', 'placeholder'] },
      size: { kind: 'string', values: ['sm', 'md', 'lg', 'xl'] },
      shape: { kind: 'string', values: ['circle', 'rounded', 'square'] },
      label: { kind: 'string', maxLength: 80 },
      area,
    },
  },
  'text-block': {
    type: 'text-block',
    label: '文字块',
    group: 'content',
    acceptsChildren: false,
    defaultProps: {
      source: 'literal',
      variant: 'body',
      text: '新的文字内容',
      alignment: 'left',
    },
    variants: ['eyebrow', 'heading', 'body', 'caption'],
    configurableFields: ['source', 'variant', 'text', 'alignment'],
    properties: {
      source: {
        kind: 'string',
        values: ['literal', 'owner-name', 'owner-bio', 'site-title', 'site-description'],
      },
      variant: { kind: 'string', values: ['eyebrow', 'heading', 'body', 'caption'] },
      text: { kind: 'string', maxLength: 500 },
      alignment: { kind: 'string', values: ['left', 'center', 'right'] },
      area,
    },
  },
  'social-links': {
    type: 'social-links',
    label: '社交链接',
    group: 'content',
    acceptsChildren: false,
    defaultProps: { variant: 'labels', alignment: 'left' },
    variants: ['icons', 'labels', 'pills'],
    configurableFields: ['variant', 'alignment'],
    properties: {
      variant: { kind: 'string', values: ['icons', 'labels', 'pills'] },
      alignment: { kind: 'string', values: ['left', 'center', 'right'] },
      area,
    },
  },
  'status-line': {
    type: 'status-line',
    label: '状态行',
    group: 'decoration',
    acceptsChildren: false,
    defaultProps: { text: 'system.log · online', tone: 'online' },
    variants: ['neutral', 'online', 'accent'],
    configurableFields: ['text', 'tone'],
    properties: {
      text: { kind: 'string', maxLength: 160 },
      tone: { kind: 'string', values: ['neutral', 'online', 'accent'] },
      area,
    },
  },
  'profile-card': {
    type: 'profile-card',
    label: '双面个人卡',
    group: 'content',
    acceptsChildren: false,
    defaultProps: { variant: 'compact', flip: true, showSocials: true, showStatus: true },
    variants: ['portrait', 'letter', 'compact'],
    configurableFields: ['variant', 'flip', 'showSocials', 'showStatus'],
    properties: {
      variant: { kind: 'string', values: ['portrait', 'letter', 'compact'] },
      flip: { kind: 'boolean' },
      showSocials: { kind: 'boolean' },
      showStatus: { kind: 'boolean' },
      area,
    },
  },
  'article-feed': {
    type: 'article-feed',
    label: '文章列表',
    group: 'content',
    acceptsChildren: false,
    defaultProps: {
      variant: 'compact',
      fields: ['title', 'date', 'category'],
      columns: 1,
      limit: 5,
      sort: 'latest',
    },
    variants: ['alternating', 'editorial', 'cover-overlay', 'compact'],
    configurableFields: ['variant', 'fields', 'columns', 'limit', 'sort'],
    properties: {
      variant: {
        kind: 'string',
        values: ['alternating', 'editorial', 'cover-overlay', 'compact'],
      },
      fields: {
        kind: 'string-array',
        values: ['cover', 'title', 'summary', 'date', 'category', 'tags', 'views', 'likes'],
        maxItems: 8,
      },
      columns: { kind: 'integer', minimum: 1, maximum: 4 },
      limit: { kind: 'integer', minimum: 1, maximum: 24 },
      sort: { kind: 'string', values: ['latest', 'popular'] },
      area,
    },
  },
  quote: {
    type: 'quote',
    label: '引语',
    group: 'decoration',
    acceptsChildren: false,
    defaultProps: { text: '新加入的一段引语。', attribution: 'YukiLog', alignment: 'left' },
    configurableFields: ['text', 'attribution', 'alignment'],
    properties: {
      text: { kind: 'string', maxLength: 500 },
      attribution: { kind: 'string', maxLength: 80 },
      alignment: { kind: 'string', values: ['left', 'center', 'right'] },
      area,
    },
  },
  stats: {
    type: 'stats',
    label: '站点数据',
    group: 'content',
    acceptsChildren: false,
    defaultProps: { fields: ['articles', 'dynamics', 'friends', 'views'], compact: true },
    configurableFields: ['fields', 'compact'],
    properties: {
      fields: {
        kind: 'string-array',
        values: ['articles', 'dynamics', 'friends', 'views'],
        maxItems: 4,
      },
      compact: { kind: 'boolean' },
      area,
    },
  },
  'dynamic-strip': {
    type: 'dynamic-strip',
    label: '最近动态',
    group: 'content',
    acceptsChildren: false,
    defaultProps: { limit: 3, variant: 'timeline' },
    configurableFields: ['limit', 'variant'],
    properties: {
      limit: { kind: 'integer', minimum: 1, maximum: 12 },
      variant: { kind: 'string', values: ['handwritten', 'timeline', 'compact'] },
      area,
    },
  },
};

export function validateLayout(document: LayoutDocument): string[] {
  const errors = validatePageLayout(document);
  if (document.theme !== 'nightflight') {
    errors.push('未注册的主题');
  }
  if (document.shell.schemaVersion !== 1) errors.push('不支持的外壳 schemaVersion');
  if (!['topbar', 'sidebar', 'floating-dock'].includes(document.shell.navigation)) {
    errors.push('未注册的导航组件');
  }
  if (!['content', 'wide', 'full'].includes(document.shell.maxWidth)) {
    errors.push('无效的页面宽度');
  }
  return errors;
}

export function toPageLayout(document: LayoutDocument): PageLayoutDocument {
  const { schemaVersion, id, label, description, root } = document;
  return { schemaVersion, id, label, description, root };
}

export function validatePageLayout(document: PageLayoutDocument): string[] {
  const errors: string[] = [];
  if (document.schemaVersion !== 1) errors.push('不支持的布局 schemaVersion');
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(document.id)) errors.push('布局 ID 格式无效');
  if (document.label.length < 1 || document.label.length > 80) errors.push('布局名称长度无效');
  if (document.description.length > 300) errors.push('布局说明过长');
  const seen = new Set<string>();
  let nodeCount = 0;

  const visit = (node: LayoutNode, depth: number) => {
    nodeCount += 1;
    if (nodeCount > 128) {
      errors.push('布局节点不能超过 128 个');
      return;
    }
    if (depth > 12) {
      errors.push(`节点 ${node.id} 的嵌套深度超过 12 层`);
      return;
    }
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(node.id)) errors.push(`节点 ID 格式无效：${node.id}`);
    const definition = componentRegistry[node.type];
    if (!definition) {
      errors.push(`未注册组件：${node.type as string}`);
      return;
    }
    if (seen.has(node.id)) errors.push(`重复节点 ID：${node.id}`);
    seen.add(node.id);
    if (!definition.acceptsChildren && node.children?.length) {
      errors.push(`${definition.label} 不接受子节点`);
    }
    validateProperties(node.id, node.props, definition.properties, errors);
    for (const [breakpoint, overrides] of Object.entries(node.responsive ?? {})) {
      if (breakpoint !== 'tablet' && breakpoint !== 'mobile') {
        errors.push(`节点 ${node.id} 使用了未知响应式断点`);
        continue;
      }
      if ('backgroundMediaId' in overrides) {
        errors.push(`节点 ${node.id} 的响应式覆盖不能修改首屏背景媒体`);
        continue;
      }
      validateProperties(node.id, overrides, definition.properties, errors);
    }
    node.children?.forEach((child) => visit(child, depth + 1));
  };

  visit(document.root, 1);
  return errors;
}

function validateProperties(
  nodeId: string,
  properties: Record<string, unknown>,
  schemas: Readonly<Record<string, PropertySchema>>,
  errors: string[],
) {
  for (const [name, value] of Object.entries(properties)) {
    const schema = schemas[name];
    if (!schema) {
      errors.push(`节点 ${nodeId} 使用了未知属性：${name}`);
      continue;
    }
    if (schema.kind === 'string') {
      if (
        typeof value !== 'string' ||
        (schema.maxLength !== undefined && value.length > schema.maxLength) ||
        (schema.values !== undefined && !schema.values.includes(value))
      ) {
        errors.push(`节点 ${nodeId} 的 ${name} 属性无效`);
      }
    } else if (schema.kind === 'boolean') {
      if (typeof value !== 'boolean') errors.push(`节点 ${nodeId} 的 ${name} 必须是布尔值`);
    } else if (schema.kind === 'integer') {
      if (
        !Number.isInteger(value) ||
        (value as number) < schema.minimum ||
        (value as number) > schema.maximum
      ) {
        errors.push(`节点 ${nodeId} 的 ${name} 必须是有效整数`);
      }
    } else if (schema.kind === 'media-image') {
      if (
        typeof value !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        )
      ) {
        errors.push(`节点 ${nodeId} 的 ${name} 必须引用有效图片`);
      }
    } else if (
      !Array.isArray(value) ||
      value.length > schema.maxItems ||
      new Set(value).size !== value.length ||
      value.some((item) => typeof item !== 'string' || !schema.values.includes(item))
    ) {
      errors.push(`节点 ${nodeId} 的 ${name} 列表无效`);
    }
  }
}

export function flattenLayout(root: LayoutNode): LayoutNode[] {
  return [root, ...(root.children?.flatMap(flattenLayout) ?? [])];
}
