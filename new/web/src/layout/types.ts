export type NavigationVariant = 'topbar' | 'sidebar' | 'floating-dock';

export type ComponentType =
  | 'stack'
  | 'grid'
  | 'split'
  | 'bento'
  | 'hero'
  | 'masthead'
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
  navigation: NavigationVariant;
  brandPosition: 'start' | 'center';
  showSearch: boolean;
  translucent: boolean;
}

export interface PageLayoutDocument {
  schemaVersion: 1;
  id: string;
  label: string;
  description: string;
  root: LayoutNode;
}

export interface LayoutDocument extends PageLayoutDocument {
  theme: 'hanakoi' | 'moonletter' | 'orbit';
  shell: ShellLayout;
}

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  group: 'layout' | 'content' | 'decoration';
  acceptsChildren: boolean;
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
    };
