/** 站点外壳设置：导航形态与版面宽度。访客端与管理端共用（原 web/src/layout/types.ts 迁入）。 */
export type NavigationVariant = 'topbar' | 'sidebar' | 'floating-dock';

export interface ShellLayout {
  schemaVersion: 1;
  navigation: NavigationVariant;
  brandPosition: 'start' | 'center';
  showSearch: boolean;
  translucent: boolean;
  maxWidth: 'content' | 'wide' | 'full';
}
