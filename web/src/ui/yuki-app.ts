import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { homeLayout, partNameOf, type ArticleField, type HomeNode } from './home-layout.js';
import * as api from './api.js';
import { paletteFor } from './cover.js';
import './cover.js';
import { buildCommentTree, type CommentNode } from './comment-tree.js';
import { loadCommenter, saveCommenter, type Commenter } from './commenter.js';
import {
  excerpt,
  formatDate,
  formatDateTime,
  formatMonthDay,
  readingMinutes,
  relTime,
  textFromHtml,
  yearOf,
} from './format.js';
import { PublicStore } from './store.js';

type IconName =
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

const publicNavigation = [
  { label: '首页', href: '/', icon: 'home' },
  { label: '文章', href: '/articles', icon: 'article' },
  { label: '动态', href: '/dynamics', icon: 'dynamic' },
  { label: '友链', href: '/friends', icon: 'friends' },
] as const;

function icon(name: IconName) {
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

/** 组件内部使用的站点视图：/api/public/site 的归一化形态。 */
interface SiteView {
  siteTitle: string;
  siteDescription: string;
  ownerName: string;
  ownerBio: string;
  avatarUrl: string;
  socialLinks: Array<{ label: string; url: string }>;
  mastheadUrl: string;
  /** null = 站点信息还没加载完成 */
  mailEnabled: boolean | null;
  heroBackgrounds: Array<{ url: string; position: string | null; size: string | null }>;
  heroQuote: string | null;
}

const emptySiteView: SiteView = {
  siteTitle: 'YukiLog',
  siteDescription: '',
  ownerName: '',
  ownerBio: '',
  avatarUrl: '',
  mastheadUrl: '',
  socialLinks: [],
  mailEnabled: null,
  heroBackgrounds: [],
  heroQuote: null,
};

function toSiteView(site: api.PublicSite): SiteView {
  return {
    siteTitle: site.siteTitle,
    siteDescription: site.siteDescription ?? '',
    ownerName: site.ownerName,
    ownerBio: site.ownerBio,
    avatarUrl: site.avatarUrl,
    mastheadUrl: site.mastheadUrl ?? '',
    socialLinks: site.socialLinks ?? [],
    mailEnabled: site.mailEnabled === true,
    heroBackgrounds: Array.isArray(site.heroBackgrounds) ? site.heroBackgrounds : [],
    heroQuote: typeof site.heroQuote === 'string' && site.heroQuote.trim() ? site.heroQuote : null,
  };
}

function socialIcon(label: string, index: number): IconName {
  const normalized = label.toLowerCase();
  if (normalized.includes('github')) return 'github';
  if (normalized.includes('qq')) return 'chat';
  if (normalized.includes('bili') || normalized.includes('视频')) return 'video';
  if (normalized === 'x' || normalized.includes('twitter')) return 'x';
  if (normalized.includes('音乐') || normalized.includes('music')) return 'music';
  if (normalized.includes('mail') || normalized.includes('邮箱')) return 'mail';
  return (['github', 'chat', 'video', 'x', 'music', 'mail'] as const)[index % 6];
}

// 首屏社交图标：旧版 YukiLog 的填充式品牌图标
function socialGlyph(label: string, index: number) {
  if (label === 'RSS') return icon('rss');
  const normalized = label.toLowerCase();
  if (normalized.includes('github')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.884 18.653c-.3-.2-.558-.455-.86-.816a51 51 0 0 1-.466-.579c-.463-.575-.755-.841-1.056-.95a1 1 0 1 1 .675-1.882c.752.27 1.261.735 1.947 1.588c-.094-.117.34.427.433.539c.19.227.33.365.44.438c.204.137.588.196 1.15.14c.024-.382.094-.753.202-1.095c-2.968-.726-4.648-2.64-4.648-6.396c0-1.24.37-2.356 1.058-3.292c-.218-.894-.185-1.975.302-3.192a1 1 0 0 1 .63-.582c.081-.024.127-.035.208-.047c.803-.124 1.937.17 3.415 1.096a11.7 11.7 0 0 1 2.687-.308c.912 0 1.819.104 2.684.308c1.477-.933 2.614-1.227 3.422-1.096q.128.02.218.05a1 1 0 0 1 .616.58c.487 1.216.52 2.296.302 3.19c.691.936 1.058 2.045 1.058 3.293c0 3.757-1.674 5.665-4.642 6.392c.125.415.19.878.19 1.38c0 .665-.002 1.299-.007 2.01c0 .19-.002.394-.005.706a1 1 0 0 1-.018 1.958c-1.14.227-1.984-.532-1.984-1.525l.002-.447l.005-.705c.005-.707.008-1.337.008-1.997c0-.697-.184-1.152-.426-1.361c-.661-.57-.326-1.654.541-1.751c2.966-.333 4.336-1.482 4.336-4.66c0-.955-.312-1.744-.913-2.404A1 1 0 0 1 17.2 6.19c.166-.414.236-.957.095-1.614l-.01.003c-.491.139-1.11.44-1.858.949a1 1 0 0 1-.833.135a9.6 9.6 0 0 0-2.592-.349c-.89 0-1.772.118-2.592.35a1 1 0 0 1-.829-.134c-.753-.507-1.374-.807-1.87-.947c-.143.653-.072 1.194.093 1.607a1 1 0 0 1-.189 1.045c-.597.655-.913 1.458-.913 2.404c0 3.172 1.371 4.328 4.322 4.66c.865.097 1.202 1.177.545 1.748c-.193.168-.43.732-.43 1.364v3.15c0 .985-.834 1.725-1.96 1.528a1 1 0 0 1-.04-1.962v-.99c-.91.061-1.661-.088-2.254-.485"/></svg>`;
  }
  if (normalized.includes('qq')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17.536 12.514l-.696-1.796c0-.021.01-.375.01-.558C16.85 7.088 15.447 4 12 4s-4.848 3.088-4.848 6.16c0 .183.009.537.01.557l-.696 1.797c-.19.515-.38 1.05-.517 1.51c-.657 2.189-.444 3.095-.282 3.115c.348.043 1.354-1.648 1.354-1.648c0 .98.487 2.258 1.542 3.18c-.394.127-.878.32-1.188.557c-.28.214-.245.431-.194.52c.22.385 3.79.245 4.82.125c1.03.12 4.599.26 4.82-.126c.05-.088.085-.305-.194-.519c-.311-.237-.795-.43-1.19-.556c1.055-.923 1.542-2.202 1.542-3.181c0 0 1.007 1.691 1.355 1.648c.162-.02.378-.928-.283-3.116a27 27 0 0 0-.516-1.509m1.021 8.227c-.373.652-.833.892-1.438 1.057a5 5 0 0 1-.794.138c-.44.045-.986.065-1.613.064a33 33 0 0 1-2.71-.116c-.692.065-1.785.114-2.71.116a16 16 0 0 1-1.614-.064a5 5 0 0 1-.793-.138c-.605-.164-1.065-.405-1.44-1.059a2.27 2.27 0 0 1-.239-1.652c-.592-.132-1.001-.482-1.279-.911a2.4 2.4 0 0 1-.309-.71a4 4 0 0 1-.116-1.106c.013-.785.187-1.762.532-2.912c.14-.466.327-1.008.567-1.655l.554-1.43l-.002-.203C5.153 5.605 7.589 2 12 2c4.413 0 6.848 3.605 6.848 8.16l-.001.203l.553 1.43l.01.026c.225.606.413 1.153.556 1.626c.348 1.15.522 2.128.535 2.916q.012.61-.118 1.108c-.066.246-.161.48-.31.708c-.276.427-.684.776-1.277.91c.13.554.055 1.14-.24 1.654"/></svg>`;
  }
  if (normalized.includes('bili') || normalized.includes('视频')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.172 2.757L10.414 6h3.171l3.243-3.242a1 1 0 1 1 1.415 1.415L16.414 6H18.5A3.5 3.5 0 0 1 22 9.5v8a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5v-8A3.5 3.5 0 0 1 5.5 6h2.085L5.757 4.171a1 1 0 0 1 1.415-1.415M18.5 8h-13a1.5 1.5 0 0 0-1.493 1.356L4 9.5v8a1.5 1.5 0 0 0 1.356 1.493L5.5 19h13a1.5 1.5 0 0 0 1.493-1.355L20 17.5v-8A1.5 1.5 0 0 0 18.5 8M8 11a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1m8 0a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1"/></svg>`;
  }
  if (normalized === 'x' || normalized.includes('twitter')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17.687 3.063l-4.996 5.711l-4.32-5.711H2.112l7.477 9.776l-7.086 8.099h3.034l5.469-6.25l4.78 6.25h6.102l-7.794-10.304l6.625-7.571zm-1.064 16.06L5.654 4.782h1.803l10.846 14.34z"/></svg>`;
  }
  if (normalized.includes('音乐') || normalized.includes('music')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.422 11.375c-.294 1.028.012 2.065.784 2.653c1.061.81 2.565.3 2.874-.995c.08-.337.103-.722.027-1.056c-.23-1.001-.521-1.988-.792-2.996c-1.33.154-2.543 1.172-2.893 2.394m5.548-.287c.273 1.012.285 2.017-.127 3c-1.128 2.69-4.722 3.14-6.573.826c-1.302-1.627-1.28-3.961.06-5.734c.78-1.032 1.804-1.707 3.048-2.054l.379-.104c-.084-.415-.188-.816-.243-1.224c-.176-1.317.512-2.503 1.744-3.04c1.226-.535 2.708-.216 3.53.76c.406.479.395 1.08-.025 1.464c-.412.377-.997.346-1.435-.09c-.247-.246-.51-.44-.877-.436c-.525.006-.987.418-.945.937c.037.468.172.93.3 1.386c.022.078.216.135.338.153c1.333.197 2.504.731 3.472 1.676c2.558 2.493 2.861 6.531.672 9.44c-1.529 2.032-3.61 3.169-6.127 3.409c-4.621.44-8.664-2.53-9.7-7.058C2.516 10.255 4.84 5.831 8.796 4.25c.586-.234 1.143-.031 1.371.498c.232.537-.019 1.086-.61 1.35c-2.368 1.06-3.817 2.855-4.215 5.424c-.533 3.433 1.656 6.776 5 7.72c2.723.77 5.658-.166 7.308-2.33c1.586-2.08 1.4-5.099-.427-6.873A4 4 0 0 0 15.4 9.026c.198.716.389 1.388.57 2.062"/></svg>`;
  }
  if (normalized.includes('mail') || normalized.includes('邮箱') || normalized.includes('gmail')) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m17 4.238l-7.928 7.1L4 7.216V19h16zM4.511 5l7.55 6.662L19.502 5z"/></svg>`;
  }
  return icon(socialIcon(label, index));
}

export class YukiApp extends LitElement {
  private flippedProfiles = new Set<string>();
  private readonly store = new PublicStore();
  private unsubscribeStore: (() => void) | null = null;
  private mobileMenuOpen = false;
  private navPastHero = false;
  private spaNavigated = false;
  private revealInstant = false;
  private quoteRefreshBusy = false;
  private feedSort: api.FeedSort | null = null;
  private commentFormOpen = false;
  private commentBusy = false;
  private commentError = '';
  private commentSentFor = '';
  private commenter: Commenter = loadCommenter();
  private subscribeBusy = false;
  private subscribeDone = new Set<string>();
  private subscribeFailed = new Set<string>();
  private friendApplyBusy = false;
  private friendApplyDone = false;
  private friendApplyError = '';
  private momentReplyOpen = new Set<string>();
  private momentReplySent = new Set<string>();
  private momentReplyBusy = new Set<string>();
  private momentReplyError = new Map<string, string>();
  private momentExtrasRequested = new Set<string>();
  private momentObserver: IntersectionObserver | null = null;
  private tocItems: { id: string; text: string; level: number }[] = [];
  private tocActive = '';
  private tocPath = '';
  private tocObserver: IntersectionObserver | null = null;
  private readonly scrollPositions = new Map<string, number>();
  private pendingScrollRestore: number | null = null;
  private hashHandled = '';
  private heroBgIndex = 0;
  private heroBgSeeded = false;
  private heroBgTimer: number | null = null;
  private heroReady = false;
  private splashAwaitingHero = false;
  private splashHardCap: number | null = null;
  /** 会话级驻留的首屏/刊头图：挂在组件上防内存缓存被逐出，SPA 换页回来不再重载。 */
  private readonly retainedImages: HTMLImageElement[] = [];
  /** 已完成驻留预载的图片 URL：轮换层只渲染当前图与已就绪图，避免冷启动全池抢带宽。 */
  private readonly heroBgRetained = new Set<string>();
  private splashActive = false;
  private splashDone = false;
  private splashStarted = false;
  private splashTimers: number[] = [];
  private lightboxImages: string[] = [];
  private lightboxIndex = 0;
  private commentReplyTo: { id: string; name: string } | null = null;
  private readonly momentReplyTo = new Map<string, { id: string; name: string }>();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private revealObserver: IntersectionObserver | null = null;

  /** 当前生效的站点数据：API 数据，未加载完为空壳。 */
  private get siteData(): SiteView {
    const data = this.store.site.data;
    return data ? toSiteView(data) : emptySiteView;
  }

  /** 外壳设置：站点设置下发，未加载时用夜航默认外壳。 */
  private get shell() {
    return (
      this.store.site.data?.shellLayout ?? {
        schemaVersion: 1,
        navigation: 'topbar',
        brandPosition: 'start',
        showSearch: true,
        translucent: true,
        maxWidth: 'wide',
      }
    );
  }

  private routeKey(): string {
    return `${window.location.pathname}${window.location.search}`;
  }

  private readonly handlePopState = () => {
    // 浏览器前进/后退：恢复该条目离开时的滚动位置（列表页体验关键）。
    this.pendingScrollRestore = this.scrollPositions.get(this.routeKey()) ?? null;
    this.handleRouteChange();
  };

  private readonly handleRouteChange = () => {
    this.mobileMenuOpen = false;
    document.body.style.overflow = '';
    if (this.spaNavigated) this.revealInstant = true;
    this.classList.toggle('spa-return', this.spaNavigated);
    this.handleViewportScroll();
    this.syncRouteData();
    this.requestUpdate();
  };

  /* ---------- 开屏动画（yukikoi 语义：每次冷进入播放，CSS 定时，JS 兜底） ---------- */

  private startSplash() {
    if (this.splashStarted) return;
    this.splashStarted = true;
    if (this.reducedMotion || window.location.pathname.startsWith('/admin')) return;
    this.splashActive = true;
    // 硬兜底：无论资源是否就绪，8s 后必须进场，不把访客困在开屏
    this.splashHardCap = window.setTimeout(() => this.leaveSplash(true), 8000);
    // 首帧前就把 is-intro 挂上，避免首屏入场动画抢跑
    this.classList.add('is-intro');
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', this.handleSplashSkip, { once: true });
    void this.updateComplete.then(() => this.armSplashTimers());
  }

  private splashPrelude(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.prelude');
  }

  private splashExitAnimation(prelude: HTMLElement): Animation | undefined {
    return (prelude.getAnimations?.() ?? []).find((animation) =>
      (animation as CSSAnimation).animationName?.startsWith('prelude-exit'),
    );
  }

  private armSplashTimers() {
    if (this.splashDone) return;
    const prelude = this.splashPrelude();
    if (!prelude) {
      this.leaveSplash();
      return;
    }
    prelude.addEventListener('click', this.handleSplashSkip);
    // 兜底：CSS 不可用或资源 6s 内未就绪时强制进场
    this.splashTimers.push(window.setTimeout(() => this.leaveSplash(true), 6000));
    const exit = this.splashExitAnimation(prelude);
    exit?.ready.then(
      () => {
        if (this.splashDone) return;
        const delay = Number(exit.effect?.getComputedTiming().delay ?? 0);
        const current = Number(exit.currentTime ?? 0);
        this.splashTimers.forEach((timer) => window.clearTimeout(timer));
        this.splashTimers = [
          window.setTimeout(() => this.leaveSplash(), Math.max(0, delay - current)),
        ];
      },
      () => undefined,
    );
  }

  private readonly handleSplashSkip = () => {
    if (this.splashDone) return;
    this.splashPrelude()?.classList.add('is-skipped');
    this.leaveSplash(true);
  };

  private leaveSplash(force = false) {
    if (this.splashDone) return;
    // 开屏动画兼作加载屏：站点数据未就绪、或已配置首屏背景但当前图未加载完时，
    // 暂停退场动画继续等待（点击/按键/6s 兜底可强制跳过）。
    if (!force) {
      const siteStatus = this.store.site.status;
      const sitePending = siteStatus === 'idle' || siteStatus === 'loading';
      const heroPending = this.siteData.heroBackgrounds.length > 0 && !this.heroReady;
      if (sitePending || heroPending) {
        if (!this.splashAwaitingHero) {
          this.splashAwaitingHero = true;
          this.splashPrelude()?.classList.add('is-waiting');
          this.requestUpdate();
        }
        return;
      }
    }
    this.splashAwaitingHero = false;
    this.splashDone = true;
    if (this.splashHardCap !== null) {
      window.clearTimeout(this.splashHardCap);
      this.splashHardCap = null;
    }
    this.splashTimers.forEach((timer) => window.clearTimeout(timer));
    this.splashTimers = [];
    window.removeEventListener('keydown', this.handleSplashSkip);
    document.body.style.overflow = '';
    const prelude = this.splashPrelude();
    prelude?.classList.remove('is-waiting');
    prelude?.classList.add('is-leaving');
    // is-intro 解除 → 首屏入场动画开始（CSS），退场动画结束后移除开屏层
    this.requestUpdate();
    const exit = prelude ? this.splashExitAnimation(prelude) : undefined;
    const done = () => {
      this.splashActive = false;
      this.requestUpdate();
    };
    if (exit) exit.finished.then(done, done);
    else done();
  }

  private renderSplash() {
    if (!this.splashActive) return nothing;
    return html`
      <div class="prelude" aria-hidden="true">
        <div class="prelude-bloom"></div>
        <div class="prelude-stage">
          <p class="prelude-kicker">YukiLog — Night Flight</p>
          <strong class="prelude-title">${this.siteData.siteTitle || 'YukiLog'}</strong>
          <span class="prelude-flake">❄</span>
        </div>
        <div class="prelude-trace">
          <svg viewBox="0 0 1200 60" preserveAspectRatio="none" focusable="false">
            <path class="prelude-track" d="M0 30H1200" />
            <path class="prelude-line" pathLength="1" d="M0 30H1200" />
          </svg>
        </div>
        <span class="prelude-hint">${this.splashAwaitingHero ? '正在加载首屏资源 · 点击或按任意键跳过' : '点击或按任意键跳过'}</span>
      </div>
    `;
  }

  /* ---------- 灯箱 ---------- */

  private openLightbox(images: string[], index: number) {
    const valid = images.filter((url) => typeof url === 'string' && url !== '');
    if (valid.length === 0) return;
    this.lightboxImages = valid;
    this.lightboxIndex = Math.min(Math.max(0, index), valid.length - 1);
    document.body.style.overflow = 'hidden';
    this.requestUpdate();
  }

  private closeLightbox() {
    if (this.lightboxImages.length === 0) return;
    this.lightboxImages = [];
    document.body.style.overflow = '';
    this.requestUpdate();
  }

  private stepLightbox(direction: -1 | 1) {
    const count = this.lightboxImages.length;
    if (count === 0) return;
    this.lightboxIndex = (this.lightboxIndex + direction + count) % count;
    this.requestUpdate();
  }

  private readonly handleLightboxKeydown = (event: KeyboardEvent) => {
    if (this.lightboxImages.length === 0) return;
    if (event.key === 'Escape') this.closeLightbox();
    else if (event.key === 'ArrowLeft') this.stepLightbox(-1);
    else if (event.key === 'ArrowRight') this.stepLightbox(1);
  };

