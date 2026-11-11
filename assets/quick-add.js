import { morph } from '@theme/morph';
import { Component } from '@theme/component';
import { CartUpdateEvent, ThemeEvents, VariantSelectedEvent } from '@theme/events';
import { DialogComponent, DialogCloseEvent, DialogOpenEvent } from '@theme/dialog';
import { mediaQueryLarge, isMobileBreakpoint, getIOSVersion } from '@theme/utilities';
import VariantPicker from '@theme/variant-picker';
import { prepareQuickBuyGallery } from '@theme/media-gallery';

/**
 * Adapts a product grid before it is mounted in Quick Buy.
 * @param {Element} productGrid
 * @param {{ productTitle: string, productPageUrl: string, showThumbnails: boolean, cartUpsell: boolean, cartError?: string }} options
 */
function prepareQuickAddGrid(productGrid, options) {
  if (options.showThumbnails) {
    const gallery = productGrid.querySelector('media-gallery');
    if (gallery) prepareQuickBuyGallery(gallery);
  }

  for (const form of productGrid.querySelectorAll('product-form-component')) {
    form.toggleAttribute('data-am-cart-upsell', options.cartUpsell);
    if (options.cartUpsell && options.cartError) {
      form.setAttribute('data-am-cart-error', options.cartError);
    } else {
      form.removeAttribute('data-am-cart-error');
    }
  }

  if (!isMobileBreakpoint()) return;

  const productDetails = productGrid.querySelector('.product-details');
  const productFormComponent = productGrid.querySelector('product-form-component');
  const variantPicker = productGrid.querySelector('variant-picker');
  const productPrice = productGrid.querySelector('product-price');
  const productTitle = document.createElement('a');
  productTitle.textContent = options.productTitle || '';
  productTitle.href = options.productPageUrl;

  const productHeader = document.createElement('div');
  productHeader.classList.add('product-header');
  productHeader.appendChild(productTitle);
  if (productPrice) productHeader.appendChild(productPrice);
  productGrid.appendChild(productHeader);
  if (variantPicker) productGrid.appendChild(variantPicker);
  if (productFormComponent) productGrid.appendChild(productFormComponent);
  productDetails?.remove();
}

/**
 * Replaces the shared Quick Buy content.
 * @param {Element} productGrid
 * @returns {boolean}
 */
function replaceQuickAddContent(productGrid) {
  const modalContent = document.getElementById('quick-add-modal-content');
  if (!modalContent) return false;

  const currentGallery = modalContent.querySelector('media-gallery');
  if (
    productGrid.querySelector('[data-am-quick-buy-gallery]') ||
    currentGallery?.hasAttribute('data-am-quick-buy-gallery')
  ) {
    currentGallery?.remove();
  }
  morph(modalContent, productGrid);
  return true;
}

export class QuickAddComponent extends Component {
  static #activeOpenRequestId = 0;
  /** @type {AbortController | null} */
  #abortController = null;
  #openRequestId = 0;
  /** @type {Map<string, Element>} */
  #cachedContent = new Map();
  /** @type {AbortController} */
  #cartUpdateAbortController = new AbortController();

  get productPageUrl() {
    const explicitProductUrl = this.dataset.productUrl;
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    const hotspotProduct = /** @type {import('./product-hotspot').ProductHotspotComponent | null} */ (
      this.closest('product-hotspot-component')
    );
    const productLink = productCard?.getProductCardLink() || hotspotProduct?.getHotspotProductLink();
    const productUrl = explicitProductUrl || productLink?.href;

    if (!productUrl) return '';

    const url = new URL(productUrl, window.location.origin);

    if (url.searchParams.has('variant')) {
      return url.toString();
    }

    const selectedVariantId = this.#getSelectedVariantId();
    if (selectedVariantId) {
      url.searchParams.set('variant', selectedVariantId);
    }

    return url.toString();
  }

