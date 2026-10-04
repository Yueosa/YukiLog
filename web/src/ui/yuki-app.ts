import { LitElement, css, html, nothing } from 'lit';
import {
  componentRegistry,
  flattenLayout,
  toPageLayout,
  validateLayout,
} from '../layout/registry.js';
import { layoutPresets } from '../layout/presets.js';
import type {
  ArticleField,
  ArticleVariant,
  ComponentType,
  LayoutDocument,
  LayoutNode,
  NavigationVariant,
  PageLayoutDocument,
} from '../layout/types.js';

const articles = [
  {
    title: '在十月的晚风里，重新搭一座小小的站',
    summary: '旧服务器消失以后，我终于有机会重新想一遍：一个博客究竟应该留下什么。',
    date: '2026 · 10 · 04',
    category: '生活随笔',
    tags: ['夜色', '重逢'],
    views: 128,
    likes: 16,
    cover: 'cover-one',
  },
  {
    title: '那些没有被算法推送的夜晚',
    summary: '有些文字并不期待抵达很多人，只希望在某一个恰好的时刻，被某个人读到。',
    date: '2026 · 09 · 17',
    category: '写作',
    tags: ['回忆', '长信'],
    views: 96,
    likes: 21,
    cover: 'cover-two',
  },
  {
    title: '把动态写成散落在时间里的星',
    summary: '短句不再是假装完整的文章，它们只是当天留下的一点光。',
    date: '2026 · 08 · 29',
    category: '动态',
    tags: ['星轨', '片刻'],
    views: 73,
    likes: 12,
    cover: 'cover-three',
  },
  {
    title: '一套不替创作者做决定的博客系统',
    summary: '组件、布局和设计语言应当可以被更换，而内容不必跟着重新搬家。',
    date: '2026 · 08 · 11',
    category: '开发手记',
    tags: ['Rust', '组件引擎'],
    views: 184,
    likes: 28,
    cover: 'cover-four',
  },
  {
    title: '雨落在窗边的时候，适合整理旧照片',
    summary: '我没有试图把每张照片都解释清楚，只给它们留下了时间和地点。',
    date: '2026 · 07 · 26',
    category: '日常',
    tags: ['雨天', '照片'],
    views: 61,
    likes: 9,
    cover: 'cover-five',
  },
  {
    title: '从一张空白页面开始',
    summary: '这一次不修补旧站。重新决定哪些东西值得存在，也允许一些东西永远离开。',
    date: '2026 · 07 · 08',
    category: '站务',
    tags: ['重构', 'YukiLog'],
    views: 142,
    likes: 24,
    cover: 'cover-six',
  },
];

const dynamics = [
  '雨停以后，窗沿留下了一小段很亮的晚霞。',
  '重新整理了书桌，也重新整理了一些念头。',
  '正在为新的 YukiLog 选择它应有的样子。',
  '凌晨两点，终于把恢复演练完整跑通。',
  '今天的风很轻，适合慢一点做决定。',
];

const navigationLabels: Record<NavigationVariant, string> = {
  topbar: '顶部导航',
  sidebar: '固定侧栏',
  'floating-dock': '浮动 Dock',
};

export class YukiApp extends LitElement {
  private layout: LayoutDocument = structuredClone(layoutPresets[0]);
  private studio = false;
  private selectedNodeId = this.layout.root.id;
  private flippedProfiles = new Set<string>();
  private draggingNodeId: string | null = null;
  private navPastHero = false;
  private navRevealed = false;

  private readonly handleViewportScroll = () => {
    const pastHero = window.scrollY >= window.innerHeight - 56;
    if (pastHero !== this.navPastHero) {
      this.navPastHero = pastHero;
      if (pastHero) this.navRevealed = false;
      this.requestUpdate();
    }
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (this.layout.shell.navigation !== 'topbar' || this.navPastHero) return;
    const revealed = event.clientY < 82;
    if (revealed !== this.navRevealed) {
      this.navRevealed = revealed;
      this.requestUpdate();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('scroll', this.handleViewportScroll, { passive: true });
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    this.handleViewportScroll();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.handleViewportScroll);
    window.removeEventListener('pointermove', this.handlePointerMove);
    super.disconnectedCallback();
  }

  loadPageLayout(page: PageLayoutDocument) {
    this.layout = { ...this.layout, ...structuredClone(page) };
    this.selectedNodeId = this.layout.root.id;
    this.studio = true;
    this.requestUpdate();
  }

