import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { generateSlug, isValidSlug } from '../slugify.js';
import { taxonomyLabel } from '../labels.js';
import type { Category, Tag } from '../types.js';

const TAG_COLLAPSE_AT = 20;

/** 分类与标签：左右两栏，内联创建 + 表格管理。 */
export class AdmTaxonomy extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private catName = '';
  @state() private catSlug = '';
  @state() private catDesc = '';
  @state() private catSort = '0';
  private catSlugTouched = false;

  @state() private newTagName = '';
  @state() private newTagSlug = '';
  @state() private tagQuery = '';
  @state() private tagsExpanded = false;
  private tagSlugTouched = false;

  static styles = [
    adminTheme,
    css`
      :host {
        display: block;
      }

      .columns {
        display: grid;
        grid-template-columns: minmax(0, 4fr) minmax(0, 5fr);
        gap: 18px;
        align-items: start;
      }

      @media (max-width: 900px) {
        .columns {
          grid-template-columns: 1fr;
        }
      }

      .tag-tools {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }

      .tag-tools .search {
        flex: 1;
        min-width: 160px;
        padding: 8px 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--surface);
        color: var(--ink);
        font: inherit;
        font-size: 13px;
      }

      .tag-tools .search:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
      }

      .tag-tools .count {
        color: var(--faint);
        font-size: 12px;
        white-space: nowrap;
      }

      .tag-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tag-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface);
        font-size: 12.5px;
        transition: border-color 200ms ease;
      }

      .tag-chip:hover {
        border-color: var(--primary);
      }

      .tag-chip i {
        color: var(--faint);
        font-size: 11px;
        font-style: normal;
      }

      .tag-chip .chip-ops {
        display: none;
        gap: 2px;
        margin-left: 2px;
      }

      .tag-chip:hover .chip-ops {
        display: inline-flex;
      }

      .tag-chip .chip-ops button {
        padding: 0 4px;
        border: 0;
        background: none;
        color: var(--faint);
        font-size: 12px;
        cursor: pointer;
      }

      .tag-chip .chip-ops button:hover {
        color: var(--ink);
      }

      .tag-chip .chip-ops button.danger:hover {
        color: var(--secondary-d);
      }

      .tag-more {
        margin-top: 10px;
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
      }

      .ops {
        display: inline-flex;
        gap: 8px;
        white-space: nowrap;
      }

      .desc-cell {
        max-width: 150px;
        color: var(--muted);
        font-size: 12.5px;
      }
    `,
  ];

  private async addCategory() {
    const name = this.catName.trim();
    const slug = this.catSlug.trim();
    if (!name) return this.store.toast('请填写分类名称', 'err');
    if (!isValidSlug(slug)) return this.store.toast('slug 格式不正确（小写字母、数字、连字符）', 'err');
    await this.store.createCategory({
      name,
      slug,
      description: this.catDesc.trim() || null,
      sort_order: Number.parseInt(this.catSort, 10) || 0,
    });
    this.catName = this.catSlug = this.catDesc = '';
    this.catSort = '0';
    this.catSlugTouched = false;
  }

  private async editCategory(item: Category) {
    const values = await this.store.prompt('编辑分类', [
      { name: 'name', label: '名称', value: item.name, required: true },
      { name: 'slug', label: 'slug', value: item.slug, required: true },
      { name: 'description', label: '说明', value: item.description ?? '' },
      { name: 'sort_order', label: '排序', value: String(item.sort_order), type: 'number' },
    ]);
    if (!values) return;
    if (!isValidSlug(values.slug.trim())) return this.store.toast('slug 格式不正确（小写字母、数字、连字符）', 'err');
    await this.store.updateCategory(item.id, {
      name: values.name.trim(),
      slug: values.slug.trim(),
      description: values.description.trim() || null,
      sort_order: Number.parseInt(values.sort_order, 10) || 0,
    });
  }

  private async addTag() {
    const name = this.newTagName.trim();
    const slug = this.newTagSlug.trim();
    if (!name) return this.store.toast('请填写标签名称', 'err');
    if (!isValidSlug(slug)) return this.store.toast('slug 格式不正确（小写字母、数字、连字符）', 'err');
    await this.store.createTag({ name, slug });
    this.newTagName = this.newTagSlug = '';
    this.tagSlugTouched = false;
  }

  private async editTag(item: Tag) {
    const values = await this.store.prompt('编辑标签', [
      { name: 'name', label: '名称', value: item.name, required: true },
      { name: 'slug', label: 'slug', value: item.slug, required: true },
    ]);
    if (!values) return;
    if (!isValidSlug(values.slug.trim())) return this.store.toast('slug 格式不正确（小写字母、数字、连字符）', 'err');
    await this.store.updateTag(item.id, { name: values.name.trim(), slug: values.slug.trim() });
  }

  private renderCategoryPanel() {
    const items = [...this.store.categories].sort((a, b) => a.sort_order - b.sort_order);
    return html`
      <section class="panel">
        <h2 class="panel-title">分类</h2>
        <div class="create-form">
          <div class="row">
            <label class="field">
              <span>名称</span>
              <input
                .value=${this.catName}
                placeholder="如：夜航手记"
                @input=${(e: InputEvent) => {
                  this.catName = (e.target as HTMLInputElement).value;
                  if (!this.catSlugTouched) this.catSlug = generateSlug(this.catName);
                }}
              />
            </label>
            <label class="field">
              <span>slug</span>
              <input
                class="mono"
                .value=${this.catSlug}
                placeholder="nightflight-notes"
                @input=${(e: InputEvent) => {
                  this.catSlug = (e.target as HTMLInputElement).value;
                  this.catSlugTouched = true;
                }}
              />
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span>说明</span>
              <input .value=${this.catDesc} placeholder="一句话介绍（可空）" @input=${(e: InputEvent) => (this.catDesc = (e.target as HTMLInputElement).value)} />
            </label>
            <label class="field">
              <span>排序</span>
              <input type="number" .value=${this.catSort} @input=${(e: InputEvent) => (this.catSort = (e.target as HTMLInputElement).value)} />
            </label>
          </div>
          <div class="actions">
            <button class="btn primary" ?disabled=${this.store.busy} @click=${this.addCategory}>添加分类</button>
          </div>
        </div>
        ${items.length
          ? html`
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr><th>名称</th><th>slug</th><th>说明</th><th>排序</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    ${items.map(
                      (item) => html`
                        <tr>
                          <td><b>${item.name}</b></td>
                          <td class="mono">${item.slug}</td>
                          <td class="desc-cell">${item.description || html`<span class="faint">—</span>`}</td>
                          <td class="mono">${item.sort_order}</td>
                          <td>
                            <span class="ops">
                              <button class="btn secondary small" @click=${() => this.editCategory(item)}>编辑</button>
                              <button class="btn danger small" @click=${() => this.store.removeTaxonomy('categories', item.id)}>删除</button>
                            </span>
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>
            `
          : html`<adm-empty text="还没有分类" hint="用上方表单创建第一个分类"></adm-empty>`}
      </section>
    `;
  }

  private renderTagPanel() {
    const query = this.tagQuery.trim().toLowerCase();
    const sorted = [...this.store.tags].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    const matched = query
      ? sorted.filter((item) => item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query))
      : sorted;
    const collapsed = !query && !this.tagsExpanded && matched.length > TAG_COLLAPSE_AT;
    const items = collapsed ? matched.slice(0, TAG_COLLAPSE_AT) : matched;
    return html`
      <section class="panel">
        <h2 class="panel-title">标签</h2>
        <div class="create-form">
          <div class="row">
            <label class="field">
              <span>名称</span>
              <input
                .value=${this.newTagName}
                placeholder="如：前端"
                @input=${(e: InputEvent) => {
                  this.newTagName = (e.target as HTMLInputElement).value;
                  if (!this.tagSlugTouched) this.newTagSlug = generateSlug(this.newTagName);
                }}
              />
            </label>
            <label class="field">
              <span>slug</span>
              <input
                class="mono"
                .value=${this.newTagSlug}
                placeholder="frontend"
                @input=${(e: InputEvent) => {
                  this.newTagSlug = (e.target as HTMLInputElement).value;
                  this.tagSlugTouched = true;
                }}
              />
            </label>
          </div>
          <div class="actions">
            <button class="btn primary" ?disabled=${this.store.busy} @click=${this.addTag}>添加标签</button>
          </div>
        </div>
        ${sorted.length
          ? html`
              <div class="tag-tools">
                <input
                  class="search"
                  type="search"
                  placeholder=${taxonomyLabel.searchTags}
                  .value=${this.tagQuery}
                  @input=${(e: InputEvent) => (this.tagQuery = (e.currentTarget as HTMLInputElement).value)}
                />
                <span class="count">${matched.length} / ${sorted.length}</span>
              </div>
              ${items.length
                ? html`
                    <div class="tag-cloud">
                      ${items.map(
                        (item) => html`
                          <span class="tag-chip" title=${item.slug}>
                            <b>${item.name}</b>
                            <i class="mono">${item.slug}</i>
                            <span class="chip-ops">
                              <button aria-label="编辑" @click=${() => this.editTag(item)}>✎</button>
                              <button aria-label="删除" class="danger" @click=${() => this.store.removeTaxonomy('tags', item.id)}>✕</button>
                            </span>
                          </span>
                        `,
                      )}
                    </div>
                    ${collapsed || (!query && this.tagsExpanded && matched.length > TAG_COLLAPSE_AT)
                      ? html`<div class="tag-more">
                          <button class="btn secondary small" @click=${() => (this.tagsExpanded = !this.tagsExpanded)}>
                            ${collapsed ? `${taxonomyLabel.expandAll}（共 ${matched.length} 个）` : taxonomyLabel.collapse}
                          </button>
                        </div>`
                      : nothing}
                  `
                : html`<adm-empty text="没有匹配的标签" hint="换个搜索词试试"></adm-empty>`}
            `
          : html`<adm-empty text="还没有标签" hint="用上方表单创建第一个标签"></adm-empty>`}
      </section>
    `;
  }

  protected render() {
    return html`
      <div class="columns">
        ${this.renderCategoryPanel()}
        ${this.renderTagPanel()}
      </div>
    `;
  }
}

customElements.define('adm-taxonomy', AdmTaxonomy);
