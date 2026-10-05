import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { generateSlug } from '../slugify.js';
import type { Tag } from '../types.js';

/**
 * 标签输入：已选标签显示为 chips，输入时给出已有标签建议，
 * 回车无匹配时创建新标签（POST /api/admin/tags）并选中。
 */
export class AdmTagInput extends LitElement {
  @property({ attribute: false }) selected: string[] = [];
  @state() private draft = '';

  static styles = css`
    .box {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px;
      padding: 8px 10px;
      border: 1px solid var(--line, #dde5ec);
      border-radius: 10px;
      background: var(--surface, #fff);
      transition:
        border-color 220ms ease,
        box-shadow 220ms ease;
    }

    .box:focus-within {
      border-color: var(--primary, #7eb6d9);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #7eb6d9) 18%, transparent);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 6px 3px 11px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary, #7eb6d9) 15%, transparent);
      color: var(--primary-d, #4a93c2);
      font-size: 12.5px;
    }

    .chip button {
      display: grid;
      width: 16px;
      height: 16px;
      padding: 0;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
    }

    .chip button:hover {
      background: rgb(28 39 51 / 12%);
    }

    input {
      flex: 1;
      min-width: 120px;
      padding: 4px 2px;
      border: 0;
      background: transparent;
      color: var(--ink, #1c2733);
      font: inherit;
      font-size: 13px;
    }

    input:focus {
      outline: none;
    }

    .hint {
      margin-top: 6px;
      color: var(--faint, #93a3b3);
      font-size: 11.5px;
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .suggestions button {
      padding: 3px 11px;
      border: 1px dashed var(--line, #dde5ec);
      border-radius: 999px;
      background: transparent;
      color: var(--muted, #5d6b7a);
      font-size: 12px;
      cursor: pointer;
      transition:
        border-color 200ms ease,
        color 200ms ease;
    }

    .suggestions button:hover {
      border-color: var(--primary, #7eb6d9);
      color: var(--primary-d, #4a93c2);
    }
  `;

  private tagById(id: string): Tag | undefined {
    return store.tags.find((tag) => tag.id === id);
  }

  private add(id: string) {
    if (this.selected.includes(id)) return;
    this.selected = [...this.selected, id];
    this.emit();
  }

  private removeTag(id: string) {
    this.selected = this.selected.filter((item) => item !== id);
    this.emit();
  }

  private emit() {
    this.dispatchEvent(
      new CustomEvent('adm-change', { detail: { selected: this.selected }, bubbles: true, composed: true }),
    );
  }

  private async keydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const name = this.draft.trim();
    if (!name) return;
    const existing = store.tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      this.add(existing.id);
      this.draft = '';
      return;
    }
    const created = await store.createTag({ name, slug: generateSlug(name) });
    if (created) {
      this.add(created.id);
      this.draft = '';
    }
  }

  protected render() {
    const unselected = store.tags.filter((tag) => !this.selected.includes(tag.id));
    const suggestions = this.draft.trim()
      ? unselected.filter((tag) => tag.name.toLowerCase().includes(this.draft.trim().toLowerCase()))
      : unselected.slice(0, 8);
    return html`
      <div class="box">
        ${this.selected.map((id) => {
          const tag = this.tagById(id);
          if (!tag) return nothing;
          return html`<span class="chip">${tag.name}<button type="button" aria-label="移除 ${tag.name}" @click=${() => this.removeTag(id)}>×</button></span>`;
        })}
        <input
          placeholder="输入标签名，回车添加或新建…"
          .value=${this.draft}
          @input=${(e: InputEvent) => (this.draft = (e.currentTarget as HTMLInputElement).value)}
          @keydown=${this.keydown}
        />
      </div>
      ${suggestions.length
        ? html`<div class="suggestions">
            ${suggestions.map((tag) => html`<button type="button" @click=${() => this.add(tag.id)}>${tag.name}</button>`)}
          </div>`
        : nothing}
      ${this.draft.trim() && !suggestions.some((tag) => tag.name.toLowerCase() === this.draft.trim().toLowerCase())
        ? html`<p class="hint">回车将创建新标签「${this.draft.trim()}」</p>`
        : nothing}
    `;
  }
}

customElements.define('adm-tag-input', AdmTagInput);
