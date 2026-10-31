import '@theme/slideshow';
import '@theme/product-form';
import '@theme/quick-add';

/** Lazy cart recommendations whose subtree survives quantity-only section updates. */
class AmCartUpsell extends HTMLElement {
  static observedAttributes = ['data-url', 'data-product-ids', 'data-service-product-ids', 'data-heading'];

  /** @type {AbortController | null} */
  #request = null;
  /** @type {AbortController | null} */
  #listeners = null;
  /** @type {Element | null} */
  #drawer = null;
  #loadedKey = '';
  #requestKey = '';
  #revision = 0;
  #queued = false;

  connectedCallback() {
    this.#listeners?.abort();
    this.#listeners = new AbortController();
    this.#drawer = this.closest('cart-drawer-component');
    this.#drawer?.addEventListener('dialog:open', this.#load, { signal: this.#listeners.signal });
    this.#scheduleUpdate();
  }

  disconnectedCallback() {
    this.#listeners?.abort();
    this.#cancelRequest();
  }

  attributeChangedCallback() {
    this.#scheduleUpdate();
  }

  /** @param {string | undefined} value */
  #productIds(value) {
    return [...new Set((value || '').split(',').filter(Boolean))].sort().join(',');
  }

  get #key() {
    return JSON.stringify([
      this.dataset.url || '',
      this.#productIds(this.dataset.productIds),
      this.#productIds(this.dataset.serviceProductIds),
      this.dataset.heading || '',
    ]);
  }

  get #isOpen() {
    return Boolean(this.#drawer?.querySelector('dialog[open]'));
  }

  #scheduleUpdate() {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (!this.isConnected) return;
      const key = this.#key;
      if (key !== this.#loadedKey && key !== this.#requestKey) {
        this.#cancelRequest();
        this.#loadedKey = '';
        this.replaceChildren();
      }
      if (this.#isOpen) this.#load();
    });
  }

  #cancelRequest() {
    this.#revision += 1;
    this.#request?.abort();
    this.#request = null;
    this.#requestKey = '';
  }

  #load = async () => {
    if (!this.isConnected || !this.dataset.url || !this.#isOpen) return;
    const key = this.#key;
    if (key === this.#loadedKey || key === this.#requestKey) return;

    this.#cancelRequest();
    const revision = this.#revision;
    const request = new AbortController();
    this.#request = request;
    this.#requestKey = key;

    try {
      const response = await fetch(this.dataset.url, {
        signal: request.signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Cart recommendations returned ${response.status}`);
      const html = await response.text();
      if (!this.isConnected || request.signal.aborted || revision !== this.#revision || key !== this.#key) return;

      const content = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-am-cart-upsell-content]');
      if (!content) throw new Error('Cart recommendations content is missing');
      if (content.querySelector('[data-am-upsell-product-id]')) {
        this.replaceChildren(document.importNode(content, true));
      } else {
        this.replaceChildren();
      }
      this.#loadedKey = key;
    } catch (error) {
      if (request.signal.aborted || revision !== this.#revision) return;
      this.replaceChildren();
      this.#loadedKey = '';
    } finally {
      if (revision === this.#revision) {
        this.#request = null;
        this.#requestKey = '';
      }
    }
  };
}

if (!customElements.get('am-cart-upsell')) {
  customElements.define('am-cart-upsell', AmCartUpsell);
}
