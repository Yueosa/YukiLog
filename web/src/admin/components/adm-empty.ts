import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';

/** 空态：小插画 + 文案。 */
export class AdmEmpty extends LitElement {
  @property() text = '这里还什么都没有';
  @property() hint = '';

  static styles = css`
    :host {
      display: grid;
      place-items: center;
      gap: 8px;
      padding: 48px 20px;
      color: var(--faint, #93a3b3);
      text-align: center;
    }

    svg {
      width: 44px;
      height: 44px;
      opacity: 0.7;
    }

    .text {
      font-size: 13.5px;
    }

    .hint {
      font-size: 12px;
      opacity: 0.8;
    }
  `;

  protected render() {
    return html`
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 5" />
        <path d="M24 15l2.3 7.2 7.2 2.3-7.2 2.3L24 34l-2.3-7.2-7.2-2.3 7.2-2.3z" fill="currentColor" opacity="0.55" />
      </svg>
      <span class="text">${this.text}</span>
      ${this.hint ? html`<span class="hint">${this.hint}</span>` : ''}
    `;
  }
}

customElements.define('adm-empty', AdmEmpty);
