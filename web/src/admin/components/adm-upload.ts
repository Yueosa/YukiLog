import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { store } from '../store.js';
import type { MediaAsset } from '../types.js';

/** 上传区：点击打开文件管理器或拖拽上传，成功后抛出 adm-upload 事件。 */
export class AdmUpload extends LitElement {
  @property() accept = 'image/*,video/mp4,video/webm';
  @property() text = '点击选择文件，或把文件拖到这里';
  @property({ type: Boolean }) compact = false;
  @state() private dragging = false;
  @state() private uploading = false;

  static styles = css`
    .zone {
      display: grid;
      place-items: center;
      gap: 6px;
      padding: 26px 18px;
      border: 1.5px dashed var(--line, #dde5ec);
      border-radius: 14px;
      background: var(--surface-muted, #eef2f5);
      color: var(--faint, #93a3b3);
      font-size: 13px;
      text-align: center;
      cursor: pointer;
      transition:
        border-color 220ms ease,
        background 220ms ease,
        color 220ms ease;
    }

    .zone.compact {
      padding: 12px 14px;
    }

    .zone:hover,
    .zone.dragging {
      border-color: var(--primary, #7eb6d9);
      background: color-mix(in srgb, var(--primary, #7eb6d9) 8%, var(--surface, #fff));
      color: var(--primary-d, #4a93c2);
    }

    .zone.uploading {
      pointer-events: none;
      opacity: 0.6;
    }

    svg {
      width: 22px;
      height: 22px;
    }

    input {
      display: none;
    }
  `;

  private open() {
    this.renderRoot.querySelector<HTMLInputElement>('input')?.click();
  }

  private async handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file || this.uploading) return;
    this.uploading = true;
    try {
      const uploaded: MediaAsset | null = await store.uploadMedia(file);
      if (uploaded) {
        this.dispatchEvent(
          new CustomEvent('adm-upload', { detail: { media: uploaded }, bubbles: true, composed: true }),
        );
      }
    } finally {
      this.uploading = false;
    }
  }

  protected render() {
    return html`
      <div
        class="zone${this.dragging ? ' dragging' : ''}${this.uploading ? ' uploading' : ''}${this.compact ? ' compact' : ''}"
        @click=${this.open}
        @dragover=${(e: DragEvent) => {
          e.preventDefault();
          this.dragging = true;
        }}
        @dragleave=${() => (this.dragging = false)}
        @drop=${(e: DragEvent) => {
          e.preventDefault();
          this.dragging = false;
          void this.handleFiles(e.dataTransfer?.files ?? null);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
          <path d="M12 16V5m0 0-4.5 4.5M12 5l4.5 4.5" />
          <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
        </svg>
        <span>${this.uploading ? '上传中…' : this.text}</span>
        <input
          type="file"
          accept=${this.accept}
          @change=${(e: Event) => {
            void this.handleFiles((e.currentTarget as HTMLInputElement).files);
            (e.currentTarget as HTMLInputElement).value = '';
          }}
        />
      </div>
      ${nothing}
    `;
  }
}

customElements.define('adm-upload', AdmUpload);
