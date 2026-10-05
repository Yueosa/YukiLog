import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { contentStatusLabel, formatRelative } from '../labels.js';
import type { Dynamic } from '../types.js';

/** 动态列表：内容摘录 + 心情/配图/状态徽标，点击进编辑器。 */
export class AdmDynamics extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 18px;
      }

      .toolbar {
        display: flex;
        justify-content: flex-end;
      }

      .list {
        display: grid;
        gap: 2px;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 12px;
        border-radius: 10px;
      }

      .row:hover {
        background: var(--surface-muted);
      }

      .row .excerpt {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--ink);
        font-size: 13.5px;
        text-decoration: none;
      }

      .row .excerpt:hover {
        color: var(--primary-d);
      }

      .row .meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: none;
      }

      .row .pics {
        color: var(--faint);
        font-size: 12px;
        white-space: nowrap;
      }

      .row time {
        width: 96px;
        flex: none;
        color: var(--faint);
        font-size: 11.5px;
        text-align: right;
      }
    `,
  ];

  private excerpt(item: Dynamic): string {
    const text = item.content_markdown.replace(/\s+/g, ' ').trim();
    return text.length > 60 ? `${text.slice(0, 60)}…` : text;
  }

  protected render() {
    const items = [...this.store.dynamics].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return html`
      <div class="toolbar">
        <button class="btn primary" @click=${() => (location.hash = '#/dynamics/new')}>＋ 新动态</button>
      </div>

      <section class="panel">
        <h2 class="panel-title">全部动态</h2>
        ${items.length
          ? html`<div class="list">
              ${items.map(
                (item) => html`
                  <div class="row">
                    <a class="excerpt" href=${`#/dynamics/${item.id}`} title=${item.content_markdown}>${this.excerpt(item)}</a>
                    <span class="meta">
                      ${item.mood ? html`<span class="badge warn">${item.mood}</span>` : nothing}
                      ${item.media.length ? html`<span class="pics">🖼 ${item.media.length}</span>` : nothing}
                      <span class="badge ${item.status === 'published' ? 'ok' : ''}">${contentStatusLabel(item)}</span>
                    </span>
                    <time>${formatRelative(item.published_at ?? item.created_at)}</time>
                  </div>
                `,
              )}
            </div>`
          : html`<adm-empty text="还没有动态" hint="点右上角「＋ 新动态」写下第一条"></adm-empty>`}
      </section>
    `;
  }
}

customElements.define('adm-dynamics', AdmDynamics);
