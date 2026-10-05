import { LitElement, css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { store } from '../store.js';

/** Toast 宿主：挂在壳层右下角，订阅 store.toasts。 */
export class AdmToastHost extends LitElement {
  @state() private toasts = store.toasts;

  static styles = css`
    :host {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 200;
      display: grid;
      gap: 10px;
      pointer-events: none;
    }

    .toast {
      min-width: 240px;
      max-width: 360px;
      padding: 12px 16px;
      border: 1px solid var(--line, #dde5ec);
      border-left: 3px solid var(--primary-d, #4a93c2);
      border-radius: 12px;
      background: var(--surface, #fff);
      color: var(--ink, #1c2733);
      font-size: 13px;
      box-shadow: 0 12px 32px -12px rgb(28 39 51 / 22%);
      animation: slide-in 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    .toast.ok {
      border-left-color: var(--primary-d, #4a93c2);
    }

    .toast.err {
      border-left-color: var(--danger, #c04a63);
    }

    .toast.info {
      border-left-color: var(--secondary, #e8a4b4);
    }

    @keyframes slide-in {
      from {
        opacity: 0;
        translate: 0 12px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    store.addEventListener('change', this.sync);
  }

  disconnectedCallback() {
    store.removeEventListener('change', this.sync);
    super.disconnectedCallback();
  }

  private sync = () => {
    this.toasts = store.toasts;
  };

  protected render() {
    if (!this.toasts.length) return nothing;
    return html`${this.toasts.map((item) => html`<div class="toast ${item.kind}">${item.message}</div>`)}`;
  }
}

customElements.define('adm-toast-host', AdmToastHost);
