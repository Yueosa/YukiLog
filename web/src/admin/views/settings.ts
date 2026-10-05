import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { fontLabel, maxWidthLabel, mediaPickerLabel, motionLabel } from '../labels.js';
import type { SiteSettings, ThemeTokens } from '../types.js';
import type { NavigationVariant, ShellLayout } from '../../layout/types.js';

const colorFields: Array<{ key: keyof ThemeTokens['colors']; label: string }> = [
  { key: 'background', label: '页面背景' },
  { key: 'surface', label: '卡片表面' },
  { key: 'surfaceMuted', label: '柔和表面' },
  { key: 'text', label: '正文文字' },
  { key: 'textMuted', label: '次要文字' },
  { key: 'primary', label: '主色' },
  { key: 'secondary', label: '点缀色' },
  { key: 'border', label: '边框' },
];

const fontOptions: Array<ThemeTokens['typography']['body']> = ['system', 'serif', 'rounded', 'mono'];

const navigationLabel: Record<NavigationVariant, string> = {
  topbar: '顶栏',
  sidebar: '侧栏',
  'floating-dock': '悬浮坞',
};

const brandPositionLabel: Record<ShellLayout['brandPosition'], string> = {
  start: '居左',
  center: '居中',
};

/** 站点设置：站点信息 / 社交链接 / 外观主题 / 导航布局，底部吸底保存。 */
export class AdmSettings extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private draft: SiteSettings | null = null;
  private source: SiteSettings | null = null;
  private dirty = false;

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 18px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 14px 16px;
      }

      .avatar-row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .avatar {
        width: 64px;
        height: 64px;
        flex: none;
        border: 1px solid var(--line);
        border-radius: 50%;
        background: var(--surface-muted);
        color: var(--faint);
        display: grid;
        place-items: center;
        font-size: 11.5px;
        overflow: hidden;
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-side {
        flex: 1;
        min-width: 220px;
        display: grid;
        gap: 10px;
      }

      .masthead-row {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        flex-wrap: wrap;
      }

      .masthead-preview {
        width: 240px;
        flex: none;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface-muted);
        color: var(--faint);
        display: grid;
        place-items: center;
        font-size: 11.5px;
      }

      .masthead-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .note {
        margin: 10px 0 0;
        color: var(--faint);
        font-size: 12px;
      }

      .links {
        display: grid;
        gap: 10px;
      }

      .link-row {
        display: grid;
        grid-template-columns: minmax(120px, 200px) 1fr auto;
        gap: 10px;
        align-items: center;
      }

      .link-row input {
        width: 100%;
        padding: 9px 13px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--surface);
        color: var(--ink);
        font: inherit;
        font-size: 13.5px;
        transition:
          border-color 220ms ease,
          box-shadow 220ms ease;
      }

      .link-row input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
      }

      .colors {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px 16px;
      }

      .color-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
      }

      .color-item input[type='color'] {
        width: 34px;
        height: 34px;
        flex: none;
        padding: 0;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: none;
        cursor: pointer;
      }

      .color-item .name {
        flex: 1;
        min-width: 0;
        color: var(--muted);
        font-size: 12.5px;
      }

      .slider-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .slider-row input[type='range'] {
        flex: 1;
        accent-color: var(--primary-d);
      }

      .slider-row output {
        min-width: 42px;
        color: var(--ink);
        font-family: var(--mono);
        font-size: 12.5px;
        text-align: right;
      }

      .toggles {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        align-items: center;
      }

      .action-bar {
        position: sticky;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        box-shadow: 0 -8px 24px rgb(28 39 51 / 6%);
      }
    `,
  ];

  protected willUpdate() {
    // store.settings 刷新时同步一次；用户编辑中（dirty）则不覆盖。
    if (!this.dirty && this.source !== this.store.settings) {
      this.source = this.store.settings;
      this.draft = structuredClone(this.store.settings);
    }
  }

  private touch() {
    this.dirty = true;
    this.requestUpdate();
  }

  private setField<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    if (!this.draft) return;
    this.draft[key] = value;
    this.touch();
  }

  private setColor(key: keyof ThemeTokens['colors'], value: string) {
    if (!this.draft) return;
    this.draft.theme.colors[key] = value;
    this.touch();
  }

  private setLink(index: number, key: 'label' | 'url', value: string) {
    if (!this.draft) return;
    this.draft.socialLinks[index][key] = value;
    this.touch();
  }

  private addLink() {
    if (!this.draft) return;
    this.draft.socialLinks = [...this.draft.socialLinks, { label: '', url: '' }];
    this.touch();
  }

  private removeLink(index: number) {
    if (!this.draft) return;
    this.draft.socialLinks = this.draft.socialLinks.filter((_, i) => i !== index);
    this.touch();
  }

  private async save() {
    const draft = this.draft;
    if (!draft) return;
    const body: SiteSettings = {
      siteTitle: draft.siteTitle,
      siteDescription: draft.siteDescription,
      ownerName: draft.ownerName,
      ownerBio: draft.ownerBio,
      avatarMediaId: draft.avatarMediaId,
      avatarExternalUrl: draft.avatarExternalUrl?.trim() || null,
      mastheadMediaId: draft.mastheadMediaId,
      socialLinks: draft.socialLinks.filter((link) => link.label.trim() || link.url.trim()),
      theme: structuredClone(draft.theme),
      shellLayout: structuredClone(draft.shellLayout),
    };
    await this.store.saveSettings(body);
    this.dirty = false;
  }

  private renderInfo(draft: SiteSettings) {
    const avatar = draft.avatarMediaId ? this.store.media.find((item) => item.id === draft.avatarMediaId) : null;
    const images = this.store.media.filter((item) => item.media_type.startsWith('image/'));
    return html`
      <section class="panel">
        <h2 class="panel-title">站点信息</h2>
        <div class="grid">
          <label class="field">
            <span>站点标题</span>
            <input .value=${draft.siteTitle} @input=${(e: InputEvent) => this.setField('siteTitle', (e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label class="field">
            <span>站长名称</span>
            <input .value=${draft.ownerName} @input=${(e: InputEvent) => this.setField('ownerName', (e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
        <div class="grid" style="margin-top: 14px">
          <label class="field">
            <span>站点说明</span>
            <input
              .value=${draft.siteDescription ?? ''}
              @input=${(e: InputEvent) => this.setField('siteDescription', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
        </div>
        <div class="grid" style="margin-top: 14px">
          <label class="field">
            <span>About</span>
            <textarea
              .value=${draft.ownerBio}
              @input=${(e: InputEvent) => this.setField('ownerBio', (e.currentTarget as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
        </div>
        <div style="margin-top: 14px">
          <div class="field" style="margin-bottom: 8px"><span>站点头像</span></div>
          <div class="avatar-row">
            <div class="avatar">${avatar ? html`<img src=${avatar.url} alt="站点头像" />` : html`无`}</div>
            <div class="avatar-side">
              <adm-upload
                accept="image/*"
                compact
                text="上传新头像"
                @adm-upload=${(e: CustomEvent<{ media: { id: string } }>) => this.setField('avatarMediaId', e.detail.media.id)}
              ></adm-upload>
              <label class="field">
                <span>从媒体库选择</span>
                <select
                  .value=${draft.avatarMediaId ?? ''}
                  @change=${(e: Event) => this.setField('avatarMediaId', (e.currentTarget as HTMLSelectElement).value || null)}
                >
                  <option value="">无</option>
                  ${images.map((item) => html`<option value=${item.id} ?selected=${item.id === draft.avatarMediaId}>${item.original_name}</option>`)}
                </select>
              </label>
              <label class="field">
                <span>头像外链 URL</span>
                <input
                  type="url"
                  placeholder="https://q1.qlogo.cn/g?b=qq&nk=QQ号&s=640"
                  .value=${draft.avatarExternalUrl ?? ''}
                  @input=${(e: InputEvent) =>
                    this.setField('avatarExternalUrl', (e.currentTarget as HTMLInputElement).value.trim() || null)}
                />
              </label>
              <p class="note">填 QQ 头像直链可随 QQ 头像自动更新；本地上传的头像优先于外链。</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private renderMasthead(draft: SiteSettings) {
    const current = draft.mastheadMediaId
      ? this.store.media.find((item) => item.id === draft.mastheadMediaId)
      : null;
    const images = this.store.media.filter((item) => item.media_type.startsWith('image/'));
    return html`
      <section class="panel">
        <h2 class="panel-title">刊头背景</h2>
        <div class="masthead-row">
          <div class="masthead-preview">
            ${current ? html`<img src=${current.url} alt="刊头背景预览" />` : html`未设置`}
          </div>
          <div class="avatar-side">
            <adm-upload
              accept="image/*"
              compact
              text=${mediaPickerLabel.upload}
              @adm-upload=${(e: CustomEvent<{ media: { id: string } }>) => this.setField('mastheadMediaId', e.detail.media.id)}
            ></adm-upload>
            <label class="field">
              <span>${mediaPickerLabel.selectFromLibrary}</span>
              <select
                .value=${draft.mastheadMediaId ?? ''}
                @change=${(e: Event) => this.setField('mastheadMediaId', (e.currentTarget as HTMLSelectElement).value || null)}
              >
                <option value="">${mediaPickerLabel.none}</option>
                ${images.map((item) => html`<option value=${item.id} ?selected=${item.id === draft.mastheadMediaId}>${item.original_name}</option>`)}
              </select>
            </label>
            ${draft.mastheadMediaId
              ? html`<div>
                  <button class="btn secondary small" type="button" @click=${() => this.setField('mastheadMediaId', null)}>
                    ${mediaPickerLabel.clear}
                  </button>
                </div>`
              : nothing}
          </div>
        </div>
        <p class="note">全站文章 / 动态 / 友链 / 搜索页刊头的背景图。</p>
      </section>
    `;
  }

  private renderLinks(draft: SiteSettings) {
    return html`
      <section class="panel">
        <h2 class="panel-title">社交链接</h2>
        <div class="links">
          ${draft.socialLinks.map(
            (link, index) => html`
              <div class="link-row">
                <input
                  placeholder="名称（如 GitHub）"
                  .value=${link.label}
                  @input=${(e: InputEvent) => this.setLink(index, 'label', (e.currentTarget as HTMLInputElement).value)}
                />
                <input
                  placeholder="链接（https://…）"
                  .value=${link.url}
                  @input=${(e: InputEvent) => this.setLink(index, 'url', (e.currentTarget as HTMLInputElement).value)}
                />
                <button class="btn danger small" type="button" @click=${() => this.removeLink(index)}>删除</button>
              </div>
            `,
          )}
          ${!draft.socialLinks.length ? html`<span class="faint">还没有社交链接</span>` : nothing}
          <div><button class="btn secondary small" type="button" @click=${this.addLink}>＋ 添加链接</button></div>
        </div>
      </section>
    `;
  }

  private renderTheme(draft: SiteSettings) {
    const theme = draft.theme;
    return html`
      <section class="panel">
        <h2 class="panel-title">外观主题</h2>
        <div class="colors">
          ${colorFields.map(
            ({ key, label }) => html`
              <label class="color-item">
                <input type="color" .value=${theme.colors[key]} @input=${(e: InputEvent) => this.setColor(key, (e.currentTarget as HTMLInputElement).value)} />
                <span class="name">${label}</span>
                <span class="mono faint">${theme.colors[key]}</span>
              </label>
            `,
          )}
        </div>
        <div class="grid" style="margin-top: 16px">
          <label class="field">
            <span>正文字体</span>
            <select
              .value=${theme.typography.body}
              @change=${(e: Event) => {
                draft.theme.typography.body = (e.currentTarget as HTMLSelectElement).value as ThemeTokens['typography']['body'];
                this.touch();
              }}
            >
              ${fontOptions.map((value) => html`<option value=${value} ?selected=${value === theme.typography.body}>${fontLabel[value]}</option>`)}
            </select>
          </label>
          <label class="field">
            <span>标题字体</span>
            <select
              .value=${theme.typography.display}
              @change=${(e: Event) => {
                draft.theme.typography.display = (e.currentTarget as HTMLSelectElement).value as ThemeTokens['typography']['display'];
                this.touch();
              }}
            >
              ${fontOptions.map((value) => html`<option value=${value} ?selected=${value === theme.typography.display}>${fontLabel[value]}</option>`)}
            </select>
          </label>
          <label class="field">
            <span>动效</span>
            <select
              .value=${theme.motion}
              @change=${(e: Event) => {
                draft.theme.motion = (e.currentTarget as HTMLSelectElement).value as ThemeTokens['motion'];
                this.touch();
              }}
            >
              ${(['none', 'subtle', 'expressive'] as const).map(
                (value) => html`<option value=${value} ?selected=${value === theme.motion}>${motionLabel[value]}</option>`,
              )}
            </select>
          </label>
        </div>
        <div class="grid" style="margin-top: 16px">
          <label class="field">
            <span>字号比例</span>
            <span class="slider-row">
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                .value=${String(theme.typography.scale)}
                @input=${(e: InputEvent) => {
                  draft.theme.typography.scale = Number((e.currentTarget as HTMLInputElement).value);
                  this.touch();
                }}
              />
              <output>${theme.typography.scale.toFixed(2)}</output>
            </span>
          </label>
          <label class="field">
            <span>圆角</span>
            <span class="slider-row">
              <input
                type="range"
                min="0"
                max="32"
                step="1"
                .value=${String(theme.shape.radius)}
                @input=${(e: InputEvent) => {
                  draft.theme.shape.radius = Number((e.currentTarget as HTMLInputElement).value);
                  this.touch();
                }}
              />
              <output>${theme.shape.radius}px</output>
            </span>
          </label>
          <div class="field">
            <span>卡片</span>
            <div class="toggles" style="padding-top: 8px">
              <adm-toggle
                label="卡片描边"
                ?checked=${theme.shape.borderedCards}
                @adm-change=${(e: CustomEvent<{ checked: boolean }>) => {
                  draft.theme.shape.borderedCards = e.detail.checked;
                  this.touch();
                }}
              ></adm-toggle>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private renderLayout(draft: SiteSettings) {
    const shell = draft.shellLayout;
    return html`
      <section class="panel">
        <h2 class="panel-title">导航布局</h2>
        <div class="grid">
          <label class="field">
            <span>导航形式</span>
            <select
              .value=${shell.navigation}
              @change=${(e: Event) => {
                draft.shellLayout.navigation = (e.currentTarget as HTMLSelectElement).value as NavigationVariant;
                this.touch();
              }}
            >
              ${(['topbar', 'sidebar', 'floating-dock'] as const).map(
                (value) => html`<option value=${value} ?selected=${value === shell.navigation}>${navigationLabel[value]}</option>`,
              )}
            </select>
          </label>
          <label class="field">
            <span>品牌位置</span>
            <select
              .value=${shell.brandPosition}
              @change=${(e: Event) => {
                draft.shellLayout.brandPosition = (e.currentTarget as HTMLSelectElement).value as ShellLayout['brandPosition'];
                this.touch();
              }}
            >
              ${(['start', 'center'] as const).map(
                (value) => html`<option value=${value} ?selected=${value === shell.brandPosition}>${brandPositionLabel[value]}</option>`,
              )}
            </select>
          </label>
          <label class="field">
            <span>页宽</span>
            <select
              .value=${shell.maxWidth}
              @change=${(e: Event) => {
                draft.shellLayout.maxWidth = (e.currentTarget as HTMLSelectElement).value as ShellLayout['maxWidth'];
                this.touch();
              }}
            >
              ${(['content', 'wide', 'full'] as const).map(
                (value) => html`<option value=${value} ?selected=${value === shell.maxWidth}>${maxWidthLabel[value]}</option>`,
              )}
            </select>
          </label>
        </div>
        <div class="toggles" style="margin-top: 16px">
          <adm-toggle
            label="搜索入口"
            ?checked=${shell.showSearch}
            @adm-change=${(e: CustomEvent<{ checked: boolean }>) => {
              draft.shellLayout.showSearch = e.detail.checked;
              this.touch();
            }}
          ></adm-toggle>
          <adm-toggle
            label="半透明导航"
            ?checked=${shell.translucent}
            @adm-change=${(e: CustomEvent<{ checked: boolean }>) => {
              draft.shellLayout.translucent = e.detail.checked;
              this.touch();
            }}
          ></adm-toggle>
        </div>
      </section>
    `;
  }

  protected render() {
    const draft = this.draft;
    if (!draft) return html`<adm-empty text="正在加载设置…"></adm-empty>`;
    return html`
      ${this.renderInfo(draft)}
      ${this.renderMasthead(draft)}
      ${this.renderLinks(draft)}
      ${this.renderTheme(draft)}
      ${this.renderLayout(draft)}
      <div class="panel action-bar">
        <span class="faint">改动在保存后生效</span>
        <button class="btn primary" type="button" ?disabled=${this.store.busy} @click=${this.save}>保存站点设置</button>
      </div>
    `;
  }
}

customElements.define('adm-settings', AdmSettings);
