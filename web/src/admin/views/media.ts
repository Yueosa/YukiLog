import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { formatBytes } from '../labels.js';
import type { ExternalRef, MediaAsset } from '../types.js';
import { heroMediaIdOf } from '../types.js';

type MediaGroup = { key: string; title: string; items: MediaAsset[] };

/** 媒体库：上传区 + URL 拉取 + 按用途分组的媒体网格 + 正文外链图片。 */
export class AdmMedia extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;
  @state() private filter: string = 'all';
  @state() private fetchUrl = '';
  @state() private fetchBusy = false;
  @state() private externalRefs: ExternalRef[] | null = null;

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 22px;
      }

      .group {
        display: grid;
        gap: 14px;
      }

      .group .head {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }

      .group .head .panel-title {
        margin: 0;
      }

      .group .count {
        color: var(--faint);
        font-family: var(--mono);
        font-size: 11.5px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 14px;
      }

      .card {
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        display: grid;
        grid-template-rows: auto 1fr auto;
        transition:
          border-color 220ms ease,
          translate 220ms ease;
      }

      .card:hover {
        border-color: var(--primary);
        translate: 0 -2px;
      }

      .thumb {
        position: relative;
        aspect-ratio: 4 / 3;
        overflow: hidden;
        background: var(--surface-muted);
        display: grid;
        place-items: center;
      }

      .thumb img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .thumb .kind {
        color: var(--faint);
        font-family: var(--mono);
        font-size: 12px;
        letter-spacing: 0.06em;
      }

      .meta {
        display: grid;
        gap: 4px;
        padding: 10px 12px;
      }

      .meta .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--ink);
        font-size: 12.5px;
      }

      .meta .spec {
        color: var(--faint);
        font-family: var(--mono);
        font-size: 11px;
      }

      .actions {
        display: flex;
        gap: 6px;
        padding: 0 12px 12px;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        padding: 4px 12px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface);
        color: var(--muted);
        font-size: 12px;
        cursor: pointer;
        transition:
          border-color 160ms ease,
          color 160ms ease,
          background 160ms ease;
      }

      .chip:hover {
        border-color: var(--primary);
        color: var(--ink);
      }

      .chip.active {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 12%, var(--surface));
        color: var(--primary-d);
      }

      .usages {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 4px;
      }

      .usages em {
        padding: 1px 7px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 12%, var(--surface));
        color: var(--primary-d);
        font-size: 10.5px;
        font-style: normal;
        white-space: nowrap;
      }

      .hint {
        margin: 0;
        color: var(--faint);
        font-size: 12px;
      }

      .fetch-row {
        display: flex;
        gap: 8px;
      }

      .fetch-row input {
        flex: 1;
        max-width: 520px;
        padding: 8px 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--surface);
        color: var(--ink);
        font: inherit;
        font-size: 13px;
      }

      .fetch-row input:focus {
        border-color: var(--primary);
        outline: none;
      }

      .origin-badge {
        padding: 1px 7px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--secondary, #e8a4b4) 18%, var(--surface));
        color: var(--secondary-d, #d57f95);
        font-size: 10.5px;
        font-style: normal;
        white-space: nowrap;
      }

      .ext-list {
        display: grid;
        gap: 10px;
      }

      .ext-item {
        display: grid;
        grid-template-columns: 64px 1fr auto;
        align-items: center;
        gap: 14px;
        padding: 10px 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
      }

      .ext-item img {
        width: 64px;
        height: 48px;
        border-radius: 8px;
        object-fit: cover;
        background: var(--surface-muted);
      }

      .ext-url {
        display: block;
        overflow: hidden;
        color: var(--ink);
        font-family: var(--mono);
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ext-usages {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }

      .ext-usages em {
        padding: 1px 7px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 12%, var(--surface));
        color: var(--primary-d);
        font-size: 10.5px;
        font-style: normal;
      }
    `,
  ];

  private siteUsageOf(item: MediaAsset): string | null {
    if (this.store.settings.avatarMediaId === item.id) return '站点头像';
    if ((this.store.settings.heroBackgroundMediaIds ?? []).some((hero) => heroMediaIdOf(hero) === item.id)) return '首屏背景';
    if (this.store.settings.mastheadMediaId === item.id) return '刊头背景';
    return null;
  }

  private usagesOf(item: MediaAsset): string[] {
    const usages: string[] = [];
    const site = this.siteUsageOf(item);
    if (site) usages.push(site);
    if (this.store.articles.some((article) => article.cover_media_id === item.id)) usages.push('文章封面');
    if (this.store.dynamics.some((dynamic) => dynamic.media.some((media) => media.id === item.id))) usages.push('动态配图');
    return usages;
  }

  private groupOf(item: MediaAsset): string {
    return this.usagesOf(item)[0] ?? '图床 · 未引用';
  }

  private groups(): MediaGroup[] {
    const order = ['站点头像', '首屏背景', '刊头背景', '站点资源', '文章封面', '动态配图', '图床 · 未引用'];
    const map = new Map<string, MediaAsset[]>();
    for (const item of this.store.media) {
      // 一图多用：出现在每个用途分组里（卡片上会带全部用途徽章）
      const usages = this.usagesOf(item);
      const keys = usages.length ? usages : ['图床 · 未引用'];
      for (const key of keys) {
        map.set(key, [...(map.get(key) ?? []), item]);
      }
    }
    return order
      .filter((key) => map.has(key))
      .map((key) => ({ key, title: key, items: map.get(key)! }));
  }

  private async fetchFromUrl() {
    const url = this.fetchUrl.trim();
    if (!url || this.fetchBusy) return;
    this.fetchBusy = true;
    try {
      const asset = await this.store.fetchMediaUrl(url);
      if (asset) {
        this.fetchUrl = '';
        if (this.externalRefs) await this.loadExternalRefs();
      }
    } finally {
      this.fetchBusy = false;
    }
  }

  private async loadExternalRefs() {
    this.externalRefs = await this.store.loadExternalRefs();
  }

  private async fetchExternal(ref: ExternalRef) {
    const asset = await this.store.fetchMediaUrl(ref.url);
    if (asset) {
      this.externalRefs = this.externalRefs?.filter((item) => item.url !== ref.url) ?? null;
      this.store.toast('已拉取入库，正文里的外链请手动替换为内部 URL');
    }
  }

  private async copyUrl(item: MediaAsset) {
    try {
      await navigator.clipboard.writeText(new URL(item.url, window.location.origin).href);
      this.store.toast('链接已复制');
    } catch {
      this.store.toast('复制失败，请手动复制', 'err');
    }
  }

  private renderCard(item: MediaAsset) {
    const isImage = item.media_type.startsWith('image/');
    return html`
      <div class="card">
        <div class="thumb">
          ${isImage
            ? html`<img src=${item.url} alt=${item.original_name} loading="lazy" />`
            : html`<span class="kind">${item.media_type}</span>`}
        </div>
        <div class="meta">
          <span class="usages">
            ${this.usagesOf(item).map((usage) => html`<em>${usage}</em>`)}
            ${item.origin === 'fetched'
              ? html`<em class="origin-badge" title=${item.source_url ?? ''}>拉取</em>`
              : nothing}
          </span>
          <span class="name" title=${item.original_name}>${item.original_name}</span>
          <span class="spec">
            ${item.width && item.height ? `${item.width}×${item.height} · ` : ''}${formatBytes(item.byte_size)}
          </span>
        </div>
        <div class="actions">
          <button class="btn small secondary" @click=${() => this.copyUrl(item)}>复制 URL</button>
          <button class="btn small danger" @click=${() => this.store.deleteMedia(item.id)}>删除</button>
        </div>
      </div>
    `;
  }

  protected render() {
    const groups = this.groups();
    const visible = this.filter === 'all' ? groups : groups.filter((group) => group.key === this.filter);
    return html`
      <adm-upload></adm-upload>
      <div class="fetch-row">
        <input
          type="url"
          placeholder="从 URL 拉取图片入库（https://…），自动去重"
          .value=${this.fetchUrl}
          @input=${(event: Event) => (this.fetchUrl = (event.target as HTMLInputElement).value)}
          @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && this.fetchFromUrl()}
        />
        <button class="btn small secondary" ?disabled=${this.fetchBusy || !this.fetchUrl.trim()} @click=${() => this.fetchFromUrl()}>
          ${this.fetchBusy ? '拉取中…' : '拉取入库'}
        </button>
      </div>
      <p class="hint">相同内容的文件会自动去重复用；复制 URL 后可以直接粘贴到文章正文里当图床用。</p>
      ${groups.length > 1 || true
        ? html`
            <div class="chips">
              <button class="chip ${this.filter === 'all' ? 'active' : ''}" @click=${() => (this.filter = 'all')}>
                全部 ${this.store.media.length}
              </button>
              ${groups.map(
                (group) => html`
                  <button
                    class="chip ${this.filter === group.key ? 'active' : ''}"
                    @click=${() => (this.filter = group.key)}
                  >
                    ${group.title} ${group.items.length}
                  </button>
                `,
              )}
              <button
                class="chip ${this.filter === '__external' ? 'active' : ''}"
                @click=${() => {
                  this.filter = '__external';
                  if (!this.externalRefs) void this.loadExternalRefs();
                }}
              >
                外链 ${this.externalRefs?.length ?? ''}
              </button>
            </div>
          `
        : nothing}
      ${this.filter === '__external'
        ? html`
            <section class="group">
              <div class="head">
                <h2 class="panel-title">正文外链图片</h2>
                <span class="count">${this.externalRefs?.length ?? '…'} 个</span>
              </div>
              <p class="hint">文章/动态正文里引用的站外图片。外链随时可能失效，建议拉取入库后把正文里的 URL 替换成内部地址。</p>
              ${this.externalRefs === null
                ? html`<p class="hint">扫描中…</p>`
                : this.externalRefs.length === 0
                  ? html`<adm-empty text="没有外链图片" hint="正文里的图片全部来自内部媒体库"></adm-empty>`
                  : html`<div class="ext-list">
                      ${this.externalRefs.map(
                        (ref) => html`
                          <div class="ext-item">
                            <img src=${ref.url} alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
                            <div>
                              <span class="ext-url" title=${ref.url}>${ref.url}</span>
                              <span class="ext-usages">
                                ${ref.usages.map(
                                  (usage) => html`<em>${usage.kind === 'article' ? '文章' : '动态'} · ${usage.label}</em>`,
                                )}
                              </span>
                            </div>
                            <button class="btn small secondary" ?disabled=${this.fetchBusy} @click=${() => this.fetchExternal(ref)}>
                              拉取入库
                            </button>
                          </div>
                        `,
                      )}
                    </div>`}
            </section>
          `
        : visible.length
          ? visible.map(
              (group) => html`
                <section class="group">
                  <div class="head">
                    <h2 class="panel-title">${group.title}</h2>
                    <span class="count">${group.items.length} 个文件</span>
                  </div>
                  <div class="grid">${group.items.map((item) => this.renderCard(item))}</div>
                </section>
              `,
            )
          : html`<adm-empty text="媒体库还是空的" hint="把图片或视频拖进上面的上传区试试"></adm-empty>`}
      ${nothing}
    `;
  }
}

customElements.define('adm-media', AdmMedia);
