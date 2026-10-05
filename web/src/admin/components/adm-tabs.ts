import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';

export type AdmTab = { key: string; label: string; count?: number };

/** 下划线页签：用于评论审核队列等视图内切换。 */
export class AdmTabs extends LitElement {
  @property({ attribute: false }) tabs: AdmTab[] = [];
  @property() active = '';

  static styles = css`
    :host {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--line, #dde5ec);
    }

    button {
      position: relative;
      padding: 9px 14px;
      border: 0;
      background: transparent;
      color: var(--faint, #93a3b3);
      font-size: 13px;
      transition: color 220ms ease;
    }

    button:hover {
      color: var(--ink, #1c2733);
    }

    button.active {
      color: var(--primary-d, #4a93c2);
      font-weight: 600;
    }

    button.active::after {
      content: '';
      position: absolute;
      right: 12px;
      bottom: -1px;
      left: 12px;
      height: 2px;
      border-radius: 2px;
      background: var(--primary-d, #4a93c2);
    }

    .count {
      margin-left: 5px;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--surface-muted, #eef2f5);
      font-size: 11px;
    }

    button.active .count {
      background: color-mix(in srgb, var(--primary, #7eb6d9) 20%, transparent);
    }
  `;

  private pick(key: string) {
    this.dispatchEvent(new CustomEvent('adm-tab', { detail: { key }, bubbles: true, composed: true }));
  }

  protected render() {
    return html`${this.tabs.map(
      (tab) => html`
        <button class=${tab.key === this.active ? 'active' : ''} @click=${() => this.pick(tab.key)}>
          ${tab.label}${tab.count !== undefined ? html`<span class="count">${tab.count}</span>` : ''}
        </button>
      `,
    )}`;
  }
}

customElements.define('adm-tabs', AdmTabs);
