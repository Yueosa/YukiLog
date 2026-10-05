import { css, html, nothing } from 'lit';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { commentStatusLabel, enumLabel, formatRelative, notificationKindLabel } from '../labels.js';

/** 概览：数据大屏 —— 统计卡、待办、榜单、最近动态。 */
export class AdmDashboard extends AdmView {
  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 18px;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 14px;
      }

      .stat {
        padding: 16px 18px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--surface);
      }

      .stat .label {
        color: var(--faint);
        font-size: 12px;
      }

      .stat strong {
        display: block;
        margin-top: 4px;
        font-family: var(--serif);
        font-size: 30px;
        font-weight: 700;
        line-height: 1.1;
      }

      .stat .sub {
        margin-top: 3px;
        color: var(--faint);
        font-size: 11.5px;
      }

      .stat.accent {
        border-color: color-mix(in srgb, var(--primary) 45%, var(--line));
        background: linear-gradient(150deg, color-mix(in srgb, var(--primary) 12%, var(--surface)), var(--surface));
      }

      .todos {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .todo {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 16px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface);
        color: var(--ink);
        font-size: 13px;
        text-decoration: none;
        transition:
          border-color 220ms ease,
          translate 220ms ease;
      }

      .todo:hover {
        border-color: var(--primary);
        translate: 0 -1px;
      }

      .todo b {
        color: var(--primary-d);
        font-family: var(--mono);
      }

      .todo.alert b {
        color: var(--danger);
      }

      .columns {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 18px;
        align-items: start;
      }

      .rank {
        display: grid;
        gap: 4px;
      }

      .rank a,
      .rank .row {
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 10px;
        color: var(--ink);
        font-size: 13px;
        text-decoration: none;
      }

      .rank a:hover {
        background: var(--surface-muted);
      }

      .rank .no {
        width: 20px;
        flex: none;
        color: var(--faint);
        font-family: var(--mono);
        font-size: 11.5px;
      }

      .rank a:nth-child(1) .no,
      .rank .row:nth-child(1) .no {
        color: var(--secondary-d);
        font-weight: 700;
      }

      .rank .title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rank .value {
        color: var(--faint);
        font-family: var(--mono);
        font-size: 11.5px;
      }

      .feed {
        display: grid;
        gap: 2px;
      }

      .feed .item {
        display: flex;
        gap: 12px;
        padding: 10px 10px;
        border-radius: 10px;
        font-size: 13px;
      }

      .feed .item:hover {
        background: var(--surface-muted);
      }

      .feed .kind {
        flex: none;
      }

      .feed .body {
        flex: 1;
        min-width: 0;
      }

      .feed .body .line {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .feed time {
        flex: none;
        color: var(--faint);
        font-size: 11.5px;
      }
    `,
  ];

  private rankList(items: Array<{ id: string; title: string; slug?: string; value: number }>, unit: string, href?: (slug?: string) => string) {
    if (!items.length) return html`<adm-empty text="还没有数据"></adm-empty>`;
    return html`<div class="rank">
      ${items.map(
        (item, index) => html`
          <a href=${href ? href(item.slug) : '#/articles'}>
            <span class="no">${String(index + 1).padStart(2, '0')}</span>
            <span class="title">${item.title}</span>
            <span class="value">${item.value} ${unit}</span>
          </a>
        `,
      )}
    </div>`;
  }

  protected render() {
    const overview = this.store.overview;
    if (!overview) {
      return html`<adm-empty text="暂无概览数据" hint="连接后端后这里会显示站点大屏"></adm-empty>`;
    }
    const { counts, totals } = overview;
    const friendApplications = this.store.friends.filter((item) => item.application_email && !item.is_visible).length;
    return html`
      <div class="stats">
        <div class="stat accent"><span class="label">总浏览</span><strong>${totals.views}</strong><span class="sub">全部文章累计</span></div>
        <div class="stat"><span class="label">总点赞</span><strong>${totals.likes}</strong><span class="sub">文章 + 动态</span></div>
        <div class="stat"><span class="label">文章</span><strong>${counts.articles}</strong><span class="sub">${counts.articles_published} 篇已发布</span></div>
        <div class="stat"><span class="label">动态</span><strong>${counts.dynamics}</strong><span class="sub">朋友圈短句</span></div>
        <div class="stat"><span class="label">活跃订阅</span><strong>${counts.subscribers_active}</strong><span class="sub">邮件订阅读者</span></div>
      </div>

      <div class="todos">
        ${counts.comments_pending ? html`<a class="todo alert" href="#/comments"><b>${counts.comments_pending}</b> 条评论待审核 →</a>` : nothing}
        ${friendApplications ? html`<a class="todo alert" href="#/friends"><b>${friendApplications}</b> 个友链申请待处理 →</a>` : nothing}
        ${counts.deliveries_failed ? html`<a class="todo alert" href="#/subscriptions"><b>${counts.deliveries_failed}</b> 封邮件投递失败 →</a>` : nothing}
        ${counts.notifications_unread ? html`<a class="todo" href="#/notifications"><b>${counts.notifications_unread}</b> 条未读消息 →</a>` : nothing}
        ${!counts.comments_pending && !friendApplications && !counts.deliveries_failed && !counts.notifications_unread
          ? html`<span class="todo">今夜无事，一切安好 ✦</span>`
          : nothing}
      </div>

      <div class="columns">
        <section class="panel">
          <h2 class="panel-title">浏览最多的文章</h2>
          ${this.rankList(overview.top_viewed.map((a) => ({ id: a.id, title: a.title, slug: a.slug, value: a.value })), '次', () => '#/articles')}
        </section>
        <section class="panel">
          <h2 class="panel-title">点赞最多的文章</h2>
          ${this.rankList(overview.top_liked_articles.map((a) => ({ id: a.id, title: a.title, slug: a.slug, value: a.value })), '♥', () => '#/articles')}
        </section>
        <section class="panel">
          <h2 class="panel-title">点赞最多的动态</h2>
          ${this.rankList(overview.top_liked_dynamics.map((d) => ({ id: d.id, title: d.excerpt, value: d.like_count })), '♥', () => '#/dynamics')}
        </section>
      </div>

      <div class="columns">
        <section class="panel">
          <h2 class="panel-title">最新评论</h2>
          <div class="feed">
            ${overview.recent_comments.length
              ? overview.recent_comments.map(
                  (comment) => html`
                    <div class="item">
                      <span class="badge kind ${comment.status === 'pending' ? 'warn' : 'ok'}">${enumLabel(commentStatusLabel, comment.status)}</span>
                      <div class="body">
                        <div class="line"><b>${comment.display_name}</b>：${comment.excerpt}</div>
                        <span class="faint">《${comment.target_title}》</span>
                      </div>
                      <time>${formatRelative(comment.created_at)}</time>
                    </div>
                  `,
                )
              : html`<adm-empty text="还没有评论"></adm-empty>`}
          </div>
        </section>
        <section class="panel">
          <h2 class="panel-title">最新消息</h2>
          <div class="feed">
            ${overview.recent_notifications.length
              ? overview.recent_notifications.map(
                  (item) => html`
                    <div class="item">
                      <span class="badge kind">${enumLabel(notificationKindLabel, item.kind)}</span>
                      <div class="body"><div class="line">${item.title}</div><span class="faint">${item.message}</span></div>
                      <time>${formatRelative(item.updated_at)}</time>
                    </div>
                  `,
                )
              : html`<adm-empty text="没有新消息"></adm-empty>`}
          </div>
        </section>
      </div>
    `;
  }
}

customElements.define('adm-dashboard', AdmDashboard);
