import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { store, type AdminStore } from '../store.js';

/** 视图基类：注入 store 并订阅变更。 */
export abstract class AdmView extends LitElement {
  @property({ attribute: false }) store: AdminStore = store;

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener('change', this.onStoreChange);
  }

  disconnectedCallback() {
    this.store.removeEventListener('change', this.onStoreChange);
    super.disconnectedCallback();
  }

  private onStoreChange = () => this.requestUpdate();
}
