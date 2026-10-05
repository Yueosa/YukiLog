import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { commentStatusLabel, enumLabel, formatRelative } from '../labels.js';
import type { Comment } from '../types.js';

type TabKey = 'pending' | 'visible' | 'hidden' | 'all';
type SourceKey = 'all' | 'article' | 'dynamic';

/** 评论审核队列：按状态分页签的卡片列表，可按来源（文章/动态）筛选。 */
export class AdmComments extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;
  @state() private tab: TabKey = 'pending';
  @state() private sourceFilter: SourceKey = 'all';

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 16px;
      }

      .list {
        display: grid;
        gap: 14px;
      }

      .card {
        padding: 16px 18px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--surface);
        display: grid;
        gap: 10px;
      }

      .card.pending {
        border-color: color-mix(in srgb, var(--secondary) 50%, var(--line));
      }

      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }

      .avatar {
        width: 34px;
        height: 34px;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: color-mix(in srgb, var(--primary) 22%, var(--surface));
        color: var(--primary-d);
        font-family: var(--serif);
        font-size: 15px;
        font-weight: 700;
      }

      .ua {
        max-width: 260px;
        overflow: hidden;
        color: var(--faint);
        font-family: var(--mono);
        font-size: 10.5px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .name {
        font-size: 14px;
        font-weight: 600;
        color: var(--ink);
        text-decoration: none;
      }

      a.name:hover {
        color: var(--primary-d);
      }

      .email {
        color: var(--faint);
      }

      .head time {
        color: var(--faint);
        font-size: 11.5px;
      }

      .head .badge {
        margin-left: auto;
      }

      .source {
        color: var(--muted);
        font-size: 12.5px;
      }

      a.source {
        color: var(--primary-d);
        text-decoration: none;
      }

      a.source:hover {
        text-decoration: underline;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        padding: 4px 12px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface);
        color: var(--muted);
        font-size: 12px;
        cursor: pointer;
        transition:
          border-color 160ms ease,
          color 160ms ease,
          background 160ms ease;
      }

      .chip:hover {
        border-color: var(--primary);
        color: var(--ink);
      }

      .chip.active {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 12%, var(--surface));
        color: var(--primary-d);
      }

      .quote {
        padding: 8px 12px;
        border-left: 3px solid var(--line);
        border-radius: 0 8px 8px 0;
        background: var(--surface-muted);
        color: var(--muted);
        font-size: 12.5px;
      }

      .quote b {
        color: var(--ink);
      }

      .body {
        margin: 0;
        color: var(--ink);
        font-size: 13.5px;
        line-height: 1.8;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding-top: 2px;
      }
    `,
  ];

  private sourceOf(comment: Comment): { label: string; href: string | null } {
    if (comment.article_id) {
      const article = this.store.articles.find((item) => item.id === comment.article_id);
      return article
        ? { label: `文章《${article.title}》`, href: `#/articles/${article.id}` }
        : { label: '文章（已删除）', href: null };
    }
    if (comment.dynamic_id) {
      const dynamic = this.store.dynamics.find((item) => item.id === comment.dynamic_id);
      if (!dynamic) return { label: '动态（已删除）', href: null };
      const text = dynamic.content_markdown.replace(/\s+/g, ' ').trim();
      return {
        label: `动态：${text.length > 30 ? `${text.slice(0, 30)}…` : text}`,
        href: `#/dynamics/${dynamic.id}`,
      };
    }
    return { label: '未知来源', href: null };
  }

  private renderCard(comment: Comment) {
    const parent = comment.parent_id
      ? this.store.comments.find((item) => item.id === comment.parent_id)
      : undefined;
    const source = this.sourceOf(comment);
    return html`
      <article class="card ${comment.status === 'pending' ? 'pending' : ''}">
        <header class="head">
          <span class="avatar" aria-hidden="true">${(comment.display_name.trim()[0] ?? '客').toUpperCase()}</span>
          ${comment.website
            ? html`<a class="name" href=${comment.website} target="_blank" rel="noopener noreferrer">${comment.display_name}</a>`
            : html`<span class="name">${comment.display_name}</span>`}
          ${comment.email ? html`<span class="email mono">${comment.email}</span>` : nothing}
          ${comment.user_agent ? html`<span class="ua" title=${comment.user_agent}>${comment.user_agent}</span>` : nothing}
          <time title=${comment.created_at}>${formatRelative(comment.created_at)}</time>
          <span class="badge ${comment.status === 'pending' ? 'warn' : comment.status === 'visible' ? 'ok' : ''}">
            ${enumLabel(commentStatusLabel, comment.status)}
          </span>
        </header>
        ${source.href
          ? html`<a class="source" href=${source.href}>${source.label}</a>`
          : html`<div class="source">${source.label}</div>`}
        ${parent !== undefined
          ? html`<blockquote class="quote">回复给 <b>${parent ? parent.display_name : '已删除的评论'}</b>：${parent ? parent.content : ''}</blockquote>`
          : nothing}
        <p class="body">${comment.content}</p>
        <div class="actions">
          ${comment.status !== 'visible'
            ? html`<button class="btn small primary" @click=${() => this.store.setCommentStatus(comment.id, 'visible')}>公开</button>`
            : nothing}
          ${comment.status !== 'hidden'
            ? html`<button class="btn small secondary" @click=${() => this.store.setCommentStatus(comment.id, 'hidden')}>隐藏</button>`
            : nothing}
          <button class="btn small danger" @click=${() => this.store.deleteComment(comment.id)}>删除</button>
        </div>
      </article>
    `;
  }

  protected render() {
    const comments = [...this.store.comments].sort(
      (a, b) =>
        Number(b.status === 'pending') - Number(a.status === 'pending') ||
        b.created_at.localeCompare(a.created_at),
    );
    const count = (status: string) => this.store.comments.filter((item) => item.status === status).length;
    const byTab = this.tab === 'all' ? comments : comments.filter((item) => item.status === this.tab);
    const filtered =
      this.sourceFilter === 'all'
        ? byTab
        : byTab.filter((item) => (this.sourceFilter === 'article' ? item.article_id : item.dynamic_id));
    const sourceChips: Array<{ key: SourceKey; label: string }> = [
      { key: 'all', label: '全部来源' },
      { key: 'article', label: '文章' },
      { key: 'dynamic', label: '动态' },
    ];
    return html`
      <adm-tabs
        .tabs=${[
          { key: 'pending', label: '待审核', count: count('pending') },
          { key: 'visible', label: '已公开', count: count('visible') },
          { key: 'hidden', label: '已隐藏', count: count('hidden') },
          { key: 'all', label: '全部', count: this.store.comments.length },
        ]}
        .active=${this.tab}
        @adm-tab=${(e: CustomEvent<{ key: string }>) => (this.tab = e.detail.key as TabKey)}
      ></adm-tabs>
      <div class="chips">
        ${sourceChips.map(
          (chip) => html`
            <button
              class="chip ${this.sourceFilter === chip.key ? 'active' : ''}"
              @click=${() => (this.sourceFilter = chip.key)}
            >
              ${chip.label}
            </button>
          `,
        )}
      </div>
      ${filtered.length
        ? html`<div class="list">${filtered.map((comment) => this.renderCard(comment))}</div>`
        : html`<adm-empty
            text=${this.tab === 'pending' ? '没有待审核的评论' : '这个分类下还没有评论'}
            hint=${this.tab === 'pending' ? '新评论会先出现在这里等你过目' : ''}
          ></adm-empty>`}
    `;
  }
}

customElements.define('adm-comments', AdmComments);
