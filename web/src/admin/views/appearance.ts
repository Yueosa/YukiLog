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

/** 外观：按部件调旋钮。左部件列表、右旋钮表单、底部 iframe 实时预览
 * （postMessage 注入覆盖，预览不落库；保存才写回站点设置的 theme.parts）。 */
export class AdmAppearance extends AdmView {
  @state() private registry: PartsRegistry | null = null;
  @state() private registryError = '';
  @state() private selected = '';
  @state() private draft: PartsDraft = {};
  @state() private dirty = false;
  @state() private previewWidth = 0; // 0 = 全宽
  private source: PartsDraft = {};

  private static readonly VIEWPORTS: Array<{ width: number; label: string }> = [
    { width: 375, label: '375 手机' },
    { width: 768, label: '768 平板' },
    { width: 1280, label: '1280 桌面' },
    { width: 0, label: '全宽' },
  ];

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 16px;
      }

      .layout {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }

      .part-list {
        display: grid;
        gap: 6px;
      }

      .part-item {
        padding: 10px 12px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 10px;
        background: var(--adm-surface, #fff);
        text-align: left;
        cursor: pointer;
        transition: border-color 160ms ease;
      }

      .part-item:hover {
        border-color: var(--adm-primary, #4a93c2);
      }

      .part-item.active {
        border-color: var(--adm-primary, #4a93c2);
        background: color-mix(in srgb, var(--adm-primary, #4a93c2) 8%, #fff);
      }

      .part-item strong {
        display: block;
        font-size: 13.5px;
      }

      .part-item span {
        display: block;
        margin-top: 2px;
        color: var(--adm-muted, #667085);
        font-size: 12px;
      }

      .part-item .tuned {
        color: var(--adm-primary, #4a93c2);
      }

      .panel {
        padding: 16px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 12px;
        background: var(--adm-surface, #fff);
      }

      .panel > p {
        margin: 0 0 14px;
        color: var(--adm-muted, #667085);
        font-size: 12.5px;
      }

      .knob {
        display: grid;
        grid-template-columns: 120px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 10px 0;
        border-top: 1px dashed var(--adm-line, #e2e8f0);
      }

      .knob:first-of-type {
        border-top: 0;
      }

      .knob > label {
        font-size: 13px;
        font-weight: 500;
      }

      .knob .hint {
        grid-column: 2;
        color: var(--adm-muted, #667085);
        font-size: 12px;
      }

      .knob input[type='text'] {
        width: 100%;
        padding: 7px 10px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 8px;
        font-size: 13px;
      }

      .knob input[type='range'] {
        width: 100%;
      }

      .options {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .options button {
        padding: 6px 12px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 999px;
        background: #fff;
        font-size: 12.5px;
        cursor: pointer;
      }

      .options button.on {
        border-color: var(--adm-primary, #4a93c2);
        background: var(--adm-primary, #4a93c2);
        color: #fff;
      }

      .clear {
        padding: 4px 10px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--adm-muted, #667085);
        font-size: 12px;
        cursor: pointer;
      }

      .clear:hover {
        color: var(--adm-danger, #d64545);
      }

      .bar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 14px;
      }

      .bar .state {
        color: var(--adm-muted, #667085);
        font-size: 12.5px;
      }

      .preview {
        overflow: hidden;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 12px;
        background: #fff;
      }

      .preview header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--adm-line, #e2e8f0);
        color: var(--adm-muted, #667085);
        font-size: 12px;
      }

      .preview .sizes {
        display: flex;
        gap: 4px;
      }

      .preview .sizes button {
        padding: 3px 10px;
        border: 1px solid var(--adm-line, #e2e8f0);
        border-radius: 999px;
        background: #fff;
        color: var(--adm-muted, #667085);
        font-size: 11.5px;
        cursor: pointer;
      }

      .preview .sizes button.on {
        border-color: var(--adm-primary, #4a93c2);
        background: var(--adm-primary, #4a93c2);
        color: #fff;
      }

      .preview .stage {
        display: flex;
        justify-content: center;
        padding: 10px;
        background: color-mix(in srgb, var(--adm-line, #e2e8f0) 35%, #fff);
      }

      .preview iframe {
        display: block;
        width: 100%;
        height: 560px;
        border: 0;
        background: #fff;
        box-shadow: 0 2px 12px rgb(15 23 42 / 8%);
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
    const frame = this.renderRoot.querySelector<HTMLIFrameElement>('.preview iframe');
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
    if (knob.kind === 'text') {
      return html`
        <label>${knob.label}</label>
        <input
          type="text"
          maxlength=${knob.maxLen ?? 120}
          placeholder="默认"
          .value=${typeof value === 'string' ? value : ''}
          @input=${(e: InputEvent) => this.setKnob(part, knob.key, (e.currentTarget as HTMLInputElement).value)}
        />
        ${clear}
        <span class="hint">${knob.hint}</span>
      `;
    }
    if (knob.kind === 'number') {
      const current = typeof value === 'number' ? value : null;
      return html`
        <label>${knob.label}</label>
        <input
          type="range"
          min=${knob.min ?? 0}
          max=${knob.max ?? 1}
          step="0.05"
          .value=${String(current ?? 1)}
          @input=${(e: InputEvent) =>
            this.setKnob(part, knob.key, Number((e.currentTarget as HTMLInputElement).value))}
        />
        <span>${current === null ? '默认' : current.toFixed(2)} ${clear}</span>
        <span class="hint">${knob.hint}</span>
      `;
    }
    if (knob.kind === 'select') {
      return html`
        <label>${knob.label}</label>
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
        ${clear}
        <span class="hint">${knob.hint}</span>
      `;
    }
    return html`
      <label>${knob.label}</label>
      <input
        type="checkbox"
        .checked=${value === true}
        @change=${(e: Event) => this.setKnob(part, knob.key, (e.currentTarget as HTMLInputElement).checked)}
      />
      ${clear}
      <span class="hint">${knob.hint}</span>
    `;
  }

  render() {
    if (this.registryError) {
      return html`<div class="panel">部件注册表加载失败：${this.registryError}</div>`;
    }
    if (!this.registry) {
      return html`<div class="panel">部件注册表加载中…</div>`;
    }
    const selected = this.registry.parts.find((part) => part.id === this.selected);
    return html`
      <div class="layout">
        <div class="part-list">
          ${this.registry.parts.map((part) => {
            const tuned = Object.keys(this.draft[part.id] ?? {}).length;
            return html`
              <button
                type="button"
                class="part-item${part.id === this.selected ? ' active' : ''}"
                @click=${() => {
                  this.selected = part.id;
                }}
              >
                <strong>${part.label}${tuned ? html`<span class="tuned"> · ${tuned} 项</span>` : nothing}</strong>
                <span>${part.id}</span>
              </button>
            `;
          })}
        </div>
        <div class="panel">
          ${selected
            ? html`
                <p>${selected.description}</p>
                ${selected.knobs.map(
                  (knob) => html`<div class="knob">${this.renderKnob(selected.id, knob)}</div>`,
                )}
                <div class="bar">
                  <button class="btn primary" type="button" ?disabled=${!this.dirty} @click=${() => void this.save()}>
                    保存外观
                  </button>
                  <button class="btn secondary" type="button" ?disabled=${!this.dirty} @click=${() => this.revert()}>
                    放弃修改
                  </button>
                  <button
                    class="btn secondary"
                    type="button"
                    ?disabled=${!this.draft[selected.id]}
                    @click=${() => this.resetPart(selected.id)}
                  >
                    重置此部件
                  </button>
                  <span class="state">${this.dirty ? '有未保存的修改' : '与线上一致'}</span>
                </div>
              `
            : html`<p>注册表里没有部件。</p>`}
        </div>
      </div>
      <div class="preview">
        <header>
          <span>实时预览（修改即时注入，不影响线上；保存后生效）</span>
          <div class="sizes">
            ${AdmAppearance.VIEWPORTS.map(
              (viewport) => html`
                <button
                  type="button"
                  class=${this.previewWidth === viewport.width ? 'on' : ''}
                  @click=${() => {
                    this.previewWidth = viewport.width;
                  }}
                >
                  ${viewport.label}
                </button>
              `,
            )}
          </div>
          <a href="/" target="_blank" rel="noopener">新窗口打开 ↗</a>
        </header>
        <div class="stage">
          <iframe
            src="/"
            title="站点预览"
            style=${this.previewWidth ? `width:${this.previewWidth}px` : ''}
            @load=${() => this.postPreview()}
          ></iframe>
        </div>
      </div>
    `;
  }
}

customElements.define('adm-appearance', AdmAppearance);
