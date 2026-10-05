import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { store } from './store.js';
import { adminTheme } from './theme.js';
import './components/index.js';
import './views/dashboard.js';
import './views/articles.js';
import './views/article-edit.js';
import './views/dynamics.js';
import './views/dynamic-edit.js';
import './views/taxonomy.js';
import './views/comments.js';
import './views/media.js';
import './views/friends.js';
import './views/settings.js';
import './views/studio.js';
import './views/notifications.js';
import './views/subscriptions.js';

type Route =
  | { name: 'dashboard' }
  | { name: 'articles' }
  | { name: 'article-edit'; id: string | null }
  | { name: 'dynamics' }
  | { name: 'dynamic-edit'; id: string | null }
  | { name: 'taxonomy' }
  | { name: 'comments' }
  | { name: 'media' }
  | { name: 'friends' }
  | { name: 'settings' }
  | { name: 'studio' }
  | { name: 'notifications' }
  | { name: 'subscriptions' };

const NAV: Array<{ key: string; label: string; href: string; icon: string }> = [
  { key: 'dashboard', label: '概览', href: '#/', icon: 'M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-11h6V4h-6v5Z' },
  { key: 'articles', label: '文章', href: '#/articles', icon: 'M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 1.5V9h4.5M9 13h7M9 17h7' },
  { key: 'dynamics', label: '动态', href: '#/dynamics', icon: 'M12 21c-4.4-3.1-8-6.3-8-9.7C4 8.4 6.2 6.5 8.7 6.5c1.4 0 2.6.7 3.3 1.7.7-1 1.9-1.7 3.3-1.7 2.5 0 4.7 1.9 4.7 4.8 0 3.4-3.6 6.6-8 9.7Z' },
  { key: 'taxonomy', label: '分类与标签', href: '#/taxonomy', icon: 'M4 4h7l9 9-7 7-9-9V4Zm4.5 4.5a1.5 1.5 0 1 0 0 .01' },
  { key: 'comments', label: '评论', href: '#/comments', icon: 'M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12Z' },
  { key: 'media', label: '媒体', href: '#/media', icon: 'M4 5h16v14H4V5Zm4 5a2 2 0 1 0 0-.01M4 17l5-4 4 3 3-2 4 3' },
  { key: 'friends', label: '友链', href: '#/friends', icon: 'M10 14a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7-7.1l-1.5 1.5M14 10a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7 7.1l1.5-1.5' },
  { key: 'settings', label: '站点设置', href: '#/settings', icon: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2-1.2L15 3h-4l-.5 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a8 8 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2 1.2L11 21h4l.5-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6a8 8 0 0 0 .1-1.2Z' },
  { key: 'studio', label: '布局工作室', href: '#/studio', icon: 'M4 4h7v7H4V4Zm9 0h7v4h-7V4Zm0 6h7v10h-7V10ZM4 13h7v7H4v-7Z' },
  { key: 'notifications', label: '消息', href: '#/notifications', icon: 'M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Zm-8.3 10a2.5 2.5 0 0 0 4.6 0' },
  { key: 'subscriptions', label: '订阅与投递', href: '#/subscriptions', icon: 'M4 5h16v14H4V5Zm0 1 8 6 8-6' },
];

function parseHash(): Route {
  let hash = location.hash.replace(/^#/, '');
  // 兼容旧通知深链 /admin#comments 与裸段
  hash = hash.replace(/^\/?admin#?/, '/');
  const parts = hash.split('/').filter(Boolean);
  const [head, second] = parts;
  switch (head) {
    case undefined: return { name: 'dashboard' };
    case 'articles':
      if (second === 'new') return { name: 'article-edit', id: null };
      if (second) return { name: 'article-edit', id: second };
      return { name: 'articles' };
    case 'dynamics':
      if (second === 'new') return { name: 'dynamic-edit', id: null };
      if (second) return { name: 'dynamic-edit', id: second };
      return { name: 'dynamics' };
    case 'taxonomy': return { name: 'taxonomy' };
    case 'comments': return { name: 'comments' };
    case 'media': return { name: 'media' };
    case 'friends': return { name: 'friends' };
    case 'settings': return { name: 'settings' };
    case 'studio': case 'layouts': return { name: 'studio' };
    case 'notifications': return { name: 'notifications' };
    case 'subscriptions': return { name: 'subscriptions' };
    default: return { name: 'dashboard' };
  }
}

export class YukiAdmin extends LitElement {
  @state() private route: Route = parseHash();
  @state() private checkingSession = true;
  @state() private loginError = '';

  static styles = [
    adminTheme,
    css`
      :host {
        display: block;
        min-height: 100dvh;
        background: var(--bg);
        color: var(--ink);
        font: 14px/1.6 Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
      }

      /* ---------- 登录 ---------- */
      .login {
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 1rem;
        background:
          radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 42%),
          radial-gradient(circle at 82% 82%, color-mix(in srgb, var(--secondary) 20%, transparent), transparent 45%),
          var(--bg);
      }

      .login form {
        display: grid;
        gap: 14px;
        width: min(380px, 100%);
        padding: 34px 32px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: color-mix(in srgb, var(--surface) 88%, transparent);
        box-shadow: 0 24px 70px -24px rgb(28 39 51 / 25%);
        backdrop-filter: blur(18px);
      }

      .login .brand {
        margin: 0;
        font-family: var(--serif);
        font-size: 26px;
        font-weight: 700;
      }

      .login .sub {
        margin: -8px 0 6px;
        color: var(--faint);
        font-size: 12.5px;
      }

      .login .err {
        margin: 0;
        color: var(--danger);
        font-size: 12.5px;
      }

      .preview-entry {
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--faint);
        font-size: 12.5px;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .preview-entry:hover {
        color: var(--primary-d);
      }

      /* ---------- 壳层 ---------- */
      .shell {
        display: grid;
        grid-template-columns: 232px minmax(0, 1fr);
        min-height: 100dvh;
      }

      aside {
        position: sticky;
        top: 0;
        display: flex;
        flex-direction: column;
        height: 100dvh;
        padding: 20px 14px;
        background: #182233;
        color: #cdd8e6;
        overflow: auto;
      }

      .brand {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 6px 10px 18px;
      }

      .brand strong {
        font-family: var(--serif);
        font-size: 21px;
        color: #f2f6fb;
      }

      .brand span {
        color: #6d7f96;
        font-family: var(--mono);
        font-size: 12px;
      }

      nav {
        display: grid;
        gap: 3px;
        flex: 1;
      }

      nav a {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 9px 12px;
        border-radius: 10px;
        color: #9fb0c6;
        font-size: 14.5px;
        text-decoration: none;
        transition:
          background 200ms ease,
          color 200ms ease;
      }

      nav a:hover {
        background: #ffffff10;
        color: #e8eef7;
      }

      nav a.active {
        background: color-mix(in srgb, var(--primary) 22%, transparent);
        color: #fff;
      }

      nav svg {
        width: 17px;
        height: 17px;
        flex: none;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.85;
      }

      nav .unread {
        margin-left: auto;
        min-width: 19px;
        padding: 1px 6px;
        border-radius: 999px;
        background: var(--secondary-d);
        color: #fff;
        font-size: 12px;
        text-align: center;
      }

      .me {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 14px;
        padding: 12px 10px 4px;
        border-top: 1px solid #ffffff14;
      }

      .me .who {
        flex: 1;
        min-width: 0;
      }

      .me .who b {
        display: block;
        color: #e8eef7;
        font-size: 13px;
      }

      .me .who span {
        color: #6d7f96;
        font-size: 11.5px;
      }

      .me button {
        padding: 5px 12px;
        border: 1px solid #ffffff22;
        border-radius: 999px;
        background: transparent;
        color: #9fb0c6;
        font-size: 12px;
      }

      .me button:hover {
        border-color: var(--secondary);
        color: #fff;
      }

      main {
        min-width: 0;
        padding: 26px 30px 60px;
      }

      .topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 20px;
      }

      .topline h1 {
        margin: 0;
        font-family: var(--serif);
        font-size: 24px;
        font-weight: 700;
      }

      .preview-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
        padding: 10px 16px;
        border: 1px solid #f0c674;
        border-radius: 12px;
        background: #fdf3d7;
        color: #7a5410;
        font-size: 12.5px;
      }

      @media (max-width: 900px) {
        .shell {
          grid-template-columns: 1fr;
        }
        aside {
          position: static;
          height: auto;
        }
        main {
          padding: 18px 16px 60px;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.onHash);
    store.addEventListener('change', this.onStore);
    void store.restoreSession().catch((error: unknown) => {
      this.loginError = error instanceof Error ? error.message : '无法连接服务器';
    }).finally(() => {
      this.checkingSession = false;
    });
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.onHash);
    store.removeEventListener('change', this.onStore);
    super.disconnectedCallback();
  }

  private onHash = () => {
    this.route = parseHash();
  };

  private onStore = () => this.requestUpdate();

  private async login(event: SubmitEvent) {
    event.preventDefault();
    this.loginError = '';
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const before = store.admin;
    await store.login(data.get('username'), data.get('password'));
    if (!store.admin && !before) this.loginError = '登录失败，请检查用户名和密码';
  }

  private renderLogin() {
    return html`
      <section class="login">
        <form @submit=${this.login}>
          <p class="brand">YukiLog</p>
          <p class="sub">管理台 · 欢迎回来</p>
          <label class="field"><span>用户名</span><input name="username" required autocomplete="username" /></label>
          <label class="field"><span>密码</span><input name="password" type="password" required autocomplete="current-password" /></label>
          ${this.loginError ? html`<p class="err">${this.loginError}</p>` : nothing}
          <button class="btn primary" ?disabled=${store.busy}>登录</button>
          ${import.meta.env.DEV
            ? html`<button type="button" class="preview-entry" @click=${() => store.enterPreview()}>
                不登录，先看看界面 →
              </button>`
            : nothing}
        </form>
      </section>
      <adm-toast-host></adm-toast-host>
    `;
  }

  private activeNav(): string {
    switch (this.route.name) {
      case 'article-edit': return 'articles';
      case 'dynamic-edit': return 'dynamics';
      default: return this.route.name;
    }
  }

  private viewTitle(): string {
    switch (this.route.name) {
      case 'article-edit': return this.route.id ? '编辑文章' : '新文章';
      case 'dynamic-edit': return this.route.id ? '编辑动态' : '新动态';
      default: return NAV.find((item) => item.key === this.activeNav())?.label ?? '';
    }
  }

  private renderView(): TemplateResult {
    switch (this.route.name) {
      case 'dashboard': return html`<adm-dashboard .store=${store}></adm-dashboard>`;
      case 'articles': return html`<adm-articles .store=${store}></adm-articles>`;
      case 'article-edit': return html`<adm-article-edit .store=${store} .articleId=${this.route.id}></adm-article-edit>`;
      case 'dynamics': return html`<adm-dynamics .store=${store}></adm-dynamics>`;
      case 'dynamic-edit': return html`<adm-dynamic-edit .store=${store} .dynamicId=${this.route.id}></adm-dynamic-edit>`;
      case 'taxonomy': return html`<adm-taxonomy .store=${store}></adm-taxonomy>`;
      case 'comments': return html`<adm-comments .store=${store}></adm-comments>`;
      case 'media': return html`<adm-media .store=${store}></adm-media>`;
      case 'friends': return html`<adm-friends .store=${store}></adm-friends>`;
      case 'settings': return html`<adm-settings .store=${store}></adm-settings>`;
      case 'studio': return html`<adm-studio .store=${store}></adm-studio>`;
      case 'notifications': return html`<adm-notifications .store=${store}></adm-notifications>`;
      case 'subscriptions': return html`<adm-subscriptions .store=${store}></adm-subscriptions>`;
    }
  }

  private renderShell() {
    const active = this.activeNav();
    const unread = store.unreadNotifications;
    return html`
      <div class="shell">
        <aside>
          <div class="brand"><strong>YukiLog</strong><span>ADMIN</span></div>
          <nav>
            ${NAV.map(
              (item) => html`
                <a href=${item.href} class=${item.key === active ? 'active' : ''}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d=${item.icon} /></svg>
                  ${item.label}
                  ${item.key === 'notifications' && unread
                    ? html`<span class="unread">${unread}</span>`
                    : nothing}
                </a>
              `,
            )}
          </nav>
          <div class="me">
            <div class="who"><b>${store.admin?.display_name}</b><span>@${store.admin?.username}</span></div>
            <button @click=${() => store.logout()}>退出</button>
          </div>
        </aside>
        <main>
          <div class="topline">
            <h1>${this.viewTitle()}</h1>
            <button class="btn secondary small" @click=${() => store.run(() => store.refreshAll(), '数据已刷新')}>
              刷新
            </button>
          </div>
          ${store.previewMode
            ? html`<div class="preview-banner">预览模式 · 后端未连接，数据是假的，改动不会保存</div>`
            : nothing}
          ${this.renderView()}
        </main>
      </div>
      <adm-toast-host></adm-toast-host>
      <adm-modal-host></adm-modal-host>
    `;
  }

  protected render() {
    if (this.checkingSession) {
      return html`<section class="login"><p class="sub">正在检查会话…</p></section>`;
    }
    return store.admin ? this.renderShell() : this.renderLogin();
  }
}

customElements.define('yuki-admin', YukiAdmin);
