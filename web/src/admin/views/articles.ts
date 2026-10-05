import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { contentStatusLabel, formatRelative } from '../labels.js';
import type { Article } from '../types.js';

type StatusFilter = 'all' | 'published' | 'draft' | 'scheduled';

const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'published', label: '已发布' },
  { key: 'draft', label: '草稿' },
  { key: 'scheduled', label: '已定时' },
];

function isScheduled(article: Article): boolean {
  return article.status === 'published' && !!article.published_at && new Date(article.published_at) > new Date();
}

/** 文章列表：搜索 + 状态筛选 + 行内状态徽标。 */
export class AdmArticles extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private query = '';
  @state() private status: StatusFilter = 'all';

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

      .row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 13px 16px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        transition:
          border-color 220ms ease,
          translate 220ms ease;
      }

      .row:hover {
        border-color: var(--primary);
        translate: 0 -1px;
      }

      .rows {
        display: grid;
        gap: 10px;
      }

      .row .main {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .row .title {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--ink);
        font-size: 14.5px;
        font-weight: 600;
        text-decoration: none;
        overflow: hidden;
      }

      .row .title span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .row .title:hover {
        color: var(--primary-d);
      }

      .row .star {
        flex: none;
        color: var(--secondary-d);
        font-size: 13px;
      }

      .row .sub {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        color: var(--faint);
        font-size: 12px;
      }

      .row .side {
        flex: none;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .row time {
        color: var(--faint);
        font-size: 12px;
        white-space: nowrap;
      }

      @media (max-width: 640px) {
        .row {
          flex-wrap: wrap;
        }
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
    return this.store.categories.find((category) => category.id === id)?.name ?? '未分类';
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
            ${STATUS_OPTIONS.map((option) => html`<option value=${option.key} ?selected=${this.status === option.key}>${option.label}</option>`)}
          </select>
        </label>
        <button class="btn primary" @click=${() => (location.hash = '#/articles/new')}>＋ 新文章</button>
      </div>

      ${articles.length
        ? html`<div class="rows">
            ${articles.map(
              (article) => html`
                <div class="row">
                  <div class="main">
                    <a class="title" href="#/articles/${article.id}">
                      ${article.featured_at ? html`<span class="star" title="精选">★</span>` : nothing}
                      <span>${article.title || '（无标题）'}</span>
                    </a>
                    <div class="sub">
                      <span>${this.categoryName(article.category_id)}</span>
                      <span class="mono">${article.slug}</span>
                    </div>
                  </div>
                  <div class="side">
                    <time title="更新时间">${formatRelative(article.updated_at)}</time>
                    <span class="badge ${this.badgeClass(article)}">${contentStatusLabel(article)}</span>
                  </div>
                </div>
              `,
            )}
          </div>`
        : html`<adm-empty text="没有符合条件的文章" hint="调整筛选条件，或点右上角「＋ 新文章」开始写作"></adm-empty>`}
    `;
  }
}

customElements.define('adm-articles', AdmArticles);
