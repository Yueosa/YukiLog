import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AdmView } from '../components/base-view.js';
import { adminTheme } from '../theme.js';
import type { FriendLink } from '../types.js';

/** 友链：待审核申请 + 全部友链表。头像统一走目标站 favicon。 */
export class AdmFriends extends AdmView {
  @property() articleId: string | null = null;
  @property() dynamicId: string | null = null;

  @state() private brokenFavicons = new Set<string>();

  static styles = [
    adminTheme,
    css`
      :host {
        display: grid;
        gap: 18px;
      }

      /* ---------- 待审核申请 ---------- */
      .applications {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 14px;
      }

      .application {
        display: grid;
        gap: 8px;
        padding: 16px 18px;
        border: 1px solid color-mix(in srgb, var(--secondary) 45%, var(--line));
        border-radius: 14px;
        background: linear-gradient(160deg, color-mix(in srgb, var(--secondary) 8%, var(--surface)), var(--surface));
      }

      .application .head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }

      .application .name {
        font-family: var(--serif);
        font-size: 15px;
        font-weight: 700;
      }

      .application .url {
        overflow: hidden;
        color: var(--primary-d);
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-decoration: none;
      }

      .application .desc {
        color: var(--muted);
        font-size: 12.5px;
        line-height: 1.7;
      }

      .application .ops {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }

      /* ---------- 全部友链 ---------- */
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .toolbar .count {
        color: var(--faint);
        font-size: 12px;
      }

      .friend-cell {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .avatar {
        width: 32px;
        height: 32px;
        flex: none;
        border: 1px solid var(--line);
        border-radius: 50%;
        background: var(--surface-muted);
        object-fit: cover;
      }

      .avatar-fallback {
        display: inline-flex;
        width: 32px;
        height: 32px;
        flex: none;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: color-mix(in srgb, var(--primary) 22%, var(--surface));
        color: var(--primary-d);
        font-family: var(--serif);
        font-size: 14px;
        font-weight: 700;
      }

      .friend-cell .name {
        overflow: hidden;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ext-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        max-width: 240px;
        color: var(--primary-d);
        font-size: 12.5px;
        text-decoration: none;
      }

      .ext-link span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ext-link:hover {
        text-decoration: underline;
      }

      .desc-cell {
        max-width: 240px;
        color: var(--muted);
        font-size: 12.5px;
      }

      .ops {
        display: inline-flex;
        gap: 8px;
        white-space: nowrap;
      }
    `,
  ];

