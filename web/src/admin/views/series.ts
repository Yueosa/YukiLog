import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { generateSlug, isValidSlug } from '../slugify.js';
import type { Article, Series } from '../types.js';

type ChapterDraft = {
  article_id: string;
  title: string;
  status: Article['status'];
  series_title: string | null;
};

/** 系列管理：列表模式（新建表单 + 全部系列）与详情模式（系列信息 + 章节管理）。
 * 路由：#/series 列表，#/series/{id} 详情。 */
export class AdmSeries extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;
  @property() seriesId: string | null = null;

  // 列表模式的内联新建表单
  @state() private name = '';
  @state() private slug = '';
  private slugTouched = false;

  // 详情模式：系列信息表单
  @state() private editName = '';
  @state() private editSlug = '';
  @state() private editDescription = '';
  @state() private editCoverMediaId: string | null = null;
  @state() private editFeatured = false;
  @state() private pickerOpen = false;

  // 详情模式：章节草稿（顺序即序号，保存时归一化为 0..n-1）
  @state() private chapters: ChapterDraft[] = [];
  @state() private chapterDirty = false;
  @state() private addCandidateId = '';
  private originalChapterIds: string[] = [];
  private syncedFor: string | null | undefined = undefined;

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 18px;
      }

      .back {
        justify-self: start;
        padding: 0;
        border: 0;
        background: none;
        color: var(--muted);
        font-size: 13px;
        text-decoration: none;
      }

      .back:hover {
        color: var(--primary-d);
      }

      .form-grid {
        display: grid;
        gap: 12px;
      }

      .form-grid .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
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

      /* 章节管理 */
      .chapter-order {
        width: 34px;
        color: var(--faint);
        font-family: var(--mono);
        font-size: 12px;
        text-align: right;
      }

      .chapter-title {
        font-weight: 600;
      }

      .chapter-title .faint {
        display: block;
        font-weight: 400;
        font-size: 11.5px;
      }

      .short-title-input {
        width: 180px;
        padding: 6px 10px;
        font-size: 12.5px;
      }

      .order-btns {
        display: inline-flex;
        gap: 4px;
      }

      .order-btns button {
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--muted);
        font-size: 12px;
        line-height: 1;
      }

      .order-btns button:hover:not(:disabled) {
        border-color: var(--primary);
        color: var(--primary-d);
      }

      .order-btns button:disabled {
        opacity: 0.35;
      }

      .add-row {
        display: flex;
        gap: 10px;
        margin-top: 12px;
      }

      .add-row select {
        flex: 1;
      }

      .chapter-foot {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 14px;
      }

      .chapter-foot .dirty-hint {
        color: var(--secondary-d);
        font-size: 12px;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void this.store.refreshMedia();
  }

  protected willUpdate() {
    const item = this.currentSeries;
    const key = this.seriesId;
    if (this.syncedFor === key) return;
    if (this.seriesId && item) {
      this.editName = item.name;
      this.editSlug = item.slug;
      this.editDescription = item.description ?? '';
      this.editCoverMediaId = item.cover_media_id;
      this.editFeatured = item.featured;
      const chapters = this.store.articles
        .filter((article) => article.series_id === item.id)
        .sort((a, b) => (a.series_order ?? 1e9) - (b.series_order ?? 1e9))
        .map((article) => ({
          article_id: article.id,
          title: article.title,
          status: article.status,
          series_title: article.series_title,
        }));
      this.chapters = chapters;
      this.originalChapterIds = chapters.map((chapter) => chapter.article_id);
      this.chapterDirty = false;
      this.addCandidateId = '';
    }
    this.syncedFor = key;
  }

  private get currentSeries(): Series | null {
    return this.seriesId
      ? (this.store.seriesList.find((item) => item.id === this.seriesId) ?? null)
      : null;
  }

  private coverOf(mediaId: string | null) {
    return mediaId ? this.store.media.find((item) => item.id === mediaId) : undefined;
  }

  // ---------- 列表模式：新建 ----------

  private async createSeries() {
    const name = this.name.trim();
    const slug = this.slug.trim();
    if (!name) return this.store.toast('请填写系列名称', 'err');
    if (!isValidSlug(slug)) {
      return this.store.toast('slug 格式不正确（小写字母、数字、连字符）', 'err');
    }
    await this.store.saveSeries(null, { name, slug, description: null, cover_media_id: null, featured: false });
    this.name = this.slug = '';
    this.slugTouched = false;
  }

  // ---------- 详情模式：系列信息 ----------

  private async saveInfo() {
    const item = this.currentSeries;
    if (!item) return;
    const name = this.editName.trim();
    const slug = this.editSlug.trim();
    if (!name) return this.store.toast('请填写系列名称', 'err');
    if (!isValidSlug(slug)) {
      return this.store.toast('slug 格式不正确（小写字母、数字、连字符）', 'err');
    }
    await this.store.saveSeries(item.id, {
      name,
      slug,
      description: this.editDescription.trim() || null,
      cover_media_id: this.editCoverMediaId,
      featured: this.editFeatured,
    });
  }

  // ---------- 详情模式：章节管理 ----------

  private moveChapter(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= this.chapters.length) return;
    const next = [...this.chapters];
    [next[index], next[target]] = [next[target], next[index]];
    this.chapters = next;
    this.chapterDirty = true;
  }

  private removeChapter(index: number) {
    this.chapters = this.chapters.filter((_, i) => i !== index);
    this.chapterDirty = true;
  }

  private addChapter() {
    const article = this.store.articles.find((entry) => entry.id === this.addCandidateId);
    if (!article) return;
    this.chapters = [
      ...this.chapters,
      {
        article_id: article.id,
        title: article.title,
        status: article.status,
        series_title: article.series_title,
      },
    ];
    this.addCandidateId = '';
    this.chapterDirty = true;
  }

  private async saveChapters() {
    const item = this.currentSeries;
    if (!item) return;
    const chapters = this.chapters.map((chapter, index) => ({
      article_id: chapter.article_id,
      series_order: index,
      series_title: chapter.series_title?.trim() || null,
    }));
    const remove = this.originalChapterIds.filter(
      (id) => !this.chapters.some((chapter) => chapter.article_id === id),
    );
    const ok = await this.store.saveSeriesChapters(item.id, chapters, remove);
    if (ok) {
      this.originalChapterIds = this.chapters.map((chapter) => chapter.article_id);
      this.chapterDirty = false;
    }
  }

  // ---------- 渲染 ----------

  private renderCreatePanel() {
    return html`
      <section class="panel">
        <h2 class="panel-title">新建系列</h2>
        <div class="form-grid">
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
          <div style="display: flex; justify-content: flex-end">
            <button class="btn primary" ?disabled=${this.store.busy} @click=${this.createSeries}>
              新建系列
            </button>
          </div>
        </div>
      </section>
    `;
  }

  private renderList() {
    const items = this.store.seriesList;
    return html`
      ${this.renderCreatePanel()}
      <section class="panel">
        <h2 class="panel-title">全部系列</h2>
        ${items.length
          ? html`
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
                              <a class="btn secondary small" href=${`#/series/${item.id}`}>管理</a>
                              <button class="btn danger small" @click=${() => this.store.deleteSeries(item)}>删除</button>
                            </span>
                          </td>
                        </tr>
                      `;
                    })}
                  </tbody>
                </table>
              </div>
            `
          : html`<adm-empty text="还没有系列" hint="用上方表单创建第一个系列"></adm-empty>`}
      </section>
    `;
  }

  private renderInfoPanel(item: Series) {
    const cover = this.coverOf(this.editCoverMediaId);
    return html`
      <section class="panel">
        <h2 class="panel-title">系列信息</h2>
        <div class="form-grid">
          <div class="row">
            <label class="field">
              <span>名称</span>
              <input .value=${this.editName} @input=${(e: InputEvent) => (this.editName = (e.target as HTMLInputElement).value)} />
            </label>
            <label class="field">
              <span>slug</span>
              <input class="mono" .value=${this.editSlug} @input=${(e: InputEvent) => (this.editSlug = (e.target as HTMLInputElement).value)} />
            </label>
          </div>
          <label class="field">
            <span>简介</span>
            <input
              .value=${this.editDescription}
              placeholder="一句话介绍这个系列（可空）"
              @input=${(e: InputEvent) => (this.editDescription = (e.target as HTMLInputElement).value)}
            />
          </label>
          <div class="field">
            <span>封面</span>
            <div class="cover-row">
              ${cover ? html`<img src=${cover.thumb_url || cover.url} alt=${cover.original_name} />` : nothing}
              <button class="btn secondary small" type="button" @click=${() => (this.pickerOpen = true)}>
                ${cover ? '更换封面' : '从媒体库选择封面'}
              </button>
              ${cover
                ? html`<button class="btn secondary small" type="button" @click=${() => (this.editCoverMediaId = null)}>移除封面</button>`
                : nothing}
            </div>
          </div>
          <adm-toggle
            label="精选（显示在首页精选区顶部）"
            .checked=${this.editFeatured}
            @adm-change=${(e: CustomEvent<{ checked: boolean }>) => (this.editFeatured = e.detail.checked)}
          ></adm-toggle>
          <div style="display: flex; justify-content: flex-end; gap: 8px">
            <button class="btn primary" ?disabled=${this.store.busy} @click=${this.saveInfo}>保存系列信息</button>
          </div>
        </div>
      </section>
    `;
  }

  private renderChaptersPanel(item: Series) {
    const candidates = this.store.articles.filter(
      (article) =>
        article.series_id !== item.id &&
        !this.chapters.some((chapter) => chapter.article_id === article.id),
    );
    const seriesNameOf = (article: Article) =>
      article.series_id
        ? (this.store.seriesList.find((entry) => entry.id === article.series_id)?.name ?? '其他系列')
        : null;
    return html`
      <section class="panel">
        <h2 class="panel-title">章节管理（${this.chapters.length}）</h2>
        ${this.chapters.length
          ? html`
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr><th></th><th>章节</th><th>系列短标题</th><th>状态</th><th>排序</th><th></th></tr>
                  </thead>
                  <tbody>
                    ${this.chapters.map(
                      (chapter, index) => html`
                        <tr>
                          <td class="chapter-order">${String(index).padStart(2, '0')}</td>
                          <td class="chapter-title">
                            ${chapter.title}
                            <span class="faint mono">${chapter.article_id.slice(0, 8)}</span>
                          </td>
                          <td>
                            <input
                              class="short-title-input"
                              .value=${chapter.series_title ?? ''}
                              placeholder="默认同文章标题"
                              @input=${(e: InputEvent) => {
                                const value = (e.target as HTMLInputElement).value;
                                this.chapters = this.chapters.map((entry, i) =>
                                  i === index ? { ...entry, series_title: value } : entry,
                                );
                                this.chapterDirty = true;
                              }}
                            />
                          </td>
                          <td>
                            <span class="badge ${chapter.status === 'published' ? 'ok' : ''}">
                              ${chapter.status === 'published' ? '已发布' : '草稿'}
                            </span>
                          </td>
                          <td>
                            <span class="order-btns">
                              <button type="button" aria-label="上移" ?disabled=${index === 0} @click=${() => this.moveChapter(index, -1)}>↑</button>
                              <button type="button" aria-label="下移" ?disabled=${index === this.chapters.length - 1} @click=${() => this.moveChapter(index, 1)}>↓</button>
                            </span>
                          </td>
                          <td>
                            <button class="btn danger small" type="button" @click=${() => this.removeChapter(index)}>移出</button>
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>
            `
          : html`<adm-empty text="这个系列还没有章节" hint="从下方把文章加进来"></adm-empty>`}
        <div class="add-row">
          <select
            .value=${this.addCandidateId}
            @change=${(e: Event) => (this.addCandidateId = (e.target as HTMLSelectElement).value)}
          >
            <option value="">选择要加入的文章…</option>
            ${candidates.map(
              (article) => html`
                <option value=${article.id}>
                  ${article.title}${article.series_id ? html`（现属「${seriesNameOf(article)}」）` : nothing}
                </option>
              `,
            )}
          </select>
          <button class="btn secondary" type="button" ?disabled=${!this.addCandidateId} @click=${this.addChapter}>
            加入系列
          </button>
        </div>
        <div class="chapter-foot">
          <button class="btn primary" type="button" ?disabled=${!this.chapterDirty || this.store.busy} @click=${this.saveChapters}>
            保存章节
          </button>
          ${this.chapterDirty
            ? html`
                <button
                  class="btn secondary"
                  type="button"
                  @click=${() => {
                    this.syncedFor = undefined;
                    this.willUpdate();
                    this.requestUpdate();
                  }}
                >
                  放弃改动
                </button>
                <span class="dirty-hint">有未保存的章节改动</span>
              `
            : nothing}
        </div>
      </section>
    `;
  }

  protected render() {
    if (this.seriesId) {
      const item = this.currentSeries;
      if (!item) {
        return html`<adm-empty text="系列不存在" hint="它可能已被删除"></adm-empty>`;
      }
      return html`
        <a class="back" href="#/series">← 返回系列列表</a>
        ${this.renderInfoPanel(item)} ${this.renderChaptersPanel(item)}
        <adm-media-picker
          ?open=${this.pickerOpen}
          .selectedId=${this.editCoverMediaId}
          @adm-pick=${(e: CustomEvent<{ media: { id: string } }>) => {
            this.editCoverMediaId = e.detail.media.id;
            this.pickerOpen = false;
          }}
          @adm-close=${() => (this.pickerOpen = false)}
        ></adm-media-picker>
      `;
    }
    return this.renderList();
  }
}

customElements.define('adm-series', AdmSeries);
