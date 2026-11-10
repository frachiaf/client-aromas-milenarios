import { updateAllHeaderCustomProperties } from '@theme/utilities';

class HeaderMenuImages extends HTMLElement {
  /** @type {HTMLElement | null} */
  #header = null;
  #observer = new MutationObserver(() => this.#schedule());
  #frame = 0;
  #layoutFrame = 0;
  /** @type {Map<HTMLElement, {image: HTMLElement, signature: string, original: HTMLImageElement | null}>} */
  #placements = new Map();

  connectedCallback() {
    this.#header = this.closest('header-component');
    if (!this.#header) return;

    this.#observer.observe(this.#header, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-am-menu-title', 'data-am-menu-level', 'data-am-image-config'],
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
    for (const placement of this.#placements.values()) releasePlacement(placement);
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
    const names = new Set(labels.map((label) => menuKey(label.getAttribute('data-am-menu-level'), label.getAttribute('data-am-menu-title'))));
    /** @type {Map<string, {template: HTMLTemplateElement, signature: string}>} */
    const mappings = new Map();

    for (const source of this.querySelectorAll('[data-am-header-image-source]')) {
      if (!(source instanceof HTMLElement)) continue;
      const name = menuKey(source.dataset.amMenuLevel, source.dataset.amMenuTitle);
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
        releasePlacement(placement);
        this.#placements.delete(label);
        changed = true;
      }
    }

    for (const label of labels) {
      if (!(label instanceof HTMLElement)) continue;
      const mapping = mappings.get(menuKey(label.dataset.amMenuLevel, label.dataset.amMenuTitle));
      const placement = this.#placements.get(label);
      const columnLink = megaColumnLink(label);

      if (
        mapping &&
        placement?.signature === mapping.signature &&
        placement.image.isConnected &&
        placement.image.parentElement === (columnLink || label)
      ) {
        continue;
      }

      if (placement) {
        releasePlacement(placement);
        this.#placements.delete(label);
        changed = true;
      }
      for (const image of label.querySelectorAll(':scope > [data-am-header-menu-image]')) {
        image.remove();
        changed = true;
      }

      if (!mapping || nestedMegaLink(label)) continue;

      const image = columnLink ? columnImage(mapping.template, columnLink) : mapping.template.content.firstElementChild?.cloneNode(true);
      if (!(image instanceof HTMLElement)) continue;
      if (columnLink) {
        const original = columnLink.querySelector(':scope > img.mega-menu__link-image:not([data-am-header-menu-image])');
        if (original instanceof HTMLImageElement) {
          if (original.sizes) image.sizes = original.sizes;
          original.hidden = true;
          original.setAttribute('data-am-menu-image-original', '');
          original.after(image);
        } else {
          image.sizes = COLUMN_IMAGE_SIZES;
          label.before(image);
        }
        this.#placements.set(label, {
          image,
          signature: mapping.signature,
          original: original instanceof HTMLImageElement ? original : null,
        });
      } else {
        label.prepend(image);
        this.#placements.set(label, { image, signature: mapping.signature, original: null });
      }
      changed = true;
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

const COLUMN_IMAGE_SIZES = '(min-width: 990px) 25vw, 50vw';

/** @param {{image: HTMLElement, original: HTMLImageElement | null}} placement */
function releasePlacement(placement) {
  placement.image.remove();
  if (!(placement.original instanceof HTMLImageElement)) return;
  placement.original.hidden = false;
  placement.original.removeAttribute('data-am-menu-image-original');
}

/**
 * Column heading inside the mega menu. Nested links live in a list within the column.
 * @param {HTMLElement} label
 * @returns {HTMLElement | null}
 */
function megaColumnLink(label) {
  if (label.dataset.amMenuLevel !== 'sub') return null;
  const link = label.closest('.mega-menu__link');
  const column = link?.closest('.mega-menu__column');
  if (!(link instanceof HTMLElement) || !(column instanceof HTMLElement)) return null;
  if (link.parentElement?.closest('ul')?.closest('.mega-menu__column') === column) return null;
  return link;
}

/** @param {HTMLElement} label */
function nestedMegaLink(label) {
  return label.dataset.amMenuLevel === 'sub' && Boolean(label.closest('.mega-menu__link')) && !megaColumnLink(label);
}

/**
 * @param {HTMLTemplateElement} template
 * @param {HTMLElement} link
 * @returns {HTMLImageElement | null}
 */
function columnImage(template, link) {
  const source = template.content.querySelector('img');
  const image = source?.cloneNode(true);
  const marker = template.content.querySelector('[data-am-header-menu-image]');
  if (!(image instanceof HTMLImageElement) || !(marker instanceof HTMLElement)) return null;
  image.dataset.amHeaderMenuImage = marker.dataset.amHeaderMenuImage || '';
  image.classList.add('mega-menu__link-image');
  const editorBlock = marker.getAttribute('data-shopify-editor-block');
  if (editorBlock) image.setAttribute('data-shopify-editor-block', editorBlock);
  if (!link.querySelector(':scope > img.mega-menu__link-image:not([data-am-header-menu-image])')?.getAttribute('sizes')) {
    image.sizes = COLUMN_IMAGE_SIZES;
  }
  return image;
}

/** @param {string | null | undefined} value */
function normalize(value) {
  return (value || '').trim().toLowerCase();
}

/** @param {string | null | undefined} level @param {string | null | undefined} title */
function menuKey(level, title) {
  return `${level === 'sub' ? 'sub' : 'main'}|${normalize(title)}`;
}

/** @param {HTMLElement} element */
function isVisible(element) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

if (!customElements.get('am-header-menu-images')) {
  customElements.define('am-header-menu-images', HeaderMenuImages);
}
