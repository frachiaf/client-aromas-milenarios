/**
 * Returns the next unreached tier label when adding this quantity reaches it.
 * Thresholds are cents and must already be positive and increasing.
 * @param {{ cartTotal: number, unitPrice: number, quantity: number, tiers: Array<{ threshold: number, label: string }> }} input
 * @returns {string | null}
 */
export function nextUnlockBenefit({ cartTotal, unitPrice, quantity, tiers }) {
  if (!Number.isFinite(cartTotal) || cartTotal < 0) return null;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  if (!Array.isArray(tiers)) return null;

  const next = tiers.find((tier) => Number.isFinite(tier?.threshold) && cartTotal < tier.threshold);
  if (!next || typeof next.label !== 'string' || next.label.trim() === '') return null;
  if (cartTotal + unitPrice * quantity >= next.threshold) return next.label;
  return null;
}

if (typeof HTMLElement !== 'undefined' && typeof customElements !== 'undefined') {
  const { ThemeEvents } = await import('@theme/events');

  class TierUnlock extends HTMLElement {
    /** @type {AbortController | undefined} */
    #controller;
    /** @type {AbortController | undefined} */
    #cartAbort;
    /** @type {HTMLElement | null} */
    #section = null;
    #pending = false;
    /** @type {Array<{ threshold: number, label: string }> | undefined} */
    #parsed;

    connectedCallback() {
      this.#section = this.closest('[data-am-main-product]');
      if (!this.#section) {
        this.hidden = true;
        return;
      }

      this.#controller = new AbortController();
      const { signal } = this.#controller;
      this.#section.addEventListener(ThemeEvents.quantitySelectorUpdate, this.#onQuantity, { signal });
      this.#section.addEventListener('input', this.#onQuantity, { signal });
      this.#section.addEventListener('change', this.#onQuantity, { signal });
      this.#section.addEventListener(ThemeEvents.variantSelected, this.#onVariantSelected, { signal });
      this.#section.addEventListener(ThemeEvents.variantUpdate, this.#onVariantUpdate, { signal });
      document.addEventListener(ThemeEvents.cartUpdate, this.#onCartUpdate, { signal });
      this.#render();
    }

    disconnectedCallback() {
      this.#controller?.abort();
      this.#cartAbort?.abort();
      this.#section = null;
    }

    /** @param {Event} event */
    #onQuantity = (event) => {
      if ('detail' in event && event.detail?.cartLine) return;
      const target = event.target;
      if (target instanceof Element && target.closest('variant-picker')) return;
      this.#render();
    };

    #onVariantSelected = () => {
      this.#pending = true;
      this.#render();
    };

    /** @param {Event} event */
    #onVariantUpdate = (event) => {
      this.#pending = false;
      const detail = 'detail' in event ? event.detail : undefined;
      const resource = detail?.resource;
      if (!resource) {
        this.dataset.available = 'false';
        this.#render();
        return;
      }
      if (resource.price != null) this.dataset.unitPrice = String(resource.price);
      this.dataset.available = resource.available ? 'true' : 'false';
      this.#render();
    };

    /** @param {Event} event */
    #onCartUpdate = (event) => {
      const cart = 'detail' in event ? event.detail?.resource : undefined;
      if (typeof cart?.total_price === 'number') {
        const currency = typeof cart.currency === 'string' ? cart.currency : cart.currency?.iso_code;
        if (currency) this.dataset.cartCurrency = currency;
        this.dataset.cartTotal = String(cart.total_price);
        this.#render();
        return;
      }
      this.#fetchCart();
    };

    #fetchCart() {
      const url = this.dataset.cartUrl;
      if (!url) return;
      this.#cartAbort?.abort();
      const controller = new AbortController();
      this.#cartAbort = controller;
      fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((cart) => {
          if (!cart || controller.signal.aborted || typeof cart.total_price !== 'number') return;
          const currency = typeof cart.currency === 'string' ? cart.currency : cart.currency?.iso_code;
          if (currency) this.dataset.cartCurrency = currency;
          this.dataset.cartTotal = String(cart.total_price);
          this.#render();
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return;
        });
    }

    /** @returns {number | null} */
    #quantity() {
      const input = this.#section?.querySelector('input[name="quantity"]');
      if (input instanceof HTMLInputElement) {
        if (!input.validity.valid) return null;
        return input.valueAsNumber;
      }
      const fallback = Number(this.dataset.quantity);
      return Number.isFinite(fallback) ? fallback : 1;
    }

    /** @returns {Array<{ threshold: number, label: string }>} */
    #tiers() {
      if (this.#parsed) return this.#parsed;
      try {
        const value = JSON.parse(this.dataset.tiers || '[]');
        this.#parsed = Array.isArray(value)
          ? value.filter((tier) => Number.isFinite(tier?.threshold) && typeof tier?.label === 'string')
          : [];
      } catch {
        this.#parsed = [];
      }
      return this.#parsed;
    }

    #render = () => {
      const currencyOk = this.dataset.cartCurrency === this.dataset.shopCurrency;
      const available = this.dataset.available === 'true';
      const quantity = this.#quantity();
      const benefit = !this.#pending && currencyOk && available && quantity != null
        ? nextUnlockBenefit({
          cartTotal: Number(this.dataset.cartTotal),
          unitPrice: Number(this.dataset.unitPrice),
          quantity,
          tiers: this.#tiers(),
        })
        : null;
      const message = this.querySelector('[data-message]');
      const help = this.querySelector('[data-help]');
      if (message) {
        message.hidden = benefit == null;
        if (benefit != null) {
          message.textContent = (this.dataset.template || '').replaceAll('{benefit}', benefit);
        }
      }
      if (help) help.hidden = benefit != null;
      this.hidden = benefit == null && this.dataset.designMode !== 'true';
    };
  }

  if (!customElements.get('am-tier-unlock')) {
    customElements.define('am-tier-unlock', TierUnlock);
  }
}
