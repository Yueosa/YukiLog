/** 焦点框选器：在图片上拖拽一个视口比例的窗口，保存为 background-position 百分比。 */
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { adminTheme } from '../theme.js';

@customElement('adm-focal-picker')
export class AdmFocalPicker extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() src = '';
  @property() position: string | null = null;
  @property() size: string | null = null;

  @state() private box: { w: number; h: number } | null = null;
  @state() private win = { x: 0, y: 0, w: 0, h: 0 };
  /** 能填满视口的最大框选窗口（cover 窗口）；滚轮只能在此基础上缩小（局部放大）。 */
  private coverWin: { w: number; h: number } | null = null;
  private winAspect = 16 / 9;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };

  static styles = [
    adminTheme,
    css`
      .mask {
        position: fixed;
        z-index: 400;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgb(12 18 26 / 55%);
        backdrop-filter: blur(3px);
      }

      .dialog {
        display: grid;
        gap: 14px;
        width: min(620px, 92vw);
        padding: 20px;
        border-radius: 18px;
        background: var(--surface);
        box-shadow: 0 24px 60px -18px rgb(15 23 32 / 45%);
      }

      .dialog h3 {
        margin: 0;
        font-size: 15px;
      }

      .stage {
        position: relative;
        overflow: hidden;
        margin: 0 auto;
        max-width: 100%;
        border-radius: 12px;
        user-select: none;
        touch-action: none;
      }

      .stage img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: fill;
        pointer-events: none;
      }

      .crop {
        position: absolute;
        border: 2px solid #fff;
        border-radius: 8px;
        box-shadow:
          0 0 0 9999px rgb(10 14 20 / 45%),
          0 0 12px rgb(0 0 0 / 35%) inset;
        cursor: grab;
      }

      .crop:active {
        cursor: grabbing;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .note {
        margin: 0;
        color: var(--faint);
        font-size: 12px;
      }
    `,
  ];

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('open') && this.open) {
      this.box = null;
      this.coverWin = null;
    }
  }

  /** 图片加载后按视口比例放置初始窗口（已有缩放则还原，否则 cover 窗口居中/对焦）。 */
  private onImageLoad(event: Event) {
    const img = event.currentTarget as HTMLImageElement;
    const stage = img.parentElement as HTMLElement;
    const rect = stage.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    this.box = { w: W, h: H };
    this.winAspect = window.innerWidth / window.innerHeight;
    let coverW = W;
    let coverH = W / this.winAspect;
    if (coverH > H) {
      coverH = H;
      coverW = H * this.winAspect;
    }
    this.coverWin = { w: coverW, h: coverH };
    const zoom = this.parseSize(this.size);
    const winW = zoom ? W * zoom[0] : coverW;
    const winH = zoom ? H * zoom[1] : coverH;
    const [px, py] = this.parsePosition(this.position) ?? [50, 50];
    const x = this.percentToPx(px, W, winW);
    const y = this.percentToPx(py, H, winH);
    this.win = { x, y, w: winW, h: winH };
  }

  /** 解析 background-size "230% 172%" → 窗口占图比例 [0.435, 0.581]。 */
  private parseSize(size: string | null): [number, number] | null {
    if (!size) return null;
    const [w, h] = size.split(' ').map((part) => Number(part.replace('%', '')));
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      ? [100 / w, 100 / h]
      : null;
  }

  private parsePosition(position: string | null): [number, number] | null {
    if (!position) return null;
    const [x, y] = position.split(' ').map((part) => Number(part.replace('%', '')));
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }

  /** background-position 百分比 → 窗口左上角像素。 */
  private percentToPx(percent: number, box: number, win: number): number {
    const free = Math.max(1, box - win);
    return Math.min(Math.max((percent / 100) * free, 0), free);
  }

  private pxToPercent(px: number, box: number, win: number): number {
    const free = Math.max(1, box - win);
    return Math.round(Math.min(Math.max(px / free, 0), 1) * 100);
  }

  private onPointerDown(event: PointerEvent) {
    this.dragging = true;
    this.dragOffset = { x: event.clientX - this.win.x, y: event.clientY - this.win.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  private onPointerMove(event: PointerEvent) {
    if (!this.dragging || !this.box) return;
    const x = Math.min(Math.max(event.clientX - this.dragOffset.x, 0), this.box.w - this.win.w);
    const y = Math.min(Math.max(event.clientY - this.dragOffset.y, 0), this.box.h - this.win.h);
    this.win = { ...this.win, x, y };
  }

  private onPointerUp() {
    this.dragging = false;
  }

  /** 滚轮缩放：窗口在 cover 窗口基础上缩小（局部放大），以光标为锚点。 */
  private onWheel(event: WheelEvent) {
    event.preventDefault();
    if (!this.box || !this.coverWin) return;
    const factor = event.deltaY < 0 ? 0.9 : 1 / 0.9;
    const minW = Math.max(48, this.box.w * 0.06);
    const w = Math.min(Math.max(this.win.w * factor, minW), this.coverWin.w);
    const h = w / this.winAspect;
    const stage = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = event.clientX - stage.left;
    const cy = event.clientY - stage.top;
    const rx = (cx - this.win.x) / this.win.w;
    const ry = (cy - this.win.y) / this.win.h;
    const x = Math.min(Math.max(cx - rx * w, 0), this.box.w - w);
    const y = Math.min(Math.max(cy - ry * h, 0), this.box.h - h);
    this.win = { x, y, w, h };
  }

  private save() {
    if (!this.box || !this.coverWin) return;
    const isCover =
      Math.abs(this.win.w - this.coverWin.w) < 1 && Math.abs(this.win.h - this.coverWin.h) < 1;
    const x = this.pxToPercent(this.win.x, this.box.w, this.win.w);
    const y = this.pxToPercent(this.win.y, this.box.h, this.win.h);
    const size = isCover
      ? null
      : `${Math.round((this.box.w / this.win.w) * 100)}% ${Math.round((this.box.h / this.win.h) * 100)}%`;
    this.dispatchEvent(
      new CustomEvent('adm-focal-save', {
        detail: { position: `${x}% ${y}%`, size },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private close() {
    this.dispatchEvent(new CustomEvent('adm-close', { bubbles: true, composed: true }));
  }

  private clear() {
    this.dispatchEvent(new CustomEvent('adm-focal-clear', { bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.open || !this.src) return nothing;
    return html`
      <div class="mask" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
        <div class="dialog" role="dialog" aria-label="框选焦点区域">
          <h3>框选首屏显示区域</h3>
          <div class="stage" @wheel=${this.onWheel}>
            <img src=${this.src} alt="焦点框选" @load=${this.onImageLoad} />
            ${this.box
              ? html`<div
                  class="crop"
                  style=${`left:${this.win.x}px;top:${this.win.y}px;width:${this.win.w}px;height:${this.win.h}px`}
                  @pointerdown=${this.onPointerDown}
                  @pointermove=${this.onPointerMove}
                  @pointerup=${this.onPointerUp}
                ></div>`
              : nothing}
          </div>
          <p class="note">拖动高亮窗口选择首屏要展示的画面区域，滚轮缩放窗口可局部放大；窗口比例与你当前的浏览器视口一致。</p>
          <div class="actions">
            ${this.position
              ? html`<button class="btn secondary" type="button" style="margin-right: auto" @click=${this.clear}>清除焦点</button>`
              : nothing}
            <button class="btn secondary" type="button" @click=${this.close}>取消</button>
            <button class="btn primary" type="button" @click=${this.save}>保存焦点</button>
          </div>
        </div>
      </div>
    `;
  }
}
