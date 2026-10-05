import { css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import { layoutPresets } from '../../layout/presets.js';
import { toPageLayout, validatePageLayout } from '../../layout/registry.js';
import type { PageLayoutDocument } from '../../layout/types.js';
import type { MediaAsset, SiteSettings } from '../types.js';
import type { PublicSiteData, StudioMedia, YukiApp } from '../../ui/yuki-app.js';
import '../../ui/yuki-app.js';

/** 布局工作室：嵌入公共站点的 <yuki-app> 作为首页可视化编辑器。 */
export class AdmStudio extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 14px;
      }

      .toolbar .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }

      .toolbar .spacer {
        flex: 1;
      }

      .toolbar .hint {
        margin: 10px 0 0;
        font-size: 12px;
      }

      .studio-frame {
        height: max(620px, calc(100dvh - 260px));
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--bg);
      }

      .studio-frame yuki-app {
        display: block;
        height: 100%;
        --studio-height: 100%;
        --studio-min-height: 0px;
        --studio-lab-display: none;
      }
    `,
  ];

  private booted = false;
  private pushedMedia: MediaAsset[] | null = null;
  private pushedSettings: SiteSettings | null = null;

  protected updated() {
    const studio = this.renderRoot.querySelector<YukiApp>('#layout-studio');
    if (!studio) return;
    const mediaChanged = this.store.media !== this.pushedMedia;
    if (mediaChanged) {
      this.pushedMedia = this.store.media;
      studio.setMediaLibrary(this.studioMedia());
    }
    if (mediaChanged || this.store.settings !== this.pushedSettings) {
      this.pushedSettings = this.store.settings;
      studio.setSiteData(this.siteData());
    }
    if (this.booted) return;
    this.booted = true;
    const saved = this.store.layouts.find((item) => item.pageKey === 'home');
    studio.loadPageLayout(saved ? saved.layout : toPageLayout(layoutPresets[0]));
  }

  private studioMedia(): StudioMedia[] {
    return this.store.media.map((item) => ({
      id: item.id,
      url: item.url,
      mediaType: item.media_type,
      name: item.original_name,
    }));
  }

  private siteData(): PublicSiteData {
    const settings = this.store.settings;
    const avatar = settings.avatarMediaId
      ? this.store.media.find((item) => item.id === settings.avatarMediaId)
      : undefined;
    return {
      siteTitle: settings.siteTitle,
      siteDescription: settings.siteDescription ?? '',
      ownerName: settings.ownerName,
      ownerBio: settings.ownerBio,
      avatarUrl: avatar?.url ?? settings.avatarExternalUrl ?? '',
      socialLinks: settings.socialLinks.map((link) => ({ ...link })),
    };
  }

  private studio(): YukiApp | null {
    return this.renderRoot.querySelector<YukiApp>('#layout-studio');
  }

  private loadLayout(layout?: PageLayoutDocument) {
    const studio = this.studio();
    if (!studio) return;
    if (!layout) {
      this.store.toast('尚未保存首页布局', 'info');
      return;
    }
    studio.loadPageLayout(layout);
  }

  private async saveLayout() {
    const studio = this.studio();
    if (!studio) return;
    const layout = studio.exportPageLayout();
    const errors = validatePageLayout(layout);
    if (errors.length) {
      this.store.toast(errors.join('；'), 'err');
      return;
    }
    await this.store.saveHomeLayout(layout);
  }

  private async uploadStudioMedia(event: CustomEvent<{ file: File }>) {
    const file = event.detail?.file;
    if (!file) return;
    const uploaded = await this.store.uploadMedia(file);
    if (uploaded) {
      this.studio()?.applyUploadedMedia({
        id: uploaded.id,
        url: uploaded.url,
        mediaType: uploaded.media_type,
        name: uploaded.original_name,
      });
    }
  }

  protected render() {
    const saved = this.store.layouts.find((item) => item.pageKey === 'home');
    return html`
      <section class="panel toolbar">
        <h2 class="panel-title">首页布局</h2>
        <div class="actions">
          <button class="btn secondary small" @click=${() => this.loadLayout(saved?.layout)}>载入已保存首页</button>
          ${layoutPresets.map(
            (preset) => html`
              <button class="btn secondary small" @click=${() => this.loadLayout(toPageLayout(preset))}>${preset.label}</button>
            `,
          )}
          <span class="spacer"></span>
          <button class="btn primary" @click=${() => void this.saveLayout()}>保存工作室为首页</button>
        </div>
        <p class="faint hint">编辑完成后点击保存，首页布局立即生效。</p>
      </section>
      <div class="studio-frame">
        <yuki-app id="layout-studio" @yuki-media-upload=${this.uploadStudioMedia}></yuki-app>
      </div>
    `;
  }
}

customElements.define('adm-studio', AdmStudio);
