import { ThemeEvents } from '@theme/events';
import { formatMoney } from '@theme/money-formatting';

export class AddToCartTotal extends HTMLElement {
  static observedAttributes = ['data-unit-price', 'data-money-format', 'data-currency'];

  /** @type {AbortController | undefined} */
  #controller;
  /** @type {MutationObserver | undefined} */
  #observer;
  #pending = false;

  connectedCallback() {
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    const form = this.closest('product-form-component');
    const section = this.closest('[data-am-main-product]');
    if (!form || !section || this.closest('dialog, quick-add-component, product-card')) {
      this.hidden = true;
      return;
    }

    form.addEventListener(ThemeEvents.quantitySelectorUpdate, this.update, { signal });
    form.addEventListener('input', this.update, { signal });
    form.addEventListener('change', this.update, { signal });
    section.addEventListener(ThemeEvents.variantSelected, this.#onVariantSelected, { signal });
    section.addEventListener(ThemeEvents.variantUpdate, this.#onVariantUpdate, { signal });
    const button = this.closest('button');
    if (button) {
      this.#observer = new MutationObserver(this.update);
      this.#observer.observe(button, { attributes: true, attributeFilter: ['disabled'] });
    }
    this.update();
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#observer?.disconnect();
    this.#pending = false;
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update();
  }

  #onVariantSelected = () => {
    this.#pending = true;
    this.update();
  };

  #onVariantUpdate = () => {
    this.#pending = false;
    this.update();
  };

  update = () => {
    const form = this.closest('product-form-component');
    const input = form?.querySelector('input[name="quantity"]');
    const quantity = input instanceof HTMLInputElement
      ? input.valueAsNumber
      : Number(form?.getAttribute('data-quantity-default') || 1);
    const price = Number(this.dataset.unitPrice);
    const button = this.closest('button');
    const valid = input instanceof HTMLInputElement ? input.validity.valid : true;
    this.hidden = !this.closest('[data-am-main-product]')
      || Boolean(this.closest('dialog, quick-add-component, product-card'))
      || this.#pending
      || !button
      || button.disabled
      || !valid
      || !Number.isInteger(quantity)
      || quantity < 1
      || !Number.isFinite(price);
    if (this.hidden) return;

    const output = this.querySelector('[data-total-price]');
    if (!output) return;
    const currency = this.dataset.currency || 'USD';
    const precision = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    const amount = Math.round(price * quantity * 10 ** precision / 100);
    const format = this.dataset.moneyFormat || '{{amount}}';
    const template = document.createElement('template');
    template.innerHTML = formatMoney(amount, format, currency);
    output.textContent = template.content.textContent;
  };
}

if (!customElements.get('am-atc-total')) {
  customElements.define('am-atc-total', AddToCartTotal);
}