  // 正文图片点击进灯箱：以全文所有图片为一组，支持左右切换。
  private readonly handleProseClick = (event: Event) => {
    const path = event.composedPath();
    // 旁注上标：点按弹出浮层（窄屏文末区块太远，浮层就地展开）
    const noteLink = path.find(
      (node): node is HTMLAnchorElement =>
        node instanceof HTMLAnchorElement && node.closest('.lm-noteref') !== null,
    );
    if (noteLink) {
      const anchor = noteLink.getAttribute('href')?.slice(1) ?? '';
      const note = anchor
        ? this.renderRoot.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`)
        : null;
      if (note) {
        event.preventDefault();
        event.stopPropagation();
        const rect = noteLink.getBoundingClientRect();
        this.notePopover = {
          html: note.innerHTML,
          x: Math.max(12, Math.min(rect.left, window.innerWidth - 340)),
          y: rect.bottom + 8,
        };
        this.requestUpdate();
        return;
      }
    }
    // mermaid 图表点击进灯箱：序列化内联 SVG 为 data URL 交给现有灯箱。
    // 复制节点并钉死像素尺寸——渲染态 width=100% 无内在尺寸，
    // <img> 会按 300×150 默认值缩成小点
    const svgNode = path.find(
      (node): node is SVGSVGElement =>
        node instanceof SVGSVGElement && node.closest('pre.lm-mermaid') !== null,
    );
    if (svgNode) {
      const clone = svgNode.cloneNode(true) as SVGSVGElement;
      const rect = svgNode.getBoundingClientRect();
      const width = Math.max(Math.round(rect.width * 2), 1200);
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', 'auto');
      clone.setAttribute('style', 'background:#fff');
      const markup = new XMLSerializer().serializeToString(clone);
      this.openLightbox(
        [`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`],
        0,
      );
      return;
    }
    const image = path.find((node): node is HTMLImageElement => node instanceof HTMLImageElement);
    if (!image) return;
    const prose = this.renderRoot.querySelector('.prose');
    const images = prose
      ? [...prose.querySelectorAll('img')]
          .map((item) => item.currentSrc || item.src)
          .filter((url) => url !== '')
      : [];
    const current = image.currentSrc || image.src;
    const index = Math.max(0, images.indexOf(current));
    this.openLightbox(images.length > 0 ? images : [current], index);
  };

  /** 旁注浮层（点按上标展开）；滚动/点别处即关。 */
  private notePopover: { html: string; x: number; y: number } | null = null;

  private renderNotePopover() {
    if (!this.notePopover) return nothing;
    return html`
      <div class="note-pop-backdrop" @click=${() => {
        this.notePopover = null;
        this.requestUpdate();
      }}></div>
      <div
        class="note-pop"
        role="note"
        style=${styleMap({ left: `${this.notePopover.x}px`, top: `${this.notePopover.y}px` })}
      >
        ${unsafeHTML(this.notePopover.html)}
      </div>
    `;
  }

  private renderLightbox() {
    if (this.lightboxImages.length === 0) return nothing;
    const count = this.lightboxImages.length;
    const current = this.lightboxImages[this.lightboxIndex];
    return html`
      <div
        class="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="查看图片"
        @click=${() => this.closeLightbox()}
      >
        <button class="lightbox-close" type="button" aria-label="关闭">×</button>
        ${count > 1
          ? html`<button
                class="lightbox-nav prev"
                type="button"
                aria-label="上一张"
                @click=${(event: Event) => {
                  event.stopPropagation();
                  this.stepLightbox(-1);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button
                class="lightbox-nav next"
                type="button"
                aria-label="下一张"
                @click=${(event: Event) => {
                  event.stopPropagation();
                  this.stepLightbox(1);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>`
          : nothing}
        ${keyed(
          this.lightboxIndex,
          html`<img
            class="lightbox-image"
            src=${current}
            alt="查看原图"
            @click=${(event: Event) => event.stopPropagation()}
          />`,
        )}
        ${count > 1
          ? html`<span class="lightbox-counter">${this.lightboxIndex + 1} / ${count}</span>`
          : nothing}
      </div>
    `;
  }

  /** 按当前地址同步数据。 */
  private syncRouteData() {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) return;
    const params = new URLSearchParams(window.location.search);
    const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
    this.store.ensureSite();
    if (path === '/') {
      this.store.ensureHitokoto();
      const sortParam = params.get('sort');
      if (sortParam === 'featured' || sortParam === 'popular' || sortParam === 'recent') {
        this.feedSort = sortParam;
      }
      this.store.loadHomeFeed(this.currentFeedSort());
      this.store.loadDynamics(1);
      this.store.ensureFriends();
      this.store.ensurePulse();
      this.setTitle('');
      return;
    }
    if (path === '/articles') {
      this.store.loadArchive({ page });
      this.setTitle('文章');
      return;
    }
    if (path.startsWith('/articles/')) {
      const slug = decodeURIComponent(path.slice('/articles/'.length));
      if (slug) this.store.loadArticle(slug);
      this.commentFormOpen = false;
      this.commentError = '';
      this.commentReplyTo = null;
      this.setTitle('文章');
      return;
    }
    if (path === '/dynamics') {
      this.store.loadDynamics(1);
      this.setTitle('动态');
      return;
    }
    if (path === '/friends') {
      this.store.ensureFriends();
      this.setTitle('友链');
      return;
    }
    if (path === '/search') {
      const query = params.get('q')?.trim() ?? '';
      const category = params.get('category') ?? '';
      const tag = params.get('tag') ?? '';
      if (query) this.store.loadSearch(query, page);
      else if (category || tag) this.store.loadArchive({ category, tag, page });
      this.store.loadFacets();
      this.setTitle('搜索');
      return;
    }
    this.setTitle('页面不存在');
  }

  private titleSection = '';

  private setTitle(section: string) {
    this.titleSection = section;
    this.syncDocumentTitle();
  }

  private syncDocumentTitle() {
    const siteTitle = this.store.site.data?.siteTitle || 'YukiLog';
    const path = window.location.pathname;
    let section = this.titleSection;
    if (path.startsWith('/articles/')) {
      const slug = decodeURIComponent(path.slice('/articles/'.length));
      const detail = this.store.articlesBySlug.get(slug)?.data;
      if (detail) section = detail.title;
    }
    document.title = section ? `${section} · ${siteTitle}` : siteTitle;
  }

  private readonly handleViewportScroll = () => {
    this.updateScrollRing();
    if (this.notePopover) {
      this.notePopover = null;
      this.requestUpdate();
    }
    const home = window.location.pathname === '/';
    if (!home) {
      if (!this.navPastHero) {
        this.navPastHero = true;
        this.requestUpdate();
      }
      return;
    }
    const pastHero = window.scrollY >= window.innerHeight * 0.72;
    if (pastHero !== this.navPastHero) {
      this.navPastHero = pastHero;
      this.requestUpdate();
    }
    this.updateHeroParallax();
  };

  private updateScrollRing() {
    const ring = this.renderRoot?.querySelector<SVGCircleElement>('.to-top .ring-fg');
    if (!ring) return;
    const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = Math.min(window.scrollY / max, 1);
    ring.style.strokeDashoffset = String(125.66 * (1 - progress));
  }

  private updateHeroParallax() {
    if (this.reducedMotion) return;
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (y >= vh) return;
    const background = this.renderRoot.querySelector<HTMLElement>('.hero-background');
    const inner = this.renderRoot.querySelector<HTMLElement>('.hero-inner');
    if (background) background.style.transform = `translateY(${y * 0.28}px)`;
    if (inner) {
      const progress = Math.min(y / (vh * 0.62), 1);
      inner.style.opacity = String(1 - progress);
      inner.style.transform = `translateY(${y * 0.12}px)`;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this.handlePopState);
    window.addEventListener('scroll', this.handleViewportScroll, { passive: true });
    this.addEventListener('click', this.handleSiteClick);
    this.addEventListener('submit', this.handleSiteSubmit);
    window.addEventListener('keydown', this.handleLightboxKeydown);
    window.addEventListener('message', this.handlePartsPreview);
    // 滚动恢复由 SPA 自己管理，浏览器原生恢复会让列表页跳动。
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    // 冷进入一律从顶部开始：浏览器原生恢复会在 JS 执行前把页面拉回旧位置，
    // 开屏 → 首屏的编排建立在顶部状态上（刷新后回到首屏）。
    window.scrollTo(0, 0);
    this.unsubscribeStore = this.store.subscribe(() => {
      this.syncDocumentTitle();
      // 站点数据到达后旋钮才可读：确保当前有效排序的文章流已加载（幂等）
      if (window.location.pathname === '/') this.store.loadHomeFeed(this.currentFeedSort());
      this.requestUpdate();
    });
    this.startSplash();
    this.handleViewportScroll();
    this.syncRouteData();
  }

  disconnectedCallback() {
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('scroll', this.handleViewportScroll);
    this.removeEventListener('click', this.handleSiteClick);
    this.removeEventListener('submit', this.handleSiteSubmit);
    window.removeEventListener('keydown', this.handleLightboxKeydown);
    window.removeEventListener('message', this.handlePartsPreview);
    this.revealObserver?.disconnect();
    this.revealObserver = null;
    this.momentObserver?.disconnect();
    this.momentObserver = null;
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    if (this.heroBgTimer !== null) {
      window.clearInterval(this.heroBgTimer);
      this.heroBgTimer = null;
    }
    this.splashTimers.forEach((timer) => window.clearTimeout(timer));
    this.splashTimers = [];
    window.removeEventListener('keydown', this.handleSplashSkip);
    document.body.style.overflow = '';
    super.disconnectedCallback();
  }

  // 站内路由：同一自定义元素内 pushState，避免整页重建导致导航与首屏动画重放。
  // 注意：shadow DOM 事件重定向会让 event.target 指向宿主，必须从 composedPath 里找锚点。
  private readonly handleSiteClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = event
      .composedPath()
      .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
    if (!anchor || anchor.target) return;
    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith('/') || href.startsWith('//')) return;
    if (/^\/(admin|api|media|subscriptions|feeds|feed\.xml)/.test(href)) return;
    event.preventDefault();
    if (href === window.location.pathname + window.location.search) return;
    this.scrollPositions.set(this.routeKey(), window.scrollY);
    window.history.pushState(null, '', href);
    this.spaNavigated = true;
    window.scrollTo(0, 0);
    this.handleRouteChange();
  };

  private readonly handleSiteSubmit = (event: SubmitEvent) => {
    if (event.defaultPrevented) return;
    const form = event
      .composedPath()
      .find((node): node is HTMLFormElement => node instanceof HTMLFormElement);
    if (!form || form.method.toLowerCase() !== 'get') return;
    const action = form.getAttribute('action') ?? '';
    if (!action.startsWith('/')) return;
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === 'string' && value) params.set(key, value);
    });
    const search = params.toString();
    this.scrollPositions.set(this.routeKey(), window.scrollY);
    window.history.pushState(null, '', `${action}${search ? `?${search}` : ''}`);
    this.spaNavigated = true;
    window.scrollTo(0, 0);
    this.handleRouteChange();
  };

  // 公开表单：邮件订阅 / 友链申请。后端不可达时给出内联错误，不打断浏览。
  private async submitSubscribe(event: SubmitEvent, kind: 'articles' | 'dynamics') {
    event.preventDefault();
    if (this.subscribeBusy) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    if (!email) return;
    const withOther = data.get('with_other') === 'on';
    this.subscribeBusy = true;
    this.subscribeFailed.delete(kind);
    this.requestUpdate();
    try {
      await api.subscribe(email, kind === 'articles' || withOther, kind === 'dynamics' || withOther);
      this.subscribeDone.add(kind);
    } catch {
      this.subscribeFailed.add(kind);
    } finally {
      this.subscribeBusy = false;
      this.requestUpdate();
    }
  }

  // 动态评论：POST 到既有评论端点，成功后记忆评论者并展示审核提示（与 SSR 行为一致）。
  private async submitMomentReply(event: SubmitEvent, id: string) {
    event.preventDefault();
    if (this.momentReplyBusy.has(id)) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const content = String(data.get('content') ?? '').trim();
    const displayName = String(data.get('display_name') ?? '').trim();
    if (!content || !displayName) return;
    const email = String(data.get('email') ?? '').trim();
    const website = String(data.get('website') ?? '').trim();
    this.momentReplyBusy.add(id);
    this.momentReplyError.delete(id);
    this.requestUpdate();
    try {
      await api.submitDynamicComment(id, {
        display_name: displayName,
        email: email || null,
        website: website || null,
        content,
        parent_id: this.momentReplyTo.get(id)?.id ?? null,
      });
      this.commenter = { display_name: displayName, email, website };
      saveCommenter(this.commenter);
      this.momentReplySent.add(id);
      this.momentReplyTo.delete(id);
    } catch (error) {
      this.momentReplyError.set(id, api.errorMessage(error));
    } finally {
      this.momentReplyBusy.delete(id);
      this.requestUpdate();
    }
  }

  private async submitArticleComment(event: SubmitEvent, detail: api.ArticleDetail) {
    event.preventDefault();
    if (this.commentBusy) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const displayName = String(data.get('display_name') ?? '').trim();
    const content = String(data.get('content') ?? '').trim();
    if (!displayName || !content) return;
    if (!detail.id) {
      this.commentError = '评论服务暂时不可用，请稍后再试。';
      this.requestUpdate();
      return;
    }
    const email = String(data.get('email') ?? '').trim();
    const website = String(data.get('website') ?? '').trim();
    this.commentBusy = true;
    this.commentError = '';
    this.requestUpdate();
    try {
      await api.submitArticleComment(detail.id, {
        display_name: displayName,
        email: email || null,
        website: website || null,
        content,
        parent_id: this.commentReplyTo?.id ?? null,
      });
      this.commenter = { display_name: displayName, email, website };
      saveCommenter(this.commenter);
      this.commentSentFor = detail.slug;
      this.commentFormOpen = false;
      this.commentReplyTo = null;
    } catch (error) {
      this.commentError = api.errorMessage(error);
    } finally {
      this.commentBusy = false;
      this.requestUpdate();
    }
  }

  private async submitFriendApplication(event: SubmitEvent) {
    event.preventDefault();
    if (this.friendApplyBusy) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const name = String(data.get('name') ?? '').trim();
    const url = String(data.get('url') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const avatarUrl = String(data.get('avatar_url') ?? '').trim();
    if (!name || !url || !email) return;
    this.friendApplyBusy = true;
    this.friendApplyError = '';
    this.requestUpdate();
    try {
      await api.applyFriendLink({
        name,
        url,
        email,
        description: description || null,
        avatar_url: avatarUrl || null,
      });
      this.friendApplyDone = true;
    } catch {
      this.friendApplyError = '提交失败，请检查站点地址格式后重试。';
    } finally {
      this.friendApplyBusy = false;
      this.requestUpdate();
    }
  }

  private observeReveals() {
    if (this.revealInstant) {
      // SPA 换页：内容直接就位，不重放浮现动画（避免闪烁感）。
      this.revealInstant = false;
      this.renderRoot.querySelectorAll('[data-reveal]').forEach((element) => {
        (element as HTMLElement).style.transitionDelay = '0ms';
        element.classList.add('in');
      });
      return;
    }
    if (this.reducedMotion || !('IntersectionObserver' in window)) return;
    if (!this.revealObserver) {
      this.classList.add('reveal-ready');
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          entries
            .filter((entry) => entry.isIntersecting)
            .forEach((entry, index) => {
              const element = entry.target as HTMLElement;
              element.style.transitionDelay = `${index * 80}ms`;
              element.classList.add('in');
              this.revealObserver?.unobserve(element);
            });
        },
        // threshold 必须是 0：长文正文（.prose 可达上万 px）永远到不了 0.1 的
        // 可见比例，会一直停在 opacity:0（生产上长文渲染不出来的根因）。
        { threshold: 0, rootMargin: '0px 0px -5% 0px' },
      );
    }
    this.renderRoot
      .querySelectorAll('[data-reveal]:not(.in)')
      .forEach((element) => this.revealObserver?.observe(element));
  }

  protected updated() {
    this.observeReveals();
    this.scanToc();
    this.observeMomentExtras();
    this.maybeSeedHeroBackgrounds();
    // 正文增强（KaTeX/mermaid）：仅文章详情与动态页可能有正文标记；
    // enhanceProse 幂等（处理过的元素带 data-lm-done），重复调用零成本
    const path = window.location.pathname;
    if (
      (path.startsWith('/articles/') || path === '/dynamics') &&
      this.renderRoot.querySelector('.lm-math:not([data-lm-done]), pre.lm-mermaid:not([data-lm-done])')
    ) {
      void import('./enhance.js').then((module) => module.enhanceProse(this.renderRoot));
    }
    this.classList.toggle('is-intro', this.splashActive && !this.splashDone);
    if (this.pendingScrollRestore !== null) {
      const y = this.pendingScrollRestore;
      this.pendingScrollRestore = null;
      window.scrollTo(0, y);
    }
    // 站外/搜索结果带来的 hash 锚点（如 /dynamics#dynamic-id）：shadow DOM 内的 id
    // 浏览器原生片段跳转够不到，等内容渲染出来后手动滚动。
    const hashKey = `${window.location.pathname}${window.location.hash}`;
    if (window.location.hash && this.hashHandled !== hashKey) {
      const target = this.renderRoot.querySelector(
        `#${CSS.escape(window.location.hash.slice(1))}`,
      );
      if (target) {
        this.hashHandled = hashKey;
        target.scrollIntoView({ block: 'start' });
      }
    }
  }

  // 目录：使用详情接口下发的 headings（服务端渲染正文时已注入相同 id），IO 做滚动高亮。
  private scanToc() {
    const path = window.location.pathname;
    const slug = path.startsWith('/articles/')
      ? decodeURIComponent(path.slice('/articles/'.length))
      : '';
    const detail = slug ? (this.store.articlesBySlug.get(slug)?.data ?? null) : null;
    const stamp = `${path}#${detail?.slug ?? ''}`;
    if (stamp === this.tocPath) return;
    this.tocPath = stamp;
    this.tocObserver?.disconnect();
    this.tocObserver = null;
    const items = (detail?.headings ?? [])
      // 与 SSR 一致：目录收录 h1–h3（SSR 模板直接渲染 rendered.headings 全量）
      .filter((heading) => heading.level >= 1 && heading.level <= 3)
      .map((heading) => ({ id: heading.id, text: heading.text, level: heading.level }));
    this.tocItems = items;
    this.tocActive = items[0]?.id ?? '';
    if (items.length === 0) return;
    this.tocObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.tocActive = entry.target.id;
            this.requestUpdate();
          }
        });
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 },
    );
    items.forEach((item) => {
      const heading = this.renderRoot.querySelector(`#${CSS.escape(item.id)}`);
      if (heading) this.tocObserver?.observe(heading);
    });
    this.requestUpdate();
  }

  // 动态卡片滚入视口后再拉取点赞状态与评论，避免整页并发请求。
  private observeMomentExtras() {
    if (window.location.pathname !== '/dynamics') return;
    const moments = this.renderRoot.querySelectorAll<HTMLElement>('.moment[data-dyn]');
    if (moments.length === 0) return;
    if (!this.momentObserver) {
      this.momentObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const id = (entry.target as HTMLElement).dataset.dyn;
            if (!id || this.momentExtrasRequested.has(id)) return;
            this.momentExtrasRequested.add(id);
            this.store.loadDynamicMetrics(id);
            this.store.loadDynamicComments(id);
            this.momentObserver?.unobserve(entry.target);
          });
        },
        { rootMargin: '200px 0px', threshold: 0 },
      );
    }
    moments.forEach((moment) => {
      const id = moment.dataset.dyn ?? '';
      if (id && !this.momentExtrasRequested.has(id)) this.momentObserver?.observe(moment);
    });
  }

  // 评论头像兜底：按昵称哈希选一个夜航配色的小插画（星星 / 月夜 / 海浪）。
  private avatarFallback(name: string) {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 997;
    switch (hash % 3) {
      case 0:
        return html`<svg viewBox="0 0 36 36" aria-hidden="true"><defs><linearGradient id="av-g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7eb6d9" /><stop offset="1" stop-color="#e8a4b4" /></linearGradient></defs><rect width="36" height="36" rx="12" fill="url(#av-g1)" /><path d="M18 8l2.4 7.6L28 18l-7.6 2.4L18 28l-2.4-7.6L8 18l7.6-2.4z" fill="#f7f8f7" /></svg>`;
      case 1:
        return html`<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="18" fill="#1c2733" /><path d="M23.5 9.5a8.5 8.5 0 1 0 4.2 16.2A10 10 0 0 1 23.5 9.5z" fill="#7eb6d9" /><circle cx="13" cy="13" r="1.6" fill="#e8a4b4" /></svg>`;
      default:
        return html`<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="18" fill="#e8a4b4" /><circle cx="24.5" cy="11.5" r="3.5" fill="#f7f8f7" /><path d="M5 24c3-2.6 6-2.6 9 0s6 2.6 9 0 5 2.2 8 .6V31H5z" fill="#f7f8f7" /></svg>`;
    }
  }

  // 评论头像：优先使用接口下发的 avatarUrl（favicon/Gravatar 已由服务端合并），
  // 为空或加载失败时回退到按昵称哈希挑选的夜航小插画（与 SSR 同一算法）。
  private commentAvatar(name: string, avatarUrl?: string | null) {
    if (!avatarUrl) return html`<span class="comment-avatar">${this.avatarFallback(name)}</span>`;
    return html`<span class="comment-avatar has-img">
      <img
        src=${avatarUrl}
        alt=""
        loading="lazy"
        @error=${(event: Event) => (event.currentTarget as HTMLElement).classList.add('is-broken')}
      />
      ${this.avatarFallback(name)}
    </span>`;
  }

  private ownerAvatar(className = '') {
    const name = this.siteData.ownerName || '博主';
    const avatarUrl = this.siteData.avatarUrl;
    if (!avatarUrl) {
      return html`<span class="comment-avatar ${className}">${this.avatarFallback(name)}</span>`;
    }
    return html`<span class="comment-avatar has-img ${className}">
      <img
        src=${avatarUrl}
        alt=""
        loading="lazy"
        @error=${(event: Event) => (event.currentTarget as HTMLElement).classList.add('is-broken')}
      />
      ${this.avatarFallback(name)}
    </span>`;
  }

  // 动态卡片（朋友圈形态）：头像+昵称+相对时间 → 正文 → 配图 → 点赞/评论 → 灰底内联评论区。
  private renderMoment(item: api.DynamicItem) {
    const metrics = this.store.dynamicMetrics.get(item.id);
    const liked = metrics?.liked ?? false;
    const likeCount = metrics?.like_count ?? item.likes;
    const likeBusy = this.store.likeBusy.has(item.id);
    const commentsSlice = this.store.comments(`dynamic:${item.id}`);
    const comments = commentsSlice.data?.items ?? [];
    const images = item.mediaUrls ?? [];
    const author = this.siteData.ownerName || '博主';
    return html`
      <div class="moment" data-dyn=${item.id} data-reveal>
        <div class="moment-card">
          <header class="moment-head">
            ${this.ownerAvatar('moment-avatar')}
            <div class="moment-who">
              <span class="moment-author">${author}</span>
              <time title=${formatDateTime(item.createdAt)}>
                ${relTime(item.createdAt)}${item.mood
                  ? html`<span class="moment-mood">· ${item.mood}</span>`
                  : nothing}
              </time>
            </div>
          </header>
          <div class="moment-text">${unsafeHTML(item.contentHtml)}</div>
          ${images.length === 1
            ? html`<yuki-cover
                class="m-media zoomable"
                src=${images[0]}
                alt="动态配图"
                seed=${item.id}
                adaptive
                max-height="62vh"
                @click=${() => this.openLightbox(images, 0)}
              ></yuki-cover>`
            : images.length > 1
              ? html`<div class="m-grid count-${images.length}">
                  ${images.map(
                    (url, imageIndex) => html`<yuki-cover
                      class="zoomable"
                      src=${url}
                      alt="动态配图 ${imageIndex + 1}"
                      seed=${`${item.id}-${imageIndex}`}
                      ratio="1 / 1"
                      fit="cover"
                      @click=${() => this.openLightbox(images, imageIndex)}
                    ></yuki-cover>`,
                  )}
                </div>`
              : nothing}
          <div class="mfoot">
            <button
              class="heart-button${liked ? ' liked' : ''}"
              type="button"
              aria-pressed=${liked}
              aria-label=${liked ? '取消喜欢' : '喜欢'}
              ?disabled=${likeBusy}
              @click=${() => void this.store.toggleDynamicLike(item.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20.3C7.2 16.9 3.5 13.6 3.5 9.9 3.5 7.2 5.6 5 8.3 5c1.5 0 2.9.7 3.7 1.9C12.8 5.7 14.2 5 15.7 5c2.7 0 4.8 2.2 4.8 4.9 0 3.7-3.7 7-8.5 10.4Z"
                />
              </svg>
              ${likeCount}
            </button>
            <span class="m-count">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12Z" />
              </svg>
              ${item.commentCount}
            </span>
          </div>
          <div class="m-comments">
            ${commentsSlice.status === 'loading'
              ? html`<div class="skel skel-line" style="width: 62%"></div>`
              : nothing}
            ${commentsSlice.status === 'error'
              ? html`<p class="m-reply-note">
                  评论加载失败，
                  <a
                    href=${`/dynamics#dynamic-${item.id}`}
                    @click=${(event: Event) => {
                      event.preventDefault();
                      this.store.loadDynamicComments(item.id, true);
                    }}
                    >重试</a
                  >
                </p>`
              : nothing}
            ${buildCommentTree(comments).map((node) =>
              this.renderMomentCommentNode(node, item.id),
            )}
            ${this.momentReplySent.has(item.id)
              ? html`<p class="m-reply-sent">评论已寄出，审核通过后会显示在这里。</p>`
              : html`
                  <form
                    class="m-reply"
                    @submit=${(event: SubmitEvent) => void this.submitMomentReply(event, item.id)}
                    @focusout=${(event: FocusEvent) =>
                      this.maybeCollapseMomentReply(item.id, event.currentTarget as HTMLFormElement)}
                  >
                    ${this.momentReplyTo.has(item.id)
                      ? html`<div class="reply-banner">
                          <span>正在回复 @${this.momentReplyTo.get(item.id)!.name}</span>
                          <button
                            type="button"
                            aria-label="取消回复"
                            @click=${() => {
                              this.momentReplyTo.delete(item.id);
                              this.momentReplyOpen.delete(item.id);
                              this.requestUpdate();
                            }}
                          >
                            取消
                          </button>
                        </div>`
                      : nothing}
                    <input
                      name="content"
                      type="text"
                      maxlength="5000"
                      placeholder="说点什么…"
                      aria-label="评论这条动态"
                      autocomplete="off"
                      required
                      @focus=${() => {
                        if (!this.momentReplyOpen.has(item.id)) {
                          this.momentReplyOpen.add(item.id);
                          this.requestUpdate();
                        }
                      }}
                    />
                    <button type="submit" ?disabled=${this.momentReplyBusy.has(item.id)}>
                      ${this.momentReplyBusy.has(item.id) ? '寄出中…' : '发送'}
                    </button>
                    ${this.momentReplyOpen.has(item.id)
                      ? html`
                          <div class="m-reply-more">
                            <input
                              name="display_name"
                              type="text"
                              maxlength="80"
                              placeholder="昵称（必填）"
                              aria-label="昵称"
                              autocomplete="nickname"
                              required
                              value=${this.commenter.display_name}
                            />
                            <input
                              name="email"
                              type="email"
                              maxlength="254"
                              placeholder="邮箱（选填，会公开）"
                              aria-label="邮箱"
                              autocomplete="email"
                              value=${this.commenter.email}
                            />
                            <input
                              name="website"
                              type="url"
                              maxlength="2048"
                              placeholder="网站（选填）"
                              aria-label="网站"
                              autocomplete="url"
                              value=${this.commenter.website}
                            />
                          </div>
                          <p class="m-reply-note">
                            ${this.momentReplyError.get(item.id) ??
                            '评论会在审核后显示；昵称和邮箱会公开展示。'}
                          </p>
                          <button
                            class="m-reply-collapse"
                            type="button"
                            @click=${() => {
                              this.momentReplyOpen.delete(item.id);
                              this.momentReplyTo.delete(item.id);
                              this.requestUpdate();
                            }}
                          >
                            收起评论框
                          </button>
                        `
                      : nothing}
                  </form>
                `}
          </div>
        </div>
      </div>
    `;
  }

  /** 一言手动刷新：3 秒冷却，服务端缓存短（60s），失败静默回退本地句库。 */
  private async refreshHitokoto() {
    if (this.quoteRefreshBusy) return;
    this.quoteRefreshBusy = true;
    this.requestUpdate();
    this.store.ensureHitokoto(true);
    window.setTimeout(() => {
      this.quoteRefreshBusy = false;
      this.requestUpdate();
    }, 3000);
  }

  /** 评论框自动收起：内容为空且焦点全部离开时折回单行态（昵称等记忆值不阻止）。 */
  private maybeCollapseMomentReply(dynamicId: string, form: HTMLFormElement) {
    window.setTimeout(() => {
      const active = (this.renderRoot as ShadowRoot).activeElement;
      if (active && form.contains(active)) return;
      const content = form.querySelector<HTMLInputElement>('input[name="content"]');
      if (content && content.value.trim() !== '') return;
      if (!this.momentReplyOpen.has(dynamicId) && !this.momentReplyTo.has(dynamicId)) return;
      this.momentReplyOpen.delete(dynamicId);
      this.momentReplyTo.delete(dynamicId);
      this.requestUpdate();
    });
  }

  private startMomentReply(dynamicId: string, comment: api.PublicComment) {    this.momentReplyTo.set(dynamicId, { id: comment.id, name: comment.displayName });
    this.momentReplyOpen.add(dynamicId);
    this.requestUpdate();
    void this.updateComplete.then(() => {
      const form = this.renderRoot.querySelector<HTMLElement>(`.moment[data-dyn="${CSS.escape(dynamicId)}"]`);
      form?.querySelector<HTMLInputElement>('input[name="content"]')?.focus();
    });
  }

  private renderMomentCommentNode(node: CommentNode, dynamicId: string): TemplateResult {
    const comment = node.comment;
    const host = comment.website
      ? comment.website.replace(/^https?:\/\//, '').split('/')[0]
      : '';
    return html`
      <div class="m-comment">
        ${this.commentAvatar(comment.displayName, comment.avatarUrl)}
        <div class="m-comment-body">
          <div class="m-comment-line">
            ${comment.website
              ? html`<a
                  class="comment-name"
                  href=${comment.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  title=${host}
                  >${comment.displayName}</a
                >`
              : html`<span class="comment-name">${comment.displayName}</span>`}
            ${node.replyToName
              ? html`<span class="comment-reply-tag">回复 @${node.replyToName}</span>`
              : nothing}
            <time title=${formatDateTime(comment.createdAt)}>${relTime(comment.createdAt)}</time>
            ${comment.id
              ? html`<button
                  class="comment-reply-btn"
                  type="button"
                  @click=${() => this.startMomentReply(dynamicId, comment)}
                >
                  回复
                </button>`
              : nothing}
          </div>
          <div class="m-comment-content">${unsafeHTML(comment.contentHtml)}</div>
          ${node.children.length > 0
            ? html`<div class="m-children">
                ${node.children.map((child) => this.renderMomentCommentNode(child, dynamicId))}
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }


  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      min-height: 100dvh;
      --page: #f7f8f7;
      --surface: #ffffff;
      --surface-soft: #eef2f5;
      --ink: #1c2733;
      --muted: #6d7f90;
      --faint: #a7b5c2;
      --line: #dde5ec;
      --primary: #7eb6d9;
      --primary-d: #4a93c2;
      --secondary: #e8a4b4;
      --secondary-d: #d57f95;
      --radius: 14px;
      color: var(--ink);
      background: var(--page);
      font-family:
        'Noto Sans CJK SC', 'Noto Sans CJK HK', 'PingFang SC', 'Microsoft YaHei', system-ui,
        sans-serif;
      --serif: 'LXGW WenKai GB', 'Noto Serif SC', 'Songti SC', Georgia, serif;
      --mono: ui-monospace, 'SFMono-Regular', Consolas, monospace;
      scroll-behavior: smooth;
    }

    button,
    input {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .caps {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.26em;
      text-transform: uppercase;
    }

    .site {
      --page: #f7f8f7;
      --surface: #ffffff;
      --surface-soft: #eef2f5;
      --ink: #1c2733;
      --muted: #6d7f90;
      --faint: #a7b5c2;
      --line: #dde5ec;
      --primary: #7eb6d9;
      --primary-d: #4a93c2;
      --secondary: #e8a4b4;
      --secondary-d: #d57f95;
      --radius: 14px;
      min-height: 100dvh;
      background: var(--page);
      color: var(--ink);
      overflow: clip;
    }

    .site-nav {
      z-index: 50;
    }

    /* 首屏角落导航：品牌 + 文字链接，随首屏离场 */
    .nav-corners {
      position: fixed;
      z-index: 51;
      top: 0;
      right: 0;
      left: 0;
      display: grid;
      height: 84px;
      align-items: center;
      grid-template-columns: 1fr auto 1fr;
      padding: 0 52px;
      color: rgb(238 243 248 / 92%);
      text-shadow: 0 2px 12px rgb(0 0 0 / 28%);
      pointer-events: none;
      transition:
        opacity 380ms ease,
        translate 380ms cubic-bezier(0.22, 0.61, 0.36, 1),
        visibility 380ms;
    }

    .nav-corners.hidden {
      opacity: 0;
      visibility: hidden;
      translate: 0 -10px;
    }

    .nav-corners > * {
      pointer-events: auto;
    }

    .nav-corners.hidden > * {
      pointer-events: none;
    }

    .brand {
      flex-shrink: 0;
      color: inherit;
      font-size: calc(20px * var(--part-brand-scale, 1));
      font-weight: 600;
      letter-spacing: 0.14em;
      text-decoration: none;
      white-space: nowrap;
    }

    .nav-corners .brand {
      justify-self: start;
      font-size: calc(20px * var(--part-brand-scale, 1));
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .nav-links {
      display: flex;
      min-width: 0;
      align-items: center;
      flex-wrap: nowrap;
      gap: 4px;
    }

    .nav-corners .nav-links {
      justify-self: center;
      gap: 26px;
    }

    /* topnav align 旋钮：居中 = 现状（1fr auto 1fr 对称居中）；start/end 时
       中列改 1fr 让链接盒有对齐空间 */
    .nav-corners.topnav-align-start,
    .nav-corners.topnav-align-end {
      grid-template-columns: auto 1fr auto;
    }

    .nav-corners.topnav-align-start .nav-links {
      justify-self: start;
    }

    .nav-corners.topnav-align-end .nav-links {
      justify-self: end;
    }

    /* topnav display 旋钮：仅图标 / 仅文字（默认 both 不加类）。
       角导航与胶囊顶栏平时隐藏图标（display:none），icons 模式要把它们放出来；
       容器类提到 0-3-0  specificity，压过后面 .nav-corners/.nav-topbar 的隐藏规则 */
    .nav-corners.topnav-icons .nav-icon,
    .nav-topbar.topnav-icons .nav-icon,
    .nav-corners.topnav-both .nav-icon,
    .nav-topbar.topnav-both .nav-icon {
      display: flex;
    }

    .topnav-icons .nav-label {
      display: none;
    }

    /* topnav align-mobile 旋钮：移动端胶囊顶栏改停靠（默认居中 = 现状） */
    @media (max-width: 968px) {
      .nav-topbar.topnav-mobile-end {
        right: 14px;
        left: auto;
        translate: 0 -12px;
      }

      .nav-topbar.topnav-mobile-end.nav-sticky {
        translate: 0 0;
      }

      .nav-topbar.topnav-mobile-start {
        right: auto;
        left: 14px;
        translate: 0 -12px;
      }

      .nav-topbar.topnav-mobile-start.nav-sticky {
        translate: 0 0;
      }
    }

    .nav-corners .nav-actions {
      justify-self: end;
    }

    .nav-corners .nav-item {
      padding: 4px 0;
      color: rgb(238 243 248 / 80%);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.18em;
      transition: color 250ms ease;
    }

    .nav-corners .nav-item:hover {
      color: #fff;
    }

    .nav-corners .nav-icon {
      display: none;
    }

    /* 胶囊悬浮导航：滚过首屏后淡入 */
    .nav-topbar {
      position: fixed;
      top: 14px;
      left: 50%;
      display: flex;
      width: auto;
      align-items: center;
      gap: 2px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgb(255 255 255 / 92%);
      box-shadow: 0 8px 28px rgb(28 39 51 / 10%);
      color: var(--ink);
      opacity: 0;
      visibility: hidden;
      translate: -50% -12px;
      backdrop-filter: blur(12px);
      transition:
        opacity 380ms ease,
        translate 380ms cubic-bezier(0.22, 0.61, 0.36, 1),
        visibility 380ms;
    }

    .nav-topbar.nav-sticky {
      opacity: 1;
      visibility: visible;
      translate: -50% 0;
    }

    .nav-topbar .brand {
      display: none;
    }

    .nav-topbar .nav-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      border-radius: 999px;
      color: var(--muted);
      font-size: 13.5px;
      font-weight: 500;
      white-space: nowrap;
      transition:
        color 250ms ease,
        background 250ms ease;
    }

    .nav-topbar .nav-item:hover {
      color: var(--ink);
    }

    .nav-topbar .nav-item.active {
      background: var(--ink);
      color: #fff;
    }

    .nav-topbar .nav-icon {
      display: none;
    }

    /* 悬浮顶栏：搜索用文字，与旁边条目保持一致；首屏角落仍用图标 */
    .nav-search .search-text {
      display: none;
    }

    .nav-topbar .nav-search {
      display: flex;
      width: auto;
      height: auto;
      padding: 8px 18px;
      border-radius: 999px;
      color: var(--muted);
      font-size: 13.5px;
      font-weight: 500;
      place-items: center;
    }

    .nav-topbar .nav-search:hover {
      background: transparent;
      color: var(--ink);
    }

    .nav-topbar .nav-search.active {
      background: var(--ink);
      color: #fff;
    }

    .nav-topbar .nav-search .search-icon {
      display: none;
    }

    .nav-topbar .nav-search .search-text {
      display: inline;
      line-height: 1;
      white-space: nowrap;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-corners .nav-action:hover {
      background: rgb(255 255 255 / 14%);
      color: #fff;
    }

    .nav-inner-actions {
      display: flex;
    }

    .nav-action {
      display: grid;
      width: 32px;
      height: 32px;
      padding: 6px;
      place-items: center;
      border: 0;
      border-radius: 16px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      text-decoration: none;
      transition:
        color 200ms ease,
        background 200ms ease;
    }

    .nav-action:hover {
      background: var(--surface-soft);
      color: var(--primary-d);
    }

    .nav-icon {
      display: flex;
      width: 20px;
      height: 20px;
      flex: 0 0 20px;
      align-items: center;
      justify-content: center;
    }

    .nav-icon svg,
    .nav-action svg,
    .enter-button svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .social-icon svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
      stroke: none;
    }

    .nav-label {
      line-height: 1;
    }

    .nav-hamburger {
      display: none;
    }

    .mobile-menu-overlay {
      position: fixed;
      z-index: 220;
      inset: 0;
      display: flex;
      align-items: flex-end;
      background: rgb(0 0 0 / 45%);
      backdrop-filter: blur(6px);
    }

    .mobile-menu {
      width: 100%;
      padding: 24px 32px calc(48px + env(safe-area-inset-bottom));
      border-radius: 28px 28px 0 0;
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 -8px 32px rgb(0 0 0 / 16%);
      animation: mobile-menu-up 280ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    @keyframes mobile-menu-up {
      from {
        transform: translateY(48px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .mobile-menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
      font-size: 20px;
    }

    .mobile-menu-nav {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .mobile-nav-item {
      display: flex;
      min-height: 88px;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--page);
      color: var(--ink);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
    }

    .mobile-menu-nav .nav-icon {
      display: flex;
    }

    .mobile-nav-item:hover {
      border-color: var(--primary);
      background: var(--surface);
      color: var(--primary-d);
    }

    .mobile-nav-item.active {
      border-color: var(--secondary);
      background: var(--surface);
      color: var(--secondary-d);
    }

    .nav-sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      display: flex;
      width: 238px;
      flex-direction: column;
      padding: 100px 30px 36px;
      border-right: 1px solid var(--line);
      background: color-mix(in srgb, var(--surface) 94%, transparent);
    }

    .nav-sidebar .nav-links {
      align-items: stretch;
      flex-direction: column;
      margin-top: 48px;
    }

    .nav-sidebar .nav-links a {
      padding: 8px 4px;
      border-radius: 4px;
      transition:
        padding 180ms ease,
        color 180ms ease;
    }

    .nav-sidebar .nav-links a:hover {
      padding-left: 18px;
      color: var(--secondary-d);
    }

    .nav-sidebar .nav-foot {
      margin-top: auto;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.7;
    }

    .shell-sidebar .page-root {
      margin-left: 238px;
    }

    .nav-dock {
      position: fixed;
      bottom: 22px;
      left: 50%;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 8px 10px;
      transform: translateX(-50%);
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgb(23 29 39 / 82%);
      color: #eff3f8;
      box-shadow: 0 18px 50px rgb(0 0 0 / 34%);
      backdrop-filter: blur(18px);
      transition: transform 200ms ease;
    }

    .nav-dock .brand {
      padding: 0 12px;
      color: var(--primary);
    }

    .nav-dock .nav-links a {
      display: grid;
      width: 40px;
      height: 40px;
      place-items: center;
      padding: 8px;
      font-size: 0;
      transition:
        background 160ms ease,
        transform 160ms ease;
    }

    .nav-dock .nav-links a::first-letter {
      font-size: 14px;
    }

    .nav-dock .nav-links a:hover {
      background: var(--surface-soft);
      transform: translateY(-5px);
    }

    .page-root {
      min-height: 100dvh;
    }

    /* 滚动浮现：JS 给 host 加 .reveal-ready 后才启用 */
    :host(.reveal-ready) [data-reveal] {
      opacity: 0;
      translate: 0 26px;
      transition:
        opacity 700ms cubic-bezier(0.22, 0.61, 0.36, 1),
        translate 700ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    :host(.reveal-ready) [data-reveal].in {
      opacity: 1;
      translate: 0 0;
    }

    /* ---------- 内页 ---------- */
    .inner-page {
      width: min(1180px, calc(100% - 64px));
      min-height: 100dvh;
      margin: 0 auto;
      padding: 128px 0 96px;
      background: transparent;
      animation: page-in 420ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    @keyframes page-in {
      from {
        opacity: 0;
        translate: 0 16px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    .page-head {
      margin-bottom: 52px;
      padding-bottom: 36px;
      border-bottom: 1px solid var(--line);
    }

    .page-head.center {
      text-align: center;
    }

    .page-head .kicker {
      margin: 0 0 16px;
      color: var(--secondary-d);
    }

    .page-head h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(40px, 5vw, 58px);
      font-weight: 700;
      line-height: 1.15;
    }

    .page-head .inner-lede {
      max-width: 560px;
      margin: 12px 0 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.8;
    }

    .page-head.center .inner-lede {
      margin-inline: auto;
    }

    /* 文章归档 */
    .archive-year {
      margin-bottom: 44px;
    }

    .archive-year > h2 {
      display: flex;
      align-items: baseline;
      gap: 14px;
      margin: 0 0 6px;
      color: var(--faint);
      font-family: var(--serif);
      font-size: 26px;
    }

    .archive-year > h2 span {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.2em;
    }

    .archive-row {
      display: grid;
      grid-template-columns: 104px minmax(0, 1fr) auto;
      gap: 22px;
      align-items: baseline;
      padding: 19px 4px;
      border-bottom: 1px solid var(--line);
      color: inherit;
      text-decoration: none;
      transition: translate 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .archive-row:hover {
      translate: 8px 0;
    }

    .archive-row time {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 12px;
    }

    .archive-row h3 {
      margin: 0;
      font-family: var(--serif);
      font-size: 19.5px;
      font-weight: 700;
      line-height: 1.5;
    }

    .archive-row h3 span {
      background-image: linear-gradient(currentColor, currentColor);
      background-repeat: no-repeat;
      background-size: 0 1.5px;
      background-position: 0 97%;
      transition: background-size 400ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .archive-row:hover h3 span {
      background-size: 100% 1.5px;
    }

    .archive-row .meta {
      display: flex;
      gap: 14px;
      color: var(--faint);
      font-size: 12px;
    }

    .archive-row .cat {
      font-weight: 600;
    }

    .cat-b {
      color: var(--primary-d);
    }

    .cat-p {
      color: var(--secondary-d);
    }

    /* 动态时间线 */
    .timeline {
      position: relative;
      max-width: 720px;
      margin: 0 auto;
    }

    .timeline::before {
      position: absolute;
      top: 8px;
      bottom: 0;
      left: 6px;
      width: 1px;
      content: '';
      background: var(--line);
    }

    .moment {
      position: relative;
      padding: 0 0 48px 34px;
    }

    .moment::before {
      position: absolute;
      top: 9px;
      left: 2px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      content: '';
      background: var(--primary);
      transition:
        background 300ms ease,
        scale 300ms ease;
    }

    .moment:hover::before {
      background: var(--secondary);
      scale: 1.4;
    }

    .moment time {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.16em;
    }

    .moment p {
      margin: 8px 0 0;
      font-size: 15.5px;
      line-height: 1.95;
    }

    .m-media {
      max-width: 420px;
      margin-top: 14px;
      overflow: hidden;
      border-radius: 12px;
      transition: scale 550ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .moment:hover .m-media {
      scale: 1.02;
    }

    .mfoot {
      margin-top: 10px;
      color: var(--faint);
      font-size: 12px;
    }

    /* ---------- 动态卡片（朋友圈形态） ---------- */
    .moment-card {
      padding: 20px 22px 14px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--surface);
      transition:
        border-color 300ms ease,
        box-shadow 300ms ease;
    }

    .moment:hover .moment-card {
      border-color: color-mix(in srgb, var(--primary) 40%, var(--line));
      box-shadow: 0 14px 34px -18px rgb(74 147 194 / 30%);
    }

    .moment-head {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .moment-avatar {
      width: 40px;
      height: 40px;
    }

    .moment-who {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .moment-author {
      color: var(--ink);
      font-size: 15px;
      font-weight: 700;
    }

    .moment-who time {
      cursor: help;
    }

    .moment-text {
      font-size: 15px;
      line-height: 1.9;
    }

    .m-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 12px;
      max-width: 420px;
    }

    .m-grid.count-2,
    .m-grid.count-4 {
      grid-template-columns: repeat(2, 1fr);
      max-width: 300px;
    }

    .m-grid yuki-cover {
      border-radius: 8px;
      transition: scale 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .m-grid yuki-cover:hover {
      scale: 1.04;
    }

    .m-count {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--faint);
      font-size: 12px;
    }

    .m-count svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
    }

    .m-comments {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--ink) 4%, var(--page));
    }

    .m-comment {
      display: flex;
      gap: 10px;
      padding: 8px 0;
    }

    .m-comment .comment-avatar {
      width: 26px;
      height: 26px;
    }

    .m-comment-body {
      min-width: 0;
      flex: 1;
    }

    .m-comment-line {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
    }

    .m-comment-line .comment-name {
      font-size: 13px;
    }

    .m-comment p {
      margin: 3px 0 0;
      font-size: 13.5px;
      line-height: 1.75;
    }

    .m-comment-agent {
      display: block;
      margin-top: 3px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 10.5px;
    }

    .m-children {
      margin-top: 8px;
      padding: 2px 0 2px 12px;
      border-left: 2px solid var(--line);
    }

    .m-reply {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .m-reply > input[name='content'] {
      flex: 1;
    }

    .m-reply-more {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      flex-basis: 100%;
      order: 3;
    }

    .m-reply-more input {
      width: 100%;
    }

    .m-reply-note {
      flex-basis: 100%;
      order: 4;
      margin: 2px 0 0;
      color: var(--faint);
      font-size: 12px;
    }

    .m-reply-sent {
      margin: 10px 0 0;
      color: var(--faint);
      font-size: 12.5px;
    }

    .m-reply input {
      box-sizing: border-box;
      min-width: 0;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--ink);
      font-family: inherit;
      font-size: 13px;
      transition:
        border-color 250ms ease,
        box-shadow 250ms ease;
    }

    .m-reply input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
    }

    .m-reply button[type='submit'] {
      flex: none;
      padding: 0 16px;
      border: 0;
      border-radius: 999px;
      background: var(--ink);
      color: var(--page);
      font-size: 12.5px;
      cursor: pointer;
      transition: background 250ms ease;
    }

    .m-reply button[type='submit']:hover {
      background: var(--primary-d);
    }

    /* 友链 */
    .friends-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 26px;
    }

    .friend {
      display: flex;
      align-items: flex-start;
      gap: 20px;
      padding: 26px 28px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--surface);
      color: inherit;
      text-decoration: none;
      transition:
        translate 350ms cubic-bezier(0.22, 0.61, 0.36, 1),
        box-shadow 350ms ease,
        border-color 350ms ease;
    }

    .friend:hover {
      translate: 0 -6px;
      border-color: transparent;
    }

    .friend:nth-child(odd):hover {
      box-shadow: 0 20px 40px -14px rgb(74 147 194 / 35%);
    }

    .friend:nth-child(even):hover {
      box-shadow: 0 20px 40px -14px rgb(213 127 149 / 35%);
    }

    .friend-avatar {
      display: grid;
      width: 54px;
      height: 54px;
      flex: 0 0 54px;
      place-items: center;
      border-radius: 50%;
      background: var(--cover);
      color: #fff;
      font-family: var(--serif);
      font-size: 21px;
    }

    .friend h3 {
      margin: 0;
      font-family: var(--serif);
      font-size: 19px;
    }

    .friend .furl {
      display: block;
      margin: 2px 0 8px;
      color: var(--primary-d);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.08em;
    }

    .friend p {
      margin: 0;
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.8;
    }

    .friend .fsince {
      display: block;
      margin-top: 10px;
      color: var(--faint);
      font-size: 11px;
      letter-spacing: 0.2em;
    }

    /* 搜索 */
    .search-box {
      display: flex;
      width: min(680px, 90%);
      align-items: center;
      gap: 12px;
      margin: 0 auto;
      padding: 6px 8px 6px 26px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      transition:
        border-color 300ms ease,
        box-shadow 300ms ease;
    }

    .search-box:focus-within {
      border-color: var(--primary);
      box-shadow: 0 12px 32px -12px rgb(74 147 194 / 40%);
    }

    .search-box input {
      min-width: 0;
      flex: 1;
      padding: 12px 0;
      border: 0;
      outline: 0;
      background: none;
      color: var(--ink);
      font-family: var(--serif);
      font-size: 17px;
    }

    .search-box input::placeholder {
      color: var(--faint);
    }

    .search-box button {
      padding: 11px 22px;
      border: 0;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      font-size: 13px;
      letter-spacing: 0.1em;
      transition: background 250ms ease;
    }

    .search-box button:hover {
      background: var(--primary-d);
    }

    .search-hint {
      margin: 12px 0 0;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-align: center;
    }

    .hot-tags {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 30px;
    }

    .hot-tags a,
    .filter-chip {
      padding: 6px 15px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      font-size: 12.5px;
      text-decoration: none;
      transition:
        color 250ms ease,
        border-color 250ms ease;
    }

    .hot-tags a:hover {
      border-color: var(--secondary);
      color: var(--secondary-d);
    }

    .filter-bar {
      display: grid;
      gap: 12px;
      margin: 26px 0 0;
    }

    .filter-group {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .filter-label {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
    }

    .filter-chip:hover {
      border-color: var(--primary);
      color: var(--primary-d);
    }

    .filter-chip.on {
      border-color: var(--ink);
      background: var(--ink);
      color: #fff;
    }

    .results {
      max-width: 760px;
      margin: 52px auto 0;
    }

    .results .cap {
      margin: 0 0 8px;
      color: var(--faint);
      font-size: 12px;
      letter-spacing: 0.18em;
    }

    .result {
      display: block;
      padding: 22px 4px;
      border-bottom: 1px solid var(--line);
      color: inherit;
      text-decoration: none;
      transition: translate 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .result:hover {
      translate: 6px 0;
    }

    .result .meta {
      display: flex;
      gap: 12px;
      margin-bottom: 6px;
      color: var(--faint);
      font-size: 12px;
    }

    .result .meta .cat {
      color: var(--primary-d);
      font-weight: 600;
    }

    .result h3 {
      margin: 0;
      font-family: var(--serif);
      font-size: 20px;
      font-weight: 700;
    }

    .result p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.85;
    }

    .result mark {
      padding: 0 2px;
      border-radius: 2px;
      background: rgb(232 164 180 / 40%);
      color: inherit;
    }

    /* 文章详情页 */
    .article-page {
      position: relative;
      width: min(840px, 100%);
      margin: 0 auto;
    }

    .post-back {
      display: inline-block;
      margin-bottom: 40px;
      color: var(--muted);
      font-size: 13px;
      transition: color 250ms ease;
    }

    .post-back:hover {
      color: var(--primary-d);
    }

    .post-head {
      margin-bottom: 40px;
    }

    .post-head .component-kicker {
      margin: 0 0 14px;
    }

    .article-page h1 {
      margin: 0 0 16px;
      font-family: var(--serif);
      font-size: clamp(30px, 4.4vw, 42px);
      font-weight: 700;
      line-height: 1.35;
    }

    .post-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 0;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.06em;
    }

    .post-cover {
      width: 100%;
      margin: 0 0 48px;
      border-radius: 14px;
    }

    /* 正文排版（SSR 的 Markdown 输出共用这套） */
    .article-page .prose {
      font-size: 16.5px;
      line-height: 2;
    }

    .prose p {
      margin: 0 0 1.5em;
    }

    .prose h2 {
      margin: 2.3em 0 1em;
      padding-bottom: 12px;
      background: linear-gradient(var(--primary), var(--primary)) left bottom / 30px 2px no-repeat;
      font-family: var(--serif);
      font-size: 25px;
      font-weight: 700;
      line-height: 1.5;
    }

    .prose h3 {
      margin: 2em 0 0.8em;
      font-family: var(--serif);
      font-size: 20px;
      font-weight: 700;
      line-height: 1.55;
    }

    .prose a {
      color: var(--primary-d);
      text-decoration: underline;
      text-decoration-color: color-mix(in srgb, var(--primary) 45%, transparent);
      text-underline-offset: 3px;
      transition: text-decoration-color 250ms ease;
    }

    .prose a:hover {
      text-decoration-color: var(--primary-d);
    }

    .prose blockquote {
      margin: 2em 0;
      padding: 2px 0 2px 20px;
      border-left: 2px solid var(--primary);
      color: var(--muted);
      font-family: var(--serif);
      font-size: 17px;
    }

    .prose blockquote p {
      margin: 0 0 0.8em;
    }

    .prose blockquote p:last-child {
      margin-bottom: 0;
    }

    .prose code {
      padding: 2px 7px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--primary) 14%, transparent);
      font-family: var(--mono);
      font-size: 0.86em;
    }

    .prose pre {
      margin: 2em 0;
      padding: 20px 22px;
      overflow-x: auto;
      border-radius: 14px;
      background: var(--ink);
      color: #dde5ec;
      font-size: 13.5px;
      line-height: 1.8;
    }

    .prose pre code {
      padding: 0;
      background: none;
      font-size: inherit;
    }

    .prose ul,
    .prose ol {
      margin: 0 0 1.5em;
      padding-left: 1.5em;
    }

    .prose li {
      margin: 0.45em 0;
    }

    .prose li::marker {
      color: var(--primary-d);
    }

    .prose hr {
      margin: 3em 0;
      border: 0;
      border-top: 1px solid var(--line);
    }

    .prose img {
      border-radius: 14px;
      cursor: zoom-in;
    }

    /* ---- LianMarkup 构造（lm-*，SSR 同套） ---- */
    .prose .lm-callout {
      margin: 1.8em 0;
      padding: 14px 18px;
      border: 1px solid var(--line);
      border-left: 3px solid var(--primary);
      border-radius: 12px;
      background: color-mix(in srgb, var(--primary) 5%, var(--surface));
    }

    .prose .lm-callout-title {
      margin: 0 0 6px;
      font-weight: 600;
    }

    .prose .lm-callout > :last-child {
      margin-bottom: 0;
    }

    .prose .lm-callout[data-kind='!'] {
      border-left-color: #e8a4b4;
      background: color-mix(in srgb, #e8a4b4 7%, var(--surface));
    }

    .prose .lm-callout[data-kind='x'] {
      border-left-color: #d64545;
      background: color-mix(in srgb, #d64545 6%, var(--surface));
    }

    .prose .lm-callout[data-kind='+'] {
      border-left-color: #5da85f;
      background: color-mix(in srgb, #5da85f 7%, var(--surface));
    }

    .prose .lm-callout[data-kind='i'] {
      border-left-color: var(--secondary);
      background: color-mix(in srgb, var(--secondary) 7%, var(--surface));
    }

    .prose .lm-fold {
      margin: 1.8em 0;
      padding: 12px 18px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface);
    }

    .prose .lm-fold > summary {
      color: var(--muted);
      font-weight: 600;
      cursor: pointer;
    }

    .prose .lm-fold[open] > summary {
      margin-bottom: 10px;
    }

    .prose .lm-spoiler {
      padding: 0 4px;
      border-radius: 4px;
      background: var(--ink);
      color: transparent;
      cursor: help;
      transition:
        color 200ms ease,
        background 200ms ease;
    }

    .prose .lm-spoiler:hover,
    .prose .lm-spoiler:active {
      background: color-mix(in srgb, var(--ink) 10%, transparent);
      color: var(--ink);
    }

    .prose .lm-noteref a {
      padding: 0 2px;
      color: var(--secondary-d);
      font-size: 0.78em;
      text-decoration: none;
    }

    .prose .lm-notes {
      color: var(--muted);
      font-size: 13.5px;
    }

    .prose .lm-notes li {
      margin: 0.3em 0;
    }

    .prose .lm-math {
      margin: 1.5em 0;
      padding: 14px 18px;
      overflow-x: auto;
      border-radius: 12px;
      background: color-mix(in srgb, var(--primary) 6%, var(--surface));
      font-family: var(--mono);
      font-size: 14px;
      white-space: pre-wrap;
    }

    .prose span.lm-math {
      padding: 2px 7px;
      margin: 0;
      white-space: nowrap;
    }

    .prose .lm-verbatim,
    .prose .lm-mermaid {
      font-family: var(--mono);
    }

    .prose pre.lm-mermaid {
      padding: 20px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--ink);
      text-align: center;
    }

    .prose .lm-mermaid svg {
      max-width: 100%;
      height: auto;
      cursor: zoom-in;
    }

    .prose .lm-ruby rt {
      color: var(--muted);
      font-size: 0.65em;
    }

    .prose .lm-task {
      list-style: none;
      padding-left: 0.2em;
    }

    .prose .lm-task input {
      margin-right: 8px;
      accent-color: var(--primary-d);
    }

    /* 旁注：窄屏文末区块，宽屏（≥1280）升右侧栏（与 SSR 同结构） */
    .post-notes {
      display: block;
      margin: 40px 0 0;
      padding: 18px 0 0;
      border-top: 1px solid var(--line);
    }

    .post-notes-kicker {
      margin: 0 0 12px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.26em;
      text-transform: uppercase;
    }

    .post-note {
      display: flex;
      gap: 8px;
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.8;
    }

    .post-note:target {
      border-radius: 8px;
      background: color-mix(in srgb, var(--primary) 8%, transparent);
    }

    .post-note-index {
      flex: none;
      color: var(--secondary-d);
      font-family: var(--mono);
      font-size: 11px;
    }

    @media (min-width: 1280px) {
      .post-notes {
        position: absolute;
        top: 0;
        left: calc(100% + 56px);
        width: 280px;
        height: 100%;
        margin: 0;
        padding: 0 0 0 18px;
        border-top: 0;
        border-left: 1px solid var(--line);
      }

      .post-notes-sticky {
        position: sticky;
        top: 110px;
        max-height: calc(100dvh - 140px);
        overflow-y: auto;
      }
    }

    /* 旁注点按浮层 */
    .note-pop-backdrop {
      position: fixed;
      z-index: 79;
      inset: 0;
    }

    .note-pop {
      position: fixed;
      z-index: 80;
      width: max-content;
      max-width: min(320px, 86vw);
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface);
      box-shadow: 0 12px 32px rgb(28 39 51 / 18%);
      color: var(--ink);
      font-size: 13.5px;
      line-height: 1.8;
    }

    /* 文末 */
    .post-end {
      display: flex;
      align-items: center;
      gap: 18px;
      margin: 60px 0 0;
      color: var(--faint);
      font-family: var(--serif);
      font-size: 14px;
      letter-spacing: 0.5em;
    }

    .post-end::before,
    .post-end::after {
      content: '';
      flex: 1;
      border-top: 1px solid var(--line);
    }

    .post-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 36px;
    }

    .post-foot > :only-child {
      margin-left: auto;
    }

    .post-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .post-tag {
      padding: 5px 14px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      font-size: 12.5px;
      transition:
        color 250ms ease,
        border-color 250ms ease;
    }

    .post-tag:hover {
      border-color: var(--primary);
      color: var(--primary-d);
    }

    .post-like {
      padding: 7px 16px;
      font-size: 13px;
    }

    .post-like svg {
      width: 15px;
      height: 15px;
    }

    .post-nav {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 68px;
      padding-top: 30px;
      border-top: 1px solid var(--line);
    }

    .post-nav-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .post-nav-item.older {
      align-items: flex-end;
      text-align: right;
    }

    .post-nav-kicker {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      transition: color 250ms ease;
    }

    .post-nav-title {
      font-family: var(--serif);
      font-size: 16.5px;
      font-weight: 700;
      line-height: 1.55;
      transition: color 250ms ease;
    }

    .post-nav-item:hover .post-nav-kicker,
    .post-nav-item:hover .post-nav-title {
      color: var(--primary-d);
    }

    /* 评论区 */
    .comments {
      margin-top: 76px;
    }

    .comments-head {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--line);
    }

    .comments-head h2 {
      margin: 0;
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 700;
    }

    .comments-count {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 12px;
    }

    .comment-list,
    .comment-children {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .comment {
      padding: 22px 0;
      border-bottom: 1px dashed var(--line);
    }

    .comment-list > .comment:last-child {
      border-bottom: 0;
    }

    .comment-children {
      margin-top: 18px;
      padding-left: 20px;
      border-left: 2px solid var(--line);
    }

    .comment-children .comment {
      padding-bottom: 0;
      border-bottom: 0;
    }

    .comment header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .comment-who {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .comment-line {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .comment-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
    }

    .comment-site {
      color: var(--primary-d);
      transition: text-decoration-color 250ms ease;
    }

    .comment-site:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .comment-name {
      color: var(--ink);
      font-size: 14px;
      font-weight: 700;
    }

    a.comment-name {
      transition: color 250ms ease;
    }

    a.comment-name:hover {
      color: var(--primary-d);
    }

    .comment-name.is-owner {
      color: var(--primary-d);
    }

    .comment-badge {
      padding: 1px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 16%, transparent);
      color: var(--primary-d);
      font-size: 10.5px;
    }

    .comment time {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
    }

    .comment p {
      margin: 0;
      font-size: 14.5px;
      line-height: 1.9;
    }

    .comment-form {
      margin-top: 30px;
    }

    .comment-form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }

    .comment-form label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.12em;
    }

    .comment-form input,
    .comment-form textarea {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: transparent;
      color: var(--ink);
      font-family: inherit;
      font-size: 14px;
      transition:
        border-color 250ms ease,
        box-shadow 250ms ease;
    }

    .comment-form input:focus,
    .comment-form textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
    }

    .comment-content {
      margin-bottom: 16px;
    }

    .comment-form textarea {
      min-height: 110px;
      resize: vertical;
      line-height: 1.8;
    }

    .comment-form-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .comment-note {
      margin: 0;
      color: var(--faint);
      font-size: 12px;
    }

    .comment-form button {
      padding: 10px 26px;
      border: 0;
      border-radius: 999px;
      background: var(--ink);
      color: var(--page);
      font-size: 13.5px;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition:
        background 250ms ease,
        transform 250ms ease;
    }

    .comment-form button:hover {
      background: var(--primary-d);
      transform: translateY(-1px);
    }

    /* 摘要（详情页 meta 之下、封面之上） */
    .post-summary {
      margin: 20px 0 0;
      color: var(--muted);
      font-size: 16.5px;
      line-height: 1.9;
    }

    /* 目录：宽屏左侧 sticky 栏，窄屏正文上方折叠 */
    .post-toc {
      position: absolute;
      top: 0;
      right: calc(100% + 44px);
      width: 240px;
      height: 100%;
    }

    .post-toc-sticky {
      position: sticky;
      top: 116px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-left: 14px;
      border-left: 1px solid var(--line);
    }

    .post-toc-kicker {
      margin: 0 0 10px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.18em;
    }

    .post-toc-item {
      position: relative;
      padding: 5px 0;
      color: var(--faint);
      font-size: 12.5px;
      line-height: 1.6;
      transition: color 250ms ease;
    }

    .post-toc-item.level-3 {
      padding-left: 14px;
      font-size: 12px;
    }

    .post-toc-item::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: -15px;
      width: 2px;
      background: var(--primary);
      opacity: 0;
      transition: opacity 250ms ease;
    }

    .post-toc-item:hover {
      color: var(--ink);
    }

    .post-toc-item.is-active {
      color: var(--primary-d);
    }

    .post-toc-item.is-active::before {
      opacity: 1;
    }

    .post-toc-mobile {
      display: none;
      margin: 0 0 36px;
      padding: 14px 18px;
      border: 1px solid var(--line);
      border-radius: 14px;
    }

    .post-toc-mobile summary {
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.12em;
      cursor: pointer;
    }

    .post-toc-mobile .post-toc-item {
      display: block;
    }

    .post-toc-mobile .post-toc-item::before {
      content: none;
    }

    .prose h2,
    .prose h3 {
      scroll-margin-top: 96px;
    }

    /* 评论头像 */
    .comment-avatar {
      display: inline-flex;
      flex: none;
      width: 32px;
      height: 32px;
      overflow: hidden;
      border-radius: 50%;
    }

    .comment-avatar svg,
    .comment-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .comment-avatar.has-img svg {
      display: none;
    }

    .comment-avatar.has-img img.is-broken {
      display: none;
    }

    .comment-avatar.has-img img.is-broken + svg {
      display: block;
    }

    /* 评论输入区：收起态是一行引导条 */
    .comment-compose {
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      width: 100%;
      margin-top: 24px;
      padding: 10px 18px 10px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: transparent;
      color: var(--faint);
      font-size: 13.5px;
      text-align: left;
      cursor: pointer;
      transition:
        border-color 250ms ease,
        color 250ms ease;
    }

    .comment-compose:hover {
      border-color: var(--primary);
      color: var(--muted);
    }

    .comment-compose .comment-avatar {
      width: 30px;
      height: 30px;
    }

    .comment-compose-hint {
      flex: 1;
    }

    .comment-compose svg:last-child {
      width: 16px;
      height: 16px;
    }

    .comment-form.is-open {
      animation: comment-form-in 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    @keyframes comment-form-in {
      from {
        opacity: 0;
        translate: 0 -8px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    .comment-form-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .comment-form button.comment-cancel {
      padding: 10px 6px;
      border: 0;
      background: transparent;
      color: var(--faint);
      font-size: 13px;
      cursor: pointer;
      transition: color 250ms ease;
    }

    .comment-form button.comment-cancel:hover {
      background: transparent;
      color: var(--ink);
      transform: none;
    }

    @media (max-width: 1240px) {
      .post-toc {
        display: none;
      }

      .post-toc-mobile {
        display: block;
      }
    }

    /* 布局引擎 */
    .layout-stack {
      display: flex;
      flex-direction: column;
      gap: var(--node-gap, 0);
    }

    .gap-none {
      --node-gap: 0;
      gap: 0;
    }

    .gap-sm {
      --node-gap: 10px;
      gap: 10px;
    }

    .gap-md {
      --node-gap: 18px;
      gap: 18px;
    }

    .gap-lg {
      --node-gap: 32px;
      gap: 32px;
    }

    .gap-xl {
      --node-gap: 54px;
      gap: 54px;
    }

    .align-start {
      align-items: start;
    }

    .align-center {
      align-items: center;
    }

    .align-stretch {
      align-items: stretch;
    }

    .is-sticky {
      position: sticky;
      top: 92px;
      align-self: start;
    }

    .layout-grid {
      display: grid;
      width: min(1120px, calc(100% - 48px));
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 56px;
      margin: 0 auto;
      padding: 130px 0 120px;
    }

    .layout-grid.grid-aside-first {
      grid-template-columns: 280px minmax(0, 1fr);
    }

    /* 个人带：首屏与正文之间的过门 */
    .layout-grid.grid-identity {
      width: min(1180px, calc(100% - 64px));
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 40px;
      align-items: center;
      padding: 44px 0;
      border-bottom: 1px solid var(--line);
      scroll-margin-top: 88px;
    }

    .grid-identity .primitive-avatar {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      object-fit: cover;
      transition: box-shadow 350ms ease;
    }

    .grid-identity .primitive-avatar:hover {
      box-shadow:
        0 0 0 4px var(--page),
        0 0 0 6px var(--primary);
    }

    .grid-identity .layout-stack {
      gap: 4px;
    }

    .grid-identity .text-heading {
      color: var(--ink);
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 700;
    }

    .grid-identity .text-body {
      color: var(--muted);
      font-size: 14px;
    }

    .grid-identity .text-caption {
      color: var(--secondary-d);
      font-size: 11px;
      letter-spacing: 0.14em;
    }

    .grid-identity .profile-log {
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11.5px;
      line-height: 1.9;
      text-align: right;
      white-space: pre-line;
    }

    /* 正文区：文章流 + 侧栏 */
    .layout-grid.grid-feed-rail {
      width: min(1180px, calc(100% - 64px));
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 64px;
      align-items: start;
      padding: 72px 0 96px;
    }

    .site-footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 44px;
      border-top: 1px solid var(--line);
      color: var(--faint);
      font-size: 12px;
      letter-spacing: 0.14em;
    }
    .layout-grid.grid-three-rail,
    .theme-hanakoi .layout-grid.grid-three-rail {
      width: 100%;
      max-width: none;
      min-height: 100svh;
      margin: 0;
      grid-template-columns: clamp(240px, 16vw, 280px) minmax(0, 900px) clamp(240px, 16vw, 280px);
      justify-content: center;
      gap: 28px;
      padding: 70px clamp(16px, 2vw, 32px) 96px;
      background: var(--page);
    }

    .theme-hanakoi .layout-card {
      border: 0;
      background: var(--surface);
    }

    .max-full {
      max-width: none;
    }

    .max-1240 {
      max-width: 1240px;
    }

    .layout-split {
      display: grid;
      width: min(1180px, calc(100% - 40px));
      grid-template-columns: 270px minmax(0, 1fr);
      gap: 34px;
      margin: 0 auto;
      padding: 88px 0 120px;
      align-items: start;
    }

    .theme-hanakoi .layout-split {
      padding-top: 104px;
      background:
        radial-gradient(circle at 10% 2%, rgb(227 160 178 / 8%), transparent 24%),
        radial-gradient(circle at 90% 16%, rgb(114 173 210 / 9%), transparent 28%);
    }

    .theme-hanakoi .layout-split > .layout-stack {
      --node-gap: 34px;
    }

    .theme-moonletter .layout-grid {
      align-items: start;
      grid-template-columns: minmax(0, 1fr) 280px;
      padding-top: 118px;
    }

    .layout-bento {
      display: grid;
      width: min(1240px, calc(100% - 40px));
      min-height: 100dvh;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: 84px;
      gap: 18px;
      margin: 0 auto;
      padding: 106px 0 120px;
    }

    .theme-orbit .layout-bento::before {
      position: fixed;
      z-index: -1;
      opacity: 0.13;
      background-image:
        linear-gradient(rgb(121 199 211 / 18%) 1px, transparent 1px),
        linear-gradient(90deg, rgb(121 199 211 / 18%) 1px, transparent 1px);
      background-size: 84px 84px;
      content: '';
      inset: 0;
      mask-image: linear-gradient(to bottom, black, transparent 90%);
    }

    .theme-orbit .layout-bento > .node-hero {
      grid-column: span 8;
      grid-row: span 5;
    }

    .theme-orbit .layout-bento > .node-profile-card {
      grid-column: span 4;
      grid-row: span 5;
    }

    .theme-orbit .layout-bento > .node-article-feed {
      grid-column: span 9;
      grid-row: span 7;
    }

    .theme-orbit .layout-bento > .layout-stack {
      grid-column: span 3;
      grid-row: span 7;
    }

    .node {
      position: relative;
      min-width: 0;
    }

    .layout-card {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 16px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--ink);
    }

    .layout-card.card-glass {
      border-color: color-mix(in srgb, var(--primary) 22%, var(--line));
      background: color-mix(in srgb, var(--surface) 82%, transparent);
      backdrop-filter: blur(18px);
    }

    .layout-card.card-outlined {
      border-width: 2px;
      background: transparent;
    }

    .layout-card.card-paper {
      border-radius: 2px;
      background:
        repeating-linear-gradient(
          transparent 0 31px,
          color-mix(in srgb, var(--primary) 8%, transparent) 32px
        ),
        var(--surface);
    }

    .padding-none {
      padding: 0;
    }

    .padding-sm {
      padding: 12px;
    }

    .padding-md {
      padding: 20px;
    }

    .padding-lg {
      padding: 28px;
    }

    .padding-xl {
      padding: 40px;
    }

    .radius-none {
      border-radius: 0;
    }

    .radius-sm {
      border-radius: 8px;
    }

    .radius-md {
      border-radius: 16px;
    }

    .radius-lg {
      border-radius: 24px;
    }

    .radius-pill {
      border-radius: 999px;
    }

    .shadow-none {
      box-shadow: none;
    }

    .shadow-soft {
      box-shadow: 0 18px 48px rgb(38 57 78 / 10%);
    }

    .shadow-blue {
      box-shadow: -7px 9px 0 rgb(114 173 210 / 14%);
    }

    .shadow-pink {
      box-shadow: 7px 9px 0 rgb(227 160 178 / 15%);
    }

    .is-sticky {
      position: sticky;
      top: 88px;
      align-self: start;
    }

    .primitive-avatar {
      display: grid;
      flex: 0 0 auto;
      place-items: center;
      background: linear-gradient(145deg, var(--secondary), var(--primary));
      color: white;
      font-family: var(--serif);
      box-shadow: 0 10px 28px color-mix(in srgb, var(--secondary) 22%, transparent);
    }

    .avatar-sm {
      width: 44px;
      height: 44px;
      font-size: 16px;
    }

    .avatar-md {
      width: 64px;
      height: 64px;
      font-size: 21px;
    }

    .avatar-lg {
      width: 88px;
      height: 88px;
      font-size: 28px;
    }

    .avatar-xl {
      width: 104px;
      height: 104px;
      font-size: 34px;
    }

    .avatar-circle {
      border-radius: 50%;
    }

    .avatar-rounded {
      border-radius: 20px;
    }

    .avatar-square {
      border-radius: 0;
    }

    .primitive-text {
      width: 100%;
    }

    .text-eyebrow {
      color: var(--secondary);
      font: 700 10px/1.4 system-ui, sans-serif;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }

    .text-heading {
      color: var(--secondary);
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 700;
      line-height: 1.35;
    }

    .text-body {
      color: var(--muted);
      line-height: 1.8;
    }

    .text-caption {
      color: var(--muted);
      font-size: 12px;
    }

    .text-left {
      text-align: left;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    .primitive-socials {
      display: flex;
      width: 100%;
      flex-wrap: wrap;
      gap: 8px;
    }

    .primitive-socials a {
      color: var(--primary);
      font-size: 12px;
    }

    .socials-labels {
      flex-direction: column;
    }

    .socials-labels a {
      padding: 8px 10px;
      border-radius: 9px;
      background: var(--surface-soft);
    }

    .socials-pills a,
    .socials-icons a {
      padding: 7px 11px;
      border: 1px solid var(--line);
      border-radius: 999px;
    }

    .primitive-status,
    .profile-log {
      width: 100%;
      margin: 8px 0 0;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgb(44 62 80 / 4%);
      color: var(--muted);
      font: 11px/1.5 ui-monospace, monospace;
      white-space: pre-wrap;
    }

    .status-online {
      color: #35835c;
    }

    .status-accent {
      color: var(--secondary);
    }

    .layout-card > .quote-card,
    .layout-card > .stats-card {
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    /* ---------- 首屏 ---------- */
    .hero {
      position: relative;
      display: grid;
      min-height: 100dvh;
      place-items: center;
      overflow: hidden;
      isolation: isolate;
      background:
        radial-gradient(circle at 70% 18%, rgb(74 147 194 / 24%), transparent 46%),
        linear-gradient(180deg, #122539, #0e1d30);
      color: #eef3f8;
    }

    .hero::before {
      position: absolute;
      z-index: -1;
      inset: 0;
      content: '';
      background: linear-gradient(
        180deg,
        rgb(6 14 26 / 30%),
        rgb(6 14 26 / 8%) 45%,
        rgb(9 17 30 / 42%) 100%
      );
    }

    .hero::after {
      position: absolute;
      z-index: -1;
      right: 0;
      bottom: 0;
      left: 0;
      height: 8vh;
      content: '';
      background: linear-gradient(180deg, transparent, rgb(247 248 247 / 68%));
    }

    /* hero-enter style 旋钮：wave/none 关掉白雾 */
    .hero.enter-none::after,
    .hero.enter-wave::after {
      display: none;
    }

    /* 三层叠加波浪：各自周期/速度/方向不同，叠加后读不出正弦
       （借 qsl rail 的思路；纯 CSS 动画，无 JS 开销） */
    .hero-waves {
      position: absolute;
      z-index: -1;
      right: 0;
      bottom: 0;
      left: 0;
      height: 96px;
      overflow: hidden;
      pointer-events: none;
    }

    .hero-waves .wave {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 200%;
      height: 100%;
      animation: hero-wave-slide linear infinite;
    }

    .hero-waves .wave-back {
      fill: rgb(255 255 255 / 28%);
      animation-duration: 26s;
      animation-direction: reverse;
    }

    .hero-waves .wave-mid {
      fill: rgb(255 255 255 / 45%);
      animation-duration: 17s;
    }

    .hero-waves .wave-front {
      fill: var(--page);
      animation-duration: 11s;
    }

    @keyframes hero-wave-slide {
      to {
        transform: translateX(-50%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .hero-waves .wave {
        animation: none;
      }
    }

    @media (max-width: 640px) {
      .hero-waves {
        height: 60px;
      }
    }

    .hero-background {
      position: absolute;
      z-index: -2;
      top: -32%;
      left: 0;
      width: 100%;
      height: 132%;
      background: var(--hero-pos, center) / cover no-repeat;
      will-change: transform;
    }

    .hero:not(.has-media) .hero-background {
      display: none;
    }

    .hero-inner {
      display: flex;
      width: min(680px, 88vw);
      align-items: center;
      flex-direction: column;
      gap: 5.5vh;
      text-align: center;
      will-change: transform, opacity;
    }

    .hero-info {
      display: flex;
      width: auto;
      max-width: 100%;
      align-items: center;
      flex-direction: column;
    }

    .component-kicker {
      margin: 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.26em;
      text-transform: uppercase;
    }

    .hero-inner > .component-kicker {
      color: rgb(238 243 248 / 72%);
    }

    .hero h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(30px, 5.2vw, 64px);
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.15;
      text-shadow: 0 6px 40px rgb(0 0 0 / 50%);
      white-space: nowrap;
    }

    .hero-character {
      display: inline-block;
      animation: hero-char-in 700ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
      animation-delay: calc(var(--char-index) * 55ms);
    }
    :host(.spa-return) .hero-character {
      animation: none;
    }

    .hero-character.accent {
      color: var(--secondary);
    }

    @keyframes hero-char-in {
      from {
        opacity: 0;
        translate: 0 22px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    /* 首屏信息卡：深色半透明卡，引语与社交图标同卡（参考旧版 YukiLog） */
    .welcome-quote {
      display: flex;
      width: auto;
      max-width: 100%;
      align-items: center;
      flex-direction: column;
      gap: 18px;
      padding: 24px 36px 20px;
      border: 1px solid rgb(255 255 255 / 8%);
      border-radius: 24px;
      background: rgb(6 12 22 / 55%);
    }

    .quote-mark {
      display: none;
    }

    .quote-text {
      font-family: var(--serif);
      font-size: 17px;
      line-height: 1.9;
      color: rgb(255 255 255 / 88%);
      text-align: center;
    }

    .social-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px 18px;
    }

    .social-icon {
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border-radius: 50%;
      transition:
        filter 300ms cubic-bezier(0.22, 0.61, 0.36, 1),
        transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .social-icon svg {
      transition: transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .social-icon:hover {
      filter: brightness(1.35);
      transform: translateY(-2px);
    }

    .social-icon:hover svg {
      transform: scale(1.12);
    }

    /* ENTER 块：底部整区可点，文字与箭头仅作引导（pointer-events:none） */
    .enter-button {
      position: absolute;
      inset: auto 0 0 0;
      height: 24vh;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 0 0 32px;
      border: 0;
      background: none;
      color: rgb(238 243 248 / 66%);
      cursor: pointer;
    }

    .enter-guide {
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 8px;
      color: rgb(238 243 248 / 92%);
      pointer-events: none;
      filter: drop-shadow(0 2px 12px rgb(9 17 30 / 65%));
    }

    .enter-guide span {
      font-size: 11px;
      letter-spacing: 0.3em;
      text-indent: 0.3em;
    }

    .enter-guide svg {
      width: 40px;
      height: 40px;
      animation: enter-bob 2.4s ease-in-out infinite;
    }

    @keyframes enter-bob {
      0%,
      100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(7px);
      }
    }

    .hero-compact .hero-inner,
    .hero-split .hero-inner {
      gap: 18px;
    }

    /* ---------- 刊头 ---------- */
    .masthead-minimal {
      display: flex;
      align-items: baseline;
      gap: 20px;
      margin-bottom: 44px;
    }

    /* 刊头背景：蒙版为深色（强度可调，默认 0），文字固定白色 + 硬阴影保证可读 */
    .masthead.has-bg {
      background-position: var(--masthead-pos, center);
      background-size: var(--masthead-fit, cover);
      position: relative;
      overflow: hidden;
      padding: 30px 32px;
      border-radius: 18px;
    }

    .masthead.has-bg::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgb(10 14 20 / var(--masthead-tint, 0%));
    }

    .masthead.has-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        transparent 52%,
        rgb(10 14 20 / 55%)
      );
    }


    .masthead.has-bg h1,
    .masthead.has-bg .kicker,
    .masthead.has-bg .lead,
    .page-head.has-bg h1,
    .page-head.has-bg .kicker,
    .page-head.has-bg .inner-lede {
      color: #fff;
      text-shadow:
        0 2px 0 rgb(9 13 20 / 55%),
        0 6px 20px rgb(9 13 20 / 35%);
    }

    .masthead.has-bg > * {
      position: relative;
      z-index: 1;
    }

    .masthead-minimal.has-bg {
      align-items: center;
    }

    .masthead-minimal .kicker {
      margin: 0;
      color: var(--secondary-d);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.08em;
    }

    .masthead-minimal h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: 32px;
      font-weight: 700;
    }

    .sort-title-anim {
      display: inline-block;
      animation: sort-title-in 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    /* 刊头紧跟文章流（带排序 tab）时收紧间距 */
    .node-masthead.masthead-minimal:has(+ .node-article-feed) {
      flex-wrap: wrap;
      row-gap: 12px;
      margin-bottom: 0;
    }

    @keyframes sort-title-in {
      from {
        opacity: 0;
        translate: 0 8px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    .masthead-minimal .lead {
      margin: 0 0 0 auto;
      color: var(--faint);
      font-size: 12px;
    }

    .masthead-editorial {
      margin-bottom: 44px;
    }

    .masthead-editorial .kicker {
      margin: 0 0 12px;
      color: var(--secondary-d);
    }

    .masthead-editorial h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(34px, 4.6vw, 48px);
    }

    .masthead-editorial .lead {
      margin: 10px 0 0;
      color: var(--muted);
    }

    /* ---------- 个人卡（工作室可选组件的简约样式） ---------- */
    .profile-card {
      width: min(100%, 420px);
    }

    .profile-button {
      display: block;
      width: 100%;
      padding: 26px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--surface);
      color: var(--ink);
      text-align: center;
    }

    .profile-face {
      display: block;
    }

    .profile-back {
      display: none;
    }

    .profile-button[aria-pressed='true'] .profile-face:not(.profile-back) {
      display: none;
    }

    .profile-button[aria-pressed='true'] .profile-back {
      display: block;
    }

    .profile-face .avatar {
      display: grid;
      width: 64px;
      height: 64px;
      margin: 0 auto 12px;
      place-items: center;
      border-radius: 50%;
      background: linear-gradient(150deg, #3d5a80, #7eb6d9 55%, #c9a0b4);
      color: #fff;
      font-family: var(--serif);
      font-size: 24px;
    }

    .profile-face h2 {
      margin: 0 0 6px;
      font-family: var(--serif);
      font-size: 20px;
    }

    .profile-face p {
      margin: 0;
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.8;
    }

    .profile-socials,
    .profile-status,
    .profile-hint {
      display: block;
      margin-top: 10px;
      color: var(--faint);
      font-size: 12px;
    }

    /* ---------- 文章流 ---------- */
    .article-feed {
      min-width: 0;
    }

    .feed-alternating {
      display: flex;
      flex-direction: column;
      gap: 56px;
    }

    .feed-alternating .article {
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
      gap: 32px;
      align-items: start;
    }

    .feed-alternating .article:nth-child(even) {
      grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    }

    /* 竖屏封面：图列收窄、文字列放宽，卡片不再一半都是图（奇偶换侧沿用基础 order 规则） */
    .feed-alternating .article:has(yuki-cover[orientation='portrait']) {
      grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
    }

    .feed-alternating .article:nth-child(even):has(yuki-cover[orientation='portrait']) {
      grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
    }

    .feed-alternating .article:nth-child(even) .article-cover {
      order: 2;
    }

    .article-cover {
      display: block;
      overflow: hidden;
      border-radius: 14px;
      transition:
        translate 450ms cubic-bezier(0.22, 0.61, 0.36, 1),
        box-shadow 450ms ease;
    }

    .article-cover yuki-cover {
      border-radius: 14px;
    }

    .article:hover .article-cover {
      translate: 0 -6px;
      box-shadow: 0 22px 44px -14px rgb(74 147 194 / 38%);
    }

    .article:nth-child(even):hover .article-cover {
      box-shadow: 0 22px 44px -14px rgb(213 127 149 / 38%);
    }

    .article-copy {
      min-width: 0;
    }

    .article-copy .meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      color: var(--faint);
      font-size: 12px;
    }

    .article-copy .meta .cat {
      color: var(--primary-d);
      font-weight: 600;
      letter-spacing: 0.1em;
    }

    .article:nth-child(even) .article-copy .meta .cat {
      color: var(--secondary-d);
    }

    .article-copy h3 {
      margin: 0;
      font-family: var(--serif);
      font-size: 25px;
      font-weight: 700;
      line-height: 1.45;
    }

    .article-copy h3 a {
      background-image: linear-gradient(currentColor, currentColor);
      background-repeat: no-repeat;
      background-size: 0 1.5px;
      background-position: 0 97%;
      transition: background-size 400ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .article-copy h3 a:hover {
      background-size: 100% 1.5px;
    }

    .article-copy .summary {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 14.5px;
      line-height: 1.95;
    }

    .article-copy .foot {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      margin-top: 14px;
      color: var(--faint);
      font-size: 12px;
    }

    .article-copy .foot .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      margin-right: auto;
    }

    .article-copy .foot .tags a:hover {
      color: var(--primary-d);
    }

    /* 其它文章列表变体的兜底排版 */
    .feed-editorial,
    .feed-cover-overlay,
    .feed-compact {
      display: grid;
      gap: 24px;
    }

    /* ---------- 侧栏区块 ---------- */
    .stats-card,
    .quote-card,
    .dynamic-strip,
    .pulse-panel {
      display: block;
      margin: 0;
      padding: 18px 0 0;
      border-top: 2px solid var(--ink);
      background: none;
    }

    .stats-card > .component-kicker,
    .dynamic-strip > .component-kicker {
      display: block;
      margin-bottom: 18px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.22em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px 12px;
    }

    .stat strong {
      display: block;
      font-family: var(--serif);
      font-size: 26px;
      font-weight: 700;
    }

    .stat:nth-child(1) strong {
      color: var(--primary-d);
    }

    .stat:nth-child(2) strong {
      color: var(--secondary-d);
    }

    .stat span {
      color: var(--faint);
      font-size: 11.5px;
    }

    .quote-card {
      position: relative;
      font-family: var(--serif);
      font-size: 15.5px;
      line-height: 2;
    }

    .quote-refresh {
      position: absolute;
      top: 6px;
      right: 6px;
      display: grid;
      width: 26px;
      height: 26px;
      padding: 0;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: none;
      color: var(--faint);
      opacity: 0;
      transition:
        opacity 200ms ease,
        color 200ms ease,
        rotate 400ms ease;
    }

    .quote-card:hover .quote-refresh,
    .quote-refresh:focus-visible {
      opacity: 1;
    }

    .quote-refresh:hover {
      color: var(--primary-d);
      rotate: 180deg;
    }

    .quote-refresh:disabled {
      opacity: 0.4;
    }

    .quote-refresh svg {
      width: 15px;
      height: 15px;
    }

    .quote-card cite {
      display: block;
      margin-top: 10px;
      color: var(--faint);
      font-family: var(--serif);
      font-size: 12px;
      font-style: normal;
      text-align: right;
    }

    .dynamic-item {
      display: block;
      padding: 13px 0;
      border-bottom: 1px dashed var(--line);
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.75;
      transition:
        color 250ms ease,
        translate 250ms ease;
    }

    .dynamic-item:last-child {
      border-bottom: 0;
    }

    .dynamic-item:hover {
      color: var(--ink);
      translate: 4px 0;
    }

    .dynamic-item time {
      display: block;
      margin-bottom: 2px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 10.5px;
    }

    /* 站点脉搏（最近评论 + 新友链混合时间线，结构与 dynamic-item 一致） */
    .pulse-panel {
      display: grid;
      gap: 2px;
    }

    .pulse-item {
      display: block;
      padding: 13px 0;
      border-bottom: 1px dashed var(--line);
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.75;
      text-decoration: none;
      transition: color 250ms ease;
    }

    .pulse-item:last-child {
      border-bottom: 0;
    }

    .pulse-item:hover {
      color: var(--ink);
    }

    .pulse-item time {
      display: block;
      margin-bottom: 2px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 10.5px;
    }

    .pulse-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      margin-right: 8px;
      border-radius: 50%;
      translate: 0 -1px;
    }

    .pulse-dot.pulse-comment {
      background: var(--primary);
    }

    .pulse-dot.pulse-friend {
      background: var(--secondary);
    }

    .pulse-text strong {
      color: var(--ink);
      font-weight: 600;
    }
    /* Layout studio */
    @keyframes hero-reveal {
      from {
        filter: blur(9px) brightness(0.55);
        transform: scale(1.1);
      }
      to {
        filter: blur(0) brightness(1);
        transform: scale(1.04);
      }
    }

    @keyframes nav-item-in {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes mobile-menu-up {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    @keyframes hero-media-reveal {
      from {
        filter: brightness(0.3) blur(8px);
        transform: scale(1.08);
      }
      to {
        filter: brightness(var(--hero-brightness, 0.7)) blur(0);
        transform: scale(1.02);
      }
    }

    @keyframes hero-copy-in {
      from {
        opacity: 0;
        transform: translateY(26px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes character-in {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes enter-float {
      0%,
      100% {
        transform: translate(-50%, 0);
      }
      50% {
        transform: translate(-50%, 7px);
      }
    }

    /* ---------- 回到顶部（滚动进度环） ---------- */
    .to-top {
      position: fixed;
      z-index: 60;
      right: 22px;
      bottom: 22px;
      display: grid;
      width: 46px;
      height: 46px;
      padding: 0;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: var(--surface);
      box-shadow: 0 8px 24px rgb(28 39 51 / 16%);
      color: var(--ink);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      translate: 0 10px;
      transition:
        opacity 320ms ease,
        translate 320ms cubic-bezier(0.22, 0.61, 0.36, 1),
        visibility 320ms;
    }

    .to-top.show {
      opacity: 1;
      visibility: visible;
      translate: 0 0;
    }

    .to-top svg.ring {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
      fill: none;
    }

    .to-top .ring-bg {
      stroke: var(--line);
      stroke-width: 2.5;
    }

    .to-top .ring-fg {
      stroke: var(--primary-d);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-dasharray: 125.66;
      stroke-dashoffset: 125.66;
    }

    .to-top svg.arrow {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .to-top:hover {
      color: var(--primary-d);
    }

    /* ---------- 首页文章排序切换（嵌在刊头行内右侧） ---------- */
    .sort-tabs {
      display: flex;
      gap: 6px;
      margin: 0 0 0 auto;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: 999px;
      width: fit-content;
    }

    .sort-tabs button {
      padding: 6px 16px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font-size: 12.5px;
      cursor: pointer;
      transition:
        color 250ms ease,
        background 250ms ease;
    }

    .sort-tabs button:hover {
      color: var(--ink);
    }

    .sort-tabs button[aria-pressed='true'] {
      background: var(--ink);
      color: #fff;
    }

    /* ---------- 侧栏「最近动态」更多链接 ---------- */
    .dynamic-strip > .component-kicker {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    a.strip-kicker {
      color: var(--ink);
      text-decoration: none;
      cursor: pointer;
    }

    .strip-more {
      color: var(--muted);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.14em;
      transition:
        color 250ms ease,
        translate 250ms ease;
    }

    a.strip-kicker:hover .strip-more {
      color: var(--primary-d);
      translate: 3px 0;
    }

    /* ---------- 文章流「全部文章」 ---------- */
    .feed-more {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 28px;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.18em;
      text-decoration: none;
      transition: color 250ms ease;
    }

    .feed-more span {
      transition: translate 250ms ease;
    }

    .feed-more:hover {
      color: var(--primary-d);
    }

    .feed-more:hover span {
      translate: 4px 0;
    }

    /* ---------- 友链 favicon 头像 ---------- */
    .friend-avatar {
      position: relative;
      overflow: hidden;
    }

    .friend-avatar img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      object-fit: cover;
      background: var(--surface);
    }

    /* ---------- 友链申请表单 ---------- */
    .friend-apply {
      margin-top: 56px;
      padding-top: 30px;
      border-top: 2px solid var(--ink);
    }

    .friend-apply h2 {
      margin: 10px 0 12px;
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 600;
    }

    .apply-lede {
      margin: 0 0 22px;
      max-width: 52ch;
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.9;
    }

    .apply-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 18px;
      max-width: 640px;
    }

    .apply-form label {
      display: grid;
      gap: 8px;
      color: var(--ink);
      font-size: 12.5px;
      letter-spacing: 0.06em;
    }

    .apply-form label.wide {
      grid-column: 1 / -1;
    }

    .apply-form input,
    .apply-form textarea {
      min-width: 0;
      padding: 11px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 13.5px;
      transition:
        border-color 200ms ease,
        box-shadow 200ms ease;
    }

    .apply-form input:focus,
    .apply-form textarea:focus,
    .sub-form input[type='email']:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
      outline: none;
    }

    .apply-form textarea {
      resize: vertical;
    }

    .apply-form button,
    .sub-form button {
      justify-self: start;
      padding: 11px 30px;
      border: none;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      font: inherit;
      font-size: 13px;
      letter-spacing: 0.12em;
      cursor: pointer;
      transition:
        background 200ms ease,
        translate 200ms ease;
    }

    .apply-form button:hover:not(:disabled),
    .sub-form button:hover:not(:disabled) {
      background: var(--primary-d);
      translate: 0 -1px;
    }

    .apply-form button:disabled,
    .sub-form button:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .apply-err,
    .sub-err {
      margin: 0;
      color: var(--secondary-d, #c26d82);
      font-size: 12.5px;
    }

    .apply-ok,
    .sub-ok {
      margin: 0;
      padding: 16px 18px;
      border: 1px solid color-mix(in srgb, var(--primary) 45%, var(--line));
      border-radius: 12px;
      background: color-mix(in srgb, var(--primary) 8%, var(--surface));
      color: var(--ink);
      font-size: 13.5px;
      line-height: 1.8;
    }

    /* ---------- 邮件订阅横条 ---------- */
    .subscribe-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px 32px;
      margin: 0 0 56px;
      padding: 20px 24px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--surface);
    }

    .subscribe-strip .component-kicker {
      margin: 0 0 5px;
    }

    .sub-copy {
      flex: 1 1 280px;
    }

    .sub-text {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.75;
    }

    .sub-text a {
      color: var(--primary-d);
      text-decoration: none;
    }

    .sub-text a:hover {
      text-decoration: underline;
    }

    .sub-form {
      display: flex;
      flex: 1 1 360px;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .sub-form input[type='email'] {
      flex: 1 1 180px;
      min-width: 0;
      padding: 10px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 13.5px;
      transition:
        border-color 200ms ease,
        box-shadow 200ms ease;
    }

    .sub-other {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 12.5px;
      white-space: nowrap;
      cursor: pointer;
    }

    .sub-other input {
      accent-color: var(--primary-d);
    }

    .subscribe-strip .sub-ok,
    .subscribe-strip .sub-err {
      flex: 1 1 100%;
    }

    /* ---------- 归档行悬停展开 ---------- */
    .archive-row {
      grid-template-columns: 104px minmax(0, 1fr) auto;
    }

    .archive-more {
      display: grid;
      grid-column: 1 / -1;
      grid-template-rows: 0fr;
      transition: grid-template-rows 480ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .archive-row:hover .archive-more,
    .archive-row:focus-visible .archive-more {
      grid-template-rows: 1fr;
    }

    .archive-more-in {
      display: flex;
      min-height: 0;
      align-items: center;
      gap: 18px;
      overflow: hidden;
    }

    .archive-cover {
      display: block;
      width: 120px;
      flex: 0 0 120px;
      border-radius: 10px;
    }

    .archive-summary {
      margin: 0;
      padding: 14px 0 4px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.85;
    }

    /* ---------- 动态爱心 ---------- */
    .mfoot {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .heart-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px 3px 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: transparent;
      color: var(--faint);
      font-size: 12px;
      cursor: pointer;
      transition:
        color 250ms ease,
        border-color 250ms ease,
        background 250ms ease;
    }

    .heart-button svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      transition:
        fill 250ms ease,
        stroke 250ms ease,
        scale 250ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .heart-button:hover {
      border-color: var(--secondary);
      color: var(--secondary-d);
    }

    .heart-button.liked {
      border-color: var(--secondary);
      background: rgb(232 164 180 / 12%);
      color: var(--secondary-d);
    }

    .heart-button.liked svg {
      fill: var(--secondary-d);
      stroke: var(--secondary-d);
      scale: 1.15;
    }

    /* ---------- 加载骨架 / 错误重试 ---------- */
    .skel {
      border-radius: 8px;
      background: linear-gradient(
        100deg,
        var(--surface-soft) 42%,
        var(--surface) 52%,
        var(--surface-soft) 62%
      );
      background-size: 200% 100%;
      animation: skel-shine 1.5s linear infinite;
    }

    .skel-cover {
      border-radius: 14px;
      aspect-ratio: 16 / 9;
    }

    .skel-line {
      height: 13px;
      margin: 9px 0;
    }

    @keyframes skel-shine {
      to {
        background-position: -200% 0;
      }
    }

    .load-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px 18px;
      padding: 20px 22px;
      border: 1px dashed var(--line);
      border-radius: 14px;
      color: var(--muted);
      font-size: 13.5px;
    }

    .load-error p {
      margin: 0;
    }

    .load-error button {
      padding: 8px 20px;
      border: 0;
      border-radius: 999px;
      background: var(--ink);
      color: var(--page);
      font-size: 12.5px;
      transition: background 250ms ease;
    }

    .load-error button:hover {
      background: var(--primary-d);
    }

    /* ---------- 分页 / 加载更多 ---------- */
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 52px;
      font-family: var(--mono);
      font-size: 12px;
    }

    .pager a,
    .pager-cur {
      padding: 7px 13px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      transition:
        color 250ms ease,
        border-color 250ms ease;
    }

    .pager a:hover {
      border-color: var(--primary);
      color: var(--primary-d);
    }

    .pager .pager-cur {
      border-color: var(--ink);
      background: var(--ink);
      color: #fff;
    }

    .pager .pager-gap {
      padding: 7px 2px;
      color: var(--faint);
    }

    .load-more {
      display: block;
      margin: 4px auto 0;
      padding: 11px 32px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--muted);
      font-size: 13px;
      letter-spacing: 0.06em;
      transition:
        color 250ms ease,
        border-color 250ms ease,
        translate 250ms ease;
    }

    .load-more:hover:not(:disabled) {
      border-color: var(--primary);
      color: var(--primary-d);
      translate: 0 -1px;
    }

    .load-more:disabled {
      opacity: 0.6;
      cursor: wait;
    }

    /* ---------- 首屏背景轮播 ---------- */
    .hero-bg-stack {
      /* 几何沿用 .hero-background（top:-32%; height:132% 视差超幅），仅作图层容器 */
    }

    .hero-bg-layer {
      position: absolute;
      inset: 0;
      background-position: var(--hero-pos, center);
      background-size: var(--hero-fit, contain);
      background-repeat: no-repeat;
      opacity: 0;
      transition: opacity 1400ms ease;
    }

    /* contain 适应：同图模糊填充底层，避免信箱黑边 */
    .hero-bg-layer.blur {
      background-size: cover;
      scale: 1.08;
      filter: blur(42px) brightness(0.72);
    }

    /* 焦点图层：贴视口几何（不参与 132% 视差超幅），cover/自定义缩放精确还原框选 */
    .hero-bg-static {
      position: absolute;
      inset: 0;
      z-index: -2;
    }

    .hero-bg-layer.active {
      opacity: 1;
    }

    /* ---------- 开屏动画（冷进入播放；is-intro 期间首屏入场待命） ---------- */
    .hero-info,
    .enter-button {
      transition:
        opacity 800ms cubic-bezier(0.22, 0.61, 0.36, 1),
        translate 800ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .hero-info {
      transition-delay: 150ms;
    }

    .enter-button {
      transition-delay: 350ms;
    }

    :host(.is-intro) .hero-character {
      animation-play-state: paused;
    }

    :host(.is-intro) .hero-info,
    :host(.is-intro) .enter-button {
      opacity: 0;
    }

    :host(.is-intro) .hero-info {
      translate: 0 22px;
    }

    :host(.is-intro) .enter-button {
      translate: 0 22px;
    }

    .prelude {
      position: fixed;
      inset: 0;
      z-index: 300;
      display: grid;
      grid-template-rows: 1fr auto;
      overflow: hidden;
      background: var(--page);
      animation: prelude-exit 0.9s cubic-bezier(0.22, 0.7, 0.2, 1) 2.3s forwards;
    }

    .prelude.is-skipped {
      animation-name: prelude-exit-now;
      animation-delay: 0s;
    }

    /* 等待首屏资源时冻结退场动画，开屏层停留为加载屏 */
    .prelude.is-waiting {
      animation-play-state: paused;
    }

    .prelude.is-leaving {
      pointer-events: none;
    }

    .prelude-bloom {
      position: absolute;
      top: 46%;
      left: 50%;
      width: min(60vw, 560px);
      aspect-ratio: 1;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--secondary) 18%, transparent),
        color-mix(in srgb, var(--primary) 7%, transparent) 46%,
        transparent 72%
      );
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
      animation: prelude-bloom 1.9s ease-out 1.15s;
    }

    .prelude-stage {
      position: relative;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 18px;
      padding: 6vw;
      text-align: center;
    }

    .prelude-kicker {
      margin: 0;
      color: var(--secondary-d);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.42em;
      text-transform: uppercase;
      animation: prelude-arrive 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }

    .prelude-title {
      color: var(--ink);
      font-family: var(--serif);
      font-size: clamp(48px, 10vw, 104px);
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.02em;
      animation: prelude-arrive 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.12s both;
    }

    .prelude-flake {
      color: var(--primary-d);
      font-size: 22px;
      line-height: 1;
      opacity: 0;
      transform: scale(0.4);
      animation: prelude-flake 0.7s cubic-bezier(0.18, 0.82, 0.22, 1) 1.15s forwards;
    }

    .prelude-trace {
      position: relative;
      height: 80px;
      margin: 0 8vw 9vh;
    }

    .prelude-trace svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .prelude-track {
      fill: none;
      stroke: var(--ink);
      stroke-width: 1;
      opacity: 0.08;
    }

    .prelude-line {
      fill: none;
      stroke: var(--primary-d);
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      opacity: 0.6;
      animation: prelude-trace 1.5s cubic-bezier(0.3, 0.05, 0.25, 1) 0.2s forwards;
    }

    .prelude-hint {
      position: absolute;
      right: 24px;
      bottom: 16px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.2em;
    }

    @keyframes prelude-exit {
      to {
        opacity: 0;
        filter: blur(3px);
        transform: scale(1.015);
        visibility: hidden;
      }
    }

    @keyframes prelude-exit-now {
      to {
        opacity: 0;
        filter: blur(3px);
        transform: scale(1.015);
        visibility: hidden;
      }
    }

    @keyframes prelude-arrive {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
    }

    @keyframes prelude-bloom {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      22% {
        opacity: 0.85;
        transform: translate(-50%, -50%) scale(1.02);
      }
      58% {
        opacity: 0.3;
        transform: translate(-50%, -50%) scale(1.1);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1.22);
      }
    }

    @keyframes prelude-flake {
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes prelude-trace {
      0% {
        stroke-dashoffset: 1;
      }
      70% {
        stroke-dashoffset: 0;
        opacity: 0.6;
      }
      100% {
        stroke-dashoffset: 0;
        opacity: 0.25;
      }
    }

    /* ---------- 灯箱 ---------- */
    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 400;
      display: grid;
      place-items: center;
      background: rgb(6 12 22 / 88%);
      cursor: zoom-out;
      backdrop-filter: blur(10px);
      animation: lightbox-in 220ms ease both;
    }

    @keyframes lightbox-in {
      from {
        opacity: 0;
      }
    }

    .lightbox-image {
      max-width: 92vw;
      max-height: 88vh;
      border-radius: 10px;
      background: #fff;
      object-fit: contain;
      box-shadow: 0 30px 90px rgb(0 0 0 / 45%);
      cursor: default;
      animation: lightbox-img-in 260ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    @keyframes lightbox-img-in {
      from {
        opacity: 0;
        scale: 0.96;
      }
    }

    .lightbox-close {
      position: fixed;
      top: 22px;
      right: 26px;
      display: grid;
      width: 42px;
      height: 42px;
      padding: 0;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: rgb(255 255 255 / 12%);
      color: #fff;
      font-size: 22px;
      line-height: 1;
      transition: background 200ms ease;
    }

    .lightbox-close:hover {
      background: rgb(255 255 255 / 24%);
    }

    .lightbox-nav {
      position: fixed;
      top: 50%;
      display: grid;
      width: 46px;
      height: 46px;
      padding: 0;
      place-items: center;
      translate: 0 -50%;
      border: 0;
      border-radius: 50%;
      background: rgb(255 255 255 / 10%);
      color: #fff;
      transition: background 200ms ease;
    }

    .lightbox-nav svg {
      width: 22px;
      height: 22px;
    }

    .lightbox-nav:hover {
      background: rgb(255 255 255 / 22%);
    }

    .lightbox-nav.prev {
      left: 18px;
    }

    .lightbox-nav.next {
      right: 18px;
    }

    .lightbox-counter {
      position: fixed;
      bottom: 22px;
      left: 50%;
      color: rgb(255 255 255 / 72%);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.18em;
      translate: -50%;
    }

    yuki-cover.zoomable {
      cursor: zoom-in;
    }

    /* ---------- 动态补充样式 ---------- */
    .moment-mood {
      margin-left: 8px;
      color: var(--secondary-d);
      letter-spacing: 0.1em;
    }

    .m-comment-content p,
    .comment-content-html p {
      margin: 3px 0 0;
    }

    .comment-content-html p {
      margin: 0 0 0.6em;
    }

    .comment-content-html p:last-child {
      margin-bottom: 0;
    }

    .comment-sent {
      margin-top: 18px;
    }

    .strip-note {
      margin: 8px 0 0;
      color: var(--faint);
      font-size: 12px;
    }

    .strip-note a {
      color: var(--primary-d);
    }

    /* 评论回复 */
    .comment-reply-tag {
      color: var(--faint);
      font-size: 12px;
      font-weight: 400;
    }

    .comment-reply-btn {
      padding: 0;
      border: 0;
      background: none;
      color: var(--faint);
      font-size: 12px;
      cursor: pointer;
      transition: color 250ms ease;
    }

    .comment-reply-btn:hover {
      color: var(--primary-d);
    }

    .reply-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      padding: 8px 14px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--primary) 10%, var(--surface));
      color: var(--muted);
      font-size: 12.5px;
    }

    .reply-banner button {
      padding: 0;
      border: 0;
      background: none;
      color: var(--faint);
      font-size: 12px;
      cursor: pointer;
    }

    .reply-banner button:hover {
      color: var(--ink);
    }

    .m-reply .reply-banner {
      flex-basis: 100%;
      margin-bottom: 0;
    }

    .m-reply-collapse {
      order: 5;
      flex-basis: 100%;
      padding: 0;
      border: 0;
      background: none;
      color: var(--faint);
      font-size: 12px;
      text-align: left;
      cursor: pointer;
    }

    .m-reply-collapse:hover {
      color: var(--primary-d);
    }

    /* 搜索结果封面 */
    .result {
      display: grid;
      grid-template-columns: 132px minmax(0, 1fr);
      gap: 18px;
      align-items: center;
    }

    .result-copy:only-child {
      grid-column: 1 / -1;
    }

    .result-cover {
      border-radius: 10px;
    }

    .post-head .post-tags {
      margin-top: 18px;
    }

    .results-cap {
      max-width: 760px;
      margin: 40px auto 8px;
      color: var(--faint);
      font-size: 12px;
      letter-spacing: 0.18em;
    }

    /* 列表页刊头背景：与组件刊头一致，深色蒙版 + 白色硬阴影文字 */
    .page-head.has-bg {
      background-position: var(--masthead-pos, center);
      background-size: var(--masthead-fit, cover);
      position: relative;
      overflow: hidden;
      padding: 40px 36px 36px;
      border-bottom: 0;
      border-radius: 20px;
    }

    .page-head.has-bg::before {
      position: absolute;
      inset: 0;
      content: '';
      background: rgb(10 14 20 / var(--masthead-tint, 0%));
    }

    .page-head.has-bg::after {
      position: absolute;
      inset: 0;
      content: '';
      background: linear-gradient(
        180deg,
        transparent 52%,
        rgb(10 14 20 / 55%)
      );
    }

    .page-head.has-bg > * {
      position: relative;
      z-index: 1;
    }

    /* ---------- 响应式 ---------- */
    @media (max-width: 1080px) {
      .layout-grid.grid-feed-rail {
        grid-template-columns: 1fr;
      }

      .grid-feed-rail .is-sticky {
        position: static;
        max-height: none;
      }

      .layout-grid.grid-identity {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .grid-identity .profile-log {
        display: none;
      }
    }

    @media (max-width: 968px) {
      .nav-corners {
        padding: 0 24px;
      }

      .nav-corners .nav-links {
        display: none;
      }

      .nav-corners .nav-actions {
        display: flex;
      }

      /* 角导航链接藏起后汉堡必须接管（原先只在 640px 以下出现，
         641–968 区间什么导航入口都没有） */
      .nav-hamburger {
        display: grid;
      }

      /* 链接 display:none 后自动布局会把操作区挤进中间 auto 列（视觉居中），
         改两列让搜索/汉堡回到右端 */
      .nav-corners {
        grid-template-columns: auto 1fr;
      }
    }

    @media (max-width: 900px) {
      .nav-sidebar {
        position: sticky;
        top: 0;
        width: 100%;
        height: auto;
        padding: 80px 18px 14px;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .nav-sidebar .nav-links {
        flex-direction: row;
        margin-top: 14px;
        overflow: auto;
      }

      .nav-sidebar .nav-foot {
        display: none;
      }

      .shell-sidebar .page-root {
        margin-left: 0;
      }

      .layout-bento {
        width: min(100% - 24px, 680px);
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
      }

      .is-sticky {
        position: relative;
        top: auto;
      }

    }

    @media (max-width: 760px) {
      .inner-page {
        width: min(100% - 40px, 1180px);
        padding-top: 108px;
      }

      .archive-row {
        grid-template-columns: 64px minmax(0, 1fr);
      }

      .archive-row .meta {
        display: none;
      }

      .friends-grid {
        grid-template-columns: 1fr;
      }

      .feed-alternating .article,
      .feed-alternating .article:nth-child(even),
      .feed-alternating .article:has(yuki-cover[orientation='portrait']),
      .feed-alternating .article:nth-child(even):has(yuki-cover[orientation='portrait']) {
        grid-template-columns: 1fr;
      }

      .feed-alternating .article:nth-child(even) .article-cover {
        order: 0;
      }

      /* 竖封面单列后别占满全宽（与 SSR 同口径） */
      .feed-alternating .article-cover:has(yuki-cover[orientation='portrait']) {
        width: min(320px, 88%);
        margin-inline: auto;
      }

      .layout-grid,
      .layout-grid.grid-three-rail {
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
        padding: 76px 16px 56px;
      }
    }

    @media (max-width: 640px) {
      .post-nav {
        grid-template-columns: 1fr;
      }

      .result {
        grid-template-columns: 96px minmax(0, 1fr);
        gap: 14px;
      }

      .post-nav-item.older {
        align-items: flex-start;
        text-align: left;
      }

      .comment-form-grid {
        grid-template-columns: 1fr;
      }

      .apply-form {
        grid-template-columns: 1fr;
      }

      .hero h1 {
        font-size: clamp(25px, 7.4vw, 48px);
      }

      .hero-inner {
        gap: 4vh;
      }

      .welcome-quote {
        gap: 12px;
        padding: 14px 18px 12px;
        border-radius: 18px;
      }

      .quote-text {
        font-size: 15px;
      }

      /* 手机端社交图标：先压缩间距和尺寸争取一行放下，实在放不下才换行 */
      .social-row {
        gap: 6px 10px;
      }

      .social-icon {
        width: 30px;
        height: 30px;
      }

      .nav-topbar .nav-links {
        display: none;
      }

      .nav-hamburger {
        display: grid;
      }

      .mobile-menu {
        padding-inline: 24px;
      }

      .layout-grid.grid-identity {
        width: min(100% - 40px, 1180px);
        gap: 20px;
      }

      .layout-grid.grid-feed-rail {
        width: min(100% - 40px, 1180px);
        gap: 48px;
        padding: 56px 0 72px;
      }

      .site-footer {
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
      }
    }
  `;


  private setMobileMenu(open: boolean) {
    this.mobileMenuOpen = open;
    document.body.style.overflow = open ? 'hidden' : '';
    this.requestUpdate();
  }

  private isCurrentPage(href: string) {
    const path = window.location.pathname;
    return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
  }

  /** 管理端外观页 iframe 预览注入的部件覆盖（不落库，postMessage 同源校验）。 */
  private previewParts: Record<string, Record<string, string | number | boolean>> | null = null;

  private readonly handlePartsPreview = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { type?: string; parts?: unknown } | null;
    if (data?.type !== 'yukilog:parts-preview') return;
    this.previewParts =
      data.parts && typeof data.parts === 'object'
        ? (data.parts as Record<string, Record<string, string | number | boolean>>)
        : null;
    this.requestUpdate();
  };

  /** 部件 token：预览覆盖优先，其次站点设置。 */
  private parts(): Record<string, Record<string, string | number | boolean>> {
    return this.previewParts ?? this.store.site.data?.theme?.parts ?? {};
  }

  private partText(part: string, key: string): string | null {
    const value = this.parts()[part]?.[key];
    return typeof value === 'string' && value !== '' ? value : null;
  }

  /** 顶栏品牌文字：brand.text 旋钮优先，缺省站点标题。 */
  private brandText(): string {
    return this.partText('brand', 'text') ?? this.siteData.siteTitle;
  }

  /** 当前文章流排序：手动切换/URL 参数 > masthead default-sort 旋钮 > 精选。 */
  private currentFeedSort(): api.FeedSort {
    if (this.feedSort) return this.feedSort;
    const knob = this.partText('masthead', 'default-sort');
    if (knob === 'popular' || knob === 'recent' || knob === 'featured') return knob;
    return 'featured';
  }

  /** article-feed 字段开关：旋钮（boolean）优先，缺省用布局字段集。 */
  private feedFieldOn(fields: Set<ArticleField>, key: ArticleField): boolean {
    const value = this.parts()['article-feed']?.[key];
    return typeof value === 'boolean' ? value : fields.has(key);
  }

  /** topnav display / align 旋钮 → 导航容器类名。 */
  private topnavClass(): string {
    const display = this.partText('topnav', 'display');
    let klass = '';
    if (display === 'icons') klass += ' topnav-icons';
    if (display === 'text') klass += ' topnav-text';
    if (display === 'both') klass += ' topnav-both';
    const align = this.partText('topnav', 'align');
    if (align === 'start') klass += ' topnav-align-start';
    if (align === 'end') klass += ' topnav-align-end';
    const alignMobile = this.partText('topnav', 'align-mobile');
    if (alignMobile === 'end') klass += ' topnav-mobile-end';
    if (alignMobile === 'start') klass += ' topnav-mobile-start';
    return klass;
  }

  /** 站点设置下发的主题 token → CSS 变量。 */
  private siteThemeStyle(): Record<string, string> {    const theme = this.store.site.data?.theme;
    const colors = theme?.colors;
    if (!colors) return {};
    const style: Record<string, string> = {};
    const map: Array<[string, string | undefined]> = [
      ['--page', colors.background],
      ['--surface', colors.surface],
      ['--surface-soft', colors.surfaceMuted],
      ['--ink', colors.text],
      ['--muted', colors.textMuted],
      ['--primary', colors.primary],
      ['--secondary', colors.secondary],
      ['--line', colors.border],
    ];
    for (const [key, value] of map) {
      if (value && /^#[0-9a-fA-F]{3,8}$/.test(value)) style[key] = value;
    }
    const radius = theme?.shape?.radius;
    if (typeof radius === 'number' && radius >= 0 && radius <= 32) {
      style['--radius'] = `${radius}px`;
    }
    const overlay = theme?.mastheadOverlay;
    if (typeof overlay === 'number' && overlay >= 0 && overlay <= 0.95) {
      style['--masthead-tint'] = `${Math.round(overlay * 100)}%`;
    }
    if (theme?.mastheadPosition) style['--masthead-pos'] = theme.mastheadPosition;
    if (theme?.mastheadFit) {
      style['--masthead-fit'] = theme.mastheadFit === 'stretch' ? '100% 100%' : theme.mastheadFit;
    }
    // 部件 token 全量落成 --part-<id>-<key>（白名单在服务端，未登记的键这里自然无害：
    // CSS 只消费 var() 引用得到的变量；id/key 限定字符集，值剔除 CSS 注入面）。
    for (const [part, knobs] of Object.entries(this.parts())) {
      if (!/^[a-z0-9-]+$/.test(part) || !knobs || typeof knobs !== 'object') continue;
      for (const [key, value] of Object.entries(knobs)) {
        if (!/^[a-z0-9-]+$/.test(key)) continue;
        const name = `--part-${part}-${key}`;
        if (typeof value === 'number' && Number.isFinite(value)) {
          style[name] = String(value);
        } else if (typeof value === 'boolean') {
          style[name] = value ? '1' : '0';
        } else if (typeof value === 'string') {
          // eslint-disable-next-line no-control-regex
          const clean = value.replace(/[;{}<>\\\x00-\x1f]/g, '').slice(0, 120);
          if (clean) style[name] = clean;
        }
      }
    }
    return style;
  }

  private renderNavigation() {
    const items = publicNavigation;
    const links = html`
      <div class="nav-links">
        ${items.map(
          (item) => html`
            <a
              class="nav-item${this.isCurrentPage(item.href) ? ' active' : ''}"
              href=${item.href}
              aria-label=${item.label}
            >
              <span class="nav-icon">${icon(item.icon)}</span>
              <span class="nav-label">${item.label}</span>
            </a>
          `,
        )}
      </div>
    `;
    const actions = html`
      <div class="nav-actions">
        ${this.shell.showSearch
          ? html`<a
              class="nav-action nav-search${this.isCurrentPage('/search') ? ' active' : ''}"
              href="/search"
              aria-label="搜索"
              ><span class="search-icon">${icon('search')}</span
              ><span class="search-text">搜索</span></a
            >`
          : nothing}
        <button
          class="nav-action nav-hamburger"
          type="button"
          aria-label=${this.mobileMenuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded=${this.mobileMenuOpen}
          @click=${() => this.setMobileMenu(!this.mobileMenuOpen)}
        >
          ${icon(this.mobileMenuOpen ? 'close' : 'menu')}
        </button>
      </div>
    `;
    if (this.shell.navigation === 'sidebar') {
      return html`
        <nav class="site-nav nav-sidebar">
          <a class="brand" href="/">${this.brandText()}</a>
          ${links}
          <div class="nav-foot">写给时间的长信<br />RSS · Mail</div>
        </nav>
      `;
    }
    if (this.shell.navigation === 'floating-dock') {
      return html`<nav class="site-nav nav-dock"><a class="brand" href="/">Y</a>${links}</nav>`;
    }
    return html`
      <div class="nav-corners${this.topnavClass()}${this.navPastHero ? ' hidden' : ''}">
        <a class="brand" href="/">${this.brandText()}</a>
        ${links}
        ${actions}
      </div>
      <nav class="site-nav nav-topbar${this.topnavClass()}${this.navPastHero ? ' nav-sticky' : ''}">
        <a class="brand" href="/">${this.brandText()}</a>
        ${links}
        <div class="nav-inner-actions">${actions}</div>
      </nav>
      ${this.mobileMenuOpen
        ? html`
            <div
              class="mobile-menu-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="导航菜单"
              @click=${() => this.setMobileMenu(false)}
            >
              <section class="mobile-menu" @click=${(event: Event) => event.stopPropagation()}>
                <header class="mobile-menu-header">
                  <strong>${this.brandText()}</strong>
                  <button
                    class="nav-action"
                    type="button"
                    aria-label="关闭菜单"
                    @click=${() => this.setMobileMenu(false)}
                  >
                    ${icon('close')}
                  </button>
                </header>
                <nav class="mobile-menu-nav">
                  ${items.map(
                    (item) => html`
                      <a
                        class="mobile-nav-item${this.isCurrentPage(item.href) ? ' active' : ''}"
                        href=${item.href}
                        @click=${() => this.setMobileMenu(false)}
                      >
                        <span class="nav-icon">${icon(item.icon)}</span>
                        <span>${item.label}</span>
                      </a>
                    `,
                  )}
                </nav>
              </section>
            </div>
          `
        : nothing}
    `;
  }

  /** 固定布局 walker：按 homeLayout 常量树渲染，根区域挂 data-part 供部件 token 使用。 */
  private renderNode(node: HomeNode): unknown {
    const base = `node node-${node.type}`;
    const part = partNameOf(node.id) ?? nothing;

    if (node.children) {
      const gap = typeof node.props.gap === 'string' ? ` gap-${node.props.gap}` : '';
      const align = typeof node.props.align === 'string' ? ` align-${node.props.align}` : '';
      const sticky = node.props.sticky ? ' is-sticky' : '';
      const columns =
        node.type === 'grid' && node.props.columns === '240px minmax(0, 1fr) 240px'
          ? ' grid-three-rail'
          : node.type === 'grid' && node.props.columns === '280px minmax(0, 1fr)'
            ? ' grid-aside-first'
            : node.type === 'grid' && node.props.columns === 'auto minmax(0, 1fr) auto'
              ? ' grid-identity'
              : node.type === 'grid' && node.props.columns === 'minmax(0, 1fr) 300px'
                ? ' grid-feed-rail'
                : '';
      const maxWidth =
        node.props.maxWidth === 'full'
          ? ' max-full'
          : node.props.maxWidth === '1240px'
            ? ' max-1240'
            : '';
      return html`
        <section
          class="${base} layout-${node.type}${gap}${align}${sticky}${columns}${maxWidth}"
          data-part=${part}
        >
          ${node.children.map((child) => this.renderNode(child))}
        </section>
      `;
    }

    switch (node.type) {
      case 'hero':
        return this.renderHero(node);
      case 'masthead':
        return this.renderMasthead(node);
      case 'avatar':
        {
          const avatarClass = `${base} primitive-avatar avatar-${String(
            node.props.size ?? 'md',
          )} avatar-${String(node.props.shape ?? 'circle')}`;
          const label = String(node.props.label ?? this.siteData.ownerName);
          return this.siteData.avatarUrl && node.props.source === 'site-owner'
            ? html`<img class=${avatarClass} src=${this.siteData.avatarUrl} alt=${label} />`
            : html`<div class=${avatarClass}>${this.siteData.ownerName.slice(0, 1) || '雪'}</div>`;
        }
      case 'text-block':
        return this.renderTextBlock(node);
      case 'social-links':
        return html`
          <nav
            class="${base} primitive-socials socials-${String(
              node.props.variant ?? 'labels',
            )} text-${String(node.props.alignment ?? 'left')}"
          >
            ${[...this.siteData.socialLinks, { label: 'RSS', url: '/feed.xml' }].map(
              (link) => html`<a href=${link.url}>${link.label}</a>`,
            )}
          </nav>
        `;
      case 'status-line':
        {
          const statusText = String(node.props.text ?? '');
          return html`
            <pre
              class="${base} ${statusText.includes('system.log') ? 'profile-log' : 'primitive-status'} status-${String(
                node.props.tone ?? 'neutral',
              )}"
            >${statusText}</pre>
          `;
        }
      case 'profile-card':
        return this.renderProfile(node);
      case 'article-feed':
        return this.renderArticleFeed(node);
      case 'quote':
        {
          // 一言（代理失败回退本地句库）；一言不可用时回退布局字面量。
          const hitokoto = this.store.hitokotoQuote();
          const quoteText = hitokoto ? hitokoto.text : String(node.props.text ?? '');
          const quoteFrom = hitokoto
            ? hitokoto.from
              ? `—— ${hitokoto.from}`
              : ''
            : String(node.props.attribution ?? '');
        return html`
          <aside class="${base} quote-card" data-part=${part} data-reveal>
            ${quoteText}
            ${quoteFrom ? html`<cite>${quoteFrom}</cite>` : nothing}
            ${hitokoto
              ? html`<button
                  class="quote-refresh"
                  type="button"
                  aria-label="换一句"
                  title="换一句"
                  ?disabled=${this.quoteRefreshBusy}
                  @click=${(event: Event) => {
                    event.stopPropagation();
                    void this.refreshHitokoto();
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11A8 8 0 0 0 5.6 6.6M4 13a8 8 0 0 0 14.4 4.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v7h-7M4 20v-7h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>`
              : nothing}
          </aside>
        `;
        }
      case 'stats':
        {
          const fields = new Set((node.props.fields as string[]) ?? []);
          const stats = this.store.stats;
          const available = [
            ['articles', stats.articles, '文章'],
            ['dynamics', stats.dynamics, '动态'],
            ['friends', stats.friends, '友链'],
            ['views', stats.views, '总阅读'],
          ] as const;
        return html`
          <section class="${base} stats-card" data-part=${part} data-reveal>
            <p class="component-kicker">站点信息</p>
            <div class="stats-grid">
                ${available
                  .filter(
                    ([field, value]) => value !== null && (fields.size === 0 || fields.has(field)),
                  )
                  .map(
                    ([, value, label]) =>
                      html`<div class="stat"><strong>${value}</strong><span>${label}</span></div>`,
                  )}
            </div>
          </section>
        `;
        }
      case 'dynamic-strip':
        {
          const limit = Number(node.props.limit ?? 3);
          const variant = String(node.props.variant ?? 'compact');
          const dynSlice = this.store.dynamics;
          const stripItems = (dynSlice.data?.items ?? []).slice(0, Math.max(1, limit));
        return html`
            <section class="${base} dynamic-strip dynamics-${variant}" data-part=${part} data-reveal>
            <a
              class="component-kicker strip-kicker"
              href="/dynamics"
              aria-label="查看全部动态"
              @click=${(event: Event) => event.stopPropagation()}
            >
                最近动态
                <span class="strip-more" aria-hidden="true">更多 ›</span>
              </a>
              ${(dynSlice.status === 'idle' || dynSlice.status === 'loading') &&
              stripItems.length === 0
                ? html`<div class="skel skel-line" style="width: 78%"></div>
                    <div class="skel skel-line" style="width: 55%"></div>`
                : nothing}
              ${dynSlice.status === 'error'
                ? html`<p class="strip-note">
                    动态暂时加载不出来，
                    <a
                      href="/dynamics"
                      @click=${(event: Event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.store.loadDynamics(1, true);
                      }}
                      >重试</a
                    >
                  </p>`
                : nothing}
              ${dynSlice.status === 'ready' && stripItems.length === 0
                ? html`<p class="strip-note">还没有动态。</p>`
                : nothing}
              ${stripItems.map(
                (item) =>
                  html`<div class="dynamic-item">
                    <time>${formatMonthDay(item.createdAt)}</time
                    ><span>${excerpt(textFromHtml(item.contentHtml), 48)}</span>
                  </div>`,
              )}
          </section>
        `;
        }
      case 'pulse-panel':
        {
          const limit = Math.max(1, Number(node.props.limit ?? 6));
          const pulseSlice = this.store.pulse;
          const items = (pulseSlice.data ?? []).slice(0, limit);
        return html`
            <section class="${base} pulse-panel" data-part=${part} data-reveal>
              <p class="component-kicker">站点脉搏</p>
              ${pulseSlice.status === 'idle' || pulseSlice.status === 'loading'
                ? html`<div class="skel skel-line" style="width: 82%"></div>
                    <div class="skel skel-line" style="width: 64%"></div>`
                : nothing}
              ${pulseSlice.status === 'error'
                ? html`<p class="strip-note">
                    脉搏暂时加载不出来，
                    <a
                      href="/"
                      @click=${(event: Event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.store.ensurePulse(true);
                      }}
                      >重试</a
                    >
                  </p>`
                : nothing}
              ${pulseSlice.status === 'ready' && items.length === 0
                ? html`<p class="strip-note">还没有新动静。</p>`
                : nothing}
              ${items.map(
                (item) => html`
                  <a
                    class="pulse-item"
                    href=${item.targetUrl}
                    target=${item.kind === 'friend' && /^https?:/.test(item.targetUrl) ? '_blank' : nothing}
                    rel=${item.kind === 'friend' && /^https?:/.test(item.targetUrl) ? 'noopener noreferrer' : nothing}
                    @click=${(event: Event) => event.stopPropagation()}
                  >
                    <time>${relTime(item.createdAt)}</time>
                    <span class="pulse-text"
                      ><span class="pulse-dot pulse-${item.kind}" aria-hidden="true"></span
                      >${item.kind === 'comment'
                        ? html`<strong>${item.author}</strong> 评论了${item.targetTitle ? html`《${item.targetTitle}》` : '一条动态'}`
                        : html`<strong>${item.author}</strong> 加入了友链`}</span
                    >
                  </a>
                `,
              )}
            </section>
          `;
        }
      default:
        return nothing;
    }
  }

  private renderHero(node: HomeNode) {
    const variant = String(node.props.variant ?? 'cinematic');
    // hero-title 旋钮优先于布局字面量
    const title = this.partText('hero-title', 'text') ?? String(node.props.title ?? '');
    const accentChars = new Set(this.partText('hero-title', 'accent') ?? String(node.props.accent ?? ''));
    // 首屏背景来自站点设置的 heroBackgrounds 池（冷进入随机抽一张，
    // 多张时每 8 秒淡切；reduced-motion 只随机不轮播）。
    const heroBackgrounds = this.siteData.heroBackgrounds;
    const hasMedia = heroBackgrounds.length > 0;
    const backgroundPosition = String(node.props.backgroundPosition ?? 'center');
    const overlay = String(node.props.overlay ?? 'medium');
    const socialLinks = [
      ...this.siteData.socialLinks,
      { label: 'RSS', url: '/feed.xml' },
    ];
    const socialColors = ['#6e7f8d', '#e3a0ae', '#7eb6d9', '#8fafc4', '#e8a4b4', '#d6a1ae', '#f0a65a'];
    // 首屏语录卡：heroQuote → siteDescription → 布局字面量。
    const literalLead = String(node.props.lead ?? '');
    const quoteText = (this.siteData.heroQuote ?? this.siteData.siteDescription ?? '') || literalLead;
    const details = html`
      <div class="welcome-quote" data-part="hero-quote-card">
        <span class="quote-text">${quoteText}</span>
        ${node.props.showSocials
          ? html`
              <nav class="social-row" aria-label="社交链接">
                ${socialLinks.map(
                  (link, index) => html`
                    <a
                      class="social-icon"
                      href=${link.url}
                      aria-label=${link.label}
                      title=${link.label}
                      target=${/^https?:/.test(link.url) ? '_blank' : nothing}
                      rel=${/^https?:/.test(link.url) ? 'noopener noreferrer' : nothing}
                      style=${styleMap({ color: socialColors[index % socialColors.length] })}
                    >
                      ${socialGlyph(link.label, index)}
                    </a>
                  `,
                )}
              </nav>
            `
          : nothing}
      </div>
    `;
    const enterStyle = this.partText('hero-enter', 'style') ?? 'mist';
    const enterClass = enterStyle === 'mist' ? '' : ` enter-${enterStyle}`;
    return html`
      <section
        class="node node-hero hero hero-${variant} overlay-${overlay}${hasMedia ? ' has-media' : ''}${enterClass}"
        data-part="hero"
      >
        ${hasMedia
          ? html`
                <div class="hero-background hero-bg-stack" role="img" aria-label="首屏背景">
                  ${heroBackgrounds.map((item, index) => {
                    if (item.position) return nothing; // 焦点图在静态视口层渲染
                    // 非焦点图恒定 contain（完整显示 + 模糊填充）；
                    // 全局对齐/适应选项已随焦点框选 + 局部缩放移除
                    const focal = backgroundPosition;
                    // 冷启动只渲染当前层与已驻留就绪的层，其余层等轮到/预载完成再挂图，
                    // 避免全池图片同时下载抢占首图带宽
                    const showImage = index === this.heroBgIndex || this.heroBgRetained.has(item.url);
                    const layerStyle: Record<string, string> = { backgroundPosition: focal };
                    if (showImage) layerStyle.backgroundImage = `url("${item.url}")`;
                    return html`
                      <div
                        class="hero-bg-layer blur${index === this.heroBgIndex ? ' active' : ''}"
                        style=${styleMap(layerStyle)}
                        aria-hidden="true"
                      ></div>
                      <div
                        class="hero-bg-layer${index === this.heroBgIndex ? ' active' : ''}"
                        style=${styleMap(layerStyle)}
                      ></div>
                    `;
                  })}
                </div>
                <div class="hero-bg-static" aria-hidden="true">
                  ${heroBackgrounds.map((item, index) => {
                    if (!item.position) return nothing; // 普通图在视差层渲染
                    // 焦点图脱离 132% 视差超幅，贴视口几何用 cover/自定义缩放精确还原框选
                    const showImage = index === this.heroBgIndex || this.heroBgRetained.has(item.url);
                    const layerStyle: Record<string, string> = {
                      backgroundPosition: item.position,
                      backgroundSize: item.size ?? 'cover',
                    };
                    if (showImage) layerStyle.backgroundImage = `url("${item.url}")`;
                    return html`<div
                      class="hero-bg-layer${index === this.heroBgIndex ? ' active' : ''}"
                      style=${styleMap(layerStyle)}
                    ></div>`;
                  })}
                </div>
              `
            : nothing}
        <div class="hero-inner">
          <h1 data-part="hero-title">
            ${variant === 'cinematic'
              ? [...title].map(
                  (character, index) =>
                    html`<span
                      class="hero-character${accentChars.has(character) ? ' accent' : ''}"
                      style="--char-index:${index}"
                      >${character}</span
                    >`,
                )
              : title}
          </h1>
          ${variant === 'cinematic' ? html`<div class="hero-info">${details}</div>` : details}
        </div>
        ${enterStyle === 'wave'
          ? html`<div class="hero-waves" aria-hidden="true">
              <svg class="wave wave-back" viewBox="0 0 1400 90" preserveAspectRatio="none">
                <path
                  d="M0 52 C 70 32, 130 66, 210 50 S 350 30, 430 52 S 590 72, 700 52 C 770 32, 830 66, 910 50 S 1050 30, 1130 52 S 1290 72, 1400 52 L1400 90 L0 90 Z"
                />
              </svg>
              <svg class="wave wave-mid" viewBox="0 0 1200 90" preserveAspectRatio="none">
                <path
                  d="M0 60 C 60 44, 120 74, 200 58 S 340 38, 440 62 S 560 48, 600 60 C 660 44, 720 74, 800 58 S 940 38, 1040 62 S 1160 48, 1200 60 L1200 90 L0 90 Z"
                />
              </svg>
              <svg class="wave wave-front" viewBox="0 0 1600 90" preserveAspectRatio="none">
                <path
                  d="M0 64 C 90 46, 170 76, 280 60 S 460 40, 580 64 S 730 52, 800 64 C 890 46, 970 76, 1080 60 S 1260 40, 1380 64 S 1530 52, 1600 64 L1600 90 L0 90 Z"
                />
              </svg>
            </div>`
          : nothing}
        ${node.props.showEnter
          ? html`<button
              class="enter-button"
              data-part="hero-enter"
              aria-label="进入文章区域"
              @click=${() => {
                // 直接按首屏高度滚动：hero 完整滚出视口，内容从视口顶开始。
                const hero = this.renderRoot.querySelector<HTMLElement>('.hero');
                window.scrollTo({
                  top: hero?.offsetHeight ?? window.innerHeight,
                  behavior: this.reducedMotion ? 'auto' : 'smooth',
                });
              }}
            >
              <span class="enter-guide"><span>ENTER</span>${icon('arrow-down')}</span>
            </button>`
          : nothing}
      </section>
    `;
  }

  /** 会话级驻留预载：Image 对象保留在组件上，内存缓存不被逐出，SPA 换页不再重载。 */
  private retainImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      const image = new Image();
      this.retainedImages.push(image);
      image.onload = () => {
        this.heroBgRetained.add(url);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = url;
    });
  }

  // 首屏背景池：站点数据到达后随机抽一张并启动 8 秒淡切（仅公开运行时一次）。
  // 抽中的当前图优先加载并作为开屏（兼加载屏）收场的就绪信号；其余图随后驻留预载。
  private maybeSeedHeroBackgrounds() {
    if (this.heroBgSeeded) return;
    const backgrounds = this.siteData.heroBackgrounds;
    if (backgrounds.length === 0) {
      // 未配置首屏背景：若开屏还在等待数据且数据已有定论，直接收场
      const siteStatus = this.store.site.status;
      if (this.splashAwaitingHero && siteStatus !== 'idle' && siteStatus !== 'loading') {
        this.leaveSplash();
      }
      return;
    }
    this.heroBgSeeded = true;
    this.heroBgIndex = Math.floor(Math.random() * backgrounds.length);
    const active = backgrounds[this.heroBgIndex];
    void this.retainImage(active.url).then(() => {
      this.heroReady = true;
      if (this.splashAwaitingHero) this.leaveSplash();
      // 当前图就绪后再驻留预载其余轮换图与刊头图，避免抢占首图带宽
      for (const item of backgrounds) {
        if (item.url !== active.url) void this.retainImage(item.url);
      }
      const masthead = this.siteData.mastheadUrl;
      if (masthead) void this.retainImage(masthead);
    });
    if (backgrounds.length > 1 && !this.reducedMotion && this.heroBgTimer === null) {
      this.heroBgTimer = window.setInterval(() => {
        const count = this.siteData.heroBackgrounds.length;
        if (count <= 1) return;
        this.heroBgIndex = (this.heroBgIndex + 1) % count;
        this.requestUpdate();
      }, 8000);
    }
    this.requestUpdate();
  }

  private renderMasthead(node: HomeNode) {
    const variant = String(node.props.variant ?? 'editorial');
    const rawTitle = String(node.props.title ?? '');
    // 首页文章流刊头：标题随排序 tab 联动（用户在工作室改过标题则尊重自定义）
    const sortTitles: Record<string, string> = {
      featured: '精选文章',
      popular: '最热文章',
      recent: '最近文章',
    };
    const sortLinked =
      variant === 'minimal' && (rawTitle === '' || Object.values(sortTitles).includes(rawTitle));
    const title = sortLinked ? sortTitles[this.currentFeedSort()] : rawTitle;
    return html`
      <header class="node node-masthead masthead masthead-${variant}" data-part="masthead">
        <p class="kicker">${String(node.props.kicker ?? 'YukiLog · Vol. 01')}</p>
        <h1>${keyed(title, html`<span class="sort-title-anim">${title}</span>`)}</h1>
        ${sortLinked
          ? html`<div class="sort-tabs" role="group" aria-label="文章排序">
              ${(
                [
                  ['featured', '精选'],
                  ['popular', '最热'],
                  ['recent', '最近'],
                ] as const
              ).map(
                ([value, label]) => html`
                  <button
                    type="button"
                    aria-pressed=${this.currentFeedSort() === value}
                    @click=${(event: Event) => {
                      event.stopPropagation();
                      this.feedSort = value;
                      this.store.loadHomeFeed(value);
                      if (window.location.pathname === '/') {
                        window.history.replaceState(
                          null,
                          '',
                          value === 'featured' ? '/' : `/?sort=${value}`,
                        );
                      }
                      this.requestUpdate();
                    }}
                  >
                    ${label}
                  </button>
                `,
              )}
            </div>`
          : html`<p class="lead">${String(node.props.lead ?? '')}</p>`}
      </header>
    `;
  }

  private renderTextBlock(node: HomeNode) {
    const source = String(node.props.source ?? 'literal');
    let text =
      {
        'owner-name': this.siteData.ownerName,
        'owner-bio': this.siteData.ownerBio,
        'site-title': this.siteData.siteTitle,
        'site-description': this.siteData.siteDescription,
      }[source] ?? String(node.props.text ?? '');
    // identity-band traits 旋钮
    if (node.id === 'nf-traits') {
      text = this.partText('identity-band', 'traits') ?? text;
    }
    const variant = String(node.props.variant ?? 'body');
    return html`
      <div
        class="node node-text-block primitive-text text-${variant} text-${String(
          node.props.alignment ?? 'left',
        )}"
      >
        ${text}
      </div>
    `;
  }

  private renderProfile(node: HomeNode) {
    const flipped = this.flippedProfiles.has(node.id);
    const variant = String(node.props.variant ?? 'portrait');
    const canFlip = node.props.flip !== false;
    return html`
      <section class="node node-profile-card profile-card profile-${variant}">
        <button
          class="profile-button"
          aria-label="翻转个人卡片"
          aria-pressed=${flipped}
          ?disabled=${!canFlip}
          @click=${(event: Event) => {
            event.stopPropagation();
            if (!canFlip) return;
            if (flipped) this.flippedProfiles.delete(node.id);
            else this.flippedProfiles.add(node.id);
            this.requestUpdate();
          }}
        >
          <span class="profile-face">
            <span class="avatar" aria-hidden="true">雪</span>
            <h2>Sakurine</h2>
            <p>写代码，也收集深夜、长风和那些不肯消失的心动。</p>
            ${node.props.showSocials
              ? html`<span class="profile-socials">GitHub · RSS · Mail</span>`
              : nothing}
            ${node.props.showStatus
              ? html`<span class="profile-status">● system.log · rebuilding</span>`
              : nothing}
            ${canFlip ? html`<span class="profile-hint">轻触卡片，读另一面</span>` : nothing}
          </span>
          <span class="profile-face profile-back">
            <p class="component-kicker">About this person</p>
            <h2>比起数字肖像</h2>
            <p>我更愿意把这里当成一封持续写下去的长信。技术只是语言之一。</p>
            <span class="profile-hint">再轻触一次，回到正面</span>
          </span>
        </button>
      </section>
    `;
  }

  private renderArticleFeed(node: HomeNode) {
    const variant = String(node.props.variant ?? 'compact');
    const fields = new Set((node.props.fields as ArticleField[]) ?? []);
    const limit = Math.max(1, Number(node.props.limit ?? 5));
    const sort = this.currentFeedSort();
    const feedSlice = this.store.homeFeed(sort);
    const items = feedSlice?.data?.items ?? [];
    const total = feedSlice?.data?.total ?? 0;
    return html`
      <section class="node node-article-feed article-feed feed-${variant}" data-part="article-feed">
        ${feedSlice?.status === 'idle' || feedSlice?.status === 'loading'
          ? this.skeletonFeed(Math.min(3, limit))
          : nothing}
        ${feedSlice?.status === 'error'
          ? this.renderLoadError(feedSlice.error, () => this.store.loadHomeFeed(sort, true))
          : nothing}
        ${items.slice(0, limit).map(
          (article) => html`
            <article class="article" data-reveal>
              ${this.feedFieldOn(fields, 'cover')
                ? html`<a
                    class="article-cover"
                    href=${`/articles/${article.slug}`}
                    aria-label=${article.title}
                    ><yuki-cover
                      src=${article.coverUrl}
                      alt=${article.title}
                      seed=${article.slug}
                      adaptive-ratio
                    ></yuki-cover
                  ></a>`
                : nothing}
              <div class="article-copy">
                <div class="meta">
                  ${this.feedFieldOn(fields, 'category') && article.category
                    ? html`<span class="cat">${article.category.name}</span>`
                    : nothing}
                  ${this.feedFieldOn(fields, 'date') ? html`<time>${formatDate(article.publishedAt)}</time>` : nothing}
                </div>
                <h3><a href=${`/articles/${article.slug}`}>${article.title}</a></h3>
                ${this.feedFieldOn(fields, 'summary') ? html`<p class="summary">${article.summary}</p>` : nothing}
                <div class="foot">
                  ${this.feedFieldOn(fields, 'tags')
                    ? html`<div class="tags">
                        ${article.tags.map(
                          (tag) => html`<a href=${`/search?tag=${encodeURIComponent(tag.slug)}`}>#${tag.name}</a>`,
                        )}
                      </div>`
                    : nothing}
                  ${this.feedFieldOn(fields, 'views') ? html`<span>${article.views} 阅读</span>` : nothing}
                  ${this.feedFieldOn(fields, 'likes') ? html`<span>${article.likes} 喜欢</span>` : nothing}
                </div>
              </div>
            </article>
          `,
        )}
        ${total > limit
          ? html`<a
              class="feed-more"
              href="/articles"
              @click=${(event: Event) => event.stopPropagation()}
              >全部文章 <span aria-hidden="true">›</span></a
            >`
          : nothing}
      </section>
    `;
  }

  private skeletonFeed(count: number) {
    return Array.from({ length: count }, (_, index) => index).map(
      (index) => html`
        <article class="article" aria-hidden="true">
          <div class="skel skel-cover"></div>
          <div class="article-copy">
            <div class="skel skel-line" style="width: 34%"></div>
            <div class="skel skel-line" style="width: 82%; height: 20px"></div>
            <div class="skel skel-line" style="width: 96%"></div>
            <div class="skel skel-line" style="width: 58%"></div>
          </div>
        </article>
      `,
    );
  }

  private renderLoadError(error: string | null, retry: () => void) {
    return html`<div class="load-error" data-reveal>
      <p>${error ?? '内容加载失败，请稍后再试。'}</p>
      <button type="button" @click=${retry}>重试</button>
    </div>`;
  }

  private renderPager(
    basePath: string,
    params: URLSearchParams,
    page: number,
    totalPages: number,
  ) {
    if (totalPages <= 1) return nothing;
    const href = (target: number) => {
      const next = new URLSearchParams(params);
      if (target > 1) next.set('page', String(target));
      else next.delete('page');
      const search = next.toString();
      return `${basePath}${search ? `?${search}` : ''}`;
    };
    const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
    const windowEnd = Math.min(totalPages, windowStart + 4);
    const pages = Array.from(
      { length: windowEnd - windowStart + 1 },
      (_, index) => windowStart + index,
    );
    return html`
      <nav class="pager" aria-label="分页" data-reveal>
        ${page > 1 ? html`<a class="pager-step" href=${href(page - 1)}>← 上一页</a>` : nothing}
        ${windowStart > 1 ? html`<a href=${href(1)}>1</a><span class="pager-gap">…</span>` : nothing}
        ${pages.map((item) =>
          item === page
            ? html`<span class="pager-cur" aria-current="page">${item}</span>`
            : html`<a href=${href(item)}>${item}</a>`,
        )}
        ${windowEnd < totalPages
          ? html`<span class="pager-gap">…</span><a href=${href(totalPages)}>${totalPages}</a>`
          : nothing}
        ${page < totalPages ? html`<a class="pager-step" href=${href(page + 1)}>下一页 →</a>` : nothing}
      </nav>
    `;
  }

  private renderSubscribeCard(kind: 'articles' | 'dynamics') {
    const done = this.subscribeDone.has(kind);
    const failed = this.subscribeFailed.has(kind);
    const mailEnabled = this.siteData.mailEnabled;
    const siteLoading = this.store.site.status === 'loading';
    const copy =
      kind === 'articles'
        ? {
            text: '新文章发布时，给你发一封短短的邮件。',
            other: '同时订阅动态',
            feed: '/feeds/articles.xml',
          }
        : {
            text: '新动态发布时，给你发一封通知。',
            other: '同时订阅文章',
            feed: '/feeds/dynamics.xml',
          };
    if (mailEnabled !== true) {
      // mailEnabled=false（或站点信息加载失败）时收起表单，指向 RSS。
      return html`
        <section class="subscribe-strip" data-reveal>
          <div class="sub-copy">
            <p class="component-kicker">邮件订阅</p>
            ${siteLoading
              ? html`<div class="skel skel-line" style="width: 64%"></div>`
              : html`<p class="sub-text">
                  邮件订阅暂未开放，请先用 RSS：
                  <a href="/feed.xml">综合 feed</a> · <a href="/feeds/articles.xml">文章</a> ·
                  <a href="/feeds/dynamics.xml">动态</a>。
                </p>`}
          </div>
        </section>
      `;
    }
    return html`
      <section class="subscribe-strip" data-reveal>
        ${done
          ? html`<p class="sub-ok">确认邮件已经发出，点一下邮件里的链接，订阅就生效了。</p>`
          : html`
              <div class="sub-copy">
                <p class="component-kicker">邮件订阅</p>
                <p class="sub-text">
                  ${copy.text}每封邮件末尾都有一键退订；也欢迎用 <a href=${copy.feed}>RSS</a>。
                </p>
              </div>
              <form class="sub-form" @submit=${(event: SubmitEvent) => this.submitSubscribe(event, kind)}>
                <input
                  name="email"
                  type="email"
                  required
                  maxlength="254"
                  placeholder="you@example.com"
                  aria-label="邮箱地址"
                />
                <label class="sub-other"><input type="checkbox" name="with_other" />${copy.other}</label>
                <button type="submit" ?disabled=${this.subscribeBusy}>
                  ${this.subscribeBusy ? '发送中…' : '订阅'}
                </button>
              </form>
              ${failed
                ? html`<p class="sub-err">提交失败，请稍后再试；也可以先用 RSS。</p>`
                : nothing}
            `}
      </section>
    `;
  }

  private renderArticleCollection(items: api.ArticleSummary[]) {
    const years = [...new Set(items.map((item) => yearOf(item.publishedAt)).filter(Boolean))];
    return years.map((year) => {
      const group = items.filter((item) => yearOf(item.publishedAt) === year);
      return html`
        <section class="archive-year">
          <h2 data-reveal>${year} <span>${group.length} 篇</span></h2>
          ${group.map(
            (article, index) => html`
              <a class="archive-row" data-reveal href=${`/articles/${article.slug}`}>
                <time>${formatMonthDay(article.publishedAt)}</time>
                <h3><span>${article.title}</span></h3>
                <div class="meta">
                  ${article.category
                    ? html`<span class="cat ${index % 2 === 0 ? 'cat-b' : 'cat-p'}"
                        >${article.category.name}</span
                      >`
                    : nothing}
                  <span>${article.views} 阅读</span>
                </div>
                <div class="archive-more">
                  <div class="archive-more-in">
                    <yuki-cover
                      class="archive-cover"
                      src=${article.coverUrl}
                      alt=${`${article.title}的封面`}
                      seed=${article.slug}
                      ratio="16 / 10"
                      fit="cover"
                    ></yuki-cover>
                    <p class="archive-summary">${article.summary}</p>
                  </div>
                </div>
              </a>
            `,
          )}
        </section>
      `;
    });
  }

  private highlight(text: string, query: string): unknown {
    if (!query || !text.includes(query)) return text;
    const parts = text.split(query);
    return parts.flatMap((part, index) =>
      index === 0 ? [part] : [html`<mark>${query}</mark>`, part],
    );
  }

  private renderIndexRows(items: api.ArticleSummary[], query: string) {
    return html`
      <div class="results">
        ${items.map(
          (article) => html`
            <a class="result" data-reveal href=${`/articles/${article.slug}`}>
              <yuki-cover
                class="result-cover"
                src=${article.coverUrl}
                alt=${article.title}
                seed=${article.slug}
                adaptive-ratio
              ></yuki-cover>
              <div class="result-copy">
                <div class="meta">
                  ${article.category ? html`<span class="cat">${article.category.name}</span>` : nothing}
                  <time>${formatDate(article.publishedAt)}</time>
                </div>
                <h3>${this.highlight(article.title, query)}</h3>
                <p>${this.highlight(article.summary, query)}</p>
              </div>
            </a>
          `,
        )}
      </div>
    `;
  }

  private renderDynamicRows(items: api.DynamicItem[], query: string) {
    return html`
      <div class="results">
        ${items.map(
          (item) => html`
            <a class="result" data-reveal href=${`/dynamics#dynamic-${item.id}`}>
              <div class="result-copy">
                <div class="meta">
                  <span class="cat">动态</span>
                  <time>${formatDateTime(item.createdAt)}</time>
                </div>
                <p>${this.highlight(excerpt(textFromHtml(item.contentHtml), 120), query)}</p>
              </div>
            </a>
          `,
        )}
      </div>
    `;
  }

  private renderInnerPage() {
    const path = window.location.pathname;
    if (path.startsWith('/articles/')) {
      const slug = decodeURIComponent(path.slice('/articles/'.length));
      if (slug) return this.renderArticleDetail(slug);
    }
    if (path === '/articles') return this.renderArticlesPage();
    if (path === '/dynamics') return this.renderDynamicsPage();
    if (path === '/friends') return this.renderFriendsPage();
    if (path === '/search') return this.renderSearchPage();
    return this.renderNotFound();
  }

  private pageHead(kicker: string, title: string, lede: string) {
    const masthead = this.siteData.mastheadUrl;
    return html`
      <header
        class="page-head${masthead ? ' has-bg' : ''}"
        style=${masthead ? styleMap({ backgroundImage: `url("${masthead}")` }) : nothing}
        data-reveal
      >
        <p class="kicker caps">${kicker}</p>
        <h1>${title}</h1>
        <p class="inner-lede">${lede}</p>
      </header>
    `;
  }

  private renderNotFound() {
    return html`
      <main class="inner-page">
        <header class="page-head" data-reveal>
          <p class="kicker caps">YukiLog — 404</p>
          <h1>页面不存在</h1>
          <p class="inner-lede"><a href="/">回到首页</a></p>
        </header>
      </main>
    `;
  }

  /* ---------- 文章详情 ---------- */

  private renderArticleDetail(slug: string) {
    const slice = this.store.article(slug);
    if (slice.status === 'error' && slice.notFound) return this.renderNotFound();
    if (slice.status === 'error') {
      return html`<main class="inner-page">
        ${this.renderLoadError(slice.error, () => this.store.loadArticle(slug, true))}
      </main>`;
    }
    const detail = slice.data;
    if (!detail) {
      return html`<main class="inner-page">
        <article class="article-page" aria-hidden="true">
          <div class="skel skel-line" style="width: 16%"></div>
          <div class="skel skel-line" style="width: 78%; height: 34px; margin-top: 18px"></div>
          <div class="skel skel-line" style="width: 46%"></div>
          <div class="skel skel-cover" style="margin: 36px 0"></div>
          <div class="skel skel-line" style="width: 100%"></div>
          <div class="skel skel-line" style="width: 97%"></div>
          <div class="skel skel-line" style="width: 88%"></div>
          <div class="skel skel-line" style="width: 64%"></div>
        </article>
      </main>`;
    }
    const metrics = this.store.articleMetrics.get(slug);
    const views = metrics?.view_count ?? detail.views;
    const likeCount = metrics?.like_count ?? detail.likes;
    const liked = metrics?.liked ?? false;
    const likeBusy = this.store.likeBusy.has(slug);
    const tocLink = (item: { id: string; text: string; level: number }) => html`<a
      class="post-toc-item level-${item.level}${this.tocActive === item.id ? ' is-active' : ''}"
      href="#${item.id}"
      @click=${(event: Event) => {
        event.preventDefault();
        this.tocActive = item.id;
        this.renderRoot
          .querySelector(`#${CSS.escape(item.id)}`)
          ?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }}
      >${item.text}</a
    >`;
    return html`
      <main class="inner-page">
        <article class="article-page">
          <a
            class="post-back"
            href="/articles"
            @click=${(event: Event) => {
              event.preventDefault();
              if (this.spaNavigated && window.history.length > 1) {
                window.history.back();
              } else {
                window.history.pushState(null, '', '/articles');
                this.handleRouteChange();
              }
            }}
            >← 返回</a
          >
          <header class="post-head" data-reveal>
            <p class="component-kicker">${detail.category?.name ?? '未分类'}</p>
            <h1>${detail.title}</h1>
            <p class="post-meta">
              <time>${formatDate(detail.publishedAt)}</time>
              <span aria-hidden="true">·</span>
              <span>${views} 阅读</span>
              <span aria-hidden="true">·</span>
              <span>${likeCount} 喜欢</span>
              <span aria-hidden="true">·</span>
              <span>约 ${readingMinutes(detail.html)} 分钟</span>
            </p>
            ${detail.tags.length > 0
              ? html`<div class="post-tags">
                  ${detail.tags.map(
                    (tag) =>
                      html`<a
                        class="post-tag"
                        href=${`/search?tag=${encodeURIComponent(tag.slug)}`}
                        >#${tag.name}</a
                      >`,
                  )}
                </div>`
              : nothing}
            ${detail.summary ? html`<p class="post-summary">${detail.summary}</p>` : nothing}
          </header>
          ${this.tocItems.length > 1
            ? html`<nav class="post-toc" aria-label="目录">
                <div class="post-toc-sticky">
                  <p class="post-toc-kicker">目录</p>
                  ${this.tocItems.map(tocLink)}
                </div>
              </nav>`
            : nothing}
          <yuki-cover
            class="post-cover"
            src=${detail.coverUrl}
            alt=${`${detail.title}的封面`}
            seed=${detail.slug}
            adaptive
            max-height="68vh"
            data-reveal
          ></yuki-cover>
          ${this.tocItems.length > 1
            ? html`<details class="post-toc-mobile" data-reveal>
                <summary>目录 · ${this.tocItems.length} 节</summary>
                ${this.tocItems.map(tocLink)}
              </details>`
            : nothing}
          <div class="prose" data-reveal @click=${this.handleProseClick}>${unsafeHTML(detail.html)}</div>
          ${detail.notes && detail.notes.length > 0
            ? html`<aside class="post-notes" aria-label="旁注" data-reveal>
                <div class="post-notes-sticky">
                  <p class="post-notes-kicker">旁注</p>
                  ${detail.notes.map(
                    (note) => html`
                      <div class="post-note" id=${note.anchor}>
                        <span class="post-note-index">${note.index}</span>
                        <span class="post-note-body">${unsafeHTML(note.html)}</span>
                      </div>
                    `,
                  )}
                </div>
              </aside>`
            : nothing}
          <p class="post-end" data-reveal>完</p>
          <footer class="post-foot" data-reveal>
            <button
              class="heart-button post-like${liked ? ' liked' : ''}"
              type="button"
              aria-pressed=${liked}
              aria-label=${liked ? '取消喜欢' : '喜欢这篇文章'}
              ?disabled=${likeBusy}
              @click=${() => void this.store.toggleArticleLike(slug)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20.3C7.2 16.9 3.5 13.6 3.5 9.9 3.5 7.2 5.6 5 8.3 5c1.5 0 2.9.7 3.7 1.9C12.8 5.7 14.2 5 15.7 5c2.7 0 4.8 2.2 4.8 4.9 0 3.7-3.7 7-8.5 10.4Z"
                />
              </svg>
              <span class="heart-count">${likeCount}</span>
              <span>${liked ? '已喜欢' : '喜欢这篇'}</span>
            </button>
          </footer>
          <nav class="post-nav" data-reveal aria-label="相邻文章">
            ${detail.prev
              ? html`<a class="post-nav-item" href=${`/articles/${detail.prev.slug}`}>
                  <span class="post-nav-kicker">← 上一篇</span>
                  <span class="post-nav-title">${detail.prev.title}</span>
                </a>`
              : html`<span aria-hidden="true"></span>`}
            ${detail.next
              ? html`<a class="post-nav-item older" href=${`/articles/${detail.next.slug}`}>
                  <span class="post-nav-kicker">下一篇 →</span>
                  <span class="post-nav-title">${detail.next.title}</span>
                </a>`
              : html`<span aria-hidden="true"></span>`}
          </nav>
          ${this.renderArticleComments(detail)}
        </article>
      </main>
    `;
  }

  private renderArticleComments(detail: api.ArticleDetail) {
    const slice = this.store.comments(`article:${detail.slug}`);
    const comments = slice.data?.items ?? [];
    return html`
      <section class="comments" id="comments" data-reveal>
        <header class="comments-head">
          <h2>评论</h2>
          <span class="comments-count"
            >${slice.status === 'ready' ? `${slice.data?.total ?? comments.length} 条` : '…'}</span
          >
        </header>
        ${this.commentSentFor === detail.slug
          ? html`<p class="sub-ok comment-sent">评论已寄出，审核通过后会显示在这里。</p>`
          : nothing}
        ${detail.allowComments
          ? this.commentFormOpen
            ? html`<form
                class="comment-form is-open"
                @submit=${(event: SubmitEvent) => void this.submitArticleComment(event, detail)}
              >
                ${this.commentReplyTo
                  ? html`<div class="reply-banner">
                      <span>正在回复 @${this.commentReplyTo.name}</span>
                      <button
                        type="button"
                        aria-label="取消回复"
                        @click=${() => {
                          // 回复打开的表单，取消回复时一并收起（多层楼里留着空表单很碍事）
                          this.commentReplyTo = null;
                          this.commentFormOpen = false;
                          this.commentError = '';
                          this.requestUpdate();
                        }}
                      >
                        取消
                      </button>
                    </div>`
                  : nothing}
                <div class="comment-form-grid">
                  <label
                    >昵称<input
                      name="display_name"
                      required
                      maxlength="80"
                      placeholder="怎么称呼你"
                      value=${this.commenter.display_name}
                  /></label>
                  <label
                    >邮箱（选填，会公开展示）<input
                      name="email"
                      type="email"
                      maxlength="254"
                      placeholder="用于头像和公开展示"
                      value=${this.commenter.email}
                  /></label>
                  <label
                    >网站（选填）<input
                      name="website"
                      type="url"
                      maxlength="2048"
                      placeholder="https://"
                      value=${this.commenter.website}
                  /></label>
                </div>
                <label class="comment-content">
                  内容
                  <textarea
                    name="content"
                    required
                    rows="4"
                    maxlength="5000"
                    placeholder="想说什么都可以，慢一点也没关系。"
                  ></textarea>
                </label>
                <div class="comment-form-foot">
                  <p class="comment-note">
                    ${this.commentError || '评论会在审核后显示；昵称和邮箱会公开展示。'}
                  </p>
                  <div class="comment-form-actions">
                    <button
                      class="comment-cancel"
                      type="button"
                      @click=${() => {
                        this.commentFormOpen = false;
                        this.commentError = '';
                        this.requestUpdate();
                      }}
                    >
                      先不写了
                    </button>
                    <button type="submit" ?disabled=${this.commentBusy}>
                      ${this.commentBusy ? '寄出中…' : '寄出评论'}
                    </button>
                  </div>
                </div>
              </form>`
            : html`<button
                class="comment-compose"
                type="button"
                @click=${() => {
                  this.commentFormOpen = true;
                  this.requestUpdate();
                }}
              >
                <span class="comment-avatar"
                  >${this.avatarFallback(this.commenter.display_name || '来访者')}</span
                >
                <span class="comment-compose-hint">写下你的想法，点这里开始评论…</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>`
          : html`<p class="comment-note">评论区已关闭，去别的页面逛逛吧。</p>`}
        ${slice.status === 'loading'
          ? html`<div class="skel skel-line" style="width: 52%"></div>
              <div class="skel skel-line" style="width: 76%"></div>`
          : nothing}
        ${slice.status === 'error'
          ? html`<p class="comment-note">
              评论加载失败，
              <a
                href="#comments"
                @click=${(event: Event) => {
                  event.preventDefault();
                  this.store.loadArticleComments(detail.slug, true);
                }}
                >重试</a
              >
            </p>`
          : nothing}
        ${comments.length > 0
          ? html`<ol class="comment-list">
              ${buildCommentTree(comments).map((node) =>
                this.renderArticleCommentNode(node, detail),
              )}
            </ol>`
          : nothing}
      </section>
    `;
  }

  private startArticleReply(comment: api.PublicComment) {
    this.commentReplyTo = { id: comment.id, name: comment.displayName };
    this.commentFormOpen = true;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<HTMLTextAreaElement>('.comment-form textarea')?.focus();
    });
  }

  private renderArticleCommentNode(node: CommentNode, detail: api.ArticleDetail): TemplateResult {
    const comment = node.comment;
    const host = comment.website
      ? comment.website.replace(/^https?:\/\//, '').split('/')[0]
      : '';
    return html`
      <li class="comment">
        <header>
          ${this.commentAvatar(comment.displayName, comment.avatarUrl)}
          <div class="comment-who">
            <div class="comment-line">
              ${comment.website
                ? html`<a
                    class="comment-name"
                    href=${comment.website}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    >${comment.displayName}</a
                  >`
                : html`<span class="comment-name">${comment.displayName}</span>`}
              ${node.replyToName
                ? html`<span class="comment-reply-tag">回复 @${node.replyToName}</span>`
                : nothing}
              <time>${formatDateTime(comment.createdAt)}</time>
              ${comment.id && detail.allowComments
                ? html`<button
                    class="comment-reply-btn"
                    type="button"
                    @click=${() => this.startArticleReply(comment)}
                  >
                    回复
                  </button>`
                : nothing}
            </div>
            ${comment.website
              ? html`<div class="comment-meta">
                  <a
                    class="comment-site"
                    href=${comment.website}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    >${host}</a
                  >
                </div>`
              : nothing}
          </div>
        </header>
        <div class="comment-content-html">${unsafeHTML(comment.contentHtml)}</div>
        ${node.children.length > 0
          ? html`<ol class="comment-children">
              ${node.children.map((child) => this.renderArticleCommentNode(child, detail))}
            </ol>`
          : nothing}
      </li>
    `;
  }

  /* ---------- 列表页 ---------- */

  private renderArticlesPage() {
    const params = new URLSearchParams(window.location.search);
    const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
    const slice = this.store.archive;
    const items = slice.data?.items ?? [];
    return html`
      <main class="inner-page">
        ${this.pageHead('YukiLog — Archive', '文章', '长文、随笔与手记，按时间倒序。写得慢，但每一篇都算数。')}
        ${this.renderSubscribeCard('articles')}
        ${slice.status === 'idle' || slice.status === 'loading'
          ? html`<section class="archive-year" aria-hidden="true">
              <div class="skel skel-line" style="width: 120px; height: 22px"></div>
              <div class="skel skel-line" style="width: 82%"></div>
              <div class="skel skel-line" style="width: 68%"></div>
              <div class="skel skel-line" style="width: 74%"></div>
              <div class="skel skel-line" style="width: 59%"></div>
            </section>`
          : nothing}
        ${slice.status === 'error'
          ? this.renderLoadError(slice.error, () => this.store.loadArchive({ page }, true))
          : nothing}
        ${slice.status === 'ready' && items.length === 0
          ? html`<p class="search-hint">这里还空着，文章正在路上。</p>`
          : nothing}
        ${this.renderArticleCollection(items)}
        ${slice.data
          ? this.renderPager('/articles', params, slice.data.page, slice.data.totalPages)
          : nothing}
      </main>
    `;
  }

  private renderDynamicsPage() {
    const slice = this.store.dynamics;
    const data = slice.data;
    const items = data?.items ?? [];
    return html`
      <main class="inner-page">
        ${this.pageHead('YukiLog — Moments', '动态', '短句与片刻，散落在时间里的星。不必完整，真实就好。')}
        ${this.renderSubscribeCard('dynamics')}
        <div class="timeline">
          ${items.map((item) => keyed(item.id, this.renderMoment(item)))}
          ${slice.status === 'idle' || (slice.status === 'loading' && items.length === 0)
            ? html`<div class="moment" aria-hidden="true">
                <div class="moment-card">
                  <div class="skel skel-line" style="width: 32%"></div>
                  <div class="skel skel-line" style="width: 88%"></div>
                  <div class="skel skel-line" style="width: 54%"></div>
                </div>
              </div>`
            : nothing}
        </div>
        ${slice.status === 'error' && items.length === 0
          ? this.renderLoadError(slice.error, () => this.store.loadDynamics(1, true))
          : nothing}
        ${slice.status === 'error' && items.length > 0
          ? html`<p class="search-hint">
              后面的内容没加载出来，
              <a
                href="/dynamics"
                @click=${(event: Event) => {
                  event.preventDefault();
                  this.store.loadDynamics((data?.page ?? 1) + 1);
                }}
                >再试一次</a
              >
            </p>`
          : nothing}
        ${slice.status === 'ready' && items.length === 0
          ? html`<p class="search-hint">还没有动态，第一颗星还没升起来。</p>`
          : nothing}
        ${data && data.page < data.totalPages
          ? html`<button
              class="load-more"
              type="button"
              ?disabled=${slice.status === 'loading'}
              @click=${() => this.store.loadDynamics(data.page + 1)}
            >
              ${slice.status === 'loading' ? '载入中…' : '再往后翻翻'}
            </button>`
          : nothing}
      </main>
    `;
  }

  private renderFriendsPage() {
    const slice = this.store.friends;
    const items = slice.data ?? [];
    return html`
      <main class="inner-page">
        ${this.pageHead('YukiLog — Friends', '友链', '互联网很大，但总有一些站点值得互相留一盏灯。')}
        ${slice.status === 'idle' || slice.status === 'loading'
          ? html`<div class="friends-grid" aria-hidden="true">
              <div class="skel" style="height: 128px; border-radius: 16px"></div>
              <div class="skel" style="height: 128px; border-radius: 16px"></div>
            </div>`
          : nothing}
        ${slice.status === 'error'
          ? this.renderLoadError(slice.error, () => this.store.ensureFriends(true))
          : nothing}
        ${items.length > 0
          ? html`<div class="friends-grid">
              ${items.map(
                (friend) => html`
                  <a class="friend" data-reveal href=${friend.url} target="_blank" rel="noopener noreferrer">
                    <span class="friend-avatar" style=${styleMap({ '--cover': paletteFor(friend.url) })}>
                      <span aria-hidden="true">${friend.name.slice(0, 1)}</span>
                      ${friend.avatarUrl || friend.host
                        ? html`<img
                            src=${friend.avatarUrl || `https://${friend.host}/favicon.ico`}
                            alt=""
                            loading="lazy"
                            @error=${(event: Event) => (event.currentTarget as HTMLImageElement).remove()}
                          />`
                        : nothing}
                    </span>
                    <div>
                      <h3>${friend.name}</h3>
                      <span class="furl">${friend.host}</span>
                      <p>${friend.description}</p>
                    </div>
                  </a>
                `,
              )}
            </div>`
          : nothing}
        ${slice.status === 'ready' && items.length === 0
          ? html`<p class="search-hint">友链还空着，来做第一盏灯吧。</p>`
          : nothing}
        <section class="friend-apply" data-reveal>
          <p class="component-kicker">交换友链</p>
          <h2>也为你的站点留一盏灯？</h2>
          ${this.friendApplyDone
            ? html`<p class="apply-ok">申请已经收到，审核通过后就会出现在上面。谢谢你的灯。</p>`
            : html`
                <p class="apply-lede">
                  留下站点信息，我看过之后就会挂到这里。favicon 可以留空，会自动取你站点的 /favicon.ico。
                </p>
                <form class="apply-form" @submit=${this.submitFriendApplication}>
                  <label>站点名称<input name="name" required maxlength="40" placeholder="你的站点名字" /></label>
                  <label>站点地址<input name="url" type="url" required placeholder="https://…" /></label>
                  <label>联系邮箱<input name="email" type="email" required maxlength="254" placeholder="方便我回复你" /></label>
                  <label>favicon 链接（选填）<input name="avatar_url" type="url" maxlength="2048" placeholder="留空则自动获取" /></label>
                  <label class="wide">一句话介绍<textarea name="description" rows="2" maxlength="120" placeholder="这个站点在记录什么？"></textarea></label>
                  ${this.friendApplyError ? html`<p class="apply-err">${this.friendApplyError}</p>` : nothing}
                  <button type="submit" ?disabled=${this.friendApplyBusy}>
                    ${this.friendApplyBusy ? '提交中…' : '提交申请'}
                  </button>
                </form>
              `}
        </section>
      </main>
    `;
  }

  private renderSearchPage() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q')?.trim() ?? '';
    const category = params.get('category') ?? '';
    const tag = params.get('tag') ?? '';
    const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
    const facetItems = this.store.facets.data?.items ?? [];
    const categories = [
      ...new Map(
        facetItems
          .map((item) => item.category)
          .filter((item): item is api.PublicTerm => item !== null)
          .map((item) => [item.slug, item]),
      ).values(),
    ];
    const tags = [
      ...new Map(
        facetItems.flatMap((item) => item.tags).map((item) => [item.slug, item]),
      ).values(),
    ];
    // 分类/标签筛选与关键词互斥：搜索 API 只认 q，筛选走文章列表 API（与 SSR 分工一致）。
    const filterHref = (key: 'category' | 'tag', value: string) => {
      const current = key === 'category' ? category : tag;
      const next = new URLSearchParams();
      if (current !== value) next.set(key, value);
      const otherKey = key === 'category' ? 'tag' : 'category';
      const otherValue = key === 'category' ? tag : category;
      if (otherValue) next.set(otherKey, otherValue);
      const search = next.toString();
      return `/search${search ? `?${search}` : ''}`;
    };
    return html`
      <main class="inner-page">
        ${this.pageHead('YukiLog — Search', '搜索', '在文章、动态与随记里，找一段你还记得的话。')}
        <form class="search-box" method="get" action="/search" @submit=${this.handleSiteSubmit}>
          <input name="q" value=${query} maxlength="100" aria-label="搜索关键词" placeholder=${tags.length > 0 ? `试着搜搜：${tags.slice(0, 3).map((item) => item.name).join('、')}……` : '试着搜搜：夜色、长风、重构……'} />
          <button type="submit">搜索</button>
        </form>
        <p class="search-hint">ENTER 搜索 · 支持标题 / 正文 / 标签</p>
        ${categories.length + tags.length > 0
          ? html`<div class="filter-bar">
              ${categories.length
                ? html`<div class="filter-group">
                    <span class="filter-label">分类</span>
                    ${categories.map(
                      (item) =>
                        html`<a
                          class="filter-chip${category === item.slug ? ' on' : ''}"
                          href=${filterHref('category', item.slug)}
                          >${item.name}</a
                        >`,
                    )}
                  </div>`
                : nothing}
              ${tags.length
                ? html`<div class="filter-group">
                    <span class="filter-label">标签</span>
                    ${tags.map(
                      (item) =>
                        html`<a
                          class="filter-chip${tag === item.slug ? ' on' : ''}"
                          href=${filterHref('tag', item.slug)}
                          >#${item.name}</a
                        >`,
                    )}
                  </div>`
                : nothing}
            </div>`
          : nothing}
        ${this.renderSearchResults(query, category, tag, page, params)}
      </main>
    `;
  }

  private renderSearchResults(
    query: string,
    category: string,
    tag: string,
    page: number,
    params: URLSearchParams,
  ) {
    if (query) {
      const slice = this.store.search;
      if (slice.status === 'idle' || slice.status === 'loading') {
        return html`<div class="results" aria-hidden="true">
          <div class="skel skel-line" style="width: 64%"></div>
          <div class="skel skel-line" style="width: 88%"></div>
          <div class="skel skel-line" style="width: 72%"></div>
        </div>`;
      }
      if (slice.status === 'error') {
        return this.renderLoadError(slice.error, () => this.store.loadSearch(query, page, true));
      }
      const data = slice.data;
      const articleItems = data?.articles.items ?? [];
      const dynamicItems = data?.dynamics.items ?? [];
      const articleTotal = data?.articles.total ?? 0;
      const dynamicTotal = data?.dynamics.total ?? 0;
      if (articleItems.length + dynamicItems.length === 0) {
        return html`<p class="search-hint">没有找到和「${query}」相关的内容。</p>`;
      }
      const searchHref = (target: number) => {
        const next = new URLSearchParams(params);
        next.set('q', query);
        if (target > 1) next.set('page', String(target));
        else next.delete('page');
        return `/search?${next.toString()}`;
      };
      return html`
        <p class="cap results-cap" data-reveal>
          「${query}」· 文章 ${articleTotal} 条 · 动态 ${dynamicTotal} 条
        </p>
        ${this.renderIndexRows(articleItems, query)}
        ${dynamicItems.length > 0
          ? html`<p class="cap results-cap" data-reveal>动态</p>`
          : nothing}
        ${this.renderDynamicRows(dynamicItems, query)}
        ${page > 1 || articleTotal > page * api.SEARCH_PAGE_SIZE
          ? html`<nav class="pager" aria-label="分页" data-reveal>
              ${page > 1
                ? html`<a class="pager-step" href=${searchHref(page - 1)}>← 上一页</a>`
                : nothing}
              ${articleTotal > page * api.SEARCH_PAGE_SIZE
                ? html`<a class="pager-step" href=${searchHref(page + 1)}>下一页 →</a>`
                : nothing}
            </nav>`
          : nothing}
      `;
    }
    if (category || tag) {
      const slice = this.store.archive;
      const items = slice.data?.items ?? [];
      if (slice.status === 'idle' || slice.status === 'loading') {
        return html`<div class="results" aria-hidden="true">
          <div class="skel skel-line" style="width: 64%"></div>
          <div class="skel skel-line" style="width: 88%"></div>
        </div>`;
      }
      if (slice.status === 'error') {
        return this.renderLoadError(slice.error, () =>
          this.store.loadArchive({ category, tag, page }, true),
        );
      }
      if (items.length === 0) {
        return html`<p class="search-hint">没有符合这些条件的文章。</p>`;
      }
      return html`
        <p class="cap results-cap" data-reveal>${slice.data?.total ?? items.length} 篇</p>
        ${this.renderIndexRows(items, '')}
        ${slice.data
          ? this.renderPager('/search', params, slice.data.page, slice.data.totalPages)
          : nothing}
      `;
    }
    return html`<p class="search-hint">输入关键词，或者从上面的分类与标签开始逛。</p>`;
  }

  private renderSite() {
    const home = window.location.pathname === '/';
    return html`
      <div
        class="site theme-nightflight shell-${this.shell.navigation}"
        style=${styleMap(this.siteThemeStyle())}
      >
        ${this.renderNavigation()}
        ${home
          ? html`<div class="page-root">${this.renderNode(homeLayout)}</div>`
          : keyed(window.location.pathname, this.renderInnerPage())}
        <footer class="site-footer">
          <span>YUKILOG</span>
          <span>© ${new Date().getFullYear()} LIAN / SAKURINE</span>
        </footer>
        <button
          class="to-top${this.navPastHero ? ' show' : ''}"
          type="button"
          aria-label="回到顶部"
          title="回到顶部"
          @click=${() =>
            window.scrollTo({ top: 0, behavior: this.reducedMotion ? 'auto' : 'smooth' })}
        >
          <svg class="ring" viewBox="0 0 46 46" aria-hidden="true">
            <circle class="ring-bg" cx="23" cy="23" r="20"></circle>
            <circle class="ring-fg" cx="23" cy="23" r="20"></circle>
          </svg>
          <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5m-7 7 7-7 7 7" />
          </svg>
        </button>
      </div>
    `;
  }

  protected render() {
    return html`
      ${this.renderSite()}
      ${this.renderSplash()}
      ${this.renderLightbox()}
      ${this.renderNotePopover()}
    `;
  }
}

customElements.define('yuki-app', YukiApp);

declare global {
  interface HTMLElementTagNameMap {
    'yuki-app': YukiApp;
  }
}
