import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { api } from '../api.js';
import { contentStatusLabel, formatRelative } from '../labels.js';
import type { Dynamic } from '../types.js';


/** 动态列表：卡片流——正文截断、心情/状态徽标、配图缩略、评论/喜欢数、编辑删除。 */
export class AdmDynamics extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private likes = new Map<string, number | null>();
  private likesRequested = new Set<string>();

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

      .cards {
        display: grid;
        gap: 14px;
      }

      .card {
        display: flex;
        gap: 16px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--surface);
        transition:
          border-color 220ms ease,
          translate 220ms ease;
      }

      .cover {
        position: relative;
        flex: none;
        display: grid;
        width: 118px;
        height: 118px;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface-muted);
        font-size: 30px;
      }

      .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .cover em {
        position: absolute;
        right: 6px;
        bottom: 6px;
        padding: 1px 7px;
        border-radius: 999px;
        background: rgb(20 26 36 / 72%);
        color: #fff;
        font-size: 11px;
        font-style: normal;
      }

      .body {
        display: grid;
        flex: 1;
        min-width: 0;
        align-content: start;
        gap: 8px;
        padding: 2px 4px 2px 0;
      }

      .card:hover {
        border-color: var(--primary);
        translate: 0 -1px;
      }

      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }

      .head time {
        color: var(--faint);
        font-size: 11.5px;
      }

      .head .spacer {
        flex: 1;
      }

      .text {
        margin: 0;
        color: var(--ink);
        font-size: 13.5px;
        line-height: 1.75;
        white-space: pre-wrap;
        word-break: break-word;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }

      a.text {
        text-decoration: none;
      }

      a.text:hover {
        color: var(--primary-d);
      }




      .foot {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-top: auto;
        padding-top: 4px;
        color: var(--faint);
        font-size: 12px;
      }

      .foot .stats {
        font-family: var(--mono);
        font-size: 11.5px;
      }

      .foot .spacer {
        flex: 1;
      }

      .foot .ops {
        display: inline-flex;
        gap: 8px;
      }

      .foot .ops a {
        text-decoration: none;
      }
    `,
  ];

  private commentCount(item: Dynamic): number {
    return this.store.comments.filter((comment) => comment.dynamic_id === item.id).length;
  }

  /** 已发布动态按需拉取喜欢数（公开 metrics 接口不支持草稿）。 */
  private ensureLikes(item: Dynamic) {
    if (item.status !== 'published' || this.likesRequested.has(item.id)) return;
    this.likesRequested.add(item.id);
    void api<{ like_count: number }>(`/api/dynamics/${item.id}/metrics`)
      .then((data) => {
        this.likes = new Map(this.likes).set(item.id, data.like_count);
      })
      .catch(() => {
        this.likes = new Map(this.likes).set(item.id, null);
      });
  }

  private renderCard(item: Dynamic) {
    const comments = this.commentCount(item);
    const likes = this.likes.get(item.id);
    this.ensureLikes(item);
    const cover = item.media[0];
    return html`
      <article class="card">
        ${cover
          ? html`<span class="cover">
              <img src=${cover.url} alt=${cover.original_name} loading="lazy" />
              ${item.media.length > 1 ? html`<em>+${item.media.length - 1}</em>` : nothing}
            </span>`
          : html`<span class="cover mood-fallback">${item.mood ?? '💬'}</span>`}
        <div class="body">
          <div class="head">
            ${item.mood ? html`<span class="badge warn">${item.mood}</span>` : nothing}
            <span class="badge ${item.status === 'published' ? 'ok' : ''}">${contentStatusLabel(item)}</span>
            <span class="spacer"></span>
            <time title=${item.published_at ?? item.created_at}>
              ${formatRelative(item.published_at ?? item.created_at)}
            </time>
          </div>
          <a class="text" href=${`#/dynamics/${item.id}`} title=${item.content_markdown}>${item.content_markdown.trim() || '（无内容）'}</a>
          <div class="foot">
            <span class="stats">${comments} 评论${likes != null ? html` · ${likes} 喜欢` : nothing}</span>
            <span class="spacer"></span>
            <span class="ops">
              <a class="btn secondary small" href=${`#/dynamics/${item.id}`}>编辑</a>
              <button class="btn danger small" @click=${() => this.store.deleteDynamic(item.id)}>删除</button>
            </span>
          </div>
        </div>
      </article>
    `;
  }

  protected render() {
    const items = [...this.store.dynamics].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return html`
      <div class="toolbar">
        <button class="btn primary" @click=${() => (location.hash = '#/dynamics/new')}>＋ 新动态</button>
      </div>

      ${items.length
        ? html`<div class="cards">${items.map((item) => this.renderCard(item))}</div>`
        : html`<adm-empty text="还没有动态" hint="点右上角「＋ 新动态」写下第一条"></adm-empty>`}
    `;
  }
}

customElements.define('adm-dynamics', AdmDynamics);