  /**
   * Gets the currently selected variant ID from the product card
   * @returns {string | null} The variant ID or null
   */
  #getSelectedVariantId() {
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    return productCard?.getSelectedVariantId() || null;
  }

  connectedCallback() {
    super.connectedCallback();

    mediaQueryLarge.addEventListener('change', this.#closeQuickAddModal);
    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate, {
      signal: this.#cartUpdateAbortController.signal,
    });
    document.addEventListener(ThemeEvents.variantSelected, this.#updateQuickAddButtonState.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.cancelOpen();
    mediaQueryLarge.removeEventListener('change', this.#closeQuickAddModal);
    this.#cartUpdateAbortController.abort();
    document.removeEventListener(ThemeEvents.variantSelected, this.#updateQuickAddButtonState.bind(this));
  }

  /**
   * Clears the cached content when cart is updated
   */
  #handleCartUpdate = () => {
    this.#cachedContent.clear();
  };

  /**
   * Re-renders the variant picker in the quick-add modal.
   * @param {Element} newHtml - The element to re-render.
   */
  #updateVariantPicker(newHtml) {
    const modalContent = document.getElementById('quick-add-modal-content');
    if (!modalContent) return;
    const variantPicker = /** @type {VariantPicker | null} */ (modalContent.querySelector('variant-picker'));
    if (!variantPicker) return;
    variantPicker.updateVariantPicker(newHtml);
  }

  /**
   * Handles quick add button click
   * @param {Event} event - The click event
   */
  handleClick = async (event) => {
    event.preventDefault();

    await this.open();
  };

  cancelOpen() {
    this.#openRequestId += 1;
    this.#abortController?.abort();
    this.#abortController = null;
  }

  /**
   * Loads the product content and opens the global quick-add modal.
   *
   * @param {string} [productPageUrl] - Optional explicit product URL
   * @returns {Promise<'opened' | 'unavailable' | 'failed' | 'aborted'>}
   */
  async open(productPageUrl) {
    this.#getQuickAddDialog()?.cancelProductUpsell();
    const requestId = ++this.#openRequestId;
    const activeRequestId = ++QuickAddComponent.#activeOpenRequestId;

    const currentUrl = productPageUrl || this.productPageUrl;
    if (!currentUrl || !this.#getQuickAddDialog() || !document.getElementById('quick-add-modal-content')) {
      return 'unavailable';
    }

    let productGrid = this.#cachedContent.get(currentUrl);

    if (!productGrid) {
      try {
        const html = await this.fetchProductPage(currentUrl);
        if (requestId !== this.#openRequestId || activeRequestId !== QuickAddComponent.#activeOpenRequestId) {
          return 'aborted';
        }

        const gridElement = html?.querySelector('[data-product-grid-content]');
        if (gridElement) {
          productGrid = /** @type {Element} */ (gridElement.cloneNode(true));
          this.#cachedContent.set(currentUrl, productGrid);
        }
      } catch (_error) {
        if (requestId !== this.#openRequestId || activeRequestId !== QuickAddComponent.#activeOpenRequestId) {
          return 'aborted';
        }
        return 'failed';
      }
    }

    if (requestId !== this.#openRequestId || activeRequestId !== QuickAddComponent.#activeOpenRequestId) {
      return 'aborted';
    }
    if (!productGrid) return 'failed';

    const freshContent = /** @type {Element} */ (productGrid.cloneNode(true));
    try {
      await this.updateQuickAddModal(freshContent, currentUrl);
      if (requestId !== this.#openRequestId || activeRequestId !== QuickAddComponent.#activeOpenRequestId) {
        return 'aborted';
      }

      this.#updateVariantPicker(productGrid);
      return await this.#openQuickAddModal(requestId, activeRequestId);
    } catch (_error) {
      if (requestId !== this.#openRequestId || activeRequestId !== QuickAddComponent.#activeOpenRequestId) {
        return 'aborted';
      }
      return 'failed';
    }
  }

  #resetScroll() {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!(dialogComponent instanceof QuickAddDialog)) return;

    const productDetails = dialogComponent.querySelector('.product-details');
    const productMedia = dialogComponent.querySelector('.product-information__media');
    productDetails?.scrollTo({ top: 0, behavior: 'instant' });
    productMedia?.scrollTo({ top: 0, behavior: 'instant' });
  }

  /** @param {QuickAddDialog} dialogComponent */
  #stayVisibleUntilDialogCloses(dialogComponent) {
    this.toggleAttribute('stay-visible', true);

    dialogComponent.addEventListener(DialogCloseEvent.eventName, () => this.toggleAttribute('stay-visible', false), {
      once: true,
    });
  }

  #getQuickAddDialog() {
    const dialogComponent = document.getElementById('quick-add-dialog');
    return dialogComponent instanceof QuickAddDialog ? dialogComponent : null;
  }

  /**
   * @param {number} requestId
   * @param {number} activeRequestId
   * @returns {Promise<'opened' | 'unavailable' | 'aborted'>}
   */
  #openQuickAddModal = (requestId, activeRequestId) => {
    const dialogComponent = this.#getQuickAddDialog();
    if (!dialogComponent) return Promise.resolve('unavailable');

    if (dialogComponent.refs.dialog.open) {
      this.#stayVisibleUntilDialogCloses(dialogComponent);
      return Promise.resolve('opened');
    }

    return new Promise((resolve) => {
      const handleOpen = () => {
        this.#stayVisibleUntilDialogCloses(dialogComponent);
        dialogComponent.refs.dialog.addEventListener('animationstart', this.#resetScroll.bind(this), { once: true });
        resolve('opened');
      };
      dialogComponent.addEventListener(DialogOpenEvent.eventName, handleOpen, { once: true });
      dialogComponent.showDialog(() => {
        const isCurrent =
          requestId === this.#openRequestId && activeRequestId === QuickAddComponent.#activeOpenRequestId;
        if (!isCurrent) {
          dialogComponent.removeEventListener(DialogOpenEvent.eventName, handleOpen);
          resolve('aborted');
        }
        return isCurrent;
      });
    });
  };

  #closeQuickAddModal = () => {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!(dialogComponent instanceof QuickAddDialog)) return;

    dialogComponent.closeDialog();
  };

  /**
   * Fetches the product page content
   * @param {string} productPageUrl - The URL of the product page to fetch
   * @returns {Promise<Document | null>}
   */
  async fetchProductPage(productPageUrl) {
    if (!productPageUrl) return null;

    // We use this to abort the previous fetch request if it's still pending.
    this.#abortController?.abort();
    const abortController = new AbortController();
    this.#abortController = abortController;

    try {
      const response = await fetch(productPageUrl, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product page: HTTP error ${response.status}`);
      }

      const responseText = await response.text();
      const html = new DOMParser().parseFromString(responseText, 'text/html');

      return html;
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      } else {
        throw error;
      }
    } finally {
      if (this.#abortController === abortController) this.#abortController = null;
    }
  }

  /**
   * Re-renders the variant picker.
   * @param {Element} productGrid - The product grid element
   * @param {string} productPageUrl - The product page URL
   */
  async updateQuickAddModal(productGrid, productPageUrl = this.productPageUrl) {
    const modalContent = document.getElementById('quick-add-modal-content');
    if (!productGrid || !modalContent) return;

    const dialog = this.#getQuickAddDialog();
    const isCartUpsell = this.hasAttribute('data-am-cart-upsell');
    dialog?.markQuickAddOrigin(this.closest('product-card') ? 'product-card' : '');
    dialog?.setCartUpsellSource(isCartUpsell ? this : null);
    prepareQuickAddGrid(productGrid, {
      productTitle: this.dataset.productTitle || '',
      productPageUrl,
      showThumbnails: !isMobileBreakpoint() && dialog?.dataset.amShowThumbnails === 'true',
      cartUpsell: isCartUpsell,
      cartError: this.dataset.amCartError,
    });
    replaceQuickAddContent(productGrid);
    this.#syncVariantSelection(modalContent);
  }

  /**
   * Updates the quick-add button state based on whether a swatch is selected
   * @param {VariantSelectedEvent} event - The variant selected event
   */
  #updateQuickAddButtonState(event) {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest('product-card') !== this.closest('product-card')) return;
    const productOptionsCount = this.dataset.productOptionsCount;
    const quickAddButton = productOptionsCount === '1' ? 'add' : 'choose';
    this.setAttribute('data-quick-add-button', quickAddButton);
  }

  /**
   * Syncs the variant selection from the product card to the modal
   * @param {Element} modalContent - The modal content element
   */
  #syncVariantSelection(modalContent) {
    const selectedVariantId = this.#getSelectedVariantId();
    if (!selectedVariantId) return;

    // Find and check the corresponding input in the modal
    const modalInputs = modalContent.querySelectorAll('input[type="radio"][data-variant-id]');
    for (const input of modalInputs) {
      if (input instanceof HTMLInputElement && input.dataset.variantId === selectedVariantId && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }
}

if (!customElements.get('quick-add-component')) {
  customElements.define('quick-add-component', QuickAddComponent);
}

class QuickAddDialog extends DialogComponent {
  #abortController = new AbortController();
  /** @type {HTMLElement | null} */
  #cartUpsellSource = null;
  #upsellRequestId = 0;
  /** @type {AbortController | null} */
  #upsellAbort = null;
  #productUpsellActive = false;

  /** @param {HTMLElement | null} source */
  setCartUpsellSource(source) {
    this.#cartUpsellSource = source;
  }

  /** @param {string} origin */
  markQuickAddOrigin(origin) {
    this.dataset.amQuickAddOrigin = origin || '';
    this.#productUpsellActive = false;
    this.#clearProductUpsellChrome();
  }

  cancelProductUpsell() {
    this.#upsellRequestId += 1;
    this.#upsellAbort?.abort();
    this.#upsellAbort = null;
  }

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener(ThemeEvents.cartUpdate, this.handleCartUpdate, { signal: this.#abortController.signal });
    document.addEventListener(ThemeEvents.cartUpdate, this.#handleProductUpsell, { signal: this.#abortController.signal });
    this.addEventListener(ThemeEvents.variantUpdate, this.#updateProductTitleLink);

    this.addEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
  }

  disconnectedCallback() {
    this.cancelProductUpsell();
    super.disconnectedCallback();

    this.#abortController.abort();
    this.removeEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
  }

  /**
   * Closes the dialog
   * @param {CartUpdateEvent} event - The cart update event
   */
  handleCartUpdate = (event) => {
    if (event.detail.data.didError) return;
    this.closeDialog();
  };

  #updateProductTitleLink = (/** @type {CustomEvent} */ event) => {
    const anchorElement = /** @type {HTMLAnchorElement} */ (
      event.detail.data.html?.querySelector('.view-product-title a')
    );
    const viewMoreDetailsLink = /** @type {HTMLAnchorElement} */ (this.querySelector('.view-product-title a'));
    const mobileProductTitle = /** @type {HTMLAnchorElement} */ (this.querySelector('.product-header a'));

    if (!anchorElement) return;

    if (viewMoreDetailsLink) viewMoreDetailsLink.href = anchorElement.href;
    if (mobileProductTitle) mobileProductTitle.href = anchorElement.href;
  };

  /**
   * Opens Quick Buy for a product suggested by the item just added.
   * @param {Event} event
   */
  #handleProductUpsell = (event) => {
    const detail = /** @type {{ data?: { didError?: boolean, source?: string, upsell?: { url?: string, heading?: string } } }} */ (event).detail;
    const upsell = detail?.data?.upsell;
    if (!upsell?.url || detail?.data?.didError || detail?.data?.source !== 'product-form-component') return;

    const requestId = ++this.#upsellRequestId;
    this.#upsellAbort?.abort();
    const abort = new AbortController();
    this.#upsellAbort = abort;

    const fromInside = event.target instanceof Node && this.contains(event.target);
    const closed = !this.refs.dialog.open
      ? Promise.resolve()
      : fromInside
        ? new Promise((resolve) => {
            this.addEventListener(DialogCloseEvent.eventName, () => resolve(), { once: true });
          })
        : this.closeDialog();

    void this.#openProductUpsell(upsell, requestId, closed, abort);
  };

  /**
   * @param {{ url?: string, heading?: string }} upsell
   * @param {number} requestId
   * @param {Promise<unknown>} closed
   * @param {AbortController} abort
   */
  async #openProductUpsell(upsell, requestId, closed, abort) {
    let grid = null;
    try {
      const [fetched] = await Promise.all([this.#fetchUpsellGrid(upsell.url || '', abort.signal), closed, this.#waitForCartDrawer()]);
      grid = fetched;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      return;
    }
    if (requestId !== this.#upsellRequestId || !grid || this.refs.dialog.open) return;

    const productTitle = grid.querySelector('.view-product-title')?.textContent?.trim() || '';
    prepareQuickAddGrid(grid, {
      productTitle,
      productPageUrl: upsell.url || '',
      showThumbnails: !isMobileBreakpoint() && this.dataset.amShowThumbnails === 'true',
      cartUpsell: false,
    });
    if (requestId !== this.#upsellRequestId || !replaceQuickAddContent(grid) || this.refs.dialog.open) return;

    this.setCartUpsellSource(null);
    this.dataset.amQuickAddOrigin = '';
    this.setAttribute('data-am-product-upsell', '');
    this.#applyUpsellHeading(upsell.heading || '');
    this.#productUpsellActive = true;
    this.showDialog();
  };

  /**
   * @param {string} url
   * @param {AbortSignal} signal
   * @returns {Promise<Element | null>}
   */
  async #fetchUpsellGrid(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Failed to fetch suggested product: HTTP error ${response.status}`);
    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    const grid = html.querySelector('[data-product-grid-content]');
    return grid ? /** @type {Element} */ (grid.cloneNode(true)) : null;
  }

  #waitForCartDrawer() {
    const drawer = document.querySelector('cart-drawer-component');
    if (!(drawer instanceof HTMLElement) || !drawer.hasAttribute('auto-open')) return Promise.resolve();
    const dialog = drawer.querySelector('dialog');
    if (!(dialog instanceof HTMLDialogElement) || dialog.open) return Promise.resolve();

    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 800);
      drawer.addEventListener(
        DialogOpenEvent.eventName,
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true }
      );
    });
  }

  /** @param {string} heading */
  #applyUpsellHeading(heading) {
    const node = this.querySelector('.am-product-upsell__heading');
    if (!(node instanceof HTMLElement)) return;
    const text = heading.trim();
    node.textContent = text;
    node.hidden = text.length === 0;
    if (text) this.refs.dialog.setAttribute('aria-labelledby', node.id);
    else this.refs.dialog.removeAttribute('aria-labelledby');
  }

  #clearProductUpsellChrome() {
    this.removeAttribute('data-am-product-upsell');
    const node = this.querySelector('.am-product-upsell__heading');
    if (node instanceof HTMLElement) {
      node.textContent = '';
      node.hidden = true;
    }
    this.refs.dialog?.removeAttribute('aria-labelledby');
  }

  #focusOpenCartHeading() {
    const heading = document.querySelector('.cart-drawer__dialog[open] #cart-drawer-heading');
    if (!(heading instanceof HTMLElement)) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  #handleDialogClose = () => {
    for (const media of this.querySelectorAll('[data-am-quick-buy-gallery] :is(deferred-media, product-model)')) {
      if ('pauseMedia' in media && typeof media.pauseMedia === 'function') media.pauseMedia();
    }
    if (this.#productUpsellActive) {
      this.#productUpsellActive = false;
      this.#clearProductUpsellChrome();
      this.#focusOpenCartHeading();
    } else if (this.#cartUpsellSource && !this.#cartUpsellSource.isConnected) {
      this.#focusOpenCartHeading();
    }
    this.#cartUpsellSource = null;
    const iosVersion = getIOSVersion();
    /**
     * This is a patch to solve an issue with the UI freezing when the dialog is closed.
     * To reproduce it, use iOS 16.0.
     */
    if (!iosVersion || iosVersion.major >= 17 || (iosVersion.major === 16 && iosVersion.minor >= 4)) return;

    requestAnimationFrame(() => {
      /** @type {HTMLElement | null} */
      const grid = document.querySelector('#ResultsList [product-grid-view]');
      if (grid) {
        const currentWidth = grid.getBoundingClientRect().width;
        grid.style.width = `${currentWidth - 1}px`;
        requestAnimationFrame(() => {
          grid.style.width = '';
        });
      }
    });
  };
}

if (!customElements.get('quick-add-dialog')) {
  customElements.define('quick-add-dialog', QuickAddDialog);
}
