import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { contentStatusLabel, formatDateTime } from '../labels.js';
import type { Dynamic, MediaAsset } from '../types.js';

const MOOD_PRESETS = ['😊 开心', '🌙 平静', '🌧️ emo', '☕ 疲惫', '✨ 期待'];
const MAX_MEDIA = 9;

/** 动态编辑器：正文 + 心情 + 配图九宫格 + 发布/定时/撤回。 */
export class AdmDynamicEdit extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private content = '';
  @state() private mood = '';
  @state() private allowComments = true;
  @state() private mediaIds: string[] = [];
  @state() private pickerOpen = false;

  /** 已同步进表单的 dynamic id；防止 store 刷新覆盖未保存的编辑。 */
  private syncedFor: string | null | undefined = undefined;

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 18px;
        max-width: 760px;
      }

      .back {
        justify-self: start;
        padding: 0;
        border: 0;
        background: none;
        color: var(--muted);
        font-size: 13px;
      }

      .back:hover {
        color: var(--primary-d);
      }

      .head {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .head .time {
        color: var(--faint);
        font-size: 12px;
      }

      textarea.content {
        min-height: 140px;
      }

      .media-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 10px;
      }

      .thumb {
        position: relative;
        aspect-ratio: 1;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface-muted);
      }

      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .thumb button {
        position: absolute;
        top: 5px;
        right: 5px;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: rgb(28 39 51 / 65%);
        color: #fff;
        font-size: 13px;
        line-height: 1;
        display: grid;
        place-items: center;
      }

      .thumb button:hover {
        background: var(--danger);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }

      .actions .spacer {
        flex: 1;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void this.store.refreshMedia();
  }

  protected willUpdate() {
    if (this.syncedFor === this.dynamicId) return;    if (this.dynamicId) {
      const item = this.store.dynamics.find((entry) => entry.id === this.dynamicId);
      if (!item) return;
      this.content = item.content_markdown;
      this.mood = item.mood ?? '';
      this.allowComments = item.allow_comments;
      this.mediaIds = item.media.map((media) => media.id);
    } else {
      this.content = '';
      this.mood = '';
      this.allowComments = true;
      this.mediaIds = [];
    }
    this.syncedFor = this.dynamicId;
  }

  private get current(): Dynamic | null {
    return this.dynamicId ? (this.store.dynamics.find((item) => item.id === this.dynamicId) ?? null) : null;
  }

  private mediaUrl(id: string): string | null {
    const fromDynamic = this.current?.media.find((media) => media.id === id);
    if (fromDynamic) return fromDynamic.url;
    const fromStore: MediaAsset | undefined = this.store.media.find((media) => media.id === id);
    return fromStore?.url ?? null;
  }

  private addMedia(id: string) {
    if (this.mediaIds.length >= MAX_MEDIA) {
      this.store.toast(`最多只能配 ${MAX_MEDIA} 张图`, 'info');
      return;
    }
    this.mediaIds = [...this.mediaIds, id];
  }

  private onUpload(event: CustomEvent<{ media: MediaAsset }>) {
    this.addMedia(event.detail.media.id);
  }

  private onPick(event: CustomEvent<{ media: MediaAsset }>) {
    this.pickerOpen = false;
    if (!this.mediaIds.includes(event.detail.media.id)) this.addMedia(event.detail.media.id);
  }

  private removeMedia(id: string) {
    this.mediaIds = this.mediaIds.filter((item) => item !== id);
  }

  private async save(): Promise<Dynamic | null> {
    const saved = await this.store.saveDynamic(this.dynamicId, {
      content_markdown: this.content,
      mood: this.mood.trim() || null,
      allow_comments: this.allowComments,
      media_ids: this.mediaIds,
    });
    if (saved && !this.dynamicId) {
      location.hash = `#/dynamics/${saved.id}`;
    }
    return saved;
  }

  private async publishNow() {
    const saved = await this.save();
    const id = this.dynamicId ?? saved?.id;
    if (!id) return;
    await this.store.dynamicAction(id, 'publish');
    if (this.store.dynamics.find((item) => item.id === id)?.status === 'published') {
      location.hash = '#/dynamics';
    }
  }

  private async schedule() {
    const result = await this.store.prompt(
      '定时发布',
      [{ name: 'published_at', label: '发布时间', type: 'datetime-local', required: true }],
      '定时发布',
    );
    const value = result?.published_at;
    if (!value) return;
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) {
      this.store.toast('时间格式不正确', 'err');
      return;
    }
    const saved = await this.save();
    const id = this.dynamicId ?? saved?.id;
    if (!id) return;
    await this.store.dynamicAction(id, 'publish', at.toISOString());
    if (this.store.dynamics.find((item) => item.id === id)?.status === 'published') {
      location.hash = '#/dynamics';
    }
  }

  private async removeDynamic() {
    await this.store.deleteDynamic(this.dynamicId!);
    if (this.dynamicId && !this.store.dynamics.some((item) => item.id === this.dynamicId)) {
      location.hash = '#/dynamics';
    }
  }

  protected render() {
    const item = this.current;
    if (this.dynamicId && !item) {
      return html`<adm-empty text="动态不存在" hint="它可能已被删除"></adm-empty>`;
    }
    return html`
      <button class="back" @click=${() => (location.hash = '#/dynamics')}>← 返回列表</button>

      <section class="panel">
        <div class="head">
          ${item
            ? html`
                <span class="badge ${item.status === 'published' ? 'ok' : ''}">${contentStatusLabel(item)}</span>
                <span class="time">
                  ${item.status === 'published' && item.published_at
                    ? `发布于 ${formatDateTime(item.published_at)}`
                    : `创建于 ${formatDateTime(item.created_at)}`}
                </span>
              `
            : html`<span class="badge">草稿</span><span class="time">尚未保存</span>`}
        </div>

        <label class="field" style="margin-top: 14px">
          <span>内容</span>
          <textarea
            class="content"
            .value=${this.content}
            placeholder="此刻在想什么…"
            @input=${(e: Event) => (this.content = (e.currentTarget as HTMLTextAreaElement).value)}
          ></textarea>
        </label>

        <label class="field" style="margin-top: 14px">
          <span>心情</span>
          <input
            list="mood-presets"
            maxlength="40"
            .value=${this.mood}
            placeholder="选一个，或随便写"
            @input=${(e: Event) => (this.mood = (e.currentTarget as HTMLInputElement).value)}
          />
          <datalist id="mood-presets">
            ${MOOD_PRESETS.map((preset) => html`<option value=${preset}></option>`)}
          </datalist>
        </label>

        <div class="field" style="margin-top: 14px">
          <span>配图（${this.mediaIds.length}/${MAX_MEDIA}）</span>
          ${this.mediaIds.length
            ? html`<div class="media-grid">
                ${this.mediaIds.map((id) => {
                  const url = this.mediaUrl(id);
                  return url
                    ? html`<div class="thumb">
                        <img src=${url} alt="配图" />
                        <button type="button" aria-label="移除配图" @click=${() => this.removeMedia(id)}>×</button>
                      </div>`
                    : nothing;
                })}
              </div>`
            : nothing}
          <adm-upload
            accept="image/*"
            compact
            text=${this.mediaIds.length ? '继续添加图片' : '点击或拖拽添加图片'}
            @adm-upload=${this.onUpload}
          ></adm-upload>
          <div style="margin-top: 8px">
            <button class="btn secondary small" type="button" @click=${() => (this.pickerOpen = true)}>
              从媒体库选择
            </button>
          </div>
        </div>

        <div style="margin-top: 14px">
          <adm-toggle
            label="允许评论"
            .checked=${this.allowComments}
            @adm-change=${(e: CustomEvent<{ checked: boolean }>) => (this.allowComments = e.detail.checked)}
          ></adm-toggle>
        </div>

        <div class="actions" style="margin-top: 18px">
          <button class="btn primary" ?disabled=${this.store.busy} @click=${this.save}>保存</button>
          ${item?.status !== 'published'
            ? html`
                <button class="btn" ?disabled=${this.store.busy} @click=${this.publishNow}>立即发布</button>
                <button class="btn secondary" ?disabled=${this.store.busy} @click=${this.schedule}>定时发布</button>
              `
            : nothing}
          <span class="spacer"></span>
          ${item?.status === 'published'
            ? html`<button
                class="btn secondary"
                ?disabled=${this.store.busy}
                @click=${() => this.store.dynamicAction(item.id, 'withdraw')}
              >
                撤回为草稿
              </button>`
            : nothing}
          ${item
            ? html`<button class="btn danger" ?disabled=${this.store.busy} @click=${this.removeDynamic}>删除</button>`
            : nothing}
        </div>
      </section>
      <adm-media-picker
        ?open=${this.pickerOpen}
        .selectedId=${null}
        @adm-pick=${this.onPick}
        @adm-close=${() => (this.pickerOpen = false)}
      ></adm-media-picker>
    `;
  }
}

customElements.define('adm-dynamic-edit', AdmDynamicEdit);