  exportPageLayout(): PageLayoutDocument {
    return structuredClone(toPageLayout(this.layout));
  }

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      min-height: 100dvh;
      color: var(--ink);
      background: var(--page);
      font-family: Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
      --serif: 'Noto Serif SC', 'Songti SC', Georgia, serif;
      scroll-behavior: smooth;
    }

    button,
    input {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    .lab-bar {
      position: fixed;
      z-index: 200;
      bottom: 14px;
      left: 14px;
      display: flex;
      width: auto;
      max-width: calc(100% - 28px);
      align-items: center;
      gap: 6px;
      padding: 7px;
      transform: none;
      border: 1px solid rgb(255 255 255 / 15%);
      border-radius: 20px;
      background: rgb(12 17 25 / 82%);
      box-shadow: 0 16px 48px rgb(0 0 0 / 28%);
      color: #e9edf5;
      backdrop-filter: blur(18px);
    }

    .lab-title {
      padding: 0 10px;
      color: #909bad;
      font-size: 12px;
      white-space: nowrap;
    }

    .lab-bar button {
      min-height: 34px;
      padding: 6px 11px;
      border: 0;
      border-radius: 11px;
      background: transparent;
      color: #c5ccda;
      font-size: 13px;
    }

    .lab-bar button[aria-pressed='true'] {
      background: #f5f7fb;
      color: #171c25;
      box-shadow: 0 5px 18px rgb(0 0 0 / 18%);
    }

    .lab-spacer {
      flex: 1;
    }

    .mode-button {
      border: 1px solid rgb(255 255 255 / 14%) !important;
    }

    .site {
      --page: #f6f7f9;
      --surface: #fff;
      --surface-soft: #eef3f7;
      --ink: #2c3e50;
      --muted: #7f8ea3;
      --line: #e1e8f0;
      --primary: #72add2;
      --secondary: #e3a0b2;
      --radius: 24px;
      min-height: 100dvh;
      background: var(--page);
      color: var(--ink);
      overflow: clip;
    }

    .theme-moonletter {
      --page: #f1ede5;
      --surface: #fffaf0;
      --surface-soft: #e9e1d5;
      --ink: #292b34;
      --muted: #786f67;
      --line: #ded5c7;
      --primary: #50677f;
      --secondary: #b66e74;
      --radius: 7px;
      font-family: var(--serif);
      background-image:
        linear-gradient(rgb(60 52 44 / 3%) 1px, transparent 1px),
        linear-gradient(90deg, rgb(60 52 44 / 3%) 1px, transparent 1px);
      background-size: 30px 30px;
    }

    .theme-orbit {
      --page: #0d1118;
      --surface: #171d27;
      --surface-soft: #202936;
      --ink: #f2f4f8;
      --muted: #99a4b5;
      --line: #2c3543;
      --primary: #79c7d3;
      --secondary: #e899a9;
      --radius: 16px;
      background:
        radial-gradient(circle at 12% 8%, rgb(75 114 145 / 18%), transparent 30%),
        radial-gradient(circle at 88% 78%, rgb(125 73 105 / 16%), transparent 28%),
        var(--page);
    }

    .site-nav {
      z-index: 50;
    }

    .nav-topbar {
      position: fixed;
      top: 10px;
      left: 50%;
      display: flex;
      width: auto;
      max-width: calc(100% - 32px);
      height: 54px;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      transform: translateX(-50%);
      border: 1px solid var(--line);
      border-radius: 22px;
      background: color-mix(in srgb, var(--surface) 95%, transparent);
      color: var(--ink);
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 12px 38px rgb(25 40 58 / 12%);
      backdrop-filter: blur(16px);
      transition:
        opacity 220ms ease,
        background 220ms ease,
        transform 220ms ease;
    }

    .nav-topbar.revealed,
    .nav-topbar.sticky {
      opacity: 1;
      pointer-events: auto;
    }

    .nav-topbar:not(.sticky) .brand {
      display: none;
    }

    .nav-corners {
      position: fixed;
      z-index: 49;
      top: 0;
      right: 0;
      left: 0;
      display: flex;
      height: 64px;
      align-items: center;
      justify-content: space-between;
      padding: 0 30px;
      color: white;
      text-shadow: 0 2px 12px rgb(0 0 0 / 28%);
      pointer-events: none;
      transition: opacity 180ms ease;
    }

    .nav-corners.hidden {
      opacity: 0;
    }

    .nav-corner-actions {
      display: flex;
      gap: 14px;
      font-size: 18px;
    }

    .brand {
      font-weight: 800;
      letter-spacing: 0.08em;
    }

    .nav-links {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .nav-links a {
      padding: 8px 10px;
      border-radius: 999px;
      color: inherit;
      font-size: 13px;
      text-decoration: none;
    }

    .nav-links a:hover {
      background: rgb(255 255 255 / 12%);
      transform: translateY(-1px);
    }

    .nav-topbar .nav-links a:hover {
      background: var(--surface-soft);
      color: var(--primary);
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

    .theme-moonletter .nav-sidebar::after {
      position: absolute;
      right: 18px;
      bottom: 34px;
      color: color-mix(in srgb, var(--muted) 38%, transparent);
      content: '01';
      font: 700 74px/1 var(--serif);
    }

    .theme-moonletter .nav-sidebar .brand {
      padding-bottom: 18px;
      border-bottom: 1px solid var(--line);
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 500;
    }

    .nav-sidebar .nav-links {
      align-items: stretch;
      flex-direction: column;
      margin-top: 48px;
    }

    .nav-sidebar .nav-links a {
      border-radius: 4px;
      transition:
        padding 180ms ease,
        color 180ms ease;
    }

    .nav-sidebar .nav-links a:hover {
      padding-left: 18px;
      background: transparent;
      color: var(--secondary);
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
      padding: 0;
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

    .layout-grid.grid-three-rail {
      width: min(1420px, calc(100% - 48px));
      grid-template-columns: minmax(220px, 280px) minmax(0, 900px) minmax(220px, 280px);
      justify-content: center;
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

    .primitive-status {
      width: 100%;
      padding: 10px 12px;
      border-radius: 9px;
      background: var(--surface-soft);
      color: var(--muted);
      font: 10px/1.5 ui-monospace, monospace;
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

    .hero {
      position: relative;
      display: grid;
      min-height: 100svh;
      place-items: center;
      overflow: hidden;
      isolation: isolate;
      color: white;
    }

    .hero::before,
    .hero::after {
      position: absolute;
      z-index: -2;
      content: '';
      inset: 0;
    }

    .theme-hanakoi .hero::before {
      background:
        radial-gradient(circle at 78% 18%, rgb(255 219 221 / 78%), transparent 13%),
        radial-gradient(ellipse at 16% 95%, rgb(23 49 77 / 92%), transparent 38%),
        linear-gradient(162deg, transparent 52%, rgb(239 179 194 / 42%) 53% 58%, transparent 59%),
        linear-gradient(155deg, #15283e 0%, #456884 42%, #9db5c3 68%, #dca9b6 100%);
      transform: scale(1.04);
      animation: hero-reveal 1.4s cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    .theme-hanakoi .hero::after {
      z-index: -1;
      background:
        linear-gradient(90deg, rgb(4 12 24 / 42%), transparent 58%),
        linear-gradient(180deg, rgb(6 14 28 / 10%), rgb(6 14 28 / 58%));
    }

    .hero-inner {
      width: min(720px, calc(100% - 36px));
      padding: 150px 0 100px;
      text-align: center;
    }

    .theme-hanakoi .hero-inner {
      display: flex;
      align-items: center;
      flex-direction: column;
      animation: hero-copy-in 900ms 180ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
    }

    .theme-hanakoi .hero-inner > .component-kicker {
      padding: 8px 13px;
      border: 1px solid rgb(255 255 255 / 22%);
      border-radius: 999px;
      background: rgb(8 17 30 / 18%);
      color: rgb(255 255 255 / 74%);
      backdrop-filter: blur(12px);
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(44px, 8vw, 78px);
      line-height: 1.15;
      letter-spacing: 0.06em;
      text-shadow: 0 8px 30px rgb(0 0 0 / 24%);
    }

    .theme-hanakoi .hero h1 {
      max-width: 850px;
      font-family: var(--serif);
      font-size: clamp(48px, 7vw, 86px);
      font-weight: 700;
      letter-spacing: 0.09em;
      text-wrap: balance;
    }

    .hero-character {
      display: inline-block;
      opacity: 0;
      transform: translateY(14px);
      animation: character-in 520ms calc(180ms + var(--char-index) * 65ms)
        cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
    }

    .hero-info {
      width: min(580px, 82vw);
      margin-top: 22px;
      padding: 18px 26px 14px;
      border: 1px solid rgb(255 255 255 / 11%);
      border-radius: 22px;
      background: rgb(3 9 18 / 54%);
      box-shadow: 0 22px 54px rgb(0 0 0 / 20%);
      backdrop-filter: blur(14px);
    }

    .hero-info > p {
      margin-top: 0;
    }

    .hero p {
      max-width: 560px;
      margin: 28px auto 0;
      color: rgb(255 255 255 / 86%);
      line-height: 1.8;
    }

    .social-row {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 22px;
    }

    .social-row span,
    .enter-button {
      padding: 10px 15px;
      border: 1px solid rgb(255 255 255 / 22%);
      border-radius: 999px;
      background: rgb(12 18 30 / 24%);
      color: white;
      backdrop-filter: blur(12px);
    }

    .social-row span {
      min-width: 66px;
      transition:
        transform 180ms ease,
        background 180ms ease;
    }

    .social-row span:hover {
      background: rgb(255 255 255 / 16%);
      transform: translateY(-4px);
    }

    .enter-button {
      position: absolute;
      bottom: 28px;
      left: 50%;
      display: grid;
      width: 54px;
      height: 54px;
      place-items: center;
      margin: 0;
      transform: translateX(-50%);
      border-radius: 50%;
      font-size: 0;
      animation: enter-float 2s ease-in-out infinite;
    }

    .enter-button::after {
      content: '↓';
      font-size: 22px;
    }

    .hero-split {
      min-height: 100%;
      place-items: stretch;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background:
        radial-gradient(circle at 16% 18%, rgb(121 199 211 / 28%), transparent 25%),
        radial-gradient(circle at 82% 78%, rgb(232 153 169 / 26%), transparent 24%),
        #151c28;
    }

    .hero-split::before {
      background-image: radial-gradient(circle, rgb(255 255 255 / 58%) 0 1px, transparent 1.5px);
      background-size: 70px 70px;
    }

    .hero-split .hero-inner {
      display: flex;
      width: auto;
      flex-direction: column;
      justify-content: flex-end;
      padding: 44px;
      text-align: left;
    }

    .hero-split .hero-inner p {
      margin-inline: 0;
    }

    .theme-orbit .hero-split h1 {
      max-width: 680px;
      font-size: clamp(42px, 5vw, 68px);
      letter-spacing: -0.035em;
    }

    .theme-orbit .hero-split .component-kicker {
      color: var(--primary);
    }

    .theme-orbit .hero-split::after {
      z-index: -1;
      background: linear-gradient(135deg, transparent 55%, rgb(232 153 169 / 12%));
    }

    .masthead {
      padding: 16px 0 44px;
      border-bottom: 1px solid var(--line);
    }

    .masthead .kicker,
    .component-kicker {
      margin: 0 0 12px;
      color: var(--secondary);
      font-family: system-ui, sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .masthead h1 {
      margin: 0;
      font-size: clamp(48px, 7vw, 88px);
      font-weight: 500;
      line-height: 1.08;
    }

    .masthead .lead {
      max-width: 620px;
      margin: 24px 0 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 2;
    }

    .masthead-minimal {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 0.7fr);
      gap: 28px;
      align-items: end;
      padding: 4px 0 28px;
    }

    .masthead-minimal .kicker {
      grid-column: 1 / -1;
      margin-bottom: -12px;
    }

    .masthead-minimal h1 {
      font-size: clamp(34px, 5vw, 58px);
      font-weight: 700;
    }

    .masthead-minimal .lead {
      margin: 0;
      font-size: 15px;
    }

    .theme-moonletter .masthead {
      position: relative;
      padding-top: 38px;
    }

    .theme-moonletter .masthead::before {
      position: absolute;
      top: 0;
      right: 0;
      color: var(--secondary);
      content: 'YUKILOG / JOURNAL';
      font: 700 10px/1 system-ui, sans-serif;
      letter-spacing: 0.22em;
    }

    .theme-moonletter .masthead h1 {
      max-width: 760px;
      letter-spacing: -0.04em;
    }

    .profile-card {
      position: sticky;
      top: 88px;
      min-height: 390px;
      perspective: 1200px;
    }

    .profile-button {
      position: relative;
      width: 100%;
      min-height: 390px;
      padding: 0;
      transform-style: preserve-3d;
      border: 0;
      background: transparent;
      color: inherit;
      transition: transform 500ms ease;
    }

    .profile-button:focus-visible {
      border-radius: var(--radius);
      outline: 3px solid color-mix(in srgb, var(--primary) 60%, transparent);
      outline-offset: 4px;
    }

    .profile-button:disabled {
      cursor: default;
    }

    .profile-button[aria-pressed='true'] {
      transform: rotateY(180deg);
    }

    .profile-face {
      position: absolute;
      display: flex;
      width: 100%;
      min-height: 390px;
      flex-direction: column;
      align-items: center;
      padding: 32px 24px;
      backface-visibility: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: 0 18px 50px rgb(49 74 100 / 10%);
      text-align: center;
    }

    .profile-back {
      align-items: flex-start;
      transform: rotateY(180deg);
      text-align: left;
    }

    .avatar {
      display: grid;
      width: 88px;
      height: 88px;
      place-items: center;
      border-radius: 50%;
      background: linear-gradient(145deg, var(--secondary), var(--primary));
      color: white;
      font-family: var(--serif);
      font-size: 28px;
      box-shadow: 0 10px 28px color-mix(in srgb, var(--secondary) 24%, transparent);
    }

    .profile-face h2 {
      margin: 18px 0 9px;
      color: var(--secondary);
      font-size: 22px;
    }

    .profile-face p {
      margin: 0;
      color: var(--muted);
      line-height: 1.8;
    }

    .profile-hint {
      margin-top: auto;
      padding-top: 24px;
      color: var(--muted);
      font-size: 12px;
    }

    .profile-socials {
      margin-top: 22px;
      color: var(--primary);
      font-size: 12px;
      letter-spacing: 0.06em;
    }

    .profile-status {
      width: 100%;
      margin-top: 16px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--surface-soft);
      color: var(--muted);
      font: 10px/1.5 ui-monospace, monospace;
      text-align: left;
    }

    .profile-portrait .profile-face {
      border-color: color-mix(in srgb, var(--secondary) 30%, var(--line));
      box-shadow: -7px 9px 0 rgb(227 160 178 / 14%);
    }

    .profile-letter .profile-face {
      align-items: flex-start;
      border-radius: 3px;
      box-shadow: 8px 8px 0 color-mix(in srgb, var(--primary) 9%, transparent);
      text-align: left;
    }

    .profile-letter .avatar {
      width: 70px;
      height: 70px;
      border-radius: 3px;
    }

    .profile-compact {
      position: relative;
      top: auto;
      height: 100%;
    }

    .profile-compact .profile-button,
    .profile-compact .profile-face {
      min-height: 100%;
    }

    .theme-orbit .profile-compact .profile-face {
      justify-content: center;
      border-color: rgb(121 199 211 / 22%);
      background:
        linear-gradient(145deg, rgb(121 199 211 / 8%), transparent 38%),
        var(--surface);
    }

    .article-feed {
      display: grid;
      gap: 22px;
    }

    .article {
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      transition:
        border-color 220ms ease,
        box-shadow 220ms ease,
        transform 220ms ease;
    }

    .article:hover {
      border-color: color-mix(in srgb, var(--primary) 34%, var(--line));
      transform: translateY(-4px);
    }

    .article-cover {
      min-height: 210px;
      background: var(--cover);
      transition: transform 600ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .article:hover .article-cover {
      transform: scale(1.045);
    }

    .cover-one {
      --cover: linear-gradient(145deg, #5d7697, #aabccb 52%, #e5b1bc);
    }

    .cover-two {
      --cover: linear-gradient(145deg, #d6beaa, #ede4db 52%, #91aeb5);
    }

    .cover-three {
      --cover: linear-gradient(145deg, #293b57, #747b9a 52%, #dfa3b2);
    }

    .cover-four {
      --cover:
        radial-gradient(circle at 70% 24%, #f2c9cf 0 8%, transparent 9%),
        linear-gradient(135deg, #13243a, #456a7b 58%, #c995a7);
    }

    .cover-five {
      --cover:
        linear-gradient(115deg, transparent 45%, rgb(255 255 255 / 28%) 46% 48%, transparent 49%),
        linear-gradient(150deg, #637888, #b7c5ca 56%, #e7d6cf);
    }

    .cover-six {
      --cover:
        radial-gradient(circle at 24% 72%, #df9caf 0 3%, transparent 4%),
        radial-gradient(circle at 33% 66%, #78abc8 0 2%, transparent 3%),
        linear-gradient(145deg, #f1ece6, #aab9c1 60%, #536b80);
    }

    .article-copy {
      padding: 28px 30px;
    }

    .article time,
    .article-metrics {
      color: var(--muted);
      font-size: 12px;
    }

    .article h3 {
      margin: 9px 0;
      font-size: 23px;
      line-height: 1.4;
    }

    .article p {
      margin: 0;
      color: var(--muted);
      line-height: 1.75;
    }

    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 18px;
    }

    .meta-pill {
      padding: 4px 9px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      color: var(--primary);
      font-size: 11px;
    }

    .feed-alternating .article {
      display: grid;
      min-height: 248px;
      grid-template-columns: 42% 58%;
      box-shadow: -3px 4px 16px rgb(114 173 210 / 18%);
    }

    .feed-alternating .article:hover {
      box-shadow: -8px 11px 0 rgb(114 173 210 / 13%);
    }

    .feed-alternating .article:nth-child(even) {
      grid-template-columns: 58% 42%;
    }

    .feed-alternating .article:nth-child(even) .article-cover {
      order: 2;
    }

    .feed-editorial {
      counter-reset: article;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      border-top: 1px solid var(--line);
      border-left: 1px solid var(--line);
    }

    .feed-editorial .article {
      position: relative;
      min-height: 290px;
      border-width: 0 1px 1px 0;
      border-radius: 0;
      background: color-mix(in srgb, var(--surface) 90%, transparent);
      counter-increment: article;
    }

    .feed-editorial .article::before {
      position: absolute;
      top: 18px;
      right: 20px;
      color: color-mix(in srgb, var(--muted) 44%, transparent);
      content: '0' counter(article);
      font: 600 11px/1 system-ui, sans-serif;
      letter-spacing: 0.12em;
    }

    .feed-editorial .article-copy {
      padding: 34px;
    }

    .feed-editorial .article h3 {
      font-family: var(--serif);
      font-size: 26px;
    }

    .feed-editorial .article:hover {
      z-index: 1;
      box-shadow: 14px 14px 0 color-mix(in srgb, var(--primary) 10%, transparent);
      transform: translate(-4px, -4px);
    }

    .feed-cover-overlay {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      height: 100%;
    }

    .feed-cover-overlay .article {
      position: relative;
      min-height: 360px;
      border-radius: 14px;
      color: white;
    }

    .feed-cover-overlay .article:hover {
      box-shadow: 0 18px 42px rgb(0 0 0 / 34%);
      transform: translateY(-7px);
    }

    .feed-cover-overlay .article-cover {
      position: absolute;
      inset: 0;
      min-height: 100%;
    }

    .feed-cover-overlay .article-cover::after {
      position: absolute;
      content: '';
      inset: 0;
      background: linear-gradient(180deg, transparent 20%, rgb(5 9 15 / 86%));
    }

    .feed-cover-overlay .article-copy {
      position: relative;
      z-index: 1;
      display: flex;
      min-height: 360px;
      flex-direction: column;
      justify-content: flex-end;
    }

    .feed-cover-overlay .article p {
      display: none;
    }

    .theme-orbit .feed-cover-overlay .article h3 {
      font-size: 19px;
    }

    .theme-orbit .feed-cover-overlay .article time,
    .theme-orbit .feed-cover-overlay .article-metrics {
      color: rgb(255 255 255 / 66%);
    }

    .quote-card,
    .stats-card,
    .dynamic-strip {
      padding: 26px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
    }

    .theme-orbit .quote-card,
    .theme-orbit .stats-card,
    .theme-orbit .dynamic-strip {
      border-color: rgb(121 199 211 / 16%);
      background: rgb(23 29 39 / 80%);
      box-shadow: inset 0 1px rgb(255 255 255 / 4%);
    }

    .quote-card {
      color: var(--muted);
      font-family: var(--serif);
      line-height: 2;
    }

    .quote-card cite {
      display: block;
      margin-top: 14px;
      color: var(--secondary);
      font-family: system-ui, sans-serif;
      font-size: 12px;
      font-style: normal;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .stat strong {
      display: block;
      color: var(--primary);
      font-size: 22px;
    }

    .stat span {
      color: var(--muted);
      font-size: 11px;
    }

    .dynamic-item {
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: 8px;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }

    .dynamic-item time {
      color: var(--secondary);
      font: 10px/1.7 ui-monospace, monospace;
    }

    .dynamic-item:last-child {
      border-bottom: 0;
    }

    .dynamics-handwritten {
      position: relative;
      padding: 32px;
      border-radius: 2px;
      background:
        repeating-linear-gradient(
          transparent 0 31px,
          color-mix(in srgb, var(--primary) 10%, transparent) 32px
        ),
        var(--surface);
      transform: rotate(-0.5deg);
      box-shadow: 7px 9px 0 color-mix(in srgb, var(--secondary) 8%, transparent);
      font-family: var(--serif);
    }

    .dynamics-timeline .dynamic-item {
      position: relative;
      margin-left: 6px;
      padding-left: 16px;
      border-bottom: 0;
      border-left: 1px solid color-mix(in srgb, var(--primary) 40%, transparent);
    }

    .dynamics-timeline .dynamic-item::before {
      position: absolute;
      top: 18px;
      left: -4px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--primary);
      content: '';
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent);
    }

    .dynamics-compact {
      display: grid;
      grid-template-columns: minmax(150px, 0.45fr) repeat(3, 1fr);
      gap: 0;
      align-items: stretch;
      padding: 0;
      overflow: hidden;
    }

    .dynamics-compact .component-kicker,
    .dynamics-compact .dynamic-item {
      margin: 0;
      padding: 22px;
      border-right: 1px solid var(--line);
      border-bottom: 0;
    }

    .dynamics-compact .component-kicker {
      display: flex;
      align-items: center;
      background: var(--surface-soft);
    }

    /* Layout studio */
    .studio-shell {
      display: grid;
      min-height: 100dvh;
      grid-template-columns: 220px minmax(520px, 1fr) 280px;
      padding-top: 64px;
      background: #0e131b;
      color: #e8edf5;
    }

    .studio-panel {
      position: sticky;
      top: 64px;
      height: calc(100dvh - 64px);
      overflow: auto;
      padding: 20px 16px;
      border-right: 1px solid #27303d;
      background: #151b24;
    }

    .studio-panel.right {
      border-right: 0;
      border-left: 1px solid #27303d;
    }

    .studio-panel h2 {
      margin: 0 0 16px;
      font-size: 14px;
    }

    .palette-group {
      margin-bottom: 20px;
    }

    .palette-group h3 {
      margin: 0 0 8px;
      color: #828da0;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .palette-item,
    .tree-item,
    .inspector-button {
      width: 100%;
      margin: 3px 0;
      padding: 9px 10px;
      border: 1px solid #2b3543;
      border-radius: 9px;
      background: #1b2330;
      color: #dbe2ed;
      font-size: 12px;
      text-align: left;
    }

    .tree-item[aria-pressed='true'] {
      border-color: #79c7d3;
      background: #21323e;
    }

    .tree-help {
      margin: 0 0 10px;
      color: #788497;
      font-size: 10px;
      line-height: 1.6;
    }

    .tree-row {
      display: flex;
      align-items: center;
      gap: 4px;
      border-radius: 9px;
    }

    .tree-row.dragging {
      opacity: 0.38;
    }

    .tree-row .tree-item {
      min-width: 0;
      flex: 1;
    }

    .tree-depth {
      color: #59677a;
      font-family: ui-monospace, monospace;
    }

    .tree-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .tree-row:hover .tree-actions,
    .tree-row:focus-within .tree-actions {
      opacity: 1;
    }

    .tree-actions button {
      width: 24px;
      height: 28px;
      padding: 0;
      border: 1px solid #303b49;
      border-radius: 7px;
      background: #1b2330;
      color: #aeb8c7;
    }

    .studio-canvas {
      min-width: 0;
      padding: 28px;
      overflow: auto;
    }

    .studio-preview {
      position: relative;
      min-height: calc(100dvh - 120px);
      overflow: hidden;
      border: 1px solid #303a48;
      border-radius: 14px;
      background: white;
      box-shadow: 0 24px 80px rgb(0 0 0 / 34%);
    }

    .studio-preview .site-nav {
      position: absolute;
    }

    .studio-preview .nav-sidebar {
      height: 100%;
    }

    .studio-preview .hero {
      min-height: 680px;
    }

    .studio-preview .layout-bento {
      min-height: 760px;
    }

    .studio-preview .node:hover::after,
    .studio-preview .node.selected::after {
      position: absolute;
      z-index: 120;
      content: attr(data-label);
      inset: 0;
      border: 2px solid #79c7d3;
      background: rgb(121 199 211 / 5%);
      color: #fff;
      font: 11px system-ui;
      pointer-events: none;
    }

    .studio-preview .node:hover::after {
      border-style: dashed;
    }

    .inspector-section {
      margin-bottom: 22px;
    }

    .inspector-section label {
      display: block;
      margin-bottom: 7px;
      color: #8d98aa;
      font-size: 11px;
    }

    .segmented {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .segmented button {
      padding: 7px 8px;
      border: 1px solid #303b49;
      border-radius: 8px;
      background: #1b2330;
      color: #c8d0dd;
      font-size: 11px;
    }

    .segmented button[aria-pressed='true'] {
      border-color: #79c7d3;
      color: #9de5ec;
    }

    .layout-json {
      max-height: 180px;
      overflow: auto;
      padding: 10px;
      border-radius: 8px;
      background: #0d1118;
      color: #9eacbd;
      font: 10px/1.5 ui-monospace, monospace;
      white-space: pre-wrap;
    }

    .validation-ok {
      color: #83d6a1;
      font-size: 12px;
    }

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

    @keyframes card-in {
      from {
        opacity: 0;
        transform: translateY(28px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @supports (animation-timeline: view()) {
      .feed-alternating .article {
        animation: card-in both;
        animation-range: entry 10% cover 28%;
        animation-timeline: view();
      }
    }

    @media (max-width: 900px) {
      .lab-title,
      .lab-spacer {
        display: none;
      }

      .lab-bar button {
        flex: 1;
        padding-inline: 5px;
        font-size: 11px;
      }

      .nav-topbar {
        top: 8px;
        padding-inline: 12px;
      }

      .nav-topbar .brand {
        display: none;
      }

      .nav-topbar .nav-links {
        width: 100%;
        justify-content: center;
      }

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

      .layout-grid,
      .layout-split {
        width: min(100% - 24px, 680px);
        grid-template-columns: 1fr;
        gap: 28px;
        padding-top: 72px;
      }

      .layout-grid.grid-three-rail {
        width: min(100% - 24px, 680px);
        grid-template-columns: 1fr;
      }

      .masthead-minimal {
        grid-template-columns: 1fr;
      }

      .masthead-minimal .lead {
        margin-top: -10px;
      }

      .layout-bento {
        width: min(100% - 24px, 680px);
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
      }

      .theme-orbit .layout-bento > * {
        grid-column: 1 !important;
        grid-row: auto !important;
      }

      .profile-card {
        position: relative;
        top: auto;
        width: min(100%, 420px);
        margin: 0 auto;
      }

      .is-sticky {
        position: relative;
        top: auto;
      }

      .feed-alternating .article,
      .feed-alternating .article:nth-child(even) {
        grid-template-columns: 1fr;
      }

      .feed-alternating .article:nth-child(even) .article-cover {
        order: 0;
      }

      .feed-editorial,
      .feed-cover-overlay {
        grid-template-columns: 1fr;
      }

      .dynamics-compact {
        grid-template-columns: 1fr;
      }

      .dynamics-compact .component-kicker,
      .dynamics-compact .dynamic-item {
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .studio-shell {
        display: block;
      }

      .studio-panel {
        position: static;
        height: auto;
      }

      .studio-panel.left {
        display: none;
      }

      .studio-canvas {
        padding: 12px;
      }
    }

    @media (max-width: 600px) {
      .lab-bar {
        top: auto;
        right: 8px;
        bottom: 8px;
        left: 8px;
        overflow-x: auto;
        justify-content: flex-start;
      }

      .lab-bar button {
        min-width: max-content;
      }

      .hero-inner {
        padding-inline: 8px;
      }

      .theme-hanakoi .hero h1 {
        font-size: clamp(40px, 13vw, 60px);
        letter-spacing: 0.04em;
      }

      .hero p {
        font-size: 14px;
      }

      .social-row span {
        min-width: 0;
        padding-inline: 12px;
      }

      .nav-links {
        gap: 0;
      }

      .nav-links a {
        padding-inline: 8px;
        font-size: 12px;
      }

      .article-copy,
      .feed-editorial .article-copy {
        padding: 23px;
      }

      .layout-bento {
        padding-top: 92px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  private selectPreset(index: number) {
    this.layout = structuredClone(layoutPresets[index]);
    this.selectedNodeId = this.layout.root.id;
    this.flippedProfiles.clear();
    this.requestUpdate();
  }

  private selectNode(id: string, event?: Event) {
    event?.stopPropagation();
    if (!this.studio) return;
    this.selectedNodeId = id;
    this.requestUpdate();
  }

  private findNode(node: LayoutNode, id: string): LayoutNode | undefined {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const found = this.findNode(child, id);
      if (found) return found;
    }
    return undefined;
  }

  private moveNode(
    draggedId: string,
    targetId: string,
    position: 'before' | 'inside' | 'after',
  ) {
    if (draggedId === this.layout.root.id || draggedId === targetId) return;
    const dragged = this.findNode(this.layout.root, draggedId);
    const target = this.findNode(this.layout.root, targetId);
    if (!dragged || !target || this.findNode(dragged, targetId)) return;
    if (position === 'inside' && !componentRegistry[target.type].acceptsChildren) {
      position = 'after';
    }
    if (targetId === this.layout.root.id && position !== 'inside') return;

    let detached: LayoutNode | undefined;
    const detach = (node: LayoutNode): LayoutNode => {
      const children: LayoutNode[] = [];
      for (const child of node.children ?? []) {
        if (child.id === draggedId) detached = child;
        else children.push(detach(child));
      }
      return { ...node, children };
    };
    const withoutDragged = detach(this.layout.root);
    if (!detached) return;

    const moving = detached;
    const insert = (node: LayoutNode): LayoutNode => {
      if (node.id === targetId && position === 'inside') {
        return { ...node, children: [...(node.children ?? []).map(insert), moving] };
      }
      const children: LayoutNode[] = [];
      for (const child of node.children ?? []) {
        if (child.id === targetId && position === 'before') children.push(moving);
        children.push(insert(child));
        if (child.id === targetId && position === 'after') children.push(moving);
      }
      return { ...node, children };
    };

    this.layout = { ...this.layout, root: insert(withoutDragged) };
    this.selectedNodeId = draggedId;
    this.draggingNodeId = null;
    this.requestUpdate();
  }

  private dropNode(target: LayoutNode, event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = event.dataTransfer?.getData('text/yukilog-node') || this.draggingNodeId;
    if (!draggedId) return;
    const element = event.currentTarget as HTMLElement;
    const ratio = (event.clientY - element.getBoundingClientRect().top) / element.offsetHeight;
    const acceptsChildren = componentRegistry[target.type].acceptsChildren;
    const position =
      ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : acceptsChildren ? 'inside' : 'after';
    this.moveNode(draggedId, target.id, position);
  }

  private moveSibling(id: string, direction: -1 | 1) {
    let changed = false;
    const visit = (node: LayoutNode): LayoutNode => {
      const children = [...(node.children ?? [])];
      const index = children.findIndex((child) => child.id === id);
      if (index >= 0) {
        const target = index + direction;
        if (target >= 0 && target < children.length) {
          [children[index], children[target]] = [children[target], children[index]];
          changed = true;
        }
        return { ...node, children };
      }
      return { ...node, children: children.map(visit) };
    };
    const root = visit(this.layout.root);
    if (changed) {
      this.layout = { ...this.layout, root };
      this.selectedNodeId = id;
      this.requestUpdate();
    }
  }

  private updateNavigation(navigation: NavigationVariant) {
    this.layout = { ...this.layout, shell: { ...this.layout.shell, navigation } };
    this.requestUpdate();
  }

  private mutateSelected(mutator: (node: LayoutNode) => void) {
    const mutate = (node: LayoutNode): LayoutNode => {
      const next = { ...node, props: { ...node.props } };
      if (node.id === this.selectedNodeId) mutator(next);
      if (node.children) next.children = node.children.map(mutate);
      return next;
    };
    this.layout = { ...this.layout, root: mutate(this.layout.root) };
    this.requestUpdate();
  }

  private setArticleVariant(variant: ArticleVariant) {
    this.mutateSelected((node) => {
      if (node.type === 'article-feed') node.props.variant = variant;
    });
  }

  private setSelectedProperty(name: string, value: unknown) {
    this.mutateSelected((node) => {
      node.props[name] = value;
    });
  }

  private toggleArticleField(field: ArticleField) {
    this.mutateSelected((node) => {
      if (node.type !== 'article-feed') return;
      const fields = new Set((node.props.fields as ArticleField[]) ?? []);
      if (fields.has(field)) fields.delete(field);
      else fields.add(field);
      node.props.fields = [...fields];
    });
  }

  private addComponent(type: ComponentType) {
    const defaults: Partial<Record<ComponentType, Record<string, unknown>>> = {
      card: {
        variant: 'plain',
        padding: 'md',
        radius: 'md',
        shadow: 'soft',
        align: 'stretch',
      },
      avatar: { source: 'site-owner', size: 'lg', shape: 'circle', label: '头像' },
      'text-block': {
        source: 'literal',
        variant: 'body',
        text: '新的文字内容',
        alignment: 'left',
      },
      'social-links': { variant: 'labels', alignment: 'left' },
      'status-line': { text: 'system.log · online', tone: 'online' },
      quote: { text: '新加入的一段引语。', attribution: 'YukiLog' },
      stats: { fields: ['articles', 'dynamics', 'words'], compact: true },
      'dynamic-strip': { limit: 3, variant: 'timeline' },
      'profile-card': { variant: 'compact', flip: true, showSocials: true },
      'article-feed': {
        variant: 'compact',
        fields: ['title', 'date', 'category'],
        columns: 1,
        limit: 5,
      },
      hero: { variant: 'compact', title: '新的首屏', lead: '在属性面板中继续配置。' },
      masthead: { title: '新的刊头', lead: '一段页面说明。', alignment: 'left' },
    };
    const node: LayoutNode = {
      id: `${type}-${Date.now()}`,
      type,
      props: defaults[type] ?? {},
    };
    const selected = this.findNode(this.layout.root, this.selectedNodeId);
    const targetId =
      selected && componentRegistry[selected.type].acceptsChildren
        ? selected.id
        : this.layout.root.id;
    const append = (current: LayoutNode): LayoutNode =>
      current.id === targetId
        ? { ...current, children: [...(current.children ?? []), node] }
        : { ...current, children: current.children?.map(append) };
    this.layout = {
      ...this.layout,
      root: append(this.layout.root),
    };
    this.selectedNodeId = node.id;
    this.requestUpdate();
  }

  private removeSelected() {
    if (this.selectedNodeId === this.layout.root.id) return;
    const remove = (node: LayoutNode): LayoutNode => ({
      ...node,
      children: node.children
        ?.filter((child) => child.id !== this.selectedNodeId)
        .map(remove),
    });
    this.layout = { ...this.layout, root: remove(this.layout.root) };
    this.selectedNodeId = this.layout.root.id;
    this.requestUpdate();
  }

  private renderNavigation() {
    const links = html`
      <div class="nav-links">
        <a href="#home">首页</a>
        <a href="#articles">文章</a>
        <a href="#dynamics">动态</a>
        <a href="#friends">友链</a>
        ${this.layout.shell.showSearch ? html`<a href="#search">搜索</a>` : nothing}
      </div>
    `;
    if (this.layout.shell.navigation === 'sidebar') {
      return html`
        <nav class="site-nav nav-sidebar">
          <div class="brand">YukiLog</div>
          ${links}
          <div class="nav-foot">写给时间的长信<br />RSS · Mail</div>
        </nav>
      `;
    }
    if (this.layout.shell.navigation === 'floating-dock') {
      return html`<nav class="site-nav nav-dock"><div class="brand">Y</div>${links}</nav>`;
    }
    return html`
      <div class="nav-corners${this.navPastHero ? ' hidden' : ''}">
        <div class="brand">YukiLog</div>
        <div class="nav-corner-actions"><span>⌕</span><span>☰</span></div>
      </div>
      <nav
        class="site-nav nav-topbar${this.navPastHero ? ' sticky' : ''}${this.navRevealed
          ? ' revealed'
          : ''}"
      >
        <div class="brand">YukiLog</div>
        ${links}
      </nav>
    `;
  }

  private renderNode(node: LayoutNode): unknown {
    const definition = componentRegistry[node.type];
    const selected = this.studio && node.id === this.selectedNodeId;
    const base = `node node-${node.type}${selected ? ' selected' : ''}`;
    const click = (event: Event) => this.selectNode(node.id, event);

    if (definition.acceptsChildren) {
      const gap = typeof node.props.gap === 'string' ? ` gap-${node.props.gap}` : '';
      const align = typeof node.props.align === 'string' ? ` align-${node.props.align}` : '';
      const sticky = node.props.sticky ? ' is-sticky' : '';
      const columns =
        node.type === 'grid' && node.props.columns === '240px minmax(0, 1fr) 240px'
          ? ' grid-three-rail'
          : node.type === 'grid' && node.props.columns === '280px minmax(0, 1fr)'
            ? ' grid-aside-first'
            : '';
      const maxWidth =
        node.props.maxWidth === 'full'
          ? ' max-full'
          : node.props.maxWidth === '1240px'
            ? ' max-1240'
            : '';
      const card =
        node.type === 'card'
          ? [
              ` card-${String(node.props.variant ?? 'plain')}`,
              ` padding-${String(node.props.padding ?? 'md')}`,
              ` radius-${String(node.props.radius ?? 'md')}`,
              ` shadow-${String(node.props.shadow ?? 'none')}`,
              ` align-${String(node.props.align ?? 'stretch')}`,
            ].join('')
          : '';
      return html`
        <section
          class="${base} layout-${node.type}${gap}${align}${sticky}${columns}${maxWidth}${card}"
          data-label="${definition.label}"
          data-node-id="${node.id}"
          .draggable=${this.studio && node.id !== this.layout.root.id}
          @dragstart=${(event: DragEvent) => {
            this.draggingNodeId = node.id;
            event.dataTransfer?.setData('text/yukilog-node', node.id);
          }}
          @dragover=${(event: DragEvent) => event.preventDefault()}
          @drop=${(event: DragEvent) => this.dropNode(node, event)}
          @click=${click}
        >
          ${node.children?.map((child) => this.renderNode(child))}
        </section>
      `;
    }

    switch (node.type) {
      case 'hero':
        return this.renderHero(node, base, click);
      case 'masthead':
        return this.renderMasthead(node, base, click);
      case 'avatar':
        return html`
          <div
            class="${base} primitive-avatar avatar-${String(node.props.size ?? 'md')} avatar-${String(
              node.props.shape ?? 'circle',
            )}"
            data-label="头像"
            @click=${click}
          >
            雪
          </div>
        `;
      case 'text-block':
        return this.renderTextBlock(node, base, click);
      case 'social-links':
        return html`
          <nav
            class="${base} primitive-socials socials-${String(
              node.props.variant ?? 'labels',
            )} text-${String(node.props.alignment ?? 'left')}"
            data-label="社交链接"
            @click=${click}
          >
            <a href="#github">GitHub</a><a href="#rss">RSS</a><a href="#mail">Mail</a>
          </nav>
        `;
      case 'status-line':
        return html`
          <div
            class="${base} primitive-status status-${String(node.props.tone ?? 'neutral')}"
            data-label="状态行"
            @click=${click}
          >
            ${String(node.props.text ?? '')}
          </div>
        `;
      case 'profile-card':
        return this.renderProfile(node, base, click);
      case 'article-feed':
        return this.renderArticleFeed(node, base, click);
      case 'quote':
        return html`
          <aside class="${base} quote-card" data-label="引语" @click=${click}>
            “${String(node.props.text ?? '')}”
            <cite>— ${String(node.props.attribution ?? '')}</cite>
          </aside>
        `;
      case 'stats':
        {
          const fields = new Set((node.props.fields as string[]) ?? []);
          const available = [
            ['articles', '42', '文章'],
            ['dynamics', '128', '动态'],
            ['words', '19万', '字'],
          ] as const;
        return html`
          <section class="${base} stats-card" data-label="站点数据" @click=${click}>
            <p class="component-kicker">Site archive</p>
            <div class="stats-grid">
                ${available
                  .filter(([field]) => fields.size === 0 || fields.has(field))
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
        return html`
            <section
              class="${base} dynamic-strip dynamics-${variant}"
              data-label="最近动态"
              @click=${click}
            >
            <p class="component-kicker">Recent moments</p>
              ${dynamics
                .slice(0, Math.max(1, limit))
                .map(
                  (item, index) =>
                    html`<div class="dynamic-item">
                      <time>${String(index + 1).padStart(2, '0')}</time><span>${item}</span>
                    </div>`,
                )}
          </section>
        `;
        }
      default:
        return nothing;
    }
  }

  private renderHero(node: LayoutNode, base: string, click: (event: Event) => void) {
    const variant = String(node.props.variant ?? 'cinematic');
    const title = String(node.props.title ?? '');
    const details = html`
      <p>${String(node.props.lead ?? '')}</p>
      ${node.props.showSocials
        ? html`<div class="social-row"><span>GitHub</span><span>Mail</span><span>RSS</span></div>`
        : nothing}
    `;
    return html`
      <section
        class="${base} hero hero-${variant}"
        data-label="沉浸式首屏"
        data-node-id="${node.id}"
        @click=${click}
      >
        <div class="hero-inner">
          <p class="component-kicker">YukiLog · 写给时间的长信</p>
          <h1>
            ${variant === 'cinematic'
              ? [...title].map(
                  (character, index) =>
                    html`<span class="hero-character" style="--char-index:${index}"
                      >${character}</span
                    >`,
                )
              : title}
          </h1>
          ${variant === 'cinematic' ? html`<div class="hero-info">${details}</div>` : details}
          ${node.props.showEnter
            ? html`<button
                class="enter-button"
                aria-label="进入文章区域"
                @click=${(event: Event) => {
                  event.stopPropagation();
                  this.renderRoot
                    .querySelector('.layout-split')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                进入主页 ↓
              </button>`
            : nothing}
        </div>
      </section>
    `;
  }

  private renderMasthead(node: LayoutNode, base: string, click: (event: Event) => void) {
    const variant = String(node.props.variant ?? 'editorial');
    return html`
      <header
        class="${base} masthead masthead-${variant}"
        data-label="文字刊头"
        data-node-id="${node.id}"
        @click=${click}
      >
        <p class="kicker">YukiLog · Vol. 01</p>
        <h1>${String(node.props.title ?? '')}</h1>
        <p class="lead">${String(node.props.lead ?? '')}</p>
      </header>
    `;
  }

  private renderTextBlock(node: LayoutNode, base: string, click: (event: Event) => void) {
    const source = String(node.props.source ?? 'literal');
    const text =
      {
        'owner-name': 'Sakurine',
        'owner-bio': '写代码，也收藏深夜、长风和那些不肯消失的心动。',
        'site-title': 'YukiLog',
        'site-description': '写给时间的长信。',
      }[source] ?? String(node.props.text ?? '');
    const variant = String(node.props.variant ?? 'body');
    return html`
      <div
        class="${base} primitive-text text-${variant} text-${String(
          node.props.alignment ?? 'left',
        )}"
        data-label="文字块"
        @click=${click}
      >
        ${text}
      </div>
    `;
  }

  private renderProfile(node: LayoutNode, base: string, click: (event: Event) => void) {
    const flipped = this.flippedProfiles.has(node.id);
    const variant = String(node.props.variant ?? 'portrait');
    const canFlip = node.props.flip !== false;
    return html`
      <section
        class="${base} profile-card profile-${variant}"
        data-label="双面个人卡"
        data-node-id="${node.id}"
        @click=${click}
      >
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

  private renderArticleFeed(node: LayoutNode, base: string, click: (event: Event) => void) {
    const variant = String(node.props.variant ?? 'compact');
    const fields = new Set((node.props.fields as ArticleField[]) ?? []);
    const limit = Number(node.props.limit ?? articles.length);
    const sortedArticles =
      node.props.sort === 'popular'
        ? [...articles].sort((left, right) => right.likes - left.likes)
        : articles;
    return html`
      <section
        class="${base} article-feed feed-${variant}"
        data-label="文章列表 · ${variant}"
        data-node-id="${node.id}"
        @click=${click}
      >
        ${sortedArticles.slice(0, Math.max(1, limit)).map(
          (article) => html`
            <article class="article">
              ${fields.has('cover')
                ? html`<div class="article-cover ${article.cover}" role="img"></div>`
                : nothing}
              <div class="article-copy">
                ${fields.has('date') ? html`<time>${article.date}</time>` : nothing}
                <h3>${article.title}</h3>
                ${fields.has('summary') ? html`<p>${article.summary}</p>` : nothing}
                <div class="meta-row">
                  ${fields.has('category')
                    ? html`<span class="meta-pill">${article.category}</span>`
                    : nothing}
                  ${fields.has('tags')
                    ? article.tags.map((tag) => html`<span class="meta-pill"># ${tag}</span>`)
                    : nothing}
                  ${fields.has('views') || fields.has('likes')
                    ? html`<span class="article-metrics">
                        ${fields.has('views') ? `${article.views} 阅读` : ''}
                        ${fields.has('likes') ? `${article.likes} 喜欢` : ''}
                      </span>`
                    : nothing}
                </div>
              </div>
            </article>
          `,
        )}
      </section>
    `;
  }

  private renderSite() {
    return html`
      <div
        class="site theme-${this.layout.theme} shell-${this.layout.shell.navigation}"
      >
        ${this.renderNavigation()}
        <div class="page-root">${this.renderNode(this.layout.root)}</div>
      </div>
    `;
  }

  private renderPalette() {
    const groups = ['layout', 'content', 'decoration'] as const;
    return html`
      <aside class="studio-panel left">
        <h2>组件库</h2>
        ${groups.map(
          (group) => html`
            <section class="palette-group">
              <h3>${group}</h3>
              ${Object.values(componentRegistry)
                .filter((definition) => definition.group === group)
                .map(
                  (definition) => html`
                    <button
                      class="palette-item"
                      @click=${() => this.addComponent(definition.type)}
                      title="加入当前页面根区域"
                    >
                      ＋ ${definition.label}
                    </button>
                  `,
                )}
            </section>
          `,
        )}
      </aside>
    `;
  }

  private renderTreeNode(node: LayoutNode, depth = 0): unknown {
    const selected = node.id === this.selectedNodeId;
    const movable = node.id !== this.layout.root.id;
    return html`
      <div
        class="tree-row${this.draggingNodeId === node.id ? ' dragging' : ''}"
        .draggable=${movable}
        @dragstart=${(event: DragEvent) => {
          if (!movable) return;
          this.draggingNodeId = node.id;
          event.dataTransfer?.setData('text/yukilog-node', node.id);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        }}
        @dragend=${() => {
          this.draggingNodeId = null;
          this.requestUpdate();
        }}
        @dragover=${(event: DragEvent) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        }}
        @drop=${(event: DragEvent) => this.dropNode(node, event)}
      >
        <button
          class="tree-item"
          aria-pressed=${selected}
          @click=${() => this.selectNode(node.id)}
        >
          <span class="tree-depth">${'· '.repeat(depth)}</span>${componentRegistry[node.type].label}
        </button>
        ${movable
          ? html`<span class="tree-actions">
              <button aria-label="上移组件" @click=${() => this.moveSibling(node.id, -1)}>↑</button>
              <button aria-label="下移组件" @click=${() => this.moveSibling(node.id, 1)}>↓</button>
            </span>`
          : nothing}
      </div>
      ${node.children?.map((child) => this.renderTreeNode(child, depth + 1))}
    `;
  }

  private renderInspector() {
    const nodes = flattenLayout(this.layout.root);
    const selected = nodes.find((node) => node.id === this.selectedNodeId) ?? this.layout.root;
    const definition = componentRegistry[selected.type];
    const errors = validateLayout(this.layout);
    const fields = new Set((selected.props.fields as ArticleField[]) ?? []);

    return html`
      <aside class="studio-panel right">
        <h2>页面结构</h2>
        <div class="inspector-section">
          <p class="tree-help">拖动节点：上部插入之前，中部放入容器，下部插入之后。</p>
          ${this.renderTreeNode(this.layout.root)}
        </div>

        <h2>属性 · ${definition.label}</h2>
        <section class="inspector-section">
          <label>全局导航组件</label>
          <div class="segmented">
            ${(['topbar', 'sidebar', 'floating-dock'] as NavigationVariant[]).map(
              (navigation) => html`
                <button
                  aria-pressed=${this.layout.shell.navigation === navigation}
                  @click=${() => this.updateNavigation(navigation)}
                >
                  ${navigationLabels[navigation]}
                </button>
              `,
            )}
          </div>
        </section>

        ${selected.type === 'card'
          ? html`
              <section class="inspector-section">
                <label>卡片外观</label>
                <div class="segmented">
                  ${(['plain', 'glass', 'outlined', 'paper'] as const).map(
                    (variant) => html`
                      <button
                        aria-pressed=${selected.props.variant === variant}
                        @click=${() => this.setSelectedProperty('variant', variant)}
                      >
                        ${variant}
                      </button>
                    `,
                  )}
                </div>
              </section>
              <section class="inspector-section">
                <label>阴影</label>
                <div class="segmented">
                  ${(['none', 'soft', 'blue', 'pink'] as const).map(
                    (shadow) => html`
                      <button
                        aria-pressed=${selected.props.shadow === shadow}
                        @click=${() => this.setSelectedProperty('shadow', shadow)}
                      >
                        ${shadow}
                      </button>
                    `,
                  )}
                </div>
              </section>
              <section class="inspector-section">
                <label>内边距</label>
                <div class="segmented">
                  ${(['none', 'sm', 'md', 'lg', 'xl'] as const).map(
                    (padding) => html`
                      <button
                        aria-pressed=${selected.props.padding === padding}
                        @click=${() => this.setSelectedProperty('padding', padding)}
                      >
                        ${padding}
                      </button>
                    `,
                  )}
                </div>
              </section>
            `
          : nothing}

        ${selected.type === 'article-feed'
          ? html`
              <section class="inspector-section">
                <label>卡片排版</label>
                <div class="segmented">
                  ${(['alternating', 'editorial', 'cover-overlay', 'compact'] as ArticleVariant[]).map(
                    (variant) => html`
                      <button
                        aria-pressed=${selected.props.variant === variant}
                        @click=${() => this.setArticleVariant(variant)}
                      >
                        ${variant}
                      </button>
                    `,
                  )}
                </div>
              </section>
              <section class="inspector-section">
                <label>卡片显示字段</label>
                <div class="segmented">
                  ${(
                    [
                      'cover',
                      'summary',
                      'date',
                      'category',
                      'tags',
                      'views',
                      'likes',
                    ] as ArticleField[]
                  ).map(
                    (field) => html`
                      <button
                        aria-pressed=${fields.has(field)}
                        @click=${() => this.toggleArticleField(field)}
                      >
                        ${field}
                      </button>
                    `,
                  )}
                </div>
              </section>
            `
          : nothing}

        <section class="inspector-section">
          <button class="inspector-button" @click=${this.removeSelected}>删除所选组件</button>
        </section>
        <section class="inspector-section">
          <div class="validation-ok">
            ${errors.length === 0 ? '布局 schema 校验通过' : errors.join('；')}
          </div>
        </section>
        <details>
          <summary>查看布局 JSON</summary>
          <pre class="layout-json">${JSON.stringify(this.layout, null, 2)}</pre>
        </details>
      </aside>
    `;
  }

  private renderStudio() {
    return html`
      <div class="studio-shell">
        ${this.renderPalette()}
        <main class="studio-canvas">
          <div class="studio-preview">${this.renderSite()}</div>
        </main>
        ${this.renderInspector()}
      </div>
    `;
  }

  protected render() {
    return html`
      <nav class="lab-bar" aria-label="布局实验室">
        <span class="lab-title">布局实验室</span>
        ${layoutPresets.map(
          (preset, index) => html`
            <button
              aria-pressed=${this.layout.id === preset.id}
              @click=${() => this.selectPreset(index)}
            >
              ${preset.label}
            </button>
          `,
        )}
        <span class="lab-spacer"></span>
        <button
          class="mode-button"
          aria-pressed=${this.studio}
          @click=${() => {
            this.studio = !this.studio;
            this.requestUpdate();
          }}
        >
          ${this.studio ? '返回页面' : '布局工作室'}
        </button>
      </nav>
      ${this.studio ? this.renderStudio() : this.renderSite()}
    `;
  }
}

customElements.define('yuki-app', YukiApp);

declare global {
  interface HTMLElementTagNameMap {
    'yuki-app': YukiApp;
  }
}
