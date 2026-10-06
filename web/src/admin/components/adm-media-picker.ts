import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { mediaPickerLabel, mediaPickerModalLabel } from '../labels.js';
import type { MediaAsset } from '../types.js';
import { heroMediaIdOf } from '../types.js';
import './adm-upload.js';
import './adm-empty.js';

type GroupKey = 'all' | 'unused' | 'article-cover' | 'dynamic' | 'site';

const GROUP_ORDER: GroupKey[] = ['all', 'unused', 'article-cover', 'dynamic', 'site'];

const groupText: Record<GroupKey, string> = {
  all: mediaPickerModalLabel.groupAll,
  unused: mediaPickerModalLabel.groupUnused,
  'article-cover': mediaPickerModalLabel.groupArticleCover,
  dynamic: mediaPickerModalLabel.groupDynamic,
  site: mediaPickerModalLabel.groupSite,
};

/**
 * 媒体选择器弹窗：全屏遮罩 + 分组筛选/搜索/上传/网格单选。
 * 打开时设 open 与 selectedId；确认抛 adm-pick（detail.media），取消抛 adm-close。
 */
export class AdmMediaPicker extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) multiple = false;
  @property() selectedId: string | null = null;

  @state() private group: GroupKey = 'all';
  @state() private query = '';
  @state() private pickedIds: string[] = [];

  static styles = css`
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 400;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgb(28 39 51 / 42%);
      backdrop-filter: blur(3px);
    }

    .dialog {
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 14px;
      width: min(860px, 100%);
      max-height: min(720px, calc(100dvh - 48px));
      padding: 20px 22px;
      border: 1px solid var(--line, #dde5ec);
      border-radius: 18px;
      background: var(--surface, #fff);
      box-shadow: 0 24px 64px rgb(28 39 51 / 18%);
    }

    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
    }

    .head h2 {
      margin: 0;
      flex: 1;
      color: var(--ink, #1c2733);
      font-family: var(--serif, serif);
      font-size: 17px;
    }

    .head .search {
      flex: 2;
      min-width: 180px;
      padding: 9px 13px;
      border: 1px solid var(--line, #dde5ec);
      border-radius: 10px;
      background: var(--surface, #fff);
      color: var(--ink, #1c2733);
      font: inherit;
      font-size: 13px;
    }

    .head .search:focus {
      outline: none;
      border-color: var(--primary, #7eb6d9);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #7eb6d9) 18%, transparent);
    }

    .head .upload {
      flex: none;
      width: 180px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      padding: 4px 12px;
      border: 1px solid var(--line, #dde5ec);
      border-radius: 999px;
      background: var(--surface, #fff);
      color: var(--muted, #6d7f90);
      font-size: 12px;
      cursor: pointer;
    }

    .chip:hover {
      border-color: var(--primary, #7eb6d9);
      color: var(--ink, #1c2733);
    }

    .chip.active {
      border-color: var(--primary, #7eb6d9);
      background: color-mix(in srgb, var(--primary, #7eb6d9) 12%, var(--surface, #fff));
      color: var(--primary-d, #4a93c2);
    }

    .grid {
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      align-content: start;
      min-height: 180px;
      padding: 2px;
    }

    .cell {
      overflow: hidden;
      padding: 0;
      border: 2px solid var(--line, #dde5ec);
      border-radius: 12px;
      background: var(--surface-muted, #eef2f5);
      display: grid;
      gap: 0;
      cursor: pointer;
      text-align: left;
      transition:
        border-color 160ms ease,
        translate 160ms ease;
    }

    .cell:hover {
      border-color: var(--primary, #7eb6d9);
      translate: 0 -1px;
    }

    .cell.selected {
      border-color: var(--primary, #7eb6d9);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #7eb6d9) 22%, transparent);
    }

    .cell .thumb {
      position: relative;
      aspect-ratio: 4 / 3;
      overflow: hidden;
    }

    .cell .thumb img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .cell .name {
      overflow: hidden;
      padding: 6px 9px;
      background: var(--surface, #fff);
      color: var(--ink, #1c2733);
      font-size: 11.5px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .foot {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-top: 4px;
      border-top: 1px solid var(--surface-muted, #eef2f5);
    }

    .foot .hint {
      flex: 1;
      color: var(--faint, #93a3b3);
      font-size: 12px;
    }

    .btn {
      padding: 9px 18px;
      border: 1px solid var(--line, #dde5ec);
      border-radius: 10px;
      background: var(--surface, #fff);
      color: var(--ink, #1c2733);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    .btn.primary {
      border-color: var(--primary, #7eb6d9);
      background: var(--primary, #7eb6d9);
      color: #fff;
    }

    .btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    store.addEventListener('change', this.onStoreChange);
    window.addEventListener('keydown', this.onKeydown);
  }

  disconnectedCallback() {
    store.removeEventListener('change', this.onStoreChange);
    window.removeEventListener('keydown', this.onKeydown);
    super.disconnectedCallback();
  }

  private onStoreChange = () => this.requestUpdate();

  private onKeydown = (event: KeyboardEvent) => {
    if (this.open && event.key === 'Escape') this.cancel();
  };

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('open') && this.open) {
      this.pickedIds = this.selectedId ? [this.selectedId] : [];
      this.query = '';
      this.group = 'all';
    }
  }

  private groupOf(item: MediaAsset): GroupKey {
    if (
      store.settings.avatarMediaId === item.id ||
      store.settings.mastheadMediaId === item.id ||
      (store.settings.heroBackgroundMediaIds ?? []).some((hero) => heroMediaIdOf(hero) === item.id)
    ) {
      return 'site';
    }
    if (store.articles.some((article) => article.cover_media_id === item.id)) return 'article-cover';
    if (store.dynamics.some((dynamic) => dynamic.media.some((media) => media.id === item.id))) return 'dynamic';
    return 'unused';
  }

  private images(): MediaAsset[] {
    return store.media.filter((item) => item.media_type.startsWith('image/'));
  }

  private counts(): Record<GroupKey, number> {
    const result: Record<GroupKey, number> = { all: 0, unused: 0, 'article-cover': 0, dynamic: 0, site: 0 };
    for (const item of this.images()) {
      result.all += 1;
      result[this.groupOf(item)] += 1;
    }
    return result;
  }

  private visible(): MediaAsset[] {
    const query = this.query.trim().toLowerCase();
    return this.images().filter((item) => {
      if (this.group !== 'all' && this.groupOf(item) !== this.group) return false;
      if (query && !item.original_name.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  private cancel() {
    this.dispatchEvent(new CustomEvent('adm-close', { bubbles: true, composed: true }));
  }

  private togglePick(id: string) {
    if (!this.multiple) {
      this.pickedIds = [id];
      return;
    }
    this.pickedIds = this.pickedIds.includes(id)
      ? this.pickedIds.filter((item) => item !== id)
      : [...this.pickedIds, id];
  }

  private confirm() {
    const mediaList = this.pickedIds
      .map((id) => this.images().find((item) => item.id === id))
      .filter((item): item is MediaAsset => !!item);
    if (!mediaList.length) return;
    this.dispatchEvent(
      new CustomEvent('adm-pick', {
        detail: { media: mediaList[0], mediaList },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onUpload(event: CustomEvent<{ media: MediaAsset }>) {
    event.stopPropagation();
    this.pickedIds = this.multiple
      ? [...this.pickedIds, event.detail.media.id]
      : [event.detail.media.id];
  }

  protected render() {
    if (!this.open) return nothing;
    const items = this.visible();
    const counts = this.counts();
    const pickedItems = this.pickedIds
      .map((id) => this.images().find((item) => item.id === id))
      .filter((item): item is MediaAsset => !!item);
    const hint = this.multiple
      ? pickedItems.length
        ? `${mediaPickerModalLabel.pickedCount} ${pickedItems.length}`
        : mediaPickerModalLabel.nonePicked
      : (pickedItems[0]?.original_name ?? mediaPickerModalLabel.nonePicked);
    return html`
      <div class="overlay" @click=${(event: Event) => event.target === event.currentTarget && this.cancel()}>
        <div class="dialog" role="dialog" aria-modal="true" aria-label=${mediaPickerModalLabel.title}>
          <div class="head">
            <h2>${mediaPickerModalLabel.title}</h2>
            <input
              class="search"
              type="search"
              placeholder=${mediaPickerModalLabel.searchPlaceholder}
              .value=${this.query}
              @input=${(event: InputEvent) => (this.query = (event.currentTarget as HTMLInputElement).value)}
            />
            <div class="upload">
              <adm-upload accept="image/*" compact text=${mediaPickerLabel.upload} @adm-upload=${this.onUpload}></adm-upload>
            </div>
          </div>
          <div class="chips">
            ${GROUP_ORDER.map(
              (key) => html`
                <button class="chip ${this.group === key ? 'active' : ''}" @click=${() => (this.group = key)}>
                  ${groupText[key]} ${counts[key]}
                </button>
              `,
            )}
          </div>
          ${items.length
            ? html`<div class="grid">
                ${items.map(
                  (item) => html`
                    <button
                      class="cell ${this.pickedIds.includes(item.id) ? 'selected' : ''}"
                      title=${item.original_name}
                      @click=${() => this.togglePick(item.id)}
                      @dblclick=${() => {
                        if (this.multiple) return;
                        this.pickedIds = [item.id];
                        this.confirm();
                      }}
                    >
                      <span class="thumb"><img src=${item.url} alt=${item.original_name} loading="lazy" /></span>
                      <span class="name">${item.original_name}</span>
                    </button>
                  `,
                )}
              </div>`
            : html`<adm-empty
                text=${mediaPickerModalLabel.empty}
                hint=${mediaPickerModalLabel.emptyHint}
              ></adm-empty>`}
          <div class="foot">
            <span class="hint">${hint}</span>
            <button class="btn" @click=${this.cancel}>${mediaPickerModalLabel.cancel}</button>
            <button class="btn primary" ?disabled=${!pickedItems.length} @click=${this.confirm}>
              ${mediaPickerModalLabel.confirm}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('adm-media-picker', AdmMediaPicker);
