import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { store } from '../store.js';
import type { MediaAsset } from '../types.js';

type QueueStatus = 'pending' | 'uploading' | 'done' | 'error';

type QueueItem = {
  id: number;
  file: File;
  name: string;
  progress: number;
  status: QueueStatus;
  error?: string;
  /** 命中服务端去重、复用了已有媒体。 */
  reused?: boolean;
};

/**
 * 上传区：点击打开文件管理器或拖拽上传，支持多选/多文件拖放。
 * 每个文件单独一个 POST，下方队列逐行展示进度与成败，失败可重试；
 * 每个成功项抛一次 adm-upload 事件（detail.media），整批结束后统一刷新媒体列表。
 */
export class AdmUpload extends LitElement {
  @property() accept = 'image/*,video/mp4,video/webm';
  @property() text = '点击选择文件，或把文件拖到这里';
  @property({ type: Boolean }) compact = false;
  @state() private dragging = false;
  @state() private queue: QueueItem[] = [];
  private queueSeq = 0;
  private processing = false;

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

    svg {
      width: 22px;
      height: 22px;
    }

    input {
      display: none;
    }

    .queue {
      display: grid;
      gap: 6px;
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
    }

    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 110px auto auto;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      border: 1px solid var(--line, #dde5ec);
      border-radius: 10px;
      background: var(--surface, #fff);
      font-size: 12px;
    }

    .row .name {
      overflow: hidden;
      color: var(--ink, #1c2733);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row .bar {
      overflow: hidden;
      height: 6px;
      border-radius: 999px;
      background: var(--surface-muted, #eef2f5);
    }

    .row .fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--primary, #7eb6d9);
      transition: width 160ms ease;
    }

    .row.error .fill {
      background: var(--danger, #c04a63);
    }

    .row .state {
      color: var(--faint, #93a3b3);
      font-family: var(--mono, monospace);
      font-size: 11px;
      white-space: nowrap;
    }

    .row.done .state {
      color: var(--primary-d, #4a93c2);
    }

    .row.error .state {
      color: var(--danger, #d98a8a);
    }

    .row .retry {
      padding: 2px 10px;
      border: 1px solid var(--line, #dde5ec);
      border-radius: 999px;
      background: var(--surface, #fff);
      color: var(--ink, #1c2733);
      font: inherit;
      font-size: 11px;
      cursor: pointer;
    }

    .row .retry:hover {
      border-color: var(--primary, #7eb6d9);
      color: var(--primary-d, #4a93c2);
    }

    .queue-foot {
      display: flex;
      justify-content: flex-end;
    }

    .queue-foot .clear {
      padding: 0;
      border: none;
      background: none;
      color: var(--faint, #93a3b3);
      font: inherit;
      font-size: 11.5px;
      cursor: pointer;
    }

    .queue-foot .clear:hover {
      color: var(--ink, #1c2733);
    }
  `;

  private open() {
    this.renderRoot.querySelector<HTMLInputElement>('input')?.click();
  }

  private patch(id: number, changes: Partial<QueueItem>) {
    this.queue = this.queue.map((item) => (item.id === id ? { ...item, ...changes } : item));
  }

  private handleFiles(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length || store.previewMode) {
      if (list.length) store.toast('预览模式：改动不会保存', 'info');
      return;
    }
    this.queue = [
      ...this.queue,
      ...list.map((file) => ({
        id: ++this.queueSeq,
        file,
        name: file.name,
        progress: 0,
        status: 'pending' as QueueStatus,
      })),
    ];
    void this.process();
  }

  /** 顺序处理队列里的 pending 项；处理中再次入队会被同一轮循环捎上。 */
  private async process() {
    if (this.processing) return;
    this.processing = true;
    const knownIds = new Set(store.media.map((item) => item.id));
    try {
      for (;;) {
        const item = this.queue.find((entry) => entry.status === 'pending');
        if (!item) break;
        this.patch(item.id, { status: 'uploading', progress: 0, error: undefined, reused: undefined });
        try {
          const uploaded: MediaAsset | null = await store.uploadMedia(item.file, (percent) =>
            this.patch(item.id, { progress: percent }),
          );
          if (!uploaded) continue;
          const reused = knownIds.has(uploaded.id);
          knownIds.add(uploaded.id);
          this.patch(item.id, { status: 'done', progress: 100, reused });
          this.dispatchEvent(
            new CustomEvent('adm-upload', { detail: { media: uploaded }, bubbles: true, composed: true }),
          );
        } catch (error) {
          this.patch(item.id, {
            status: 'error',
            error: error instanceof Error ? error.message : '上传失败',
          });
        }
      }
      if (this.queue.length) await this.summarize();
    } finally {
      this.processing = false;
    }
  }

  /** 整批结束：刷新媒体列表 + 汇总 toast。 */
  private async summarize() {
    await store.refreshMedia();
    const done = this.queue.filter((item) => item.status === 'done');
    const failed = this.queue.filter((item) => item.status === 'error').length;
    const reused = done.filter((item) => item.reused).length;
    if (failed) {
      store.toast(`上传完成：成功 ${done.length} 个，失败 ${failed} 个`, 'err');
    } else if (reused) {
      store.toast(reused === done.length ? '文件与已有媒体内容重复，已自动复用' : `上传成功（${reused} 个重复文件已复用）`);
    } else {
      store.toast(done.length > 1 ? `上传成功（${done.length} 个文件）` : '上传成功');
    }
  }

  private retry(item: QueueItem) {
    if (this.processing) return;
    this.patch(item.id, { status: 'pending', progress: 0, error: undefined });
    void this.process();
  }

  private clearFinished() {
    if (this.processing) return;
    this.queue = [];
  }

  private stateText(item: QueueItem): string {
    switch (item.status) {
      case 'pending':
        return '等待中';
      case 'uploading':
        return `${item.progress}%`;
      case 'done':
        return item.reused ? '已复用' : '成功';
      case 'error':
        return item.error ?? '失败';
    }
  }

  protected render() {
    return html`
      <div
        class="zone${this.dragging ? ' dragging' : ''}${this.compact ? ' compact' : ''}"
        @click=${this.open}
        @dragover=${(e: DragEvent) => {
          e.preventDefault();
          this.dragging = true;
        }}
        @dragleave=${() => (this.dragging = false)}
        @drop=${(e: DragEvent) => {
          e.preventDefault();
          this.dragging = false;
          this.handleFiles(e.dataTransfer?.files ?? null);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
          <path d="M12 16V5m0 0-4.5 4.5M12 5l4.5 4.5" />
          <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
        </svg>
        <span>${this.text}</span>
        <input
          type="file"
          multiple
          accept=${this.accept}
          @change=${(e: Event) => {
            this.handleFiles((e.currentTarget as HTMLInputElement).files);
            (e.currentTarget as HTMLInputElement).value = '';
          }}
        />
      </div>
      ${this.queue.length
        ? html`
            <ul class="queue">
              ${this.queue.map(
                (item) => html`
                  <li class="row ${item.status}">
                    <span class="name" title=${item.name}>${item.name}</span>
                    <span class="bar"><span class="fill" style="width:${item.progress}%"></span></span>
                    <span class="state" title=${item.error ?? ''}>${this.stateText(item)}</span>
                    ${item.status === 'error'
                      ? html`<button class="retry" type="button" @click=${() => this.retry(item)}>重试</button>`
                      : nothing}
                  </li>
                `,
              )}
            </ul>
            ${this.processing
              ? nothing
              : html`<div class="queue-foot">
                  <button class="clear" type="button" @click=${this.clearFinished}>清空列表</button>
                </div>`}
          `
        : nothing}
    `;
  }
}

customElements.define('adm-upload', AdmUpload);
