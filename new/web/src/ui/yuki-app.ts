import { LitElement, css, html, nothing } from 'lit';
import { componentRegistry, flattenLayout, validateLayout } from '../layout/registry.js';
import { layoutPresets } from '../layout/presets.js';
import type {
  ArticleField,
  ArticleVariant,
  ComponentType,
  LayoutDocument,
  LayoutNode,
  NavigationVariant,
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
      top: 12px;
      left: 50%;
      display: flex;
      width: min(920px, calc(100% - 24px));
      align-items: center;
      gap: 6px;
      padding: 7px;
      transform: translateX(-50%);
      border: 1px solid rgb(255 255 255 / 15%);
      border-radius: 17px;
      background: rgb(12 17 25 / 88%);
      box-shadow: 0 14px 40px rgb(0 0 0 / 24%);
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
    }

    .site-nav {
      z-index: 50;
    }

    .nav-topbar {
      position: fixed;
      top: 66px;
      left: 50%;
      display: flex;
      width: min(1120px, calc(100% - 32px));
      height: 54px;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      transform: translateX(-50%);
      border: 1px solid rgb(255 255 255 / 18%);
      border-radius: 18px;
      background: rgb(18 26 40 / 34%);
      color: white;
      backdrop-filter: blur(16px);
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
    }

    .nav-sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      display: flex;
      width: 238px;
      flex-direction: column;
      padding: 94px 28px 34px;
      border-right: 1px solid var(--line);
      background: color-mix(in srgb, var(--surface) 94%, transparent);
    }

    .nav-sidebar .nav-links {
      align-items: stretch;
      flex-direction: column;
      margin-top: 48px;
    }

    .nav-sidebar .nav-links a {
      border-radius: 4px;
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
    }

    .nav-dock .nav-links a::first-letter {
      font-size: 14px;
    }

    .page-root {
      min-height: 100dvh;
    }

    .layout-stack {
      display: flex;
      flex-direction: column;
      gap: var(--node-gap, 0);
    }

    .layout-grid {
      display: grid;
      width: min(1120px, calc(100% - 48px));
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 56px;
      margin: 0 auto;
      padding: 130px 0 120px;
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
        radial-gradient(circle at 74% 24%, rgb(239 194 203 / 66%), transparent 18%),
        linear-gradient(155deg, #192b43, #526f8d 44%, #a8bac6 68%, #d9aeb7);
    }

    .theme-hanakoi .hero::after {
      z-index: -1;
      background: linear-gradient(180deg, rgb(6 14 28 / 12%), rgb(6 14 28 / 46%));
    }

    .hero-inner {
      width: min(720px, calc(100% - 36px));
      padding: 150px 0 100px;
      text-align: center;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(44px, 8vw, 78px);
      line-height: 1.15;
      letter-spacing: 0.06em;
      text-shadow: 0 8px 30px rgb(0 0 0 / 24%);
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

    .enter-button {
      margin-top: 26px;
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

    .profile-compact {
      position: relative;
      top: auto;
      height: 100%;
    }

    .profile-compact .profile-button,
    .profile-compact .profile-face {
      min-height: 100%;
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
    }

    .article-cover {
      min-height: 210px;
      background: var(--cover);
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

    .feed-alternating .article:nth-child(even) {
      grid-template-columns: 58% 42%;
    }

    .feed-alternating .article:nth-child(even) .article-cover {
      order: 2;
    }

    .feed-editorial {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      border-top: 1px solid var(--line);
      border-left: 1px solid var(--line);
    }

    .feed-editorial .article {
      min-height: 290px;
      border-width: 0 1px 1px 0;
      border-radius: 0;
      background: color-mix(in srgb, var(--surface) 90%, transparent);
    }

    .feed-editorial .article-copy {
      padding: 34px;
    }

    .feed-editorial .article h3 {
      font-family: var(--serif);
      font-size: 26px;
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

    .quote-card,
    .stats-card,
    .dynamic-strip {
      padding: 26px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
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
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }

    .dynamic-item:last-child {
      border-bottom: 0;
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
        top: 64px;
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
    this.layout = {
      ...this.layout,
      root: {
        ...this.layout.root,
        children: [...(this.layout.root.children ?? []), node],
      },
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
    return html`<nav class="site-nav nav-topbar"><div class="brand">YukiLog</div>${links}</nav>`;
  }

  private renderNode(node: LayoutNode): unknown {
    const definition = componentRegistry[node.type];
    const selected = this.studio && node.id === this.selectedNodeId;
    const base = `node node-${node.type}${selected ? ' selected' : ''}`;
    const click = (event: Event) => this.selectNode(node.id, event);

    if (definition.acceptsChildren) {
      return html`
        <section
          class="${base} layout-${node.type}"
          data-label="${definition.label}"
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
        return html`
          <section class="${base} stats-card" data-label="站点数据" @click=${click}>
            <p class="component-kicker">Site archive</p>
            <div class="stats-grid">
              <div class="stat"><strong>42</strong><span>文章</span></div>
              <div class="stat"><strong>128</strong><span>动态</span></div>
              <div class="stat"><strong>19万</strong><span>字</span></div>
            </div>
          </section>
        `;
      case 'dynamic-strip':
        return html`
          <section class="${base} dynamic-strip" data-label="最近动态" @click=${click}>
            <p class="component-kicker">Recent moments</p>
            <div class="dynamic-item">雨停以后，窗沿留下了一小段很亮的晚霞。</div>
            <div class="dynamic-item">重新整理了书桌，也重新整理了一些念头。</div>
            <div class="dynamic-item">正在为新的 YukiLog 选择它应有的样子。</div>
          </section>
        `;
      default:
        return nothing;
    }
  }

  private renderHero(node: LayoutNode, base: string, click: (event: Event) => void) {
    const variant = String(node.props.variant ?? 'cinematic');
    return html`
      <section
        class="${base} hero hero-${variant}"
        data-label="沉浸式首屏"
        @click=${click}
      >
        <div class="hero-inner">
          <p class="component-kicker">YukiLog · 写给时间的长信</p>
          <h1>${String(node.props.title ?? '')}</h1>
          <p>${String(node.props.lead ?? '')}</p>
          ${node.props.showSocials
            ? html`<div class="social-row"><span>GitHub</span><span>Mail</span><span>RSS</span></div>`
            : nothing}
          ${node.props.showEnter
            ? html`<button
                class="enter-button"
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
    return html`
      <header class="${base} masthead" data-label="文字刊头" @click=${click}>
        <p class="kicker">YukiLog · Vol. 01</p>
        <h1>${String(node.props.title ?? '')}</h1>
        <p class="lead">${String(node.props.lead ?? '')}</p>
      </header>
    `;
  }

  private renderProfile(node: LayoutNode, base: string, click: (event: Event) => void) {
    const flipped = this.flippedProfiles.has(node.id);
    const compact = node.props.variant === 'compact' ? ' profile-compact' : '';
    return html`
      <section class="${base} profile-card${compact}" data-label="双面个人卡" @click=${click}>
        <button
          class="profile-button"
          aria-label="翻转个人卡片"
          aria-pressed=${flipped}
          @click=${(event: Event) => {
            event.stopPropagation();
            if (flipped) this.flippedProfiles.delete(node.id);
            else this.flippedProfiles.add(node.id);
            this.requestUpdate();
          }}
        >
          <span class="profile-face">
            <span class="avatar" aria-hidden="true">雪</span>
            <h2>Sakurine</h2>
            <p>写代码，也收集深夜、长风和那些不肯消失的心动。</p>
            <span class="profile-hint">轻触卡片，读另一面</span>
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
    return html`
      <section
        class="${base} article-feed feed-${variant}"
        data-label="文章列表 · ${variant}"
        @click=${click}
      >
        ${articles.map(
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
          ${nodes.map(
            (node) => html`
              <button
                class="tree-item"
                aria-pressed=${node.id === selected.id}
                @click=${() => this.selectNode(node.id)}
              >
                ${componentRegistry[node.type].label}
              </button>
            `,
          )}
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
