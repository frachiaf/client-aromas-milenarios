import { updateAllHeaderCustomProperties } from '@theme/utilities';

class HeaderMenuImages extends HTMLElement {
  /** @type {HTMLElement | null} */
  #header = null;
  #observer = new MutationObserver(() => this.#schedule());
  #frame = 0;
  #layoutFrame = 0;
  /** @type {Map<HTMLElement, {image: HTMLElement, signature: string}>} */
  #placements = new Map();

  connectedCallback() {
    this.#header = this.closest('header-component');
    if (!this.#header) return;

    this.#observer.observe(this.#header, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-am-menu-title', 'data-am-image-config'],
    });
    this.#header.addEventListener('shopify:block:select', this.#onBlockSelect);
    this.#schedule();
  }

  disconnectedCallback() {
    this.#observer.disconnect();
    cancelAnimationFrame(this.#frame);
    cancelAnimationFrame(this.#layoutFrame);
    this.#frame = 0;
    this.#layoutFrame = 0;
    this.#header?.removeEventListener('shopify:block:select', this.#onBlockSelect);
    for (const { image } of this.#placements.values()) image.remove();
    this.#placements.clear();
    this.#header = null;
  }

  #schedule() {
    if (!this.#frame) {
      this.#frame = requestAnimationFrame(() => {
        this.#frame = 0;
        this.#sync();
      });
    }
  }

  #sync() {
    if (!this.#header) return;

    const labels = Array.from(this.#header.querySelectorAll('[data-am-header-menu-label]'));
    const names = new Set(labels.map((label) => normalize(label.getAttribute('data-am-menu-title'))));
    /** @type {Map<string, {template: HTMLTemplateElement, signature: string}>} */
    const mappings = new Map();

    for (const source of this.querySelectorAll('[data-am-header-image-source]')) {
      if (!(source instanceof HTMLElement)) continue;
      const name = normalize(source.dataset.amMenuTitle);
      const template = source.querySelector('template');
      const valid = name && template?.content.querySelector('img') && !mappings.has(name);

      if (valid && template) {
        mappings.set(name, { template, signature: template.innerHTML });
      }
      source.hidden = !this.hasAttribute('data-design-mode') || Boolean(valid && names.has(name));
    }

    let changed = false;
    const currentLabels = new Set(labels);
    for (const [label, placement] of this.#placements) {
      if (!currentLabels.has(label)) {
        placement.image.remove();
        this.#placements.delete(label);
        changed = true;
      }
    }

    for (const label of labels) {
      if (!(label instanceof HTMLElement)) continue;
      const mapping = mappings.get(normalize(label.dataset.amMenuTitle));
      const placement = this.#placements.get(label);

      if (mapping && placement?.signature === mapping.signature && placement.image.parentElement === label) continue;

      for (const image of label.querySelectorAll(':scope > [data-am-header-menu-image]')) {
        image.remove();
        changed = true;
      }
      this.#placements.delete(label);

      if (mapping) {
        const image = mapping.template.content.firstElementChild?.cloneNode(true);
        if (!(image instanceof HTMLElement)) continue;
        label.prepend(image);
        this.#placements.set(label, { image, signature: mapping.signature });
        changed = true;
      }
    }

    if (changed && !this.#layoutFrame) {
      this.#layoutFrame = requestAnimationFrame(() => {
        this.#layoutFrame = 0;
        this.#header?.querySelector('overflow-list')?.dispatchEvent(new CustomEvent('reflow', { detail: {} }));
        updateAllHeaderCustomProperties();
      });
    }
  }

  /** @param {Event} event */
  #onBlockSelect = (event) => {
    if (!this.hasAttribute('data-design-mode') || !(event.target instanceof Element)) return;
    const block = event.target.closest('[data-am-header-image-source], [data-am-header-menu-image]');
    const id = block?.getAttribute('data-am-header-image-source') || block?.getAttribute('data-am-header-menu-image');
    if (!id || !this.#header) return;

    const copies = Array.from(this.#placements.values()).map(({ image }) => image)
      .filter((image) => image.dataset.amHeaderMenuImage === id);
    if (copies.some(isVisible)) return;

    const drawerCopy = copies.find((image) => image.closest('.header__drawer'));
    if (drawerCopy && (this.#header.dataset.menuStyle === 'drawer' || window.innerWidth < 750)) {
      const details = drawerCopy.closest('header-drawer')?.querySelector('details');
      if (details && !details.open) details.querySelector('summary')?.click();
    } else {
      const overflowCopy = copies.find((image) => image.closest('[slot="overflow"]'));
      overflowCopy?.closest('[slot="overflow"]')?.dispatchEvent(new PointerEvent('pointerenter'));
      overflowCopy?.closest('a')?.focus({ preventScroll: true });
    }
  };
}

/** @param {string | null | undefined} value */
function normalize(value) {
  return (value || '').trim().toLowerCase();
}

/** @param {HTMLElement} element */
function isVisible(element) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

if (!customElements.get('am-header-menu-images')) {
  customElements.define('am-header-menu-images', HeaderMenuImages);
}
