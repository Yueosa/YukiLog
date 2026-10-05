import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import {
  deliveryKindLabel,
  deliveryStatusLabel,
  enumLabel,
  formatDateTime,
  subscriberStatusLabel,
} from '../labels.js';
import type { Delivery, Subscriber } from '../types.js';

/** 订阅与投递：左侧订阅者名单，右侧邮件投递记录。 */
export class AdmSubscriptions extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
        align-items: start;
      }

      @media (max-width: 900px) {
        :host {
          grid-template-columns: 1fr;
        }
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .ops {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .err {
        display: block;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .target {
        display: block;
        max-width: 130px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ];

  private subscriberStatusClass(status: string): string {
    if (status === 'active') return 'ok';
    if (status === 'pending') return 'warn';
    return '';
  }

  private deliveryStatusClass(status: string): string {
    if (status === 'sent') return 'ok';
    if (status === 'failed') return 'danger';
    if (status === 'uncertain') return 'warn';
    return '';
  }

  private deliveryTarget(item: Delivery): string {
    if (item.kind === 'confirm_subscription') return '—';
    if (item.article_id) {
      return this.store.articles.find((a) => a.id === item.article_id)?.title ?? '—';
    }
    if (item.dynamic_id) {
      const dynamic = this.store.dynamics.find((d) => d.id === item.dynamic_id);
      return dynamic ? dynamic.content_markdown.slice(0, 20) : '—';
    }
    return '—';
  }

  private subscriberEmail(id: string): string {
    return this.store.subscribers.find((s) => s.id === id)?.email ?? '—';
  }

  private renderSubscriberRow(item: Subscriber) {
    return html`
      <tr>
        <td>${item.email}</td>
        <td>
          <span class="badges">
            ${item.subscribe_articles ? html`<span class="badge ok">文章</span>` : nothing}
            ${item.subscribe_dynamics ? html`<span class="badge ok">动态</span>` : nothing}
            ${!item.subscribe_articles && !item.subscribe_dynamics ? html`<span class="faint">—</span>` : nothing}
          </span>
        </td>
        <td><span class="badge ${this.subscriberStatusClass(item.status)}">${enumLabel(subscriberStatusLabel, item.status)}</span></td>
        <td class="mono">${formatDateTime(item.created_at)}</td>
        <td>
          <button class="btn danger small" ?disabled=${this.store.busy} @click=${() => this.store.deleteSubscriber(item.id)}>删除</button>
        </td>
      </tr>
    `;
  }

  private renderDeliveryRow(item: Delivery) {
    const actionable = item.status !== 'sent';
    return html`
      <tr>
        <td><span class="badge">${enumLabel(deliveryKindLabel, item.kind)}</span></td>
        <td><span class="target" title=${this.deliveryTarget(item)}>${this.deliveryTarget(item)}</span></td>
        <td>${this.subscriberEmail(item.subscriber_id)}</td>
        <td><span class="badge ${this.deliveryStatusClass(item.status)}">${enumLabel(deliveryStatusLabel, item.status)}</span></td>
        <td class="mono">${item.attempt_count}</td>
        <td>${item.last_error ? html`<span class="faint err" title=${item.last_error}>${item.last_error}</span>` : html`<span class="faint">—</span>`}</td>
        <td>
          ${actionable
            ? html`<span class="ops">
                ${item.status !== 'sending'
                  ? html`<button class="btn secondary small" ?disabled=${this.store.busy} @click=${() => this.store.deliveryAction(item.id, 'retry')}>重试</button>`
                  : nothing}
                <button class="btn secondary small" ?disabled=${this.store.busy} @click=${() => this.store.deliveryAction(item.id, 'cancel')}>取消</button>
              </span>`
            : html`<span class="faint">—</span>`}
        </td>
      </tr>
    `;
  }

  protected render() {
    const subscribers = this.store.subscribers;
    const deliveries = this.store.deliveries;
    return html`
      <section class="panel">
        <h2 class="panel-title">订阅者</h2>
        ${subscribers.length
          ? html`<div class="table-wrap">
              <table>
                <thead>
                  <tr><th>邮箱</th><th>订阅内容</th><th>状态</th><th>订阅时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                  ${subscribers.map((item) => this.renderSubscriberRow(item))}
                </tbody>
              </table>
            </div>`
          : html`<adm-empty text="还没有订阅者" hint="读者在前台留下邮箱后会出现在这里"></adm-empty>`}
      </section>
      <section class="panel">
        <h2 class="panel-title">投递记录</h2>
        ${deliveries.length
          ? html`<div class="table-wrap">
              <table>
                <thead>
                  <tr><th>类型</th><th>目标</th><th>收件人</th><th>状态</th><th>尝试</th><th>错误</th><th>操作</th></tr>
                </thead>
                <tbody>
                  ${deliveries.map((item) => this.renderDeliveryRow(item))}
                </tbody>
              </table>
            </div>`
          : html`<adm-empty text="还没有投递记录"></adm-empty>`}
      </section>
    `;
  }
}

customElements.define('adm-subscriptions', AdmSubscriptions);
