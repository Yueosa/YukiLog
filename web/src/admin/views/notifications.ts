import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import {
  emailStatusLabel,
  enumLabel,
  formatRelative,
  frequencyLabel,
  notificationKindLabel,
} from '../labels.js';
import type { AdminNotification, NotificationSettings } from '../types.js';

/** 消息中心：左侧站内消息流，右侧通知偏好。 */
export class AdmNotifications extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private form: NotificationSettings | null = null;
  private syncedFrom: NotificationSettings | null = null;

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 18px;
        align-items: start;
      }

      @media (max-width: 900px) {
        :host {
          grid-template-columns: 1fr;
        }
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .toolbar .left {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .feed {
        display: grid;
        gap: 12px;
      }

      .note {
        position: relative;
        padding: 14px 16px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
      }

      .note.unread {
        border-left: 3px solid var(--primary);
      }

      .note .head {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }

      .note .title {
        flex: 1;
        min-width: 0;
        font-size: 13.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .note.unread .title {
        font-weight: 700;
      }

      .note time {
        flex: none;
        color: var(--faint);
        font-size: 11.5px;
      }

      .note .msg {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .note .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
      }

      .note .meta .err {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }

      .note .ops {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .toggles {
        display: grid;
        gap: 12px;
      }
    `,
  ];

  protected willUpdate() {
    if (this.store.notificationSettings !== this.syncedFrom) {
      this.syncedFrom = this.store.notificationSettings;
      this.form = { ...this.store.notificationSettings };
    }
  }

  private targetHref(url: string): string {
    if (url.startsWith('/admin#')) return `#/${url.slice('/admin#'.length)}`;
    return url;
  }

  private emailBadgeClass(status: string): string {
    if (status === 'sent') return 'ok';
    if (status === 'failed') return 'danger';
    return '';
  }

  private patchForm(patch: Partial<NotificationSettings>) {
    if (this.form) this.form = { ...this.form, ...patch };
  }

  private renderNote(item: AdminNotification) {
    const unread = !item.read_at;
    const canRetryEmail = !['sent', 'sending', 'pending', 'suppressed'].includes(item.email_status);
    const canCancelEmail = !['sent', 'cancelled', 'suppressed'].includes(item.email_status);
    return html`
      <article class="note ${unread ? 'unread' : ''}">
        <div class="head">
          <span class="badge">${enumLabel(notificationKindLabel, item.kind)}</span>
          <span class="title">${item.title}${item.event_count > 1 ? ` ×${item.event_count}` : ''}</span>
          <time>${formatRelative(item.updated_at)}</time>
        </div>
        <p class="msg">${item.message}</p>
        <div class="meta">
          <span class="badge ${this.emailBadgeClass(item.email_status)}">${enumLabel(emailStatusLabel, item.email_status)}</span>
          ${item.email_last_error ? html`<span class="faint err">${item.email_last_error}</span>` : nothing}
        </div>
        <div class="ops">
          <a class="btn secondary small" href=${this.targetHref(item.target_url)}>查看</a>
          ${unread
            ? html`<button class="btn secondary small" ?disabled=${this.store.busy} @click=${() => this.store.markNotificationRead(item.id)}>标为已读</button>`
            : nothing}
          ${canRetryEmail
            ? html`<button class="btn secondary small" ?disabled=${this.store.busy} @click=${() => this.store.notificationEmailAction(item, 'email-retry')}>邮件重试</button>`
            : nothing}
          ${canCancelEmail
            ? html`<button class="btn secondary small" ?disabled=${this.store.busy} @click=${() => this.store.notificationEmailAction(item, 'email-cancel')}>取消邮件</button>`
            : nothing}
        </div>
      </article>
    `;
  }

  private renderSettings() {
    const form = this.form;
    if (!form) return nothing;
    return html`
      <section class="panel">
        <h2 class="panel-title">通知设置</h2>
        <div class="toggles">
          <label class="field">
            <span>通知邮箱</span>
            <input
              type="email"
              placeholder="you@example.com"
              .value=${form.notification_email ?? ''}
              @input=${(e: InputEvent) => this.patchForm({ notification_email: (e.target as HTMLInputElement).value || null })}
            />
          </label>
          <adm-toggle
            label="启用邮件提醒"
            .checked=${form.email_notifications_enabled}
            @adm-change=${(e: CustomEvent<{ checked: boolean }>) => this.patchForm({ email_notifications_enabled: e.detail.checked })}
          ></adm-toggle>
          <adm-toggle
            label="评论"
            .checked=${form.notify_on_comments}
            @adm-change=${(e: CustomEvent<{ checked: boolean }>) => this.patchForm({ notify_on_comments: e.detail.checked })}
          ></adm-toggle>
          <adm-toggle
            label="友链申请"
            .checked=${form.notify_on_friend_links}
            @adm-change=${(e: CustomEvent<{ checked: boolean }>) => this.patchForm({ notify_on_friend_links: e.detail.checked })}
          ></adm-toggle>
          <adm-toggle
            label="点赞"
            .checked=${form.notify_on_likes}
            @adm-change=${(e: CustomEvent<{ checked: boolean }>) => this.patchForm({ notify_on_likes: e.detail.checked })}
          ></adm-toggle>
          <label class="field">
            <span>邮件频率</span>
            <select
              .value=${form.notification_frequency}
              @change=${(e: Event) =>
                this.patchForm({ notification_frequency: (e.target as HTMLSelectElement).value as NotificationSettings['notification_frequency'] })}
            >
              ${Object.entries(frequencyLabel).map(([value, label]) => html`<option value=${value} ?selected=${form.notification_frequency === value}>${label}</option>`)}
            </select>
          </label>
          <p class="faint">聚合频率只影响邮件投递节奏，站内消息实时更新；未勾选的事件仍会出现在消息列表，但不会发邮件。</p>
          <button class="btn primary" ?disabled=${this.store.busy} @click=${() => this.store.saveNotificationSettings(this.form)}>保存通知设置</button>
        </div>
      </section>
    `;
  }

  protected render() {
    const items = this.store.notifications;
    const unread = this.store.unreadNotifications;
    return html`
      <section class="panel">
        <div class="toolbar">
          <div class="left">
            <h2 class="panel-title" style="margin: 0">消息</h2>
            <span class="badge ${unread ? 'warn' : ''}">${unread} 条未读</span>
          </div>
          <button
            class="btn secondary small"
            ?disabled=${!unread || this.store.busy}
            @click=${() => this.store.markAllNotificationsRead()}
          >全部标为已读</button>
        </div>
        <div class="feed">
          ${items.length
            ? items.map((item) => this.renderNote(item))
            : html`<adm-empty text="还没有消息" hint="评论、友链申请与点赞会聚合在这里"></adm-empty>`}
        </div>
      </section>
      ${this.renderSettings()}
    `;
  }
}

customElements.define('adm-notifications', AdmNotifications);
