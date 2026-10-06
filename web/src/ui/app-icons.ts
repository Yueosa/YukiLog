import { html, nothing, type TemplateResult } from 'lit';

export type IconName =
  | 'home'
  | 'article'
  | 'dynamic'
  | 'friends'
  | 'search'
  | 'menu'
  | 'close'
  | 'github'
  | 'chat'
  | 'video'
  | 'x'
  | 'music'
  | 'mail'
  | 'rss'
  | 'arrow-down';

export const publicNavigation = [
  { label: '首页', href: '/', icon: 'home' },
  { label: '文章', href: '/articles', icon: 'article' },
  { label: '动态', href: '/dynamics', icon: 'dynamic' },
  { label: '友链', href: '/friends', icon: 'friends' },
] as const;

export function icon(name: IconName) {
  switch (name) {
    case 'home':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z" /></svg>`;
    case 'article':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4M15 3v4h4" /></svg>`;
    case 'dynamic':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4zM8 9h8M8 13h5" /></svg>`;
    case 'friends':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20c.6-3.3 2.4-5 5.5-5s4.9 1.7 5.5 5M14 15.5c3.7-.8 5.8.7 6.5 3.5" /></svg>`;
    case 'search':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>`;
    case 'menu':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>`;
    case 'close':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>`;
    case 'github':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12.3c0 5.2 3.4 9.6 8.1 11.2.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.4-1.3-5.4-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.4 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>`;
    case 'chat':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.1 2C6.6 2 2.2 6.1 2.2 11.2c0 2.9 1.5 5.5 3.9 7.2-.2.8-.7 2.1-1.6 3.3 1.8-.2 3.5-1 4.6-1.8 1 .3 2 .4 3 .4 5.5 0 9.9-4.1 9.9-9.1S17.6 2 12.1 2Z"/></svg>`;
    case 'video':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7.2l-2.3 2.7a1 1 0 0 1-1.6 0L6.6 17H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm6.2 3.2v5.6l5-2.8-5-2.8Z"/></svg>`;
    case 'x':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 10.3 22 2h-2.2l-6.2 7.1L8.7 2H2l7.7 11.1L2 22h2.2l6.8-7.8L15.3 22H22l-7.3-11.7Zm-2.4 2.8-.8-1.1L5 3.6h2.7l5 7.2.8 1.1 6.5 9.3h-2.7l-5.4-7.1Z"/></svg>`;
    case 'music':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.5A3.5 3.5 0 1 1 5.5 15V6.8l12-2.4v9.6a3.5 3.5 0 1 1-2 3.1V8.2l-6.5 1.3v9Z"/></svg>`;
    case 'mail':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2L20.2 7H3.8L12 12.2Z"/></svg>`;
    case 'rss':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-1-8a1 1 0 0 1 1-1 8 8 0 0 1 8 8 1 1 0 1 1-2 0 6 6 0 0 0-6-6 1 1 0 0 1-1-1Zm0-6a1 1 0 0 1 1-1 14 14 0 0 1 14 14 1 1 0 1 1-2 0A12 12 0 0 0 5 7a1 1 0 0 1-1-1Z"/></svg>`;
    case 'arrow-down':
      return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7" /></svg>`;
  }
}

