import { LitElement, css, html, nothing } from 'lit';
import { api, ApiError } from '../admin/api.js';
import type {
  Admin,
  AdminNotification,
  Article,
  Category,
  Comment,
  Delivery,
  Dynamic,
  FriendLink,
  LayoutRecord,
  MediaAsset,
  NotificationSettings,
  SiteSettings,
  Subscriber,
  Tag,
} from '../admin/types.js';
import { layoutPresets } from '../layout/presets.js';
import { toPageLayout, validatePageLayout } from '../layout/registry.js';
import type { PageLayoutDocument } from '../layout/types.js';
import type { StudioMedia, YukiApp } from './yuki-app.js';
import './yuki-app.js';

type View =
  | 'dashboard'
  | 'articles'
  | 'dynamics'
  | 'taxonomy'
  | 'comments'
  | 'media'
  | 'friends'
  | 'settings'
  | 'layouts'
  | 'notifications'
  | 'subscriptions';

const defaultSettings: SiteSettings = {
  siteTitle: 'YukiLog',
  siteDescription: '',
  ownerName: 'Sakurine',
  ownerBio: '',
  avatarMediaId: null,
  socialLinks: [],
  theme: {
    schemaVersion: 1,
    colors: {
      background: '#f8f9fc',
      surface: '#ffffff',
      surfaceMuted: '#f1f3f8',
      text: '#20242c',
      textMuted: '#697386',
      primary: '#3278d4',
      secondary: '#ef78ac',
      border: '#dfe3ea',
    },
    typography: { body: 'system', display: 'serif', scale: 1 },
    shape: { radius: 16, borderedCards: true },
    motion: 'subtle',
  },
  shellLayout: {
    schemaVersion: 1,
    navigation: 'topbar',
    brandPosition: 'start',
    showSearch: true,
    translucent: true,
    maxWidth: 'wide',
  },
};

export class YukiAdmin extends LitElement {
  private admin: Admin | null = null;
  private checkingSession = true;
  private busy = false;
  private notice = '';
  private error = '';
  private view: View = 'dashboard';
  private categories: Category[] = [];
  private tags: Tag[] = [];
  private articles: Article[] = [];
  private dynamics: Dynamic[] = [];
  private comments: Comment[] = [];
  private media: MediaAsset[] = [];
  private friends: FriendLink[] = [];
  private layouts: LayoutRecord[] = [];
  private subscribers: Subscriber[] = [];
  private deliveries: Delivery[] = [];
  private notifications: AdminNotification[] = [];
  private notificationSettings: NotificationSettings = {
    notification_email: null,
    email_notifications_enabled: false,
    notify_on_comments: true,
    notify_on_friend_links: true,
    notify_on_likes: false,
    notification_frequency: 'hourly',
  };
  private settings: SiteSettings = structuredClone(defaultSettings);
  private selectedArticle: Article | null = null;
  private selectedDynamic: Dynamic | null = null;

