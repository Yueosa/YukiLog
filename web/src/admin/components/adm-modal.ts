import { LitElement, css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { store } from '../store.js';
import { adminTheme } from '../theme.js';

/** 模态框宿主：confirm / 字段表单，Promise 由 store.confirm/prompt 发起。 */
export class AdmModalHost extends LitElement {
  @state() private modal = store.modal;

  static styles = [
    adminTheme,
    css`
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 150;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgb(28 39 51 / 38%);
        backdrop-filter: blur(3px);
        animation: fade-in 220ms ease;
      }

      .dialog {
        width: min(440px, 100%);
        padding: 24px 26px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--surface);
        box-shadow: 0 24px 64px -16px rgb(28 39 51 / 35%);
        animation: pop-in 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
      }

      .dialog h3 {
        margin: 0 0 10px;
        font-family: var(--serif);
        font-size: 18px;
      }

      .dialog .msg {
        margin: 0 0 16px;
        color: var(--muted);
        font-size: 13.5px;
        line-height: 1.8;
      }

      .fields {
        display: grid;
        gap: 12px;
        margin-bottom: 18px;
      }

      .row {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      @keyframes fade-in {
        from { opacity: 0; }
      }

      @keyframes pop-in {
        from {
          opacity: 0;
          scale: 0.96;
          translate: 0 8px;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    store.addEventListener('change', this.sync);
  }

  disconnectedCallback() {
    store.removeEventListener('change', this.sync);
    super.disconnectedCallback();
  }

  private sync = () => {
    this.modal = store.modal;
  };

  private submit(event: SubmitEvent) {
    event.preventDefault();
    const modal = this.modal;
    if (!modal) return;
    if (!modal.fields) {
      store.closeModal({});
      return;
    }
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const values: Record<string, string> = {};
    for (const field of modal.fields) values[field.name] = String(data.get(field.name) ?? '');
    store.closeModal(values);
  }

  protected render() {
    const modal = this.modal;
    if (!modal) return nothing;
    return html`
      <div class="backdrop" @click=${() => store.closeModal(null)}>
        <form class="dialog" @submit=${this.submit} @click=${(e: Event) => e.stopPropagation()}>
          <h3>${modal.title}</h3>
          ${modal.message ? html`<p class="msg">${modal.message}</p>` : nothing}
          ${modal.fields
            ? html`<div class="fields">
                ${modal.fields.map(
                  (field) => html`
                    <label class="field">
                      <span>${field.label}</span>
                      <input
                        name=${field.name}
                        type=${field.type ?? 'text'}
                        .value=${field.value ?? ''}
                        ?required=${field.required ?? false}
                      />
                    </label>
                  `,
                )}
              </div>`
            : nothing}
          <div class="row">
            <button type="button" class="btn secondary" @click=${() => store.closeModal(null)}>取消</button>
            <button class="btn${modal.danger ? ' danger' : ' primary'}">${modal.confirmLabel ?? '确定'}</button>
          </div>
        </form>
      </div>
    `;
  }
}

customElements.define('adm-modal-host', AdmModalHost);
