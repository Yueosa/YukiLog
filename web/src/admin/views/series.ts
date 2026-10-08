import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { generateSlug, isValidSlug } from '../slugify.js';
import type { Series } from '../types.js';

/** 系列管理：顶部创建/编辑表单 + 系列列表（封面缩略图、章节数、精选状态）。 */
export class AdmSeries extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private editingId: string | null = null;
  @state() private name = '';
  @state() private slug = '';
  @state() private description = '';
  @state() private coverMediaId: string | null = null;
  @state() private featured = false;
  @state() private pickerOpen = false;
  private slugTouched = false;

  static styles = [
    adminTheme,
    css`
      :host {
        display: block;
      }

      .create-form {
        display: grid;
        gap: 10px;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--surface-muted);
      }

      .create-form .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .create-form .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .cover-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .cover-row img {
        width: 96px;
        height: 60px;
        border: 1px solid var(--line);
        border-radius: 10px;
        object-fit: cover;
      }

      .thumb {
        width: 54px;
        height: 54px;
        border: 1px solid var(--line);
        border-radius: 8px;
        object-fit: cover;
      }

      .thumb-fallback {
        display: inline-grid;
        width: 54px;
        height: 54px;
        place-items: center;
        border: 1px dashed var(--line);
        border-radius: 8px;
        color: var(--faint);
        font-size: 11px;
      }

      .featured-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--secondary) 16%, transparent);
        color: var(--secondary-d);
        font-size: 11.5px;
      }

      .ops {
        display: inline-flex;
        gap: 8px;
        white-space: nowrap;
      }

      .desc-cell {
        max-width: 220px;
        color: var(--muted);
        font-size: 12.5px;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void this.store.refreshMedia();
  }

  private resetForm() {
    this.editingId = null;
    this.name = this.slug = this.description = '';
    this.coverMediaId = null;
    this.featured = false;
    this.slugTouched = false;
  }

  private startEdit(item: Series) {
    this.editingId = item.id;
    this.name = item.name;
    this.slug = item.slug;
    this.description = item.description ?? '';
    this.coverMediaId = item.cover_media_id;
    this.featured = item.featured;
    this.slugTouched = true;
  }

  private async save() {
    const name = this.name.trim();
    const slug = this.slug.trim();
    if (!name) return this.store.toast('请填写系列名称', 'err');
    if (!isValidSlug(slug)) {
      return this.store.toast('slug 格式不正确（小写字母、数字、连字符）', 'err');
    }
    await this.store.saveSeries(this.editingId, {
      name,
      slug,
      description: this.description.trim() || null,
      cover_media_id: this.coverMediaId,
      featured: this.featured,
    });
    this.resetForm();
  }

  private coverOf(mediaId: string | null) {
    return mediaId ? this.store.media.find((item) => item.id === mediaId) : undefined;
  }

  private renderForm() {
    const cover = this.coverOf(this.coverMediaId);
    return html`
      <div class="create-form">
        <div class="row">
          <label class="field">
            <span>名称</span>
            <input
              .value=${this.name}
              placeholder="如：ShellStory: 贝壳的故事"
              @input=${(e: InputEvent) => {
                this.name = (e.target as HTMLInputElement).value;
                if (!this.slugTouched) this.slug = generateSlug(this.name);
              }}
            />
          </label>
          <label class="field">
            <span>slug</span>
            <input
              class="mono"
              .value=${this.slug}
              placeholder="shellstory"
              @input=${(e: InputEvent) => {
                this.slug = (e.target as HTMLInputElement).value;
                this.slugTouched = true;
              }}
            />
          </label>
        </div>
        <label class="field">
          <span>简介</span>
          <input
            .value=${this.description}
            placeholder="一句话介绍这个系列（可空）"
            @input=${(e: InputEvent) => (this.description = (e.target as HTMLInputElement).value)}
          />
        </label>
        <div class="field">
          <span>封面</span>
          <div class="cover-row">
            ${cover
              ? html`<img src=${cover.thumb_url || cover.url} alt=${cover.original_name} />`
              : nothing}
            <button class="btn secondary small" type="button" @click=${() => (this.pickerOpen = true)}>
              ${cover ? '更换封面' : '从媒体库选择封面'}
            </button>
            ${cover
              ? html`<button class="btn secondary small" type="button" @click=${() => (this.coverMediaId = null)}>
                  移除封面
                </button>`
              : nothing}
          </div>
        </div>
        <adm-toggle
          label="精选（显示在首页精选区顶部）"
          .checked=${this.featured}
          @adm-change=${(e: CustomEvent<{ checked: boolean }>) => (this.featured = e.detail.checked)}
        ></adm-toggle>
        <div class="actions">
          ${this.editingId
            ? html`<button class="btn secondary" type="button" @click=${this.resetForm}>取消编辑</button>`
            : nothing}
          <button class="btn primary" ?disabled=${this.store.busy} @click=${this.save}>
            ${this.editingId ? '保存修改' : '新建系列'}
          </button>
        </div>
      </div>
    `;
  }

  private renderTable() {
    const items = this.store.seriesList;
    if (!items.length) {
      return html`<adm-empty text="还没有系列" hint="用上方表单创建第一个系列"></adm-empty>`;
    }
    return html`
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>封面</th><th>名称</th><th>slug</th><th>简介</th><th>章节数</th><th>精选</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${items.map((item) => {
              const cover = this.coverOf(item.cover_media_id);
              return html`
                <tr>
                  <td>
                    ${cover
                      ? html`<img class="thumb" src=${cover.thumb_url || cover.url} alt=${cover.original_name} loading="lazy" />`
                      : html`<span class="thumb-fallback">无封面</span>`}
                  </td>
                  <td><b>${item.name}</b></td>
                  <td class="mono">${item.slug}</td>
                  <td class="desc-cell">${item.description || html`<span class="faint">—</span>`}</td>
                  <td class="mono">${item.chapter_count}</td>
                  <td>${item.featured ? html`<span class="featured-badge">精选</span>` : html`<span class="faint">—</span>`}</td>
                  <td>
                    <span class="ops">
                      <button class="btn secondary small" @click=${() => this.startEdit(item)}>编辑</button>
                      <button class="btn danger small" @click=${() => this.store.deleteSeries(item)}>删除</button>
                    </span>
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  protected render() {
    return html`
      <section class="panel">
        <h2 class="panel-title">${this.editingId ? '编辑系列' : '新建系列'}</h2>
        ${this.renderForm()}
        <h2 class="panel-title">全部系列</h2>
        ${this.renderTable()}
      </section>
      <adm-media-picker
        ?open=${this.pickerOpen}
        .selectedId=${this.coverMediaId}
        @adm-pick=${(e: CustomEvent<{ media: { id: string } }>) => {
          this.coverMediaId = e.detail.media.id;
          this.pickerOpen = false;
        }}
        @adm-close=${() => (this.pickerOpen = false)}
      ></adm-media-picker>
    `;
  }
}

customElements.define('adm-series', AdmSeries);
