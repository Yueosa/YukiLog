import { css } from 'lit';

/** YukiApp 全量样式（从 yuki-app.ts 抽出，保持类名与挂载点不变）。 */
export const appStyles = css`
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
      width: 148px;
      flex: 0 0 148px;
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
