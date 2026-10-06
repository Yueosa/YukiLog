import { css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { api } from '../api.js';
import type { PartsRegistry } from '../types.js';

type PartValues = Record<string, string | number | boolean>;
type PartsDraft = Record<string, PartValues>;

/** 枚举旋钮值的中文标签（注册表只下发值，展示文案归管理端）。 */
const OPTION_LABELS: Record<string, string> = {
  both: '图标 + 文字',
  icons: '仅图标',
  text: '仅文字',
  start: '左对齐',
  center: '居中',
  end: '右对齐',
  featured: '精选',
  popular: '最热',
  recent: '最近',
  mist: '白雾',
  wave: '波浪',
  none: '无',
};

/** 外观工作区：顶栏部件 tabs / 中间实时预览 / 底部密集选项，整页一屏 100vh。
 * 预览用 postMessage 注入未保存草稿（不落库）；保存才写回站点设置的 theme.parts。 */
export class AdmAppearance extends AdmView {
  @state() private registry: PartsRegistry | null = null;
  @state() private registryError = '';
  @state() private selected = '';
  @state() private draft: PartsDraft = {};
  @state() private dirty = false;
  @state() private previewWidth = 0; // 0 = 全宽
  private source: PartsDraft = {};

  private static readonly VIEWPORTS: Array<{ width: number; label: string }> = [
    { width: 375, label: '375' },
    { width: 768, label: '768' },
    { width: 1280, label: '1280' },
    { width: 1920, label: '1920' },
    { width: 0, label: '全宽' },
  ];

  /** 自定义视口宽度（输入框），null = 未启用。 */
  @state() private customWidth: number | null = null;

  static styles = [
    adminTheme,
    css`
      :host {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
      }

      /* ---- 顶栏：部件 tabs + 保存区 ---- */
      .topbar {
        display: flex;
        flex: none;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .tabs {
        display: flex;
        flex: 1;
        gap: 6px;
        min-width: 0;
        overflow-x: auto;
        padding: 2px;
        scrollbar-width: thin;
      }

      .tab {
        flex: none;
        padding: 7px 14px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 999px;
        background: var(--adm-surface, #fff);
        color: var(--adm-muted, #667085);
        font-size: 12.5px;
        white-space: nowrap;
        cursor: pointer;
        transition:
          border-color 160ms ease,
          color 160ms ease,
          background 160ms ease;
      }

      .tab:hover {
        border-color: var(--adm-primary, #4a93c2);
        color: var(--ink, #20232a);
      }

      .tab.active {
        border-color: var(--adm-primary, #4a93c2);
        background: var(--adm-primary, #4a93c2);
        color: #fff;
      }

      .tab .tuned {
        margin-left: 4px;
        opacity: 0.75;
        font-size: 11px;
      }

      .actions {
        display: flex;
        flex: none;
        align-items: center;
        gap: 8px;
      }

      .state {
        color: var(--adm-muted, #667085);
        font-size: 12px;
        white-space: nowrap;
      }

      /* ---- 预览区 ---- */
      .stage {
        position: relative;
        display: flex;
        flex: 1;
        justify-content: center;
        min-height: 0;
        overflow: hidden;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 14px;
        background: color-mix(in srgb, var(--adm-line, #e2e8f0) 30%, #fff);
      }

      .stage iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: #fff;
        transition: width 240ms ease;
      }

      .sizes {
        position: absolute;
        z-index: 2;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 4px;
        padding: 4px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 999px;
        background: rgb(255 255 255 / 88%);
        backdrop-filter: blur(8px);
      }

      .sizes button {
        padding: 3px 10px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--adm-muted, #667085);
        font-size: 11px;
        cursor: pointer;
      }

      .sizes button.on {
        background: var(--adm-primary, #4a93c2);
        color: #fff;
      }

      .sizes input {
        width: 62px;
        padding: 2px 6px;
        border: 1px solid transparent;
        border-radius: 999px;
        background: transparent;
        color: var(--adm-muted, #667085);
        font-size: 11px;
        text-align: center;
      }

      .sizes input:focus,
      .sizes input.on {
        border-color: var(--adm-primary, #4a93c2);
        color: var(--ink, #20232a);
        outline: none;
      }

      /* ---- 底部密集选项 ---- */
      .knobs {
        display: grid;
        flex: none;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 8px 14px;
        max-height: 34vh;
        overflow-y: auto;
        padding: 12px 14px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 14px;
        background: var(--adm-surface, #fff);
        scrollbar-width: thin;
      }

      .knobs .part-desc {
        grid-column: 1 / -1;
        margin: 0;
        color: var(--adm-muted, #667085);
        font-size: 12px;
      }

      .knob {
        display: grid;
        gap: 5px;
        min-width: 0;
        padding: 8px 10px;
        border-radius: 10px;
        background: color-mix(in srgb, var(--adm-line, #e2e8f0) 22%, #fff);
      }

      .knob-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .knob-head label {
        font-size: 12.5px;
        font-weight: 600;
      }

      .knob .clear {
        flex: none;
        padding: 1px 8px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--adm-muted, #667085);
        font-size: 11px;
        cursor: pointer;
      }

      .knob .clear:hover:not(:disabled) {
        color: var(--adm-danger, #d64545);
      }

      .knob .clear:disabled {
        opacity: 0.35;
        cursor: default;
      }

      .knob .hint {
        overflow: hidden;
        color: var(--adm-muted, #667085);
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .knob input[type='text'] {
        width: 100%;
        padding: 6px 9px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 8px;
        font-size: 12.5px;
      }

      .knob .number-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .knob input[type='range'] {
        flex: 1;
        min-width: 0;
      }

      .knob .number-value {
        flex: none;
        min-width: 42px;
        color: var(--adm-muted, #667085);
        font-family: ui-monospace, monospace;
        font-size: 11.5px;
        text-align: right;
      }

      .options {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .options button {
        padding: 4px 11px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 999px;
        background: #fff;
        color: var(--adm-muted, #667085);
        font-size: 12px;
        cursor: pointer;
      }

      .options button.on {
        border-color: var(--adm-primary, #4a93c2);
        background: var(--adm-primary, #4a93c2);
        color: #fff;
      }

      .bool-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .bool-row input {
        width: 16px;
        height: 16px;
        accent-color: var(--adm-primary, #4a93c2);
      }

      .bool-row .bool-label {
        color: var(--adm-muted, #667085);
        font-size: 12px;
      }

      .empty {
        grid-column: 1 / -1;
        margin: 0;
        padding: 18px 0;
        color: var(--adm-muted, #667085);
        font-size: 12.5px;
        text-align: center;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    if (!this.registry) void this.load();
  }

  private async load() {
    try {
      this.registry = await api<PartsRegistry>('/api/admin/parts/registry');
      this.source = structuredClone(this.store.settings?.theme?.parts ?? {}) as PartsDraft;
      this.draft = structuredClone(this.source);
      this.selected = this.registry.parts[0]?.id ?? '';
      this.dirty = false;
    } catch (error) {
      this.registryError = error instanceof Error ? error.message : '注册表加载失败';
    }
  }

  /** 预览帧就绪 / 草稿变化时注入覆盖（与 yuki-app 的 handlePartsPreview 约定）。 */
  private postPreview() {
    const frame = this.renderRoot.querySelector<HTMLIFrameElement>('.stage iframe');
    frame?.contentWindow?.postMessage(
      { type: 'yukilog:parts-preview', parts: this.draft },
      window.location.origin,
    );
  }

  private setKnob(part: string, key: string, value: string | number | boolean | null) {
    const next: PartsDraft = structuredClone(this.draft);
    const knobs: PartValues = { ...(next[part] ?? {}) };
    if (value === null || value === '') {
      delete knobs[key];
    } else {
      knobs[key] = value;
    }
    if (Object.keys(knobs).length === 0) {
      delete next[part];
    } else {
      next[part] = knobs;
    }
    this.draft = next;
    this.dirty = true;
    this.postPreview();
  }

  private resetPart(part: string) {
    const next: PartsDraft = structuredClone(this.draft);
    delete next[part];
    this.draft = next;
    this.dirty = true;
    this.postPreview();
  }

  private revert() {
    this.draft = structuredClone(this.source);
    this.dirty = false;
    this.postPreview();
  }

  private async save() {
    const settings = this.store.settings;
    if (!settings) return;
    // 与站点设置页同款逐字段构造：整对象展开会把 updatedAt 等响应字段
    // 带进 PUT，服务端 deny_unknown_fields 直接 422（保存悄悄失败）
    await this.store.saveSettings({
      siteTitle: settings.siteTitle,
      siteDescription: settings.siteDescription,
      ownerName: settings.ownerName,
      ownerBio: settings.ownerBio,
      avatarMediaId: settings.avatarMediaId,
      avatarExternalUrl: settings.avatarExternalUrl,
      mastheadMediaId: settings.mastheadMediaId,
      heroBackgroundMediaIds: [...(settings.heroBackgroundMediaIds ?? [])],
      heroQuote: settings.heroQuote,
      socialLinks: settings.socialLinks,
      theme: { ...settings.theme, parts: structuredClone(this.draft) },
      shellLayout: structuredClone(settings.shellLayout),
    });
    this.source = structuredClone(this.draft);
    this.dirty = false;
  }

  private knobValue(part: string, key: string) {
    return this.draft[part]?.[key];
  }

  private renderKnob(part: string, knob: PartsRegistry['parts'][number]['knobs'][number]) {
    const value = this.knobValue(part, knob.key);
    const clear = html`<button
      class="clear"
      type="button"
      title="恢复默认"
      ?disabled=${value === undefined}
      @click=${() => this.setKnob(part, knob.key, null)}
    >
      默认
    </button>`;
    const head = html`<div class="knob-head"><label>${knob.label}</label>${clear}</div>`;
    if (knob.kind === 'text') {
      return html`<div class="knob">
        ${head}
        <input
          type="text"
          maxlength=${knob.maxLen ?? 120}
          placeholder="默认"
          .value=${typeof value === 'string' ? value : ''}
          @input=${(e: InputEvent) => this.setKnob(part, knob.key, (e.currentTarget as HTMLInputElement).value)}
        />
        <span class="hint" title=${knob.hint}>${knob.hint}</span>
      </div>`;
    }
    if (knob.kind === 'number') {
      const current = typeof value === 'number' ? value : null;
      return html`<div class="knob">
        ${head}
        <div class="number-row">
          <input
            type="range"
            min=${knob.min ?? 0}
            max=${knob.max ?? 1}
            step="0.05"
            .value=${String(current ?? 1)}
            @input=${(e: InputEvent) =>
              this.setKnob(part, knob.key, Number((e.currentTarget as HTMLInputElement).value))}
          />
          <span class="number-value">${current === null ? '默认' : current.toFixed(2)}</span>
        </div>
        <span class="hint" title=${knob.hint}>${knob.hint}</span>
      </div>`;
    }
    if (knob.kind === 'select') {
      return html`<div class="knob">
        ${head}
        <div class="options">
          ${(knob.options ?? []).map(
            (option) => html`
              <button
                type="button"
                class=${value === option ? 'on' : ''}
                @click=${() => this.setKnob(part, knob.key, option)}
              >
                ${OPTION_LABELS[option] ?? option}
              </button>
            `,
          )}
        </div>
        <span class="hint" title=${knob.hint}>${knob.hint}</span>
      </div>`;
    }
    return html`<div class="knob">
      ${head}
      <div class="bool-row">
        <input
          type="checkbox"
          .checked=${value !== false}
          @change=${(e: Event) => this.setKnob(part, knob.key, (e.currentTarget as HTMLInputElement).checked)}
        />
        <span class="bool-label">${value === false ? '已关闭' : '显示中'}</span>
      </div>
      <span class="hint" title=${knob.hint}>${knob.hint}</span>
    </div>`;
  }

  render() {
    if (this.registryError) {
      return html`<p class="empty">部件注册表加载失败：${this.registryError}</p>`;
    }
    if (!this.registry) {
      return html`<p class="empty">部件注册表加载中…</p>`;
    }
    const selected = this.registry.parts.find((part) => part.id === this.selected);
    return html`
      <div class="topbar">
        <div class="tabs">
          ${this.registry.parts.map((part) => {
            const tuned = Object.keys(this.draft[part.id] ?? {}).length;
            return html`
              <button
                type="button"
                class="tab${part.id === this.selected ? ' active' : ''}"
                @click=${() => {
                  this.selected = part.id;
                }}
              >
                ${part.label}${tuned ? html`<span class="tuned">· ${tuned}</span>` : nothing}
              </button>
            `;
          })}
        </div>
        <div class="actions">
          <span class="state">${this.dirty ? '有未保存的修改' : '与线上一致'}</span>
          <button class="btn secondary small" type="button" ?disabled=${!this.dirty} @click=${() => this.revert()}>
            放弃
          </button>
          <button
            class="btn secondary small"
            type="button"
            ?disabled=${!selected || !this.draft[selected.id]}
            @click=${() => selected && this.resetPart(selected.id)}
          >
            重置此部件
          </button>
          <button class="btn primary small" type="button" ?disabled=${!this.dirty} @click=${() => void this.save()}>
            保存外观
          </button>
        </div>
      </div>
      <div class="stage">
        <div class="sizes">
          ${AdmAppearance.VIEWPORTS.map(
            (viewport) => html`
              <button
                type="button"
                class=${this.customWidth === null && this.previewWidth === viewport.width ? 'on' : ''}
                title=${viewport.width ? `${viewport.width}px 视口` : '全宽'}
                @click=${() => {
                  this.previewWidth = viewport.width;
                  this.customWidth = null;
                }}
              >
                ${viewport.label}
              </button>
            `,
          )}
          <input
            type="number"
            min="240"
            max="3840"
            step="10"
            placeholder="自定义"
            title="自定义视口宽度（240–3840px，回车生效）"
            class=${this.customWidth !== null ? 'on' : ''}
            .value=${this.customWidth !== null ? String(this.customWidth) : ''}
            @change=${(e: Event) => {
              const value = Math.round(Number((e.currentTarget as HTMLInputElement).value));
              if (Number.isFinite(value) && value >= 240 && value <= 3840) {
                this.customWidth = value;
                this.previewWidth = value;
              } else {
                this.customWidth = null;
                (e.currentTarget as HTMLInputElement).value = '';
              }
            }}
          />
        </div>
        <iframe
          src="/"
          title="站点预览"
          style=${this.previewWidth ? `width:${this.previewWidth}px` : ''}
          @load=${() => this.postPreview()}
        ></iframe>
      </div>
      <div class="knobs">
        ${selected
          ? html`
              <p class="part-desc">${selected.description}（修改即时注入预览，保存后上线）</p>
              ${selected.knobs.map((knob) => this.renderKnob(selected.id, knob))}
            `
          : html`<p class="empty">注册表里没有部件。</p>`}
      </div>
    `;
  }
}

customElements.define('adm-appearance', AdmAppearance);
