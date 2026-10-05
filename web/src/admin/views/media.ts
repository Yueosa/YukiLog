import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { formatBytes } from '../labels.js';
import type { LayoutNode } from '../../layout/types.js';
import type { MediaAsset } from '../types.js';

type MediaGroup = { key: string; title: string; items: MediaAsset[] };

/** 媒体库：上传区 + 按用途分组的媒体网格（含图床筛选）。 */
export class AdmMedia extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;
  @state() private filter: string = 'all';

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
        transition:
          border-color 220ms ease,
          translate 220ms ease;
      }

      .card:hover {
        border-color: var(--primary);
        translate: 0 -2px;
      }

      .thumb {
        aspect-ratio: 16 / 10;
        background: var(--surface-muted);
        display: grid;
        place-items: center;
      }

      .thumb img {
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

      .hint {
        margin: 0;
        color: var(--faint);
        font-size: 12px;
      }
    `,
  ];

  private siteUsageOf(item: MediaAsset): string | null {
    if (this.store.settings.avatarMediaId === item.id) return '站点头像';
    if (this.store.settings.mastheadMediaId === item.id) return '刊头背景';
    for (const record of this.store.layouts) {
      const usage = this.nodeUsage(record.layout.root, item);
      if (usage === 'hero') return '首屏背景';
      if (usage === 'masthead') return '刊头背景';
      if (usage) return '站点资源';
    }
    return null;
  }

  private nodeUsage(node: LayoutNode, item: MediaAsset): string | null {
    const props = JSON.stringify(node.props);
    if (props.includes(item.url) || props.includes(item.id)) return node.type;
    for (const child of node.children ?? []) {
      const usage = this.nodeUsage(child, item);
      if (usage) return usage;
    }
    return null;
  }

  private groupOf(item: MediaAsset): string {
    const site = this.siteUsageOf(item);
    if (site) return site;
    if (this.store.articles.some((article) => article.cover_media_id === item.id)) return '文章封面';
    if (this.store.dynamics.some((dynamic) => dynamic.media.some((media) => media.id === item.id))) return '动态配图';
    return '图床 · 未引用';
  }

  private groups(): MediaGroup[] {
    const order = ['站点头像', '首屏背景', '刊头背景', '站点资源', '文章封面', '动态配图', '图床 · 未引用'];
    const map = new Map<string, MediaAsset[]>();
    for (const item of this.store.media) {
      const key = this.groupOf(item);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return order
      .filter((key) => map.has(key))
      .map((key) => ({ key, title: key, items: map.get(key)! }));
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
      <p class="hint">相同内容的文件会自动去重复用；复制 URL 后可以直接粘贴到文章正文里当图床用。</p>
      ${groups.length > 1
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
            </div>
          `
        : nothing}
      ${visible.length
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
