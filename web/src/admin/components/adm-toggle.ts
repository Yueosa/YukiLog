import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';

/** 夜航开关：替代裸 checkbox。 */
export class AdmToggle extends LitElement {
  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean }) disabled = false;
  @property() label = '';

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      cursor: pointer;
      user-select: none;
    }

    :host([disabled]) {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .track {
      position: relative;
      width: 38px;
      height: 22px;
      flex: none;
      border-radius: 999px;
      background: var(--line, #dde5ec);
      transition: background 240ms ease;
    }

    .knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgb(28 39 51 / 25%);
      transition: translate 240ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    :host([checked]) .track {
      background: var(--primary-d, #4a93c2);
    }

    :host([checked]) .knob {
      translate: 16px 0;
    }

    .label {
      color: var(--muted, #5d6b7a);
      font-size: 13px;
    }
  `;

  private toggle() {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('adm-change', { detail: { checked: this.checked }, bubbles: true, composed: true }));
  }

  protected render() {
    return html`
      <span class="track" @click=${this.toggle}><span class="knob"></span></span>
      ${this.label ? html`<span class="label" @click=${this.toggle}>${this.label}</span>` : ''}
    `;
  }
}

customElements.define('adm-toggle', AdmToggle);