  private hostOf(url: string): string | null {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  private avatar(item: FriendLink) {
    const host = this.hostOf(item.url);
    const src = item.avatar_url || (host ? `https://${host}/favicon.ico` : null);
    if (!src || this.brokenFavicons.has(item.id)) {
      return html`<span class="avatar-fallback">${(item.name.trim()[0] ?? '友').toUpperCase()}</span>`;
    }
    return html`<img
      class="avatar"
      src=${src}
      alt=""
      loading="lazy"
      @error=${() => {
        this.brokenFavicons = new Set(this.brokenFavicons).add(item.id);
      }}
    />`;
  }

  private friendFields(item?: FriendLink) {
    return [
      { name: 'name', label: '名称', value: item?.name ?? '', required: true },
      { name: 'url', label: '链接 URL', value: item?.url ?? '', required: true },
      { name: 'avatar_url', label: '头像链接（留空自动取 favicon）', value: item?.avatar_url ?? '' },
      { name: 'description', label: '说明', value: item?.description ?? '' },
      { name: 'sort_order', label: '排序', value: String(item?.sort_order ?? 0), type: 'number' },
    ];
  }

  private async addFriend() {
    const values = await this.store.prompt('添加友链', this.friendFields(), '添加');
    if (!values) return;
    if (!values.name.trim() || !values.url.trim()) return this.store.toast('名称和 URL 不能为空', 'err');
    await this.store.saveFriend(null, {
      name: values.name.trim(),
      url: values.url.trim(),
      description: values.description.trim() || null,
      avatar_media_id: null,
      avatar_url: values.avatar_url.trim() || null,
      is_visible: true,
      sort_order: Number.parseInt(values.sort_order, 10) || 0,
    });
  }

  private async editFriend(item: FriendLink) {
    const values = await this.store.prompt('编辑友链', this.friendFields(item));
    if (!values) return;
    if (!values.name.trim() || !values.url.trim()) return this.store.toast('名称和 URL 不能为空', 'err');
    await this.store.saveFriend(item.id, {
      name: values.name.trim(),
      url: values.url.trim(),
      description: values.description.trim() || null,
      avatar_media_id: item.avatar_media_id,
      avatar_url: values.avatar_url.trim() || null,
      is_visible: item.is_visible,
      sort_order: Number.parseInt(values.sort_order, 10) || 0,
    });
  }

  private toggleVisible(item: FriendLink, checked: boolean) {
    void this.store.saveFriend(item.id, { ...item, is_visible: checked });
  }

  private renderApplications() {
    const pending = this.store.friends.filter((item) => item.application_email && !item.is_visible);
    if (!pending.length) return nothing;
    return html`
      <section class="panel">
        <h2 class="panel-title">待审核申请 <span class="badge warn">${pending.length}</span></h2>
        <div class="applications">
          ${pending.map(
            (item) => html`
              <article class="application">
                <div class="head">
                  <span class="name">${item.name}</span>
                  <span class="badge">申请</span>
                </div>
                <a class="url mono" href=${item.url} target="_blank" rel="noopener">${item.url}</a>
                ${item.description ? html`<p class="desc">${item.description}</p>` : nothing}
                <span class="faint">申请邮箱：${item.application_email}</span>
                <div class="ops">
                  <button class="btn primary small" ?disabled=${this.store.busy} @click=${() => this.store.approveFriend(item)}>通过</button>
                  <button class="btn danger small" ?disabled=${this.store.busy} @click=${() => this.store.deleteFriend(item.id)}>拒绝</button>
                </div>
              </article>
            `,
          )}
        </div>
      </section>
    `;
  }

  protected render() {
    const items = [...this.store.friends].sort((a, b) => a.sort_order - b.sort_order);
    return html`
      ${this.renderApplications()}

      <section class="panel">
        <div class="toolbar">
          <h2 class="panel-title" style="margin: 0">全部友链</h2>
          <span class="count">共 ${items.length} 条</span>
          <button class="btn primary" ?disabled=${this.store.busy} @click=${this.addFriend}>＋ 添加友链</button>
        </div>
        <div style="height: 14px"></div>
        ${items.length
          ? html`
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr><th>友链</th><th>URL</th><th>说明</th><th>排序</th><th>可见</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    ${items.map(
                      (item) => html`
                        <tr>
                          <td>
                            <span class="friend-cell">
                              ${this.avatar(item)}
                              <span class="name">${item.name}</span>
                            </span>
                          </td>
                          <td>
                            <a class="ext-link" href=${item.url} target="_blank" rel="noopener">
                              <span class="mono">${this.hostOf(item.url) ?? item.url}</span>
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                <path d="M2 8 8 2M3.5 2H8v4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                              </svg>
                            </a>
                          </td>
                          <td class="desc-cell">${item.description || html`<span class="faint">—</span>`}</td>
                          <td class="mono">${item.sort_order}</td>
                          <td>
                            <adm-toggle
                              .checked=${item.is_visible}
                              @adm-change=${(e: CustomEvent<{ checked: boolean }>) => this.toggleVisible(item, e.detail.checked)}
                            ></adm-toggle>
                          </td>
                          <td>
                            <span class="ops">
                              <button class="btn secondary small" @click=${() => this.editFriend(item)}>编辑</button>
                              <button class="btn danger small" @click=${() => this.store.deleteFriend(item.id)}>删除</button>
                            </span>
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>
            `
          : html`<adm-empty text="还没有友链" hint="点击右上角「添加友链」收录第一个朋友"></adm-empty>`}
      </section>
    `;
  }
}

customElements.define('adm-friends', AdmFriends);
