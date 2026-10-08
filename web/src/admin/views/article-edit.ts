import { css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { contentStatusLabel, formatDateTime } from '../labels.js';
import { generateSlug, isValidSlug, uniqueSlug } from '../slugify.js';
import type { Article } from '../types.js';

/** 文章编辑器：左编辑右预览，支持新建（articleId 为 null）。 */
export class AdmArticleEdit extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private formTitle = '';
  @state() private slug = '';
  @state() private categoryId = '';
  @state() private seriesId = '';
  @state() private seriesOrder = '';
  @state() private seriesTitle = '';
  @state() private coverMediaId: string | null = null;
  @state() private coverFetchUrl = '';
  @state() private coverFetchBusy = false;
  @state() private summary = '';
  @state() private body = '';
  @state() private allowComments = true;
  @state() private tagIds: string[] = [];
  @state() private coverPickerOpen = false;

  private slugTouched = false;
  private loadedId: string | null | undefined = undefined;

  static styles = [
    adminTheme,
    css`
      :host {
        display: block;
      }

      .layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 18px;
        align-items: start;
      }

      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }

      .editor {
        display: grid;
        gap: 16px;
      }

      .series-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      @media (max-width: 640px) {
        .series-row {
          grid-template-columns: 1fr;
        }
      }

      .back {
        color: var(--muted);
        font-size: 13px;
        text-decoration: none;
      }

      .back:hover {
        color: var(--primary-d);
      }

      .slug-hint {
        font-size: 11.5px;
      }

      .slug-hint.bad {
        color: var(--danger);
      }

      .body-input textarea {
        min-height: 320px;
        font-family: var(--mono);
        font-size: 13px;
      }

      .cover {
        display: grid;
        gap: 10px;
      }

      .cover-fetch {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }

      .cover-fetch input {
        width: 240px;
        padding: 6px 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--ink);
        font: inherit;
        font-size: 12.5px;
      }

      .cover-fetch input:focus {
        border-color: var(--primary);
        outline: none;
      }

      .cover-current {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .cover-current img {
        width: 120px;
        height: 72px;
        border: 1px solid var(--line);
        border-radius: 10px;
        object-fit: cover;
      }

      .side {
        display: grid;
        gap: 18px;
      }

      /* ---------- 预览卡片（模仿主站文章卡） ---------- */
      .card {
        overflow: hidden;
        padding: 0;
      }

      .card .cover-box {
        aspect-ratio: 16 / 9;
        background: var(--surface-muted);
        display: grid;
        place-items: center;
        color: var(--faint);
        font-size: 12px;
      }

      .card .cover-box img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .card .card-body {
        display: grid;
        gap: 9px;
        padding: 16px 18px 18px;
      }

      .card .cat {
        color: var(--secondary-d);
        font-size: 11.5px;
        letter-spacing: 0.08em;
      }

      .card h3 {
        margin: 0;
        font-family: var(--serif);
        font-size: 18px;
        line-height: 1.4;
        color: var(--ink);
      }

      .card .excerpt {
        margin: 0;
        color: var(--muted);
        font-size: 12.5px;
        line-height: 1.7;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .card .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .card .chip {
        padding: 2px 10px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 15%, transparent);
        color: var(--primary-d);
        font-size: 11.5px;
      }

      .card .meta {
        display: flex;
        align-items: center;
        gap: 10px;
        padding-top: 9px;
        border-top: 1px solid var(--surface-muted);
        color: var(--faint);
        font-size: 11.5px;
      }

      .actions {
        display: grid;
        gap: 10px;
      }

      .actions .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .actions .status {
        display: flex;
        align-items: center;
        gap: 10px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--surface-muted);
        font-size: 12.5px;
      }
    `,
  ];

  protected willUpdate(changed: PropertyValues<this>) {
    // articleId 变化，或文章数据刚加载出来时，重建表单草稿
    if (changed.has('articleId') || (this.articleId && this.article && this.loadedId !== this.articleId)) {
      this.loadFromStore();
      this.loadedId = this.articleId;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    void this.store.refreshMedia();
  }

  private get article(): Article | undefined {
    return this.articleId ? this.store.articles.find((item) => item.id === this.articleId) : undefined;
  }

  private loadFromStore() {
    const article = this.article;
    this.slugTouched = false;
    if (article) {
      this.formTitle = article.title;
      this.slug = article.slug;
      this.categoryId = article.category_id;
      this.seriesId = article.series_id ?? '';
      this.seriesOrder = article.series_order === null ? '' : String(article.series_order);
      this.seriesTitle = article.series_title ?? '';
      this.coverMediaId = article.cover_media_id;
      this.summary = article.summary ?? '';
      this.body = article.body_markdown;
      this.allowComments = article.allow_comments;
      this.tagIds = [...article.tag_ids];
    } else {
      this.formTitle = '';
      this.slug = '';
      this.categoryId = this.store.categories[0]?.id ?? '';
      this.seriesId = '';
      this.seriesOrder = '';
      this.seriesTitle = '';
      this.coverMediaId = null;
      this.summary = '';
      this.body = '';
      this.allowComments = true;
      this.tagIds = [];
    }
  }

  private onTitleInput(value: string) {
    this.formTitle = value;
    if (!this.slugTouched) {
      const taken = this.store.articles.filter((item) => item.id !== this.articleId).map((item) => item.slug);
      this.slug = this.formTitle.trim() ? uniqueSlug(generateSlug(this.formTitle), taken) : '';
    }
  }

  private categoryName(id: string): string {
    return this.store.categories.find((category) => category.id === id)?.name ?? '未分类';
  }

  private async save() {
    const slug = this.slug.trim();
    if (!slug) {
      this.store.toast('请填写 slug', 'err');
      return;
    }
    if (!isValidSlug(slug)) {
      this.store.toast('Slug 格式无效：仅限小写字母、数字和连字符', 'err');
      return;
    }
    const seriesOrderText = this.seriesOrder.trim();
    const seriesOrder = seriesOrderText === '' ? null : Number.parseInt(seriesOrderText, 10);
    if (this.seriesId && seriesOrderText !== '' && (seriesOrder === null || Number.isNaN(seriesOrder) || seriesOrder < 0)) {
      this.store.toast('系列序号需要是不小于 0 的整数', 'err');
      return;
    }
    const saved = await this.store.saveArticle(this.articleId, {
      title: this.formTitle.trim(),
      slug,
      category_id: this.categoryId,
      cover_media_id: this.coverMediaId,
      series_id: this.seriesId || null,
      series_order: this.seriesId ? seriesOrder : null,
      series_title: this.seriesId ? this.seriesTitle.trim() || null : null,
      summary: this.summary.trim() || null,
      body_markdown: this.body,
      allow_comments: this.allowComments,
      tag_ids: this.tagIds,
    });
    if (saved && !this.articleId) {
      location.hash = `#/articles/${saved.id}`;
    }
  }

  private async publish() {
    if (!this.articleId) {
      this.store.toast('请先保存草稿，再发布', 'info');
      return;
    }
    await this.store.articleAction(this.articleId, 'publish');
    if (this.article?.status === 'published') location.hash = '#/articles';
  }

  private async schedule() {
    if (!this.articleId) {
      this.store.toast('请先保存草稿，再定时发布', 'info');
      return;
    }
    const result = await this.store.prompt(
      '定时发布',
      [{ name: 'time', label: '发布时间', type: 'datetime-local', required: true }],
      '定时发布',
    );
    const value = result?.time;
    if (!value) return;
    const time = new Date(value);
    if (Number.isNaN(time.getTime())) {
      this.store.toast('时间格式无效', 'err');
      return;
    }
    await this.store.articleAction(this.articleId, 'publish', time.toISOString());
    if (this.article?.status === 'published') location.hash = '#/articles';
  }

  private async withdraw() {
    if (!this.articleId) return;
    await this.store.articleAction(this.articleId, 'withdraw');
  }

  private async removeArticle() {
    if (!this.articleId) {
      location.hash = '#/articles';
      return;
    }
    const id = this.articleId;
    await this.store.deleteArticle(id);
    if (!this.store.articles.some((item) => item.id === id)) {
      location.hash = '#/articles';
    }
  }

  private async fetchCover() {
    const url = this.coverFetchUrl.trim();
    if (!url || this.coverFetchBusy) return;
    this.coverFetchBusy = true;
    try {
      const asset = await this.store.fetchMediaUrl(url);
      if (asset) {
        this.coverMediaId = asset.id;
        this.coverFetchUrl = '';
      }
    } finally {
      this.coverFetchBusy = false;
    }
  }

  private renderCover() {
    const cover = this.coverMediaId ? this.store.media.find((item) => item.id === this.coverMediaId) : undefined;    return html`
      <div class="field">
        <span>封面</span>
        <div class="cover">
          ${cover
            ? html`<div class="cover-current">
                <img src=${cover.url} alt=${cover.original_name} />
                <button class="btn small secondary" @click=${() => (this.coverMediaId = null)}>移除封面</button>
              </div>`
            : nothing}
          <div>
            <button class="btn secondary small" type="button" @click=${() => (this.coverPickerOpen = true)}>
              ${cover ? '更换封面' : '从媒体库选择封面'}
            </button>
            <span class="cover-fetch">
              <input
                type="url"
                placeholder="或粘贴图片 URL 拉取"
                .value=${this.coverFetchUrl}
                @input=${(event: Event) => (this.coverFetchUrl = (event.target as HTMLInputElement).value)}
                @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && this.fetchCover()}
              />
              <button
                class="btn secondary small"
                type="button"
                ?disabled=${this.coverFetchBusy || !this.coverFetchUrl.trim()}
                @click=${() => this.fetchCover()}
              >
                ${this.coverFetchBusy ? '拉取中…' : '拉取'}
              </button>
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private renderPreview() {
    const article = this.article;
    const cover = this.coverMediaId ? this.store.media.find((item) => item.id === this.coverMediaId) : undefined;
    const statusSource = article ?? { status: 'draft', published_at: null };
    const tags = this.tagIds
      .map((id) => this.store.tags.find((tag) => tag.id === id))
      .filter((tag) => tag !== undefined);
    return html`
      <section class="panel card">
        <div class="cover-box">
          ${cover ? html`<img src=${cover.url} alt=${cover.original_name} />` : html`<span>暂无封面</span>`}
        </div>
        <div class="card-body">
          <span class="cat">${this.categoryName(this.categoryId)}</span>
          <h3>${this.formTitle.trim() || '未命名文章'}</h3>
          <p class="excerpt">${this.summary.trim() || '这篇文章还没有摘要。'}</p>
          ${tags.length
            ? html`<div class="chips">${tags.map((tag) => html`<span class="chip">${tag.name}</span>`)}</div>`
            : nothing}
          <div class="meta">
            <span>${formatDateTime(article?.published_at ?? article?.updated_at ?? null)}</span>
            <span>·</span>
            <span>${this.allowComments ? '开放评论' : '评论关闭'}</span>
          </div>
        </div>
      </section>
      <section class="panel actions">
        <div class="status">
          <span class="badge ${article?.status === 'published' ? 'ok' : ''}">${contentStatusLabel(statusSource)}</span>
          ${article?.published_at
            ? html`<span class="faint">发布于 ${formatDateTime(article.published_at)}</span>`
            : html`<span class="faint">尚未发布</span>`}
        </div>
        <button class="btn primary" ?disabled=${this.store.busy} @click=${this.save}>保存</button>
        <div class="row">
          ${article?.status === 'published'
            ? html`<button class="btn secondary" ?disabled=${this.store.busy} @click=${this.withdraw}>撤回为草稿</button>`
            : html`
                <button class="btn secondary" ?disabled=${this.store.busy} @click=${this.publish}>立即发布</button>
                <button class="btn secondary" ?disabled=${this.store.busy} @click=${this.schedule}>定时发布</button>
              `}
        </div>
        ${article?.status === 'published'
          ? html`<adm-toggle
              label="精选"
              .checked=${!!article.featured_at}
              @adm-change=${(e: CustomEvent<{ checked: boolean }>) => this.store.setArticleFeatured(article.id, e.detail.checked)}
            ></adm-toggle>`
          : nothing}
        <button class="btn danger small" ?disabled=${this.store.busy} @click=${this.removeArticle}>删除</button>
      </section>
    `;
  }

  protected render() {
    const slugBad = !!this.slug && !isValidSlug(this.slug);
    return html`
      <div class="layout">
        <div class="editor">
          <a class="back" href="#/articles">← 返回列表</a>
          <section class="panel editor">
            <label class="field">
              <span>标题</span>
              <input
                .value=${this.formTitle}
                placeholder="给文章起个名字…"
                @input=${(e: InputEvent) => this.onTitleInput((e.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label class="field">
              <span>Slug</span>
              <input
                class="mono"
                .value=${this.slug}
                placeholder="post-url-path"
                @input=${(e: InputEvent) => {
                  this.slugTouched = true;
                  this.slug = (e.currentTarget as HTMLInputElement).value;
                }}
              />
              ${slugBad
                ? html`<span class="slug-hint bad">格式无效：仅限小写字母、数字和连字符</span>`
                : html`<span class="slug-hint faint">${this.slugTouched ? '已手动指定' : '按标题自动生成，可手动修改'}</span>`}
            </label>
            <label class="field">
              <span>分类</span>
              <select
                .value=${this.categoryId}
                @change=${(e: Event) => (this.categoryId = (e.currentTarget as HTMLSelectElement).value)}
              >
                ${this.store.categories.map(
                  (category) => html`<option value=${category.id} ?selected=${category.id === this.categoryId}>${category.name}</option>`,
                )}
              </select>
            </label>
            <label class="field">
              <span>系列</span>
              <select
                .value=${this.seriesId}
                @change=${(e: Event) => (this.seriesId = (e.currentTarget as HTMLSelectElement).value)}
              >
                <option value="" ?selected=${this.seriesId === ''}>不属于任何系列</option>
                ${this.store.seriesList.map(
                  (series) => html`<option value=${series.id} ?selected=${series.id === this.seriesId}>${series.name}</option>`,
                )}
              </select>
            </label>
            ${this.seriesId
              ? html`
                  <div class="row series-row">
                    <label class="field">
                      <span>章节序号（可空，0 起）</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        .value=${this.seriesOrder}
                        placeholder="留空则排到系列末尾"
                        @input=${(e: InputEvent) => (this.seriesOrder = (e.currentTarget as HTMLInputElement).value)}
                      />
                    </label>
                    <label class="field">
                      <span>系列短标题（可空）</span>
                      <input
                        maxlength="80"
                        .value=${this.seriesTitle}
                        placeholder="选集/目录里显示的短标题"
                        @input=${(e: InputEvent) => (this.seriesTitle = (e.currentTarget as HTMLInputElement).value)}
                      />
                    </label>
                  </div>
                `
              : nothing}
            ${this.renderCover()}
            <label class="field">
              <span>摘要</span>
              <textarea
                maxlength="500"
                .value=${this.summary}
                placeholder="一两句话介绍这篇文章…"
                @input=${(e: InputEvent) => (this.summary = (e.currentTarget as HTMLTextAreaElement).value)}
              ></textarea>
            </label>
            <label class="field body-input">
              <span>正文</span>
              <textarea
                .value=${this.body}
                placeholder="开始写作…"
                @input=${(e: InputEvent) => (this.body = (e.currentTarget as HTMLTextAreaElement).value)}
              ></textarea>
            </label>
            <label class="field">
              <span>标签</span>
              <adm-tag-input
                .selected=${this.tagIds}
                @adm-change=${(e: CustomEvent<{ selected: string[] }>) => (this.tagIds = e.detail.selected)}
              ></adm-tag-input>
            </label>
            <adm-toggle
              label="允许评论"
              .checked=${this.allowComments}
              @adm-change=${(e: CustomEvent<{ checked: boolean }>) => (this.allowComments = e.detail.checked)}
            ></adm-toggle>
          </section>
        </div>
        <div class="side">${this.renderPreview()}</div>
      </div>
      <adm-media-picker
        ?open=${this.coverPickerOpen}
        .selectedId=${this.coverMediaId}
        @adm-pick=${(e: CustomEvent<{ media: { id: string } }>) => {
          this.coverMediaId = e.detail.media.id;
          this.coverPickerOpen = false;
        }}
        @adm-close=${() => (this.coverPickerOpen = false)}
      ></adm-media-picker>
    `;
  }
}

customElements.define('adm-article-edit', AdmArticleEdit);