  static styles = css`
    * { box-sizing: border-box; }
    :host { display:block; min-height:100dvh; color:#20242c; background:#f3f5f9; font:14px/1.55 Inter,system-ui,sans-serif; }
    button,input,textarea,select { font:inherit; }
    button { cursor:pointer; }
    .login { min-height:100dvh; display:grid; place-items:center; padding:1rem; background:radial-gradient(circle at 20% 10%,#dbeafe,transparent 30%),radial-gradient(circle at 80% 80%,#fce7f3,transparent 35%); }
    .login form { width:min(400px,100%); padding:2rem; background:#ffffffdd; border:1px solid #dfe3ea; border-radius:24px; box-shadow:0 24px 80px #26334d18; backdrop-filter:blur(20px); }
    h1,h2,h3,p { margin-top:0; }
    label { display:grid; gap:.35rem; color:#596174; }
    input,textarea,select { width:100%; border:1px solid #cfd5df; border-radius:10px; padding:.7rem .8rem; color:#20242c; background:#fff; }
    textarea { min-height:130px; resize:vertical; font-family:ui-monospace,monospace; }
    button { border:0; border-radius:10px; padding:.65rem .9rem; color:#fff; background:#3278d4; }
    button.secondary { color:#303848; background:#e9edf4; }
    button.danger { background:#ba3650; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .shell { display:grid; grid-template-columns:230px minmax(0,1fr); min-height:100dvh; }
    aside { position:sticky; top:0; height:100dvh; padding:1.2rem; color:#e8edf8; background:#182033; overflow:auto; }
    .brand { padding:.7rem; font-size:1.25rem; font-weight:800; }
    nav { display:grid; gap:.25rem; margin:1.2rem 0; }
    nav button { text-align:left; background:transparent; color:#aeb8cc; }
    nav button[aria-current="page"] { color:#fff; background:#ffffff18; }
    .admin-meta { padding:.8rem; color:#8f9bb1; border-top:1px solid #ffffff18; }
    main { min-width:0; padding:2rem; }
    .topline { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.5rem; }
    .notice,.error { position:sticky; top:1rem; z-index:50; padding:.8rem 1rem; margin-bottom:1rem; border-radius:10px; }
    .notice { color:#185c3d; background:#dff7e9; }
    .error { color:#8d2437; background:#fde7eb; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; }
    .card,.panel { padding:1.2rem; border:1px solid #dfe3ea; border-radius:16px; background:#fff; }
    .card strong { display:block; font-size:2rem; }
    .split { display:grid; grid-template-columns:minmax(260px,380px) minmax(0,1fr); gap:1rem; align-items:start; }
    .list { display:grid; gap:.5rem; max-height:calc(100dvh - 150px); overflow:auto; }
    .list-item { width:100%; display:flex; justify-content:space-between; gap:1rem; padding:.8rem; text-align:left; color:#303848; background:#f4f6fa; }
    .list-item.active { outline:2px solid #3278d4; }
    .form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }
    .full { grid-column:1/-1; }
    .actions { display:flex; flex-wrap:wrap; gap:.5rem; margin-top:1rem; }
    .checks { display:flex; flex-wrap:wrap; gap:.7rem; }
    .checks label { display:flex; align-items:center; gap:.3rem; }
    .checks input { width:auto; }
    table { width:100%; border-collapse:collapse; background:#fff; }
    th,td { padding:.7rem; text-align:left; border-bottom:1px solid #e3e7ee; vertical-align:top; }
    .scroll { overflow:auto; border:1px solid #dfe3ea; border-radius:14px; }
    .media-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:1rem; }
    .media-item img,.media-placeholder { width:100%; aspect-ratio:1.5; object-fit:cover; border-radius:10px; background:#edf0f5; }
    .status { display:inline-block; padding:.15rem .45rem; border-radius:999px; background:#e8edf5; font-size:.78rem; }
    .layout-studio { height:max(720px,calc(100dvh - 190px)); overflow:hidden; border:1px solid #dfe3ea; border-radius:16px; background:white; }
    .layout-studio yuki-app { display:block; height:100%; --studio-height:100%; }
    @media(max-width:900px){.shell{grid-template-columns:1fr}aside{position:static;height:auto}.split,.form-grid{grid-template-columns:1fr}main{padding:1rem}}
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.restoreSession();
  }

  protected updated() {
    if (this.view !== 'layouts') return;
    const studio = this.renderRoot.querySelector<YukiApp>('#layout-studio');
    const media: StudioMedia[] = this.media.map((item) => ({
      id: item.id,
      url: item.url,
      mediaType: item.media_type,
      name: item.original_name,
    }));
    studio?.setMediaLibrary(media);
  }

  private async restoreSession() {
    try {
      this.admin = await api<Admin>('/api/admin/auth/session');
      await this.refreshAll();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) this.setError(error);
    } finally {
      this.checkingSession = false;
      this.requestUpdate();
    }
  }

  private async login(event: SubmitEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    await this.run(async () => {
      this.admin = await api<Admin>('/api/admin/auth/login', {
        method: 'POST',
        body: { username: form.get('username'), password: form.get('password') },
      });
      await this.refreshAll();
    }, '登录成功');
  }

  private async logout() {
    await this.run(async () => {
      await api('/api/admin/auth/logout', { method: 'POST' });
      this.admin = null;
    });
  }

  private async refreshAll() {
    const [
      categories,
      tags,
      articles,
      dynamics,
      comments,
      media,
      friends,
      layouts,
      subscribers,
      deliveries,
      notifications,
      notificationSettings,
      settings,
    ] = await Promise.all([
      api<Category[]>('/api/admin/categories'),
      api<Tag[]>('/api/admin/tags'),
      api<Article[]>('/api/admin/articles'),
      api<Dynamic[]>('/api/admin/dynamics'),
      api<Comment[]>('/api/admin/comments'),
      api<MediaAsset[]>('/api/admin/media'),
      api<FriendLink[]>('/api/admin/friend-links'),
      api<LayoutRecord[]>('/api/admin/layouts'),
      api<Subscriber[]>('/api/admin/subscribers'),
      api<Delivery[]>('/api/admin/deliveries'),
      api<AdminNotification[]>('/api/admin/notifications'),
      api<NotificationSettings>('/api/admin/notification-settings'),
      api<SiteSettings>('/api/admin/settings').catch((error) => {
        if (error instanceof ApiError && error.status === 404) return structuredClone(defaultSettings);
        throw error;
      }),
    ]);
    Object.assign(this, {
      categories, tags, articles, dynamics, comments, media, friends, layouts,
      subscribers, deliveries, notifications, notificationSettings, settings,
    });
    this.requestUpdate();
  }

  private async run(action: () => Promise<void>, notice = '已保存') {
    this.busy = true;
    this.error = '';
    this.notice = '';
    this.requestUpdate();
    try {
      await action();
      this.notice = notice;
    } catch (error) {
      this.setError(error);
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  private setError(error: unknown) {
    this.error = error instanceof Error ? error.message : '发生未知错误';
  }

  private openView(view: View) {
    this.view = view;
    this.notice = '';
    this.error = '';
    this.requestUpdate();
  }

  private renderLogin() {
    return html`<section class="login">
      <form @submit=${this.login}>
        <p>YukiLog Administration</p>
        <h1>欢迎回来</h1>
        <label>用户名<input name="username" required autocomplete="username"></label>
        <label>密码<input name="password" type="password" required autocomplete="current-password"></label>
        ${this.error ? html`<p class="error">${this.error}</p>` : nothing}
        <button ?disabled=${this.busy}>登录</button>
      </form>
    </section>`;
  }

  private renderShell() {
    const items: Array<[View, string]> = [
      ['dashboard', '概览'], ['articles', '文章'], ['dynamics', '动态'],
      ['taxonomy', '分类与标签'], ['comments', '评论'], ['media', '媒体'],
      ['friends', '友链'], ['settings', '站点设置'], ['layouts', '布局工作室'],
      ['notifications', `消息 (${this.notifications.filter((item) => !item.read_at).length})`],
      ['subscriptions', '订阅与投递'],
    ];
    return html`<div class="shell">
      <aside>
        <div class="brand">YukiLog</div>
        <nav>${items.map(([view, label]) => html`
          <button aria-current=${this.view === view ? 'page' : 'false'} @click=${() => this.openView(view)}>${label}</button>
        `)}</nav>
        <div class="admin-meta">${this.admin?.display_name}<br>@${this.admin?.username}</div>
        <button class="secondary" @click=${this.logout}>退出</button>
      </aside>
      <main>
        <div class="topline"><h1>${items.find(([view]) => view === this.view)?.[1]}</h1><button class="secondary" @click=${() => this.run(() => this.refreshAll(), '数据已刷新')}>刷新</button></div>
        ${this.notice ? html`<div class="notice">${this.notice}</div>` : nothing}
        ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
        ${this.renderView()}
      </main>
    </div>`;
  }

  private renderView() {
    switch (this.view) {
      case 'dashboard': return this.renderDashboard();
      case 'articles': return this.renderArticles();
      case 'dynamics': return this.renderDynamics();
      case 'taxonomy': return this.renderTaxonomy();
      case 'comments': return this.renderComments();
      case 'media': return this.renderMedia();
      case 'friends': return this.renderFriends();
      case 'settings': return this.renderSettings();
      case 'layouts': return this.renderLayouts();
      case 'notifications': return this.renderNotifications();
      case 'subscriptions': return this.renderSubscriptions();
    }
  }

  private renderDashboard() {
    const pending = this.comments.filter((comment) => comment.status === 'pending').length;
    const failed = this.deliveries.filter((delivery) => delivery.status === 'failed').length;
    return html`<section class="grid">
      ${[
        ['文章', this.articles.length], ['动态', this.dynamics.length],
        ['待审评论', pending], ['媒体', this.media.length],
        ['未读消息', this.notifications.filter((item) => !item.read_at).length],
        ['活跃订阅', this.subscribers.filter((item) => item.status === 'active').length],
        ['投递失败', failed],
      ].map(([label, value]) => html`<article class="card"><span>${label}</span><strong>${value}</strong></article>`)}
    </section>`;
  }

  private renderArticles() {
    const article = this.selectedArticle;
    return html`<section class="split">
      <div class="panel">
        <button @click=${() => { this.selectedArticle = null; this.requestUpdate(); }}>＋ 新文章</button>
        <div class="list">${this.articles.map((item) => html`
          <button class="list-item ${article?.id === item.id ? 'active' : ''}" @click=${() => { this.selectedArticle = item; this.requestUpdate(); }}>
            <span>${item.title}</span><span class="status">${this.contentStatus(item)}</span>
          </button>`)}</div>
      </div>
      <form class="panel form-grid" @submit=${this.saveArticle}>
        <label class="full">标题<input name="title" required maxlength="200" .value=${article?.title ?? ''}></label>
        <label>Slug<input name="slug" required .value=${article?.slug ?? ''}></label>
        <label>分类<select name="category_id" required>${this.categories.map((category) => html`<option value=${category.id} ?selected=${category.id === article?.category_id}>${category.name}</option>`)}</select></label>
        <label>封面<select name="cover_media_id"><option value="">无</option>${this.media.filter((item) => item.media_type.startsWith('image/')).map((item) => html`<option value=${item.id} ?selected=${item.id === article?.cover_media_id}>${item.original_name}</option>`)}</select></label>
        <label class="full">摘要<textarea name="summary" maxlength="500" .value=${article?.summary ?? ''}></textarea></label>
        <label class="full">Markdown<textarea name="body_markdown" required .value=${article?.body_markdown ?? ''}></textarea></label>
        <div class="full checks">${this.tags.map((tag) => html`<label><input type="checkbox" name="tag_ids" value=${tag.id} ?checked=${article?.tag_ids.includes(tag.id) ?? false}>${tag.name}</label>`)}</div>
        <label class="full"><span><input type="checkbox" name="allow_comments" ?checked=${article?.allow_comments ?? true}> 允许评论</span></label>
        <div class="full actions"><button ?disabled=${this.busy}>保存</button>
          ${article ? html`${article.status === 'published'
            ? html`<button type="button" class="secondary" @click=${() => this.articleAction(article.id, 'withdraw')}>撤回</button>`
            : html`<button type="button" @click=${() => this.articleAction(article.id, 'publish')}>立即发布</button><button type="button" class="secondary" @click=${() => this.scheduleArticle(article.id)}>定时发布</button>`}
            <button type="button" class="danger" @click=${() => this.deleteArticle(article.id)}>删除</button>` : nothing}
        </div>
      </form>
    </section>`;
  }

  private async saveArticle(event: SubmitEvent) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const body = {
      title: data.get('title'), slug: data.get('slug'), category_id: data.get('category_id'),
      cover_media_id: data.get('cover_media_id') || null, summary: data.get('summary') || null,
      body_markdown: data.get('body_markdown'), allow_comments: data.has('allow_comments'),
      tag_ids: data.getAll('tag_ids'),
    };
    await this.run(async () => {
      const saved = await api<Article>(this.selectedArticle ? `/api/admin/articles/${this.selectedArticle.id}` : '/api/admin/articles', { method: this.selectedArticle ? 'PUT' : 'POST', body });
      this.selectedArticle = saved;
      this.articles = await api('/api/admin/articles');
    });
  }

  private async articleAction(id: string, action: 'publish' | 'withdraw') {
    await this.run(async () => {
      this.selectedArticle = await api(`/api/admin/articles/${id}/${action}`, { method: 'POST', body: action === 'publish' ? {} : undefined });
      this.articles = await api('/api/admin/articles');
    }, action === 'publish' ? '文章已发布' : '文章已撤回');
  }

  private async scheduleArticle(id:string){const value=prompt('请输入本地发布时间（例如 2026-10-05 09:30）');if(!value)return;const date=new Date(value.replace(' ','T'));if(Number.isNaN(date.getTime())){this.error='发布时间格式无效';this.requestUpdate();return;}await this.run(async()=>{this.selectedArticle=await api(`/api/admin/articles/${id}/publish`,{method:'POST',body:{published_at:date.toISOString()}});this.articles=await api('/api/admin/articles');},'文章已安排定时发布');}

  private async deleteArticle(id: string) {
    if (!confirm('确定删除这篇文章？')) return;
    await this.run(async () => {
      await api(`/api/admin/articles/${id}`, { method: 'DELETE' });
      this.selectedArticle = null;
      this.articles = await api('/api/admin/articles');
    }, '文章已删除');
  }

  private renderDynamics() {
    const item = this.selectedDynamic;
    return html`<section class="split"><div class="panel"><button @click=${() => { this.selectedDynamic = null; this.requestUpdate(); }}>＋ 新动态</button>
      <div class="list">${this.dynamics.map((dynamic) => html`<button class="list-item ${item?.id === dynamic.id ? 'active' : ''}" @click=${() => { this.selectedDynamic = dynamic; this.requestUpdate(); }}><span>${dynamic.content_markdown.slice(0, 42)}</span><span class="status">${this.contentStatus(dynamic)}</span></button>`)}</div></div>
      <form class="panel" @submit=${this.saveDynamic}><label>Markdown<textarea name="content_markdown" required .value=${item?.content_markdown ?? ''}></textarea></label>
      <label><span><input type="checkbox" name="allow_comments" ?checked=${item?.allow_comments ?? true}> 允许评论</span></label>
      <div class="actions"><button>保存</button>${item ? html`${item.status === 'published' ? html`<button type="button" class="secondary" @click=${() => this.dynamicAction(item.id, 'withdraw')}>撤回</button>` : html`<button type="button" @click=${() => this.dynamicAction(item.id, 'publish')}>立即发布</button><button type="button" class="secondary" @click=${() => this.scheduleDynamic(item.id)}>定时发布</button>`}<button type="button" class="danger" @click=${() => this.deleteDynamic(item.id)}>删除</button>` : nothing}</div></form></section>`;
  }

  private async saveDynamic(event: SubmitEvent) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    await this.run(async () => {
      this.selectedDynamic = await api(this.selectedDynamic ? `/api/admin/dynamics/${this.selectedDynamic.id}` : '/api/admin/dynamics', { method: this.selectedDynamic ? 'PUT' : 'POST', body: { content_markdown: data.get('content_markdown'), allow_comments: data.has('allow_comments') } });
      this.dynamics = await api('/api/admin/dynamics');
    });
  }

  private async dynamicAction(id: string, action: 'publish' | 'withdraw') {
    await this.run(async () => {
      this.selectedDynamic = await api(`/api/admin/dynamics/${id}/${action}`, { method: 'POST', body: action === 'publish' ? {} : undefined });
      this.dynamics = await api('/api/admin/dynamics');
    });
  }

  private async scheduleDynamic(id:string){const value=prompt('请输入本地发布时间（例如 2026-10-05 09:30）');if(!value)return;const date=new Date(value.replace(' ','T'));if(Number.isNaN(date.getTime())){this.error='发布时间格式无效';this.requestUpdate();return;}await this.run(async()=>{this.selectedDynamic=await api(`/api/admin/dynamics/${id}/publish`,{method:'POST',body:{published_at:date.toISOString()}});this.dynamics=await api('/api/admin/dynamics');},'动态已安排定时发布');}

  private contentStatus(item:Article|Dynamic){return item.status==='published'&&item.published_at&&new Date(item.published_at).getTime()>Date.now()?'scheduled':item.status;}

  private async deleteDynamic(id: string) {
    if (!confirm('确定删除这条动态？')) return;
    await this.run(async () => {
      await api(`/api/admin/dynamics/${id}`, { method: 'DELETE' });
      this.selectedDynamic = null;
      this.dynamics = await api('/api/admin/dynamics');
    }, '动态已删除');
  }

  private renderTaxonomy() {
    return html`<section class="grid">
      <form class="panel" @submit=${this.createCategory}><h2>分类</h2><label>名称<input name="name" required></label><label>Slug<input name="slug" required></label><label>说明<input name="description"></label><label>排序<input name="sort_order" type="number" value="0"></label><button>添加分类</button>
      <div class="list">${this.categories.map((item) => html`<div class="list-item"><span>${item.name}<br><small>${item.slug}</small></span><span class="actions"><button type="button" @click=${() => this.editCategory(item)}>编辑</button><button class="danger" type="button" @click=${() => this.removeTaxonomy('categories', item.id)}>删除</button></span></div>`)}</div></form>
      <form class="panel" @submit=${this.createTag}><h2>标签</h2><label>名称<input name="name" required></label><label>Slug<input name="slug" required></label><button>添加标签</button>
      <div class="list">${this.tags.map((item) => html`<div class="list-item"><span>${item.name}<br><small>${item.slug}</small></span><span class="actions"><button type="button" @click=${() => this.editTag(item)}>编辑</button><button class="danger" type="button" @click=${() => this.removeTaxonomy('tags', item.id)}>删除</button></span></div>`)}</div></form>
    </section>`;
  }

  private async createCategory(event: SubmitEvent) {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form);
    await this.run(async () => { await api('/api/admin/categories', { method:'POST', body:{ name:data.get('name'), slug:data.get('slug'), description:data.get('description') || null, sort_order:Number(data.get('sort_order')) }}); this.categories = await api('/api/admin/categories'); form.reset(); });
  }
  private async createTag(event: SubmitEvent) {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form);
    await this.run(async () => { await api('/api/admin/tags', { method:'POST', body:{ name:data.get('name'), slug:data.get('slug') }}); this.tags = await api('/api/admin/tags'); form.reset(); });
  }
  private async editCategory(item: Category) {
    const name=prompt('分类名称',item.name);if(name===null)return;const slug=prompt('Slug',item.slug);if(slug===null)return;const description=prompt('说明',item.description??'');
    await this.run(async()=>{await api(`/api/admin/categories/${item.id}`,{method:'PUT',body:{name,slug,description:description||null,sort_order:item.sort_order}});this.categories=await api('/api/admin/categories');});
  }
  private async editTag(item: Tag) {
    const name=prompt('标签名称',item.name);if(name===null)return;const slug=prompt('Slug',item.slug);if(slug===null)return;
    await this.run(async()=>{await api(`/api/admin/tags/${item.id}`,{method:'PUT',body:{name,slug}});this.tags=await api('/api/admin/tags');});
  }
  private async removeTaxonomy(kind: 'categories' | 'tags', id: string) {
    if (!confirm('确定删除？被内容引用时数据库会拒绝。')) return;
    await this.run(async () => { await api(`/api/admin/${kind}/${id}`, { method:'DELETE' }); if (kind === 'categories') this.categories = await api('/api/admin/categories'); else this.tags = await api('/api/admin/tags'); }, '已删除');
  }

  private renderComments() {
    return html`<div class="scroll"><table><thead><tr><th>访客</th><th>内容</th><th>状态</th><th>时间</th><th></th></tr></thead><tbody>${this.comments.map((comment) => html`<tr><td>${comment.display_name}<br>${comment.email}</td><td>${comment.content}</td><td>${comment.status}</td><td>${new Date(comment.created_at).toLocaleString()}</td><td><div class="actions"><button @click=${() => this.setComment(comment.id,'visible')}>公开</button><button class="secondary" @click=${() => this.setComment(comment.id,'hidden')}>隐藏</button><button class="danger" @click=${() => this.deleteComment(comment.id)}>删除</button></div></td></tr>`)}</tbody></table></div>`;
  }
  private async setComment(id: string, status: string) { await this.run(async () => { await api(`/api/admin/comments/${id}`, { method:'PUT', body:{ status }}); this.comments = await api('/api/admin/comments'); }); }
  private async deleteComment(id: string) { if (!confirm('确定删除评论？')) return; await this.run(async () => { await api(`/api/admin/comments/${id}`, { method:'DELETE' }); this.comments = await api('/api/admin/comments'); }, '评论已删除'); }

  private renderMedia() {
    return html`<section><form class="panel" @submit=${this.uploadMedia}><label>上传图片或视频<input name="file" type="file" required></label><button ?disabled=${this.busy}>上传</button></form><div class="media-grid">${this.media.map((item) => html`<article class="card media-item">${item.media_type.startsWith('image/') ? html`<img src=${item.url} alt="">` : html`<div class="media-placeholder">VIDEO</div>`}<strong>${item.original_name}</strong><small>${item.media_type} · ${Math.round(item.byte_size/1024)} KiB</small></article>`)}</div></section>`;
  }
  private async uploadMedia(event: SubmitEvent) { event.preventDefault(); const form=event.currentTarget as HTMLFormElement; const data=new FormData(form); await this.run(async()=>{ await api('/api/admin/media',{method:'POST',formData:data}); this.media=await api('/api/admin/media'); form.reset(); },'上传成功'); }

  private renderFriends() {
    return html`<section class="split"><form class="panel" @submit=${this.createFriend}><label>名称<input name="name" required></label><label>URL<input name="url" type="url" required></label><label>说明<textarea name="description"></textarea></label><label>头像<select name="avatar_media_id"><option value="">无</option>${this.media.filter((item)=>item.media_type.startsWith('image/')).map((item)=>html`<option value=${item.id}>${item.original_name}</option>`)}</select></label><label>排序<input name="sort_order" type="number" value="0"></label><label><span><input name="is_visible" type="checkbox" checked> 公开</span></label><button>添加友链</button></form><div class="panel list">${this.friends.map((item)=>html`<div class="list-item"><span><strong>${item.name}</strong><br>${item.url}${item.application_email?html`<br><small>申请邮箱：${item.application_email}</small>`:nothing}</span><span class="actions">${item.application_email&&!item.is_visible?html`<button @click=${()=>this.approveFriend(item)}>通过</button>`:nothing}<button @click=${()=>this.editFriend(item)}>编辑</button><button class="danger" @click=${()=>this.deleteFriend(item.id)}>删除</button></span></div>`)}</div></section>`;
  }
  private async createFriend(event:SubmitEvent){event.preventDefault();const form=event.currentTarget as HTMLFormElement;const data=new FormData(form);await this.run(async()=>{await api('/api/admin/friend-links',{method:'POST',body:{name:data.get('name'),url:data.get('url'),description:data.get('description')||null,avatar_media_id:data.get('avatar_media_id')||null,is_visible:data.has('is_visible'),sort_order:Number(data.get('sort_order'))}});this.friends=await api('/api/admin/friend-links');form.reset();});}
  private async editFriend(item:FriendLink){const name=prompt('名称',item.name);if(name===null)return;const url=prompt('URL',item.url);if(url===null)return;const description=prompt('说明',item.description??'');await this.run(async()=>{await api(`/api/admin/friend-links/${item.id}`,{method:'PUT',body:{name,url,description:description||null,avatar_media_id:item.avatar_media_id,is_visible:item.is_visible,sort_order:item.sort_order}});this.friends=await api('/api/admin/friend-links');});}
  private async approveFriend(item:FriendLink){await this.run(async()=>{await api(`/api/admin/friend-links/${item.id}`,{method:'PUT',body:{name:item.name,url:item.url,description:item.description,avatar_media_id:item.avatar_media_id,is_visible:true,sort_order:item.sort_order}});this.friends=await api('/api/admin/friend-links');},'友链申请已通过');}
  private async deleteFriend(id:string){if(!confirm('确定删除友链？'))return;await this.run(async()=>{await api(`/api/admin/friend-links/${id}`,{method:'DELETE'});this.friends=await api('/api/admin/friend-links');},'友链已删除');}

  private renderSettings() {
    const value=this.settings;
    return html`<form class="panel form-grid" @submit=${this.saveSettings}>
      <label>站点标题<input name="siteTitle" required .value=${value.siteTitle}></label><label>站点说明<input name="siteDescription" .value=${value.siteDescription??''}></label>
      <label>名称<input name="ownerName" required .value=${value.ownerName}></label><label>头像<select name="avatarMediaId"><option value="">无</option>${this.media.filter((item)=>item.media_type.startsWith('image/')).map((item)=>html`<option value=${item.id} ?selected=${item.id===value.avatarMediaId}>${item.original_name}</option>`)}</select></label>
      <label class="full">About<textarea name="ownerBio" .value=${value.ownerBio}></textarea></label>
      <label class="full">社交链接 JSON<textarea name="socialLinks" .value=${JSON.stringify(value.socialLinks,null,2)}></textarea></label>
      ${Object.entries(value.theme.colors).map(([key,color])=>html`<label>${key}<input name="color_${key}" type="color" .value=${color.slice(0,7)}></label>`)}
      <label>正文字体<select name="bodyFont">${['system','serif','rounded','mono'].map((font)=>html`<option value=${font} ?selected=${font===value.theme.typography.body}>${font}</option>`)}</select></label>
      <label>字号比例<input name="scale" type="number" min=".8" max="1.4" step=".05" .value=${String(value.theme.typography.scale)}></label>
      <label>圆角<input name="radius" type="number" min="0" max="32" .value=${String(value.theme.shape.radius)}></label>
      <label>导航<input type="hidden" name="navigation" value="topbar"><input value="花恋双态导航" disabled></label>
      <label>页宽<select name="maxWidth">${['content','wide','full'].map((item)=>html`<option value=${item} ?selected=${item===value.shellLayout.maxWidth}>${item}</option>`)}</select></label>
      <div class="full checks"><label><input name="showSearch" type="checkbox" ?checked=${value.shellLayout.showSearch}>搜索入口</label><label><input name="translucent" type="checkbox" ?checked=${value.shellLayout.translucent}>半透明导航</label></div>
      <button class="full">保存站点设置</button>
    </form>`;
  }

  private async saveSettings(event:SubmitEvent){event.preventDefault();const data=new FormData(event.currentTarget as HTMLFormElement);await this.run(async()=>{const colors={...this.settings.theme.colors};for(const key of Object.keys(colors) as Array<keyof typeof colors>){colors[key]=String(data.get(`color_${key}`));}const body:SiteSettings={...this.settings,siteTitle:String(data.get('siteTitle')),siteDescription:String(data.get('siteDescription'))||null,ownerName:String(data.get('ownerName')),ownerBio:String(data.get('ownerBio')),avatarMediaId:String(data.get('avatarMediaId'))||null,socialLinks:JSON.parse(String(data.get('socialLinks'))),theme:{...this.settings.theme,colors,typography:{...this.settings.theme.typography,body:data.get('bodyFont') as SiteSettings['theme']['typography']['body'],scale:Number(data.get('scale'))},shape:{...this.settings.theme.shape,radius:Number(data.get('radius'))}},shellLayout:{...this.settings.shellLayout,navigation:data.get('navigation') as SiteSettings['shellLayout']['navigation'],maxWidth:data.get('maxWidth') as SiteSettings['shellLayout']['maxWidth'],showSearch:data.has('showSearch'),translucent:data.has('translucent')}};this.settings=await api('/api/admin/settings',{method:'PUT',body});});}

  private renderLayouts() {
    return html`<section><div class="panel actions"><button @click=${()=>this.loadStudioLayout(this.layouts.find((item)=>item.pageKey==='home')?.layout)}>载入已保存首页</button>${layoutPresets.map((preset)=>html`<button class="secondary" @click=${()=>this.loadStudioLayout(toPageLayout(preset))}>${preset.label}</button>`)}<button @click=${this.saveStudioLayout}>保存工作室为首页</button></div><div class="layout-studio"><yuki-app id="layout-studio"></yuki-app></div></section>`;
  }
  private loadStudioLayout(layout?:PageLayoutDocument){if(!layout){this.error='尚未保存首页布局';this.requestUpdate();return;}const studio=this.renderRoot.querySelector<YukiApp>('#layout-studio');studio?.loadPageLayout(layout);}
  private async saveStudioLayout(){const studio=this.renderRoot.querySelector<YukiApp>('#layout-studio');if(!studio)return;const layout=studio.exportPageLayout();const errors=validatePageLayout(layout);if(errors.length){this.error=errors.join('；');this.requestUpdate();return;}await this.run(async()=>{await api('/api/admin/layouts/home',{method:'PUT',body:layout});this.layouts=await api('/api/admin/layouts');},'首页布局已保存');}

  private renderNotifications() {
    const settings=this.notificationSettings;
    return html`<section class="grid">
      <div class="panel">
        <div class="actions"><button @click=${()=>this.markAllNotificationsRead()}>全部标为已读</button></div>
        <div class="list">${this.notifications.map((item)=>html`
          <article class="list-item">
            <span><strong>${item.title}${item.event_count>1?` × ${item.event_count}`:''}</strong><br>${item.message}<br><small>${new Date(item.updated_at).toLocaleString()} · 邮件 ${item.email_status}${item.email_last_error?`：${item.email_last_error}`:''}</small></span>
            <span class="actions"><a href=${item.target_url}>查看</a>${!item.read_at?html`<button @click=${()=>this.markNotificationRead(item.id)}>已读</button>`:nothing}${!['sent','sending','pending','suppressed'].includes(item.email_status)?html`<button @click=${()=>this.notificationEmailAction(item,'email-retry')}>邮件重试</button>`:nothing}${!['sent','cancelled','suppressed'].includes(item.email_status)?html`<button class="danger" @click=${()=>this.notificationEmailAction(item,'email-cancel')}>取消邮件</button>`:nothing}</span>
          </article>`)}
        </div>
      </div>
      <form class="panel form-grid" @submit=${this.saveNotificationSettings}>
        <label class="full">通知邮箱<input name="notification_email" type="email" .value=${settings.notification_email??''}></label>
        <label class="full"><span><input name="email_notifications_enabled" type="checkbox" ?checked=${settings.email_notifications_enabled}> 启用邮件提醒</span></label>
        <div class="full checks">
          <label><input name="notify_on_comments" type="checkbox" ?checked=${settings.notify_on_comments}>评论</label>
          <label><input name="notify_on_friend_links" type="checkbox" ?checked=${settings.notify_on_friend_links}>友链申请</label>
          <label><input name="notify_on_likes" type="checkbox" ?checked=${settings.notify_on_likes}>点赞</label>
        </div>
        <label class="full">邮件频率<select name="notification_frequency">${(['immediate','hourly','daily'] as const).map((value)=>html`<option value=${value} ?selected=${settings.notification_frequency===value}>${value}</option>`)}</select></label>
        <p class="full">真实邮件总开关默认关闭；完成 SMTP 灰度验证前，这些设置只会保留站内消息。</p>
        <button class="full">保存通知设置</button>
      </form>
    </section>`;
  }
  private async markNotificationRead(id:string){await this.run(async()=>{await api(`/api/admin/notifications/${id}/read`,{method:'POST'});this.notifications=await api('/api/admin/notifications');},'消息已读');}
  private async markAllNotificationsRead(){await this.run(async()=>{await api('/api/admin/notifications/read-all',{method:'POST'});this.notifications=await api('/api/admin/notifications');},'全部消息已读');}
  private async notificationEmailAction(item:AdminNotification,action:'email-retry'|'email-cancel'){if(action==='email-retry'&&item.email_status==='uncertain'&&!confirm('SMTP 可能已经接收过这封邮件。重试可能导致重复发送，确定继续？'))return;await this.run(async()=>{await api(`/api/admin/notifications/${item.id}/${action}`,{method:'POST'});this.notifications=await api('/api/admin/notifications');});}
  private async saveNotificationSettings(event:SubmitEvent){event.preventDefault();const data=new FormData(event.currentTarget as HTMLFormElement);await this.run(async()=>{this.notificationSettings=await api('/api/admin/notification-settings',{method:'PUT',body:{notification_email:String(data.get('notification_email'))||null,email_notifications_enabled:data.has('email_notifications_enabled'),notify_on_comments:data.has('notify_on_comments'),notify_on_friend_links:data.has('notify_on_friend_links'),notify_on_likes:data.has('notify_on_likes'),notification_frequency:data.get('notification_frequency')}});},'通知设置已保存');}

  private renderSubscriptions() {
    return html`<section class="grid"><div class="panel scroll"><table><thead><tr><th>邮箱</th><th>偏好</th><th>状态</th></tr></thead><tbody>${this.subscribers.map((item)=>html`<tr><td>${item.email}</td><td>${item.subscribe_articles?'文章 ':''}${item.subscribe_dynamics?'动态':''}</td><td>${item.status}</td></tr>`)}</tbody></table></div><div class="panel scroll"><table><thead><tr><th>类型</th><th>状态</th><th>尝试</th><th></th></tr></thead><tbody>${this.deliveries.map((item)=>html`<tr><td>${item.kind}${item.last_error?html`<br><small>${item.last_error}</small>`:nothing}</td><td>${item.status}</td><td>${item.attempt_count}</td><td>${item.status!=='sent'?html`<div class="actions">${item.status!=='sending'?html`<button @click=${()=>this.deliveryAction(item.id,'retry')}>重试</button>`:nothing}<button class="danger" @click=${()=>this.deliveryAction(item.id,'cancel')}>取消</button></div>`:nothing}</td></tr>`)}</tbody></table></div></section>`;
  }
  private async deliveryAction(id:string,action:'retry'|'cancel'){const delivery=this.deliveries.find((item)=>item.id===id);if(action==='retry'&&delivery?.status==='uncertain'&&!confirm('SMTP 可能已经接收过这封邮件。重试可能导致重复发送，确定继续？'))return;await this.run(async()=>{await api(`/api/admin/deliveries/${id}/${action}`,{method:'POST'});this.deliveries=await api('/api/admin/deliveries');});}

  protected render() {
    if (this.checkingSession) return html`<section class="login"><p>正在检查会话…</p></section>`;
    return this.admin ? this.renderShell() : this.renderLogin();
  }
}

customElements.define('yuki-admin', YukiAdmin);
