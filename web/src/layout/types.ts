export type NavigationVariant = 'topbar' | 'sidebar' | 'floating-dock';
export type ThemeId = 'hanakoi' | 'yukikoi-moonletter';

export type ComponentType =
  | 'stack'
  | 'grid'
  | 'split'
  | 'bento'
  | 'card'
  | 'hero'
  | 'masthead'
  | 'avatar'
  | 'text-block'
  | 'social-links'
  | 'status-line'
  | 'profile-card'
  | 'article-feed'
  | 'quote'
  | 'stats'
  | 'dynamic-strip';

export type ArticleVariant = 'alternating' | 'editorial' | 'cover-overlay' | 'compact';

export type ArticleField =
  | 'cover'
  | 'title'
  | 'summary'
  | 'date'
  | 'category'
  | 'tags'
  | 'views'
  | 'likes';

export interface ResponsiveProps {
  tablet?: Record<string, unknown>;
  mobile?: Record<string, unknown>;
}

export interface LayoutNode {
  id: string;
  type: ComponentType;
  props: Record<string, unknown>;
  responsive?: ResponsiveProps;
  children?: LayoutNode[];
}

export interface ShellLayout {
  schemaVersion: 1;
  navigation: NavigationVariant;
  brandPosition: 'start' | 'center';
  showSearch: boolean;
  translucent: boolean;
  maxWidth: 'content' | 'wide' | 'full';
}

export interface PageLayoutDocument {
  schemaVersion: 1;
  id: string;
  label: string;
  description: string;
  root: LayoutNode;
}

export interface LayoutDocument extends PageLayoutDocument {
  theme: ThemeId;
  shell: ShellLayout;
}

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  group: 'layout' | 'content' | 'decoration';
  acceptsChildren: boolean;
  defaultProps: Readonly<Record<string, unknown>>;
  variants?: readonly string[];
  configurableFields?: readonly string[];
  properties: Readonly<Record<string, PropertySchema>>;
}

export type PropertySchema =
  | {
      kind: 'string';
      values?: readonly string[];
      maxLength?: number;
    }
  | {
      kind: 'boolean';
    }
  | {
      kind: 'integer';
      minimum: number;
      maximum: number;
    }
  | {
      kind: 'string-array';
      values: readonly string[];
      maxItems: number;
    }
  | {
      kind: 'media-image';
    };
