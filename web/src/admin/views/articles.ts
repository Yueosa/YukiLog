import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { api } from '../api.js';
import { articleCardLabel, articleStatusFilterLabel, contentStatusLabel, formatDateTime } from '../labels.js';
import type { Article } from '../types.js';

type StatusFilter = 'all' | 'published' | 'draft' | 'scheduled';

const STATUS_OPTIONS = Object.keys(articleStatusFilterLabel) as StatusFilter[];

type ArticleStats = { views: number; likes: number };

function isScheduled(article: Article): boolean {
  return article.status === 'published' && !!article.published_at && new Date(article.published_at) > new Date();
}

/** 文章列表：搜索 + 状态筛选 + 封面卡片网格（无封面时显示占位提示）。 */
export class AdmArticles extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private query = '';
  @state() private status: StatusFilter = 'all';
  @state() private metrics = new Map<string, ArticleStats | null>();
  private metricsRequested = new Set<string>();

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 18px;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
      }

      .toolbar .search {
        flex: 1;
        min-width: 220px;
      }

      .toolbar .filter {
        width: 150px;
      }

      .toolbar .btn {
        margin-bottom: 1px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 14px;
      }

      .card {
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        display: grid;
        grid-template-rows: auto 1fr;
        color: inherit;
        text-decoration: none;
        transition:
          border-color 220ms ease,
          translate 220ms ease;
      }

      .card:hover {
        border-color: var(--primary);
        translate: 0 -2px;
      }

      .cover {
        position: relative;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: var(--surface-muted);
        display: grid;
        place-items: center;
      }

      .cover img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .cover .placeholder {
        display: grid;
        place-items: center;
        gap: 6px;
        width: calc(100% - 16px);
        height: calc(100% - 16px);
        border: 1.5px dashed var(--line);
        border-radius: 10px;
        color: var(--faint);
        font-size: 12px;
      }

      .cover .placeholder svg {
        width: 22px;
        height: 22px;
      }

      .body {
        display: grid;
        align-content: start;
        gap: 7px;
        padding: 12px 14px 13px;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .title {
        margin: 0;
        color: var(--ink);
        font-size: 14.5px;
        font-weight: 600;
        line-height: 1.45;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }

      .card:hover .title {
        color: var(--primary-d);
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--faint);
        font-size: 12px;
      }

      .meta .tag {
        color: var(--muted);
      }

      .foot {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        color: var(--faint);
        font-size: 12px;
      }

      .foot .stats {
        font-family: var(--mono);
        font-size: 11.5px;
      }
    `,
  ];

  private badgeClass(article: Article): string {
    if (article.status !== 'published') return '';
    return isScheduled(article) ? 'warn' : 'ok';
  }

  private filtered(): Article[] {
    const query = this.query.trim().toLowerCase();
    return this.store.articles.filter((article) => {
      if (this.status === 'published' && (article.status !== 'published' || isScheduled(article))) return false;
      if (this.status === 'draft' && article.status !== 'draft') return false;
      if (this.status === 'scheduled' && !isScheduled(article)) return false;
      if (query && !article.title.toLowerCase().includes(query) && !article.slug.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  private categoryName(id: string): string {
    return this.store.categories.find((category) => category.id === id)?.name ?? articleCardLabel.uncategorized;
  }

  /** 已发布文章按需拉取阅读/喜欢数（公开 metrics 接口不支持草稿）。 */
  private ensureMetrics(article: Article) {
    if (article.status !== 'published' || this.metricsRequested.has(article.id)) return;
    this.metricsRequested.add(article.id);
    void api<{ view_count: number; like_count: number }>(`/api/articles/${article.id}/metrics`)
      .then((data) => {
        this.metrics = new Map(this.metrics).set(article.id, { views: data.view_count, likes: data.like_count });
      })
      .catch(() => {
        this.metrics = new Map(this.metrics).set(article.id, null);
      });
  }

  private renderCard(article: Article) {
    const cover = article.cover_media_id
      ? this.store.media.find((item) => item.id === article.cover_media_id)
      : null;
    const tags = article.tag_ids
      .map((id) => this.store.tags.find((tag) => tag.id === id)?.name)
      .filter((name): name is string => !!name)
      .slice(0, 3);
    const stats = this.metrics.get(article.id);
    this.ensureMetrics(article);
    return html`
      <a class="card" href="#/articles/${article.id}">
        <div class="cover">
          ${cover
            ? html`<img src=${cover.url} alt=${article.title} loading="lazy" />`
            : html`
                <span class="placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3.5" y="5" width="17" height="14" rx="2" />
                    <circle cx="9" cy="10" r="1.6" />
                    <path d="m5 17 4.5-4.5 3 3L16 12l3.5 3.5" />
                  </svg>
                  <span>${articleCardLabel.noCover}</span>
                </span>
              `}
        </div>
        <div class="body">
          <div class="badges">
            <span class="badge ${this.badgeClass(article)}">${contentStatusLabel(article)}</span>
            ${article.featured_at ? html`<span class="badge warn">★ ${articleCardLabel.featured}</span>` : nothing}
          </div>
          <h3 class="title">${article.title || '（无标题）'}</h3>
          <div class="meta">
            <span>${this.categoryName(article.category_id)}</span>
            ${tags.map((name) => html`<span class="tag">#${name}</span>`)}
          </div>
          <div class="foot">
            <time>${article.published_at ? formatDateTime(article.published_at) : articleCardLabel.unpublished}</time>
            ${stats ? html`<span class="stats">${stats.views} 阅读 · ${stats.likes} 喜欢</span>` : nothing}
          </div>
        </div>
      </a>
    `;
  }

  protected render() {
    const articles = this.filtered();
    return html`
      <div class="toolbar">
        <label class="field search">
          <span>搜索</span>
          <input
            type="search"
            placeholder="按标题或 slug 过滤…"
            .value=${this.query}
            @input=${(e: InputEvent) => (this.query = (e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <label class="field filter">
          <span>状态</span>
          <select
            .value=${this.status}
            @change=${(e: Event) => (this.status = (e.currentTarget as HTMLSelectElement).value as StatusFilter)}
          >
            ${STATUS_OPTIONS.map(
              (key) => html`<option value=${key} ?selected=${this.status === key}>${articleStatusFilterLabel[key]}</option>`,
            )}
          </select>
        </label>
        <button class="btn primary" @click=${() => (location.hash = '#/articles/new')}>＋ 新文章</button>
      </div>

      ${articles.length
        ? html`<div class="grid">${articles.map((article) => this.renderCard(article))}</div>`
        : html`<adm-empty text="没有符合条件的文章" hint="调整筛选条件，或点右上角「＋ 新文章」开始写作"></adm-empty>`}
    `;
  }
}

customElements.define('adm-articles', AdmArticles);
