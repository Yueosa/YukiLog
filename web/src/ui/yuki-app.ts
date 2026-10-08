import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { homeLayout, partNameOf, type ArticleField, type HomeNode } from './home-layout.js';
import { appStyles } from './app-styles.js';
import { icon, publicNavigation, type IconName } from './app-icons.js';
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
import { enhanceArticlePage, type ArticleFx } from './article-fx.js';

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
  private currentPath = window.location.pathname;
  private previousPath: string | null = null;

  /** 文章页阅读布局预设（宽屏可切换，localStorage 持久化）。 */
  private layoutChoice = localStorage.getItem('yukilog-article-layout') ?? 'wide';
  private layoutMenuOpen = false;
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
    if (window.location.pathname !== this.currentPath) {
      this.previousPath = this.currentPath;
      this.currentPath = window.location.pathname;
    }
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
    else if (event.key === '0') this.lbReset();
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
    // mermaid 图表点击进灯箱：复制节点并按 viewBox 钉死尺寸再序列化
    // （渲染态 width=100% 无内在尺寸，img 会按 300×150 默认值缩成小点）
    const svgNode = path.find(
      (node): node is SVGSVGElement =>
        node instanceof SVGSVGElement && node.closest('pre.lm-mermaid') !== null,
    );
    if (svgNode) {
      const clone = svgNode.cloneNode(true) as SVGSVGElement;
      const viewBox = svgNode.getAttribute('viewBox')?.split(/\s+/).map(Number);
      const naturalW = viewBox?.length === 4 ? viewBox[2] : svgNode.getBoundingClientRect().width;
      const naturalH = viewBox?.length === 4 ? viewBox[3] : svgNode.getBoundingClientRect().height;
      const width = Math.max(Math.round(naturalW * 1.5), 900);
      clone.setAttribute('viewBox', `0 0 ${naturalW} ${naturalH}`);
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(Math.round((width * naturalH) / naturalW)));
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

  /** 文章页结构增强（标题编号/代码卡/多图带/旁注对齐），随 slug 重建。 */
  private articleFx: ArticleFx | null = null;
  private articleFxKey = '';

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
      <div class="lightbox" role="dialog" aria-modal="true" aria-label="查看图片">
        <div
          class="lightbox-stage"
          @wheel=${this.lbWheel}
          @pointerdown=${this.lbPointerDown}
          @pointermove=${this.lbPointerMove}
          @pointerup=${this.lbPointerUp}
          @pointercancel=${this.lbPointerUp}
          @dblclick=${this.lbDoubleClick}
        >
          ${keyed(
            this.lightboxIndex,
            html`<img class="lightbox-item" src=${current} alt="查看原图" @load=${this.lbPrepare} />`,
          )}
        </div>
        <div class="lb-zoom" aria-hidden="true">100%</div>
        <div class="lightbox-tools">
          <button class="lb-btn" type="button" aria-label="放大" @click=${() => this.lbZoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>
          </button>
          <button class="lb-btn" type="button" aria-label="缩小" @click=${() => this.lbZoomAt(window.innerWidth / 2, window.innerHeight / 2, 0.8)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>
          </button>
          <button class="lb-btn" type="button" aria-label="复位" @click=${() => this.lbReset()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
          </button>
          <button class="lb-btn" type="button" aria-label="关闭" @click=${() => this.closeLightbox()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
        ${count > 1
          ? html`<button
                class="lb-nav prev"
                type="button"
                aria-label="上一张"
                @click=${() => this.stepLightbox(-1)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button
                class="lb-nav next"
                type="button"
                aria-label="下一张"
                @click=${() => this.stepLightbox(1)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>`
          : nothing}
        ${count > 1
          ? html`<span class="lb-counter">${this.lightboxIndex + 1} / ${count}</span>`
          : nothing}
        <span class="lb-hint" aria-hidden="true">滚轮缩放 · 拖拽平移 · 双击复位 · ESC 关闭</span>
      </div>
    `;
  }

  /* ---------- 灯箱缩放/平移（直接操作 DOM，不走状态重渲染） ---------- */
  private lbScale = 1;
  private lbTx = 0;
  private lbTy = 0;
  private lbFit = 1;
  private lbBaseW = 0;
  private lbBaseH = 0;
  private lbDrag: { x: number; y: number } | null = null;
  private lbZoomTimer: number | undefined;

  private lbItem(): HTMLImageElement | null {
    return this.renderRoot.querySelector('.lightbox-item');
  }

  private readonly lbPrepare = (event: Event) => {
    const img = event.currentTarget as HTMLImageElement;
    const naturalW = img.naturalWidth || 900;
    const naturalH = img.naturalHeight || 600;
    this.lbBaseW = Math.min(naturalW, window.innerWidth * 0.9, 1280);
    this.lbBaseH = (this.lbBaseW * naturalH) / naturalW;
    img.style.width = `${this.lbBaseW}px`;
    this.lbFit = Math.min(
      (window.innerWidth * 0.92) / this.lbBaseW,
      (window.innerHeight * 0.86) / this.lbBaseH,
      2,
    );
    this.lbReset();
  };

  private lbApply() {
    const item = this.lbItem();
    if (!item) return;
    item.style.transform = `translate(${this.lbTx}px, ${this.lbTy}px) scale(${this.lbScale})`;
    const badge = this.renderRoot.querySelector<HTMLElement>('.lb-zoom');
    if (badge) {
      badge.textContent = `${Math.round(this.lbScale * 100)}%`;
      badge.classList.add('show');
      window.clearTimeout(this.lbZoomTimer);
      this.lbZoomTimer = window.setTimeout(() => badge.classList.remove('show'), 900);
    }
  }

  private lbReset() {
    this.lbScale = this.lbFit;
    this.lbTx = (window.innerWidth - this.lbBaseW * this.lbScale) / 2;
    this.lbTy = (window.innerHeight - this.lbBaseH * this.lbScale) / 2;
    this.lbApply();
  }

  private lbZoomAt(cx: number, cy: number, factor: number) {
    const next = Math.min(8, Math.max(0.15, this.lbScale * factor));
    this.lbTx = cx - ((cx - this.lbTx) * next) / this.lbScale;
    this.lbTy = cy - ((cy - this.lbTy) * next) / this.lbScale;
    this.lbScale = next;
    this.lbApply();
  }

  private readonly lbWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.lbZoomAt(event.clientX, event.clientY, Math.pow(1.0018, -event.deltaY));
  };

  private readonly lbPointerDown = (event: PointerEvent) => {
    if (event.target === event.currentTarget) {
      this.closeLightbox();
      return;
    }
    this.lbDrag = { x: event.clientX - this.lbTx, y: event.clientY - this.lbTy };
    (event.currentTarget as HTMLElement).classList.add('panning');
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  private readonly lbPointerMove = (event: PointerEvent) => {
    if (!this.lbDrag) return;
    this.lbTx = event.clientX - this.lbDrag.x;
    this.lbTy = event.clientY - this.lbDrag.y;
    this.lbApply();
  };

  private readonly lbPointerUp = (event: PointerEvent) => {
    this.lbDrag = null;
    (event.currentTarget as HTMLElement).classList.remove('panning');
  };

  private readonly lbDoubleClick = (event: MouseEvent) => {
    if (this.lbScale > this.lbFit * 1.06) {
      this.lbReset();
    } else {
      this.lbZoomAt(event.clientX, event.clientY, Math.min(3, this.lbFit * 2.4) / this.lbScale);
    }
  };

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
    this.updateArticleProgress();
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

  private setArticleLayout(key: string) {
    this.layoutChoice = key;
    this.layoutMenuOpen = false;
    localStorage.setItem('yukilog-article-layout', key);
    this.requestUpdate();
    // 布局变化后旁注需要重新对齐（过渡动画 380ms，中途一次+结束后一次）
    window.setTimeout(() => this.articleFx?.relayout(), 120);
    window.setTimeout(() => this.articleFx?.relayout(), 440);
  }

  /** 文章页阅读进度：写进左栏目录的进度轨与已读百分比（DOM 直写不重渲染）。
   * 对全页可滚动区间归一，保证到达底部时恰好 100%。 */
  private updateArticleProgress() {
    if (!window.location.pathname.startsWith('/articles/')) return;
    const progressEl = this.renderRoot.querySelector<HTMLElement>('.post-toc .toc-progress');
    const pctEl = this.renderRoot.querySelector<HTMLElement>('.post-toc .toc-foot b');
    if (!progressEl || !pctEl) return;
    const prose = this.renderRoot.querySelector<HTMLElement>('.prose');
    if (!prose) return;
    const y = window.scrollY;
    const rect = prose.getBoundingClientRect();
    const proseTop = rect.top + y;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const start = Math.max(0, proseTop - window.innerHeight * 0.3);
    const end = Math.min(proseTop + rect.height - window.innerHeight * 0.55, maxScroll);
    const progress =
      end > start ? Math.min(1, Math.max(0, (y - start) / (end - start))) : y >= maxScroll ? 1 : 0;
    progressEl.style.height = `${(progress * 100).toFixed(1)}%`;
    const pct = String(Math.round(progress * 100));
    if (pctEl.textContent !== pct) pctEl.textContent = pct;
  }

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
    // 文章页结构增强：slug 变化时销毁旧的重建（标题编号/代码卡/多图带/旁注对齐）
    const fxKey = path.startsWith('/articles/') ? path : '';
    if (fxKey !== this.articleFxKey) {
      this.articleFx?.destroy();
      this.articleFx = null;
      this.articleFxKey = fxKey;
    }
    if (fxKey && !this.articleFx) {
      const fx = enhanceArticlePage(this.renderRoot);
      if (fx) this.articleFx = fx;
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
      // 目录只收 h2/h3：h1 是文章标题（页头已有），进目录是重复
      .filter((heading) => heading.level >= 2 && heading.level <= 3)
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
    // 展示用 card 变体（无变体回退原图），灯箱始终开原图
    const display = images.map((url, i) => item.mediaCardUrls?.[i] ?? url);
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
                src=${display[0]}
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
                      src=${display[imageIndex]}
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


  static styles = appStyles;


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
                      adaptive-ratio
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
    let tocIndex = 0;
    const tocLink = (item: { id: string; text: string; level: number }) => {
      const no = item.level === 2 ? String(++tocIndex).padStart(2, '0') : '';
      return html`<a
        class="post-toc-item level-${item.level}${this.tocActive === item.id ? ' is-active' : ''}"
        href="#${item.id}"
        @click=${(event: Event) => {
          event.preventDefault();
          this.tocActive = item.id;
          this.renderRoot
            .querySelector(`#${CSS.escape(item.id)}`)
            ?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth', block: 'start' });
        }}
        >${no ? html`<span class="no">${no}</span>` : nothing}<span>${item.text}</span></a
      >`;
    };
    return html`
      <main class="inner-page">
        <article class="article-page" data-layout=${this.layoutChoice}>
          ${this.tocItems.length > 1
            ? html`<nav class="post-toc" aria-label="目录">
                <div class="post-toc-sticky">
                  <p class="rail-kicker">Contents · 目录</p>
                  <div class="toc">
                    <i class="toc-progress" aria-hidden="true"></i>
                    ${this.tocItems.map(tocLink)}
                  </div>
                  <p class="toc-foot"><b>0</b>% · 已读</p>
                </div>
              </nav>`
            : nothing}
          <div class="post-main">
            <a
              class="post-back"
              href="/articles"
              @click=${(event: Event) => {
                event.preventDefault();
                // 只有上一跳是列表页才 history.back（保留滚动位置）；
                // 上一跳是另一篇文章时直接回列表，避免"返回"变成回上一篇
                const LIST_PATHS = new Set(['/', '/articles', '/search', '/archive']);
                if (
                  this.spaNavigated &&
                  this.previousPath !== null &&
                  LIST_PATHS.has(this.previousPath) &&
                  window.history.length > 1
                ) {
                  window.history.back();
                } else {
                  window.history.pushState(null, '', '/articles');
                  this.handleRouteChange();
                }
              }}
              >← 返回文章列表</a
            >
            <header class="post-head" data-reveal>
              <p class="post-kicker">Nightflight Notes<span class="cat">· ${detail.category?.name ?? '未分类'}</span></p>
              <h1>${detail.title}</h1>
              <p class="post-meta">
                <time>${formatDate(detail.publishedAt)}</time>
                <i class="dot" aria-hidden="true"></i>
                <span>${views} 阅读</span>
                <i class="dot" aria-hidden="true"></i>
                <span>${likeCount} 喜欢</span>
                <i class="dot" aria-hidden="true"></i>
                <span>约 ${readingMinutes(detail.html)} 分钟</span>
              </p>
              ${detail.summary ? html`<p class="post-summary">${detail.summary}</p>` : nothing}
              <yuki-cover
                class="post-cover"
                src=${detail.coverUrl}
                alt=${`${detail.title}的封面`}
                seed=${detail.slug}
                adaptive
                max-height="68vh"
                @click=${() => this.openLightbox([detail.coverUrl], 0)}
              ></yuki-cover>
            </header>
            ${this.tocItems.length > 1
              ? html`<details class="post-toc-mobile" data-reveal>
                  <summary>目录 · ${this.tocItems.length} 节</summary>
                  <div class="toc-mobile-list">${this.tocItems.map(tocLink)}</div>
                </details>`
              : nothing}
            <div class="prose" data-reveal @click=${this.handleProseClick}>${unsafeHTML(detail.html)}</div>
            ${detail.notes && detail.notes.length > 0
              ? html`<aside class="post-notes" aria-label="旁注">
                  <p class="rail-kicker">Notes · 旁注</p>
                  ${detail.notes.map(
                    (note) => html`
                      <div class="post-note" id=${note.anchor}>
                        <span class="sn-no">${String(note.index).padStart(2, '0')}</span>
                        <span class="sn-body">${unsafeHTML(note.html)}</span>
                      </div>
                    `,
                  )}
                </aside>`
              : nothing}
            <p class="post-end" data-reveal>FIN</p>
            ${detail.tags.length > 0
              ? html`<div class="post-tags" data-reveal>
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
              <span class="copyright">© ${new Date().getFullYear()} ${this.siteData.siteTitle || 'YukiLog'} · CC BY-NC-SA 4.0</span>
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
          </div>
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
          <span>
            <a
              href="?ssr=1"
              @click=${(event: Event) => {
                event.preventDefault();
                // 整页跳转：让网关按 ?ssr=1 直出阅读版（SPA 内部路由到不了 SSR）
                window.location.assign(`${window.location.pathname}?ssr=1`);
              }}
              >阅读版</a
            >
          </span>
          <span>© ${new Date().getFullYear()} LIAN / SAKURINE</span>
        </footer>
        ${window.location.pathname.startsWith('/articles/')
          ? html`<div class="layout-switch${this.layoutMenuOpen ? ' open' : ''}">
              ${this.layoutMenuOpen
                ? html`<div
                    class="layout-backdrop"
                    @click=${() => {
                      this.layoutMenuOpen = false;
                      this.requestUpdate();
                    }}
                  ></div>`
                : nothing}
              <div class="layout-menu" role="menu">
                <p class="layout-menu-kicker">阅读布局</p>
                ${[
                  ['default', '紧凑', '720px 正文'],
                  ['wide', '宽松', '880px 正文（≥1500px 视口生效）'],
                  ['full-compact', '全宽', '18 / 60 / 18 三栏'],
                ].map(
                  ([key, name, desc]) => html`<button
                    class="layout-option${this.layoutChoice === key ? ' active' : ''}"
                    type="button"
                    role="menuitemradio"
                    aria-checked=${this.layoutChoice === key}
                    @click=${() => this.setArticleLayout(key)}
                  >
                    <span class="opt-name">${name}</span>
                    <span class="opt-desc">${desc}</span>
                  </button>`,
                )}
              </div>
              <button
                class="layout-fab${this.navPastHero ? ' show' : ''}"
                type="button"
                aria-label="阅读布局"
                title="阅读布局"
                @click=${() => {
                  this.layoutMenuOpen = !this.layoutMenuOpen;
                  this.requestUpdate();
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="4.5" height="16" rx="1.2" />
                  <rect x="9.8" y="4" width="7" height="16" rx="1.2" />
                  <rect x="19" y="4" width="3.4" height="16" rx="1.2" />
                </svg>
              </button>
            </div>`
          : nothing}
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
