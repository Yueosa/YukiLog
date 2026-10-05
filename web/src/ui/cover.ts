import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

/** 封面兜底渐变（沿用夜航六色，按 seed 哈希稳定挑选）。 */
export const COVER_PALETTES = [
  'linear-gradient(150deg, #3d5a80, #7eb6d9 55%, #c9a0b4)',
  'linear-gradient(150deg, #1d2b4a, #45618f 60%, #7eb6d9)',
  'linear-gradient(150deg, #5c4a72, #a17fa8 55%, #e8a4b4)',
  'linear-gradient(150deg, #274c57, #3f7d8c 55%, #8fc7c9)',
  'linear-gradient(150deg, #6b4a68, #b07fa0 55%, #e8c9b4)',
  'linear-gradient(150deg, #2c3e50, #5f7d9c 55%, #a9c6de)',
];

export function paletteFor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 997;
  return COVER_PALETTES[hash % COVER_PALETTES.length];
}

/**
 * 统一封面组件：
 * - 横屏图 object-fit cover 填满容器（默认 16:9）；
 * - 竖屏/接近方形图走「模糊填充」：同一张图做 cover + blur + 压暗的背景层，
 *   前景层 object-fit contain 完整显示，不再被裁成细条；
 * - adaptive 模式（文章详情头图）按自然比例自适应高度，并设最大高度；
 * - 加载失败回退到兜底渐变。
 */
export class YukiCover extends LitElement {
  @property() src = '';
  @property() alt = '';
  /** 容器比例（非 adaptive 时），如 '16 / 9'、'1 / 1'。 */
  @property() ratio = '16 / 9';
  /** auto：按图片朝向自动 cover/contain；cover：始终裁满（九宫格等）。 */
  @property() fit: 'auto' | 'cover' = 'auto';
  /** 详情头图模式：容器跟随自然比例，max-height 限高。 */
  @property({ type: Boolean }) adaptive = false;
  @property() maxHeight = '72vh';
  @property() seed = '';

  @state() private phase: 'loading' | 'landscape' | 'portrait' | 'broken' = 'loading';
  @state() private naturalRatio = 0;

  static styles = css`
    :host {
      display: block;
    }

    .frame {
      position: relative;
      display: block;
      width: 100%;
      overflow: hidden;
      border-radius: inherit;
      background: var(--cover-fallback) center / cover no-repeat;
      aspect-ratio: var(--cover-ratio, 16 / 9);
    }

    .frame.adaptive {
      max-height: var(--cover-max-h, 72vh);
      aspect-ratio: var(--cover-natural, var(--cover-ratio, 16 / 9));
    }

    .bg {
      position: absolute;
      inset: 0;
      display: none;
      background-position: center;
      background-size: cover;
      filter: blur(30px) brightness(0.84) saturate(1.08);
      scale: 1.32;
    }

    .frame.portrait .bg {
      display: block;
    }

    .fg {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 420ms ease;
    }

    .frame.landscape .fg,
    .frame.portrait .fg {
      opacity: 1;
    }

    .frame.portrait .fg {
      object-fit: contain;
    }

    @media (prefers-reduced-motion: reduce) {
      .fg {
        transition: none;
      }
    }
  `;

  private readonly handleLoad = (event: Event) => {
    const image = event.currentTarget as HTMLImageElement;
    const { naturalWidth, naturalHeight } = image;
    if (!naturalWidth || !naturalHeight) {
      this.phase = 'broken';
      return;
    }
    const ratio = naturalWidth / naturalHeight;
    this.naturalRatio = ratio;
    this.phase = this.fit === 'cover' || ratio >= 1.25 ? 'landscape' : 'portrait';
  };

  private readonly handleError = () => {
    this.phase = 'broken';
  };

  protected render() {
    const clamped = Math.min(Math.max(this.naturalRatio, 0.45), 2.4);
    const frameStyle: Record<string, string> = {
      '--cover-ratio': this.ratio,
      '--cover-fallback': paletteFor(this.seed || this.src || this.alt || 'yukilog'),
      '--cover-max-h': this.maxHeight,
    };
    if (this.adaptive && this.naturalRatio > 0) {
      frameStyle['--cover-natural'] = String(clamped);
    }
    const showImage = this.src !== '' && this.phase !== 'broken';
    return html`
      <div
        class="frame${this.adaptive ? ' adaptive' : ''} ${this.phase}"
        style=${styleMap(frameStyle)}
      >
        ${showImage
          ? html`
              <div
                class="bg"
                aria-hidden="true"
                style=${styleMap({ backgroundImage: `url("${this.src}")` })}
              ></div>
              <img
                class="fg"
                src=${this.src}
                alt=${this.alt}
                loading="lazy"
                decoding="async"
                @load=${this.handleLoad}
                @error=${this.handleError}
              />
            `
          : nothing}
      </div>
    `;
  }
}

customElements.define('yuki-cover', YukiCover);

declare global {
  interface HTMLElementTagNameMap {
    'yuki-cover': YukiCover;
  }
}
