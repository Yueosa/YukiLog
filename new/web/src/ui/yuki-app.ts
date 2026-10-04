import { LitElement, css, html } from 'lit';

export class YukiApp extends LitElement {
  static styles = css`
    :host {
      display: grid;
      min-height: 100dvh;
      place-items: center;
      padding: 2rem;
      box-sizing: border-box;
      color: CanvasText;
      background: Canvas;
      font-family: system-ui, sans-serif;
    }

    main {
      max-width: 42rem;
    }
  `;

  protected render() {
    return html`
      <main>
        <h1>YukiLog</h1>
        <p>洁净工程骨架已经运行。视觉语言将在独立阶段设计。</p>
      </main>
    `;
  }
}

customElements.define('yuki-app', YukiApp);

declare global {
  interface HTMLElementTagNameMap {
    'yuki-app': YukiApp;
  }
}
