import { Component } from '@theme/component';
import { QuickAddComponent } from '@theme/quick-add';
import { isClickedOutside, isMobileBreakpoint, isTouchDevice, mediaQueryLarge } from '@theme/utilities';

const mediaQueryFinePointer = matchMedia('(hover: hover) and (pointer: fine)');
const mediaQueryReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const HOVER_IMAGE_DURATION = 400;

/**
 * @typedef {object} HotspotHoverImageDetail
 * @property {ProductHotspotComponent} source
 * @property {string} url
 */

/**
 * @typedef {object} HotspotResetImageDetail
 * @property {ProductHotspotComponent} source
 */

class ProductHotspots extends HTMLElement {
  /** @type {HTMLImageElement[]} */
  #hoverImages = [];
  /** @type {HTMLImageElement | null} */
  #currentHoverImage = null;
  /** @type {ProductHotspotComponent | null} */
  #activeSource = null;
  /** @type {number | null} */
  #hoverImageResetFrame = null;
  #hoverImageRequestId = 0;
  #hoverImageTransitionId = 0;
  /** @type {Promise<void>} */
  #hoverImageTransition = Promise.resolve();
  /** @type {Set<Animation>} */
  #hoverImageAnimations = new Set();
  /** @type {Map<string, Promise<void>>} */
  #hoverImageLoads = new Map();
  /** @type {ProductHotspotComponent | null} */
  #activeMobileSource = null;
  /** @type {HTMLElement | null} */
  #mobileQuickBuyPanel = null;
  /** @type {HTMLElement | null} */
  #mobileQuickBuyContent = null;
  /** @type {ResizeObserver | null} */
  #mobileQuickBuyResizeObserver = null;
  /** @type {HTMLElement | null} */
  #quickBuyDialog = null;
  #mobileQuickBuyRequestId = 0;
  /** @type {HTMLElement | null} */
  #mobileButtons = null;
  /** @type {MutationObserver | null} */
  #mobileButtonObserver = null;
  /** @type {HTMLElement | null} */
  #mediaContainer = null;
  /** @type {HTMLElement | null} */
  #hotspotsContainer = null;

  connectedCallback() {
    this.#hoverImages = Array.from(this.querySelectorAll('[data-hotspot-hover-image]')).filter(
      (image) => image instanceof HTMLImageElement
    ).slice(0, 2);
    if (this.#hoverImages.length === 1) {
      const firstImage = this.#hoverImages[0];
      if (firstImage) {
        const buffer = /** @type {HTMLImageElement} */ (firstImage.cloneNode(false));
        buffer.removeAttribute('src');
        buffer.removeAttribute('srcset');
        delete buffer.dataset.src;
        firstImage.after(buffer);
        this.#hoverImages.push(buffer);
      }
    }
    this.#restoreBaseImage(false);
    const quickBuyPanel = this.querySelector('[data-hotspot-mobile-quick-buy-panel]');
    this.#mobileQuickBuyPanel = quickBuyPanel instanceof HTMLElement ? quickBuyPanel : null;
    const mediaContainer = this.querySelector('.section-product-hotspots__content');
    this.#mediaContainer = mediaContainer instanceof HTMLElement ? mediaContainer : null;
    const hotspotsContainer = this.querySelector('.hotspots-container');
    this.#hotspotsContainer = hotspotsContainer instanceof HTMLElement ? hotspotsContainer : null;
    if (this.#mobileQuickBuyPanel) this.#mobileQuickBuyPanel.hidden = !this.mobilePreviewQuickBuyEnabled;
    if (this.#mobileQuickBuyPanel && 'ResizeObserver' in window) {
      this.#mobileQuickBuyResizeObserver = new ResizeObserver(this.#positionMobileQuickBuy);
      this.#mobileQuickBuyResizeObserver.observe(this.#mobileQuickBuyPanel);
    }
    this.addEventListener('product-hotspot-hover-image', this.#handleHoverImage);
    this.addEventListener('product-hotspot-reset-image', this.#handleResetImage);
    this.addEventListener('click', this.#handleMobileButtonClick);
    this.addEventListener('click', this.#handleMobileQuickBuyClick);
    this.addEventListener('click', this.#handleMobilePreviewClose);
    this.addEventListener('keydown', this.#handleMobileKeydown);
    this.addEventListener('shopify:block:select', this.#handleBlockSelect);
    this.addEventListener('shopify:block:deselect', this.#handleBlockDeselect);
    document.addEventListener('click', this.#handleOutsideClick);
    mediaQueryLarge.addEventListener('change', this.#handleBreakpointChange);
    mediaQueryReducedMotion.addEventListener('change', this.#handleReducedMotionChange);

    const mobileButtons = this.querySelector('[data-hotspot-mobile-buttons]');
    if (mobileButtons instanceof HTMLElement && hotspotsContainer) {
      this.#mobileButtons = mobileButtons;
      this.#syncMobileButtons();
      this.#mobileButtonObserver = new MutationObserver(this.#syncMobileButtons);
      this.#mobileButtonObserver.observe(hotspotsContainer, { childList: true });
    }
  }

  disconnectedCallback() {
    this.removeEventListener('product-hotspot-hover-image', this.#handleHoverImage);
    this.removeEventListener('product-hotspot-reset-image', this.#handleResetImage);
    this.removeEventListener('click', this.#handleMobileButtonClick);
    this.removeEventListener('click', this.#handleMobileQuickBuyClick);
    this.removeEventListener('click', this.#handleMobilePreviewClose);
    this.removeEventListener('keydown', this.#handleMobileKeydown);
    this.removeEventListener('shopify:block:select', this.#handleBlockSelect);
    this.removeEventListener('shopify:block:deselect', this.#handleBlockDeselect);
    document.removeEventListener('click', this.#handleOutsideClick);
    mediaQueryLarge.removeEventListener('change', this.#handleBreakpointChange);
    mediaQueryReducedMotion.removeEventListener('change', this.#handleReducedMotionChange);
    this.#mobileButtonObserver?.disconnect();
    this.#mobileButtonObserver = null;
    this.#mobileButtons = null;
    this.#clearMobileSelection();
    this.#mobileQuickBuyResizeObserver?.disconnect();
    this.#mobileQuickBuyResizeObserver = null;
    this.#mobileQuickBuyPanel = null;
    this.#mediaContainer = null;
    this.#hotspotsContainer = null;
    this.#hoverImageRequestId += 1;
    this.#cancelPendingImageReset();
    this.#activeSource = null;
    this.#restoreBaseImage(false);
    this.#hoverImages = [];
    this.#hoverImageLoads.clear();
  }

  #syncMobileButtons = () => {
    const grid = this.#mobileButtons;
    if (!grid) return;

    this.resetState();
    const buttons = document.createDocumentFragment();
    for (const template of this.querySelectorAll('[data-hotspot-mobile-button-template]')) {
      if (template instanceof HTMLTemplateElement) buttons.append(template.content.cloneNode(true));
    }
    grid.replaceChildren(buttons);
    grid.hidden = grid.childElementCount === 0;
    this.#syncMobileSelection();
  };

  get mobilePreviewQuickBuyEnabled() {
    return isMobileBreakpoint() && this.dataset.mobilePreviewQuickBuy === 'true';
  }

  get mobileQuickBuyPanelId() {
    return this.#mobileQuickBuyPanel?.id || '';
  }

  /** @param {ProductHotspotComponent} source */
  clearRemovedMobileHotspot(source) {
    if (this.#activeMobileSource === source) this.resetState();
  }

  /** @param {MouseEvent} event */
  #handleMobileButtonClick = (event) => {
    if (!isMobileBreakpoint() || !(event.target instanceof Element)) return;

    const button = event.target.closest('[data-hotspot-mobile-button]');
    if (!(button instanceof HTMLButtonElement) || !this.contains(button)) return;

    const source = Array.from(this.querySelectorAll('product-hotspot-component')).find(
      (hotspot) => hotspot instanceof ProductHotspotComponent && hotspot.dataset.id === button.dataset.hotspotMobileButton
    );
    if (!(source instanceof ProductHotspotComponent)) return;
    this.selectMobileHotspot(source);
  };

  /** @param {ProductHotspotComponent} source */
  selectMobileHotspot(source) {
    if (!isMobileBreakpoint() || !this.contains(source)) return;
    const wasSelected = this.#activeMobileSource === source;
    if (wasSelected) {
      this.resetState({ animateImage: true });
      return;
    }
    this.#clearMobileSelection();
    this.closeOtherPreviews(source);

    this.#activeMobileSource = source;
    this.#syncMobileSelection();
    if (source.dataset.mobileHoverImageUrl) {
      void this.#handleHoverImage(
        new CustomEvent('product-hotspot-hover-image', {
          detail: { source, url: source.dataset.mobileHoverImageUrl },
        })
      );
    } else {
      this.#resetImageState(true);
    }

    const panel = this.#mobileQuickBuyPanel;
    const template = source.querySelector('[data-hotspot-mobile-quick-buy-template]');
    if (!this.mobilePreviewQuickBuyEnabled || !panel || !(template instanceof HTMLTemplateElement)) return;
    panel.replaceChildren(template.content.cloneNode(true));
    const content = panel.firstElementChild;
    this.#mobileQuickBuyContent = content instanceof HTMLElement ? content : null;
    if (this.#mobileQuickBuyContent) this.#mobileQuickBuyResizeObserver?.observe(this.#mobileQuickBuyContent);
    panel.inert = false;
    panel.setAttribute('aria-hidden', 'false');
    this.#positionMobileQuickBuy();
    requestAnimationFrame(() => {
      if (this.#activeMobileSource === source) panel.classList.add('is-active');
    });
  }

  #positionMobileQuickBuy = () => {
    const panel = this.#mobileQuickBuyPanel;
    const content = this.#mobileQuickBuyContent;
    if (!this.mobilePreviewQuickBuyEnabled || !this.#activeMobileSource || !panel || !content) return;

    const { width, height } = panel.getBoundingClientRect();
    const action = content.querySelector('[data-hotspot-mobile-quick-buy]:not([hidden]), [data-hotspot-mobile-product-link]:not([hidden])');
    if (!(action instanceof HTMLElement)) return;
    const contentWidth = content.offsetWidth;
    const halfHeight = content.offsetHeight / 2;
    const minX = 12;
    const maxX = width - 12 - contentWidth;
    const minY = 12 + halfHeight;
    const maxY = height - 12 - halfHeight;
    const requestedX = (Number(content.dataset.positionX ?? 50) / 100) * width - action.offsetWidth / 2;
    const requestedY = (Number(content.dataset.positionY ?? 85) / 100) * height;
    const x = minX > maxX ? (width - contentWidth) / 2 : Math.max(minX, Math.min(maxX, requestedX));
    const y = minY > maxY ? height / 2 : Math.max(minY, Math.min(maxY, requestedY));
    const enterOffset = minY > maxY ? 0 : Math.max(minY, Math.min(maxY, y - 8)) - y;
    content.style.setProperty('--mobile-quick-buy-left', `${x}px`);
    content.style.setProperty('--mobile-quick-buy-top', `${y}px`);
    content.style.setProperty('--mobile-quick-buy-enter-offset', `${enterOffset}px`);
  };

  #syncMobileSelection() {
    const previewActive = this.mobilePreviewQuickBuyEnabled && this.#activeMobileSource !== null;
    this.toggleAttribute('data-mobile-preview-active', previewActive);
    if (this.#hotspotsContainer) this.#hotspotsContainer.inert = previewActive;
    for (const button of this.querySelectorAll('[data-hotspot-mobile-button]')) {
      if (button instanceof HTMLButtonElement) {
        button.setAttribute('aria-pressed', String(button.dataset.hotspotMobileButton === this.#activeMobileSource?.dataset.id));
      }
    }
    for (const source of this.querySelectorAll('product-hotspot-component')) {
      if (source instanceof ProductHotspotComponent) source.syncMobileSelection(source === this.#activeMobileSource);
    }
  }

  #clearMobileSelection() {
    this.#mobileQuickBuyRequestId += 1;
    this.#activeMobileSource?.cancelMobileQuickBuy();
    this.#activeMobileSource = null;
    this.#detachQuickBuyDialog();
    if (this.#mobileQuickBuyContent) this.#mobileQuickBuyResizeObserver?.unobserve(this.#mobileQuickBuyContent);
    this.#mobileQuickBuyContent = null;
    const panel = this.#mobileQuickBuyPanel;
    if (panel) {
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.classList.remove('is-active');
    }
    this.#syncMobileSelection();
  }

  /** @param {MouseEvent} event */
  #handleMobileQuickBuyClick = async (event) => {
    if (!this.mobilePreviewQuickBuyEnabled || !(event.target instanceof Element)) return;
    const button = event.target.closest('[data-hotspot-mobile-quick-buy]');
    const source = this.#activeMobileSource;
    if (!(button instanceof HTMLButtonElement) || !this.#mobileQuickBuyPanel?.contains(button) || !source) return;
    event.preventDefault();
    if (button.getAttribute('aria-disabled') === 'true') return;

    const requestId = ++this.#mobileQuickBuyRequestId;
    button.focus({ preventScroll: true });
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('aria-busy', 'true');
    this.#detachQuickBuyDialog();
    const dialog = document.getElementById('quick-add-dialog');
    if (dialog) {
      this.#quickBuyDialog = dialog;
      dialog.addEventListener('dialog:close', this.#handleQuickBuyClose);
    }

    const result = await source.openMobileQuickBuy();
    if (requestId !== this.#mobileQuickBuyRequestId || this.#activeMobileSource !== source) return;
    button.removeAttribute('aria-disabled');
    button.removeAttribute('aria-busy');
    if (result === 'opened') return;
    this.#detachQuickBuyDialog();
    if (result === 'aborted') return;

    const link = this.#mobileQuickBuyPanel?.querySelector('[data-hotspot-mobile-product-link]');
    if (link instanceof HTMLAnchorElement) {
      const shouldFocus = document.activeElement === button;
      button.hidden = true;
      link.hidden = false;
      this.#positionMobileQuickBuy();
      if (shouldFocus) link.focus({ preventScroll: true });
    }
  };

  #detachQuickBuyDialog() {
    this.#quickBuyDialog?.removeEventListener('dialog:close', this.#handleQuickBuyClose);
    this.#quickBuyDialog = null;
  }

  #handleQuickBuyClose = () => {
    this.#detachQuickBuyDialog();
    if (!this.isConnected || !this.mobilePreviewQuickBuyEnabled || !this.#activeMobileSource) return;
    const target = this.#mobileQuickBuyPanel?.querySelector('.button:not([hidden])');
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  };

  /** @param {boolean} restoreFocus */
  #closeMobilePreview(restoreFocus) {
    const source = this.#activeMobileSource;
    this.resetState({ animateImage: true });
    if (!restoreFocus || !source) return;

    const gridButton = Array.from(this.#mobileButtons?.querySelectorAll('[data-hotspot-mobile-button]') || []).find(
      (button) => button instanceof HTMLElement && button.dataset.hotspotMobileButton === source.dataset.id
    );
    for (const target of [source.refs.trigger, gridButton, this.#mediaContainer]) {
      if (!(target instanceof HTMLElement) || !target.isConnected || target.getClientRects().length === 0) continue;
      if (target.closest('[inert]') || getComputedStyle(target).visibility === 'hidden') continue;
      if (target === this.#mediaContainer && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      return;
    }
  }

  /** @param {MouseEvent} event */
  #handleMobilePreviewClose = (event) => {
    if (!this.mobilePreviewQuickBuyEnabled || !(event.target instanceof Element)) return;
    const button = event.target.closest('[data-hotspot-mobile-close]');
    if (!button || !this.#mobileQuickBuyPanel?.contains(button) || !this.#activeMobileSource) return;
    event.preventDefault();
    this.#closeMobilePreview(true);
  };

  /** @param {MouseEvent} event */
  #handleOutsideClick = (event) => {
    if (event.target instanceof Element && event.target.closest('#quick-add-dialog')) return;
    if (!this.#activeMobileSource || !(event.target instanceof Node)) return;
    if (this.mobilePreviewQuickBuyEnabled && event.target instanceof Element) {
      const gridButton = event.target.closest('[data-hotspot-mobile-button]');
      if (gridButton && this.#mobileButtons?.contains(gridButton)) return;
    }
    const boundary = this.mobilePreviewQuickBuyEnabled ? this.#mediaContainer || this : this;
    if (!boundary.contains(event.target)) {
      this.resetState({ animateImage: true });
    }
  };

  /** @param {KeyboardEvent} event */
  #handleMobileKeydown = (event) => {
    if (event.key === 'Escape' && this.#activeMobileSource) {
      event.preventDefault();
      const restoreFocus = event.target instanceof Node && Boolean(this.#mobileQuickBuyPanel?.contains(event.target));
      this.#closeMobilePreview(restoreFocus);
    }
  };

  #handleBreakpointChange = () => {
    this.resetState();
    if (this.#mobileQuickBuyPanel) this.#mobileQuickBuyPanel.hidden = !this.mobilePreviewQuickBuyEnabled;
  };

  /** @param {Event} event */
  #handleBlockSelect = (event) => {
    if (!(event.target instanceof Element)) return;
    if (this.mobilePreviewQuickBuyEnabled && this.#activeMobileSource) this.resetState();
    event.target.closest('.hotspot')?.setAttribute('data-editor-selected', '');
  };

  /** @param {Event} event */
  #handleBlockDeselect = (event) => {
    if (!(event.target instanceof Element)) return;
    event.target.closest('.hotspot')?.removeAttribute('data-editor-selected');
  };

  /** @param {Event} event */
  #handleHoverImage = async (event) => {
    if (!(event instanceof CustomEvent)) return;

    const { source, url } = /** @type {HotspotHoverImageDetail} */ (event.detail);
    if (!(source instanceof ProductHotspotComponent) || this.#hoverImages.length < 2 || typeof url !== 'string' || !url) return;

    this.#cancelPendingImageReset();
    const requestId = ++this.#hoverImageRequestId;
    this.#activeSource = source;
    const isCurrent = () => this.isConnected && requestId === this.#hoverImageRequestId && this.#activeSource === source;

    try {
      await this.#preloadHoverImage(url);
    } catch {
      if (isCurrent()) this.#resetImageState(true);
      return;
    }

    // Loads run in parallel; only the latest request may enter the next free buffer.
    let transition;
    do {
      transition = this.#hoverImageTransition;
      await transition;
    } while (isCurrent() && transition !== this.#hoverImageTransition);
    if (!isCurrent() || this.#currentHoverImage?.dataset.src === url) return;

    const incoming = this.#hoverImages.find((image) => image !== this.#currentHoverImage);
    if (!incoming) return;
    incoming.src = url;
    incoming.dataset.src = url;
    try {
      await incoming.decode();
    } catch {
      if (!incoming.complete || incoming.naturalWidth === 0) {
        if (isCurrent()) this.#resetImageState(true);
        return;
      }
    }
    if (!isCurrent() || incoming.dataset.src !== url) return;

    const transitionId = ++this.#hoverImageTransitionId;
    incoming.hidden = false;
    incoming.classList.add('is-active');
    incoming.parentElement?.append(incoming);
    // Keep the outgoing bitmap opaque until the incoming bitmap fully covers it.
    this.#hoverImageTransition = this.#animateHoverOpacity(incoming, 0, 1).then(() => {
      if (transitionId !== this.#hoverImageTransitionId) return;
      this.#currentHoverImage = incoming;
      for (const image of this.#hoverImages) {
        if (image !== incoming) this.#retireHoverImage(image);
      }
    });
  };

  /** @param {HTMLImageElement} image */
  #retireHoverImage(image) {
    image.hidden = true;
    image.classList.remove('is-active');
    image.style.removeProperty('opacity');
  }

  /**
   * @param {HTMLImageElement} image
   * @param {number} from
   * @param {number} to
   * @returns {Promise<void>}
   */
  async #animateHoverOpacity(image, from, to) {
    image.style.opacity = String(to);
    if (mediaQueryReducedMotion.matches || from === to) return;
    const animation = image.animate({ opacity: [from, to] }, {
      duration: HOVER_IMAGE_DURATION,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'both',
    });
    this.#hoverImageAnimations.add(animation);
    await animation.finished.catch(() => {});
    if (this.#hoverImageAnimations.delete(animation)) animation.cancel();
  }

  /** @param {boolean} animate */
  #restoreBaseImage(animate) {
    const visible = this.#hoverImages.filter((image) => !image.hidden).map((image) => ({
      image,
      opacity: Number.parseFloat(getComputedStyle(image).opacity),
    }));
    const transitionId = ++this.#hoverImageTransitionId;
    const animations = [...this.#hoverImageAnimations];
    this.#hoverImageAnimations.clear();
    for (const animation of animations) animation.cancel();
    this.#currentHoverImage = null;
    if (!animate || mediaQueryReducedMotion.matches || !visible.length) {
      for (const image of this.#hoverImages) this.#retireHoverImage(image);
      this.#hoverImageTransition = Promise.resolve();
      return;
    }
    this.#hoverImageTransition = Promise.all(visible.map(({ image, opacity }) => {
      image.classList.remove('is-active');
      return this.#animateHoverOpacity(image, opacity, 0);
    })).then(() => {
      if (transitionId !== this.#hoverImageTransitionId) return;
      for (const image of this.#hoverImages) this.#retireHoverImage(image);
    });
  }

  /** @param {boolean} animate */
  #resetImageState(animate) {
    this.#hoverImageRequestId += 1;
    this.#cancelPendingImageReset();
    this.#activeSource = null;
    this.#restoreBaseImage(animate);
  }

  #handleReducedMotionChange = () => {
    if (mediaQueryReducedMotion.matches) {
      for (const animation of this.#hoverImageAnimations) animation.finish();
    }
  };

  /**
   * Loads and decodes a hover image once per URL.
   * @param {string} url
   * @returns {Promise<void>}
   */
  #preloadHoverImage(url) {
    const cachedLoad = this.#hoverImageLoads.get(url);
    if (cachedLoad) return cachedLoad;

    const load = /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = async () => {
        try {
          await image.decode();
        } catch {
          // A completed load is still safe to display when decode() is unavailable or rejects.
        }
        resolve();
      };
      image.onerror = () => reject(new Error(`Unable to load hotspot hover image: ${url}`));
      image.src = url;
    }));

    this.#hoverImageLoads.set(url, load);
    load.catch(() => {
      if (this.#hoverImageLoads.get(url) === load) this.#hoverImageLoads.delete(url);
    });
    return load;
  }

  /** @param {Event} event */
  #handleResetImage = (event) => {
    if (!(event instanceof CustomEvent)) return;

    const { source } = /** @type {HotspotResetImageDetail} */ (event.detail);
    if (!(source instanceof ProductHotspotComponent)) return;

    this.#cancelPendingImageReset();
    this.#hoverImageResetFrame = requestAnimationFrame(() => {
      this.#hoverImageResetFrame = null;
      if (source !== this.#activeSource) return;
      this.#resetImageState(true);
      if (this.#activeMobileSource === source && !this.mobilePreviewQuickBuyEnabled) this.#clearMobileSelection();
    });
  };

  /** @param {ProductHotspotComponent} source */
  resetHoverImage(source) {
    if (source !== this.#activeSource) return;
    this.#resetImageState(false);
    if (this.#activeMobileSource === source && !this.mobilePreviewQuickBuyEnabled) this.#clearMobileSelection();
  }

  /** @param {ProductHotspotComponent} source */
  closeOtherPreviews(source) {
    for (const hotspot of this.querySelectorAll('product-hotspot-component')) {
      if (hotspot instanceof ProductHotspotComponent && hotspot !== source) {
        void hotspot.closeDialog();
      }
    }
  }

  /**
   * Restores the base image and closes every preview owned by this media container.
   * Lifecycle/editor/slideshow resets are immediate; user dismissals can fade out.
   * @param {{ animateImage?: boolean }} [options]
   */
  resetState({ animateImage = false } = {}) {
    this.#resetImageState(animateImage);
    this.#clearMobileSelection();
    for (const hotspot of this.querySelectorAll('product-hotspot-component')) {
      if (hotspot instanceof ProductHotspotComponent && hotspot.refs.dialog) void hotspot.closeDialog();
    }
  }

  #cancelPendingImageReset() {
    if (this.#hoverImageResetFrame === null) return;
    cancelAnimationFrame(this.#hoverImageResetFrame);
    this.#hoverImageResetFrame = null;
  }

}

/**
 * A custom element that manages a dialog.
 *
 * @typedef {object} Refs
 * @property {HTMLDialogElement} dialog - The dialog element.
 * @property {HTMLButtonElement} trigger - The button element.
 * @property {HTMLAnchorElement} productLink - The product link element.
 *
 * @extends Component<Refs>
 */

export class ProductHotspotComponent extends Component {
  requiredRefs = ['trigger', 'dialog'];
  /** @type {(() => void) | null} */
  #pointerenterHandler = null;
  /** @type {(() => void) | null} */
  #focusHandler = null;
  /** @type {(() => void) | null} */
  #hoverImageEnterHandler = null;
  /** @type {(() => void) | null} */
  #hoverImageLeaveHandler = null;
  #quickAddRequestId = 0;
  /** @type {ResizeObserver | null} */
  #quickBuyLabelResizeObserver = null;
  /** @type {ProductHotspots | null} */
  #hotspotsRoot = null;
  #triggerLabel = '';

  connectedCallback() {
    super.connectedCallback();

    const hotspotsRoot = this.closest('product-hotspots');
    this.#hotspotsRoot = hotspotsRoot instanceof ProductHotspots ? hotspotsRoot : null;
    this.#triggerLabel = this.dataset.detailsLabel || this.refs.trigger.getAttribute('aria-label') || '';

    this.#measureQuickBuyLabel();
    requestAnimationFrame(this.#measureQuickBuyLabel);
    document.fonts?.ready?.then(this.#measureQuickBuyLabel);
    this.#observeQuickBuyLabel();
    this.addEventListener('focusout', this.#handleFocusOut);

    // Set up initial event listeners based on current breakpoint
    this.#handleBreakpointChange();

    // Listen for breakpoint changes
    mediaQueryLarge.addEventListener('change', this.#handleBreakpointChange);
    mediaQueryFinePointer.addEventListener('change', this.#handleBreakpointChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.cancelMobileQuickBuy();
    this.#hotspotsRoot?.clearRemovedMobileHotspot(this);
    this.#hotspotsRoot?.resetHoverImage(this);
    this.#hotspotsRoot = null;

    // Clean up listeners
    this.#removeDesktopListeners();
    mediaQueryLarge.removeEventListener('change', this.#handleBreakpointChange);
    mediaQueryFinePointer.removeEventListener('change', this.#handleBreakpointChange);
    this.#quickBuyLabelResizeObserver?.disconnect();
    this.#quickBuyLabelResizeObserver = null;
    this.removeEventListener('focusout', this.#handleFocusOut);
  }

  #measureQuickBuyLabel = () => {
    const label = this.querySelector('.hotspot-trigger__quick-buy-label');

    if (!(label instanceof HTMLElement)) return;

    label.style.removeProperty('width');
    const labelWidth = Math.ceil(label.scrollWidth);
    if (labelWidth > 0) {
      this.style.setProperty('--quick-buy-label-width', `${labelWidth}px`);
    }
  };

  #observeQuickBuyLabel() {
    const content = this.querySelector('.hotspot-trigger__quick-buy-label > span');
    if (!(content instanceof HTMLElement) || !('ResizeObserver' in window)) return;

    this.#quickBuyLabelResizeObserver = new ResizeObserver(this.#measureQuickBuyLabel);
    this.#quickBuyLabelResizeObserver.observe(content);
  }

  /**
   * Opens Quick Add and reports whether the modal was shown.
   * @returns {Promise<'opened' | 'unavailable' | 'failed' | 'aborted'>}
   */
  async #openQuickAddModal() {
    const productUrl = this.dataset.productUrl;
    const quickAddComponent = /** @type {QuickAddComponent | null} */ (this.querySelector('quick-add-component'));

    if (!productUrl || !quickAddComponent) return 'unavailable';
    return quickAddComponent.open(productUrl);
  }

  /** @returns {Promise<'opened' | 'unavailable' | 'failed' | 'aborted'>} */
  async openMobileQuickBuy() {
    const requestId = ++this.#quickAddRequestId;
    const result = await this.#openQuickAddModal();
    return requestId === this.#quickAddRequestId ? result : 'aborted';
  }

  cancelMobileQuickBuy() {
    this.#quickAddRequestId += 1;
    const quickAdd = this.querySelector('quick-add-component');
    if (quickAdd instanceof QuickAddComponent) quickAdd.cancelOpen();
  }

  /** @param {boolean} selected */
  syncMobileSelection(selected) {
    this.toggleAttribute('data-mobile-selected', selected);
    const trigger = this.refs.trigger;
    if (!trigger) return;
    if (this.#hotspotsRoot?.mobilePreviewQuickBuyEnabled) {
      trigger.setAttribute('aria-pressed', String(selected));
      trigger.setAttribute('aria-controls', this.#hotspotsRoot.mobileQuickBuyPanelId);
      trigger.setAttribute('aria-label', this.dataset.mobileSelectionLabel || this.#triggerLabel);
      trigger.removeAttribute('aria-expanded');
      trigger.removeAttribute('aria-haspopup');
    } else {
      trigger.removeAttribute('aria-pressed');
      trigger.setAttribute('aria-controls', this.refs.dialog.id);
      trigger.setAttribute('aria-label', this.#triggerLabel);
      trigger.setAttribute('aria-expanded', String(this.refs.dialog.open));
      trigger.setAttribute('aria-haspopup', 'dialog');
    }
  }

  get desktopInteractionMode() {
    return this.dataset.desktopInteractionMode || 'hover-preview-click-quick-buy';
  }

  /**
   * Set up desktop event listeners (hover)
   * @returns {void}
   */
  #setupDesktopListeners() {
    const { trigger, dialog } = this.refs;

    if (this.desktopInteractionMode === 'hover-preview-click-quick-buy') {
      const showPreview = () => {
        if (dialog.open) return;
        this.showDialog();
      };

      this.#pointerenterHandler = showPreview;
      this.#focusHandler = showPreview;
      trigger.addEventListener('pointerenter', showPreview);
      trigger.addEventListener('pointerleave', this.#handlePointerLeave);
      trigger.addEventListener('focus', showPreview);
    }

    if (this.dataset.hoverImageUrl) {
      this.#hoverImageEnterHandler = () => {
        this.dispatchEvent(
          new CustomEvent('product-hotspot-hover-image', {
            bubbles: true,
            detail: { source: this, url: this.dataset.hoverImageUrl },
          })
        );
      };
      this.#hoverImageLeaveHandler = () => {
        this.dispatchEvent(
          new CustomEvent('product-hotspot-reset-image', { bubbles: true, detail: { source: this } })
        );
      };
      this.addEventListener('pointerenter', this.#hoverImageEnterHandler);
      this.addEventListener('pointerleave', this.#hoverImageLeaveHandler);
    }
  }

  /**
   * Remove desktop event listeners from trigger
   * @returns {void}
   */
  #removeDesktopListeners() {
    const { trigger } = this.refs;

    if (this.#pointerenterHandler) {
      trigger.removeEventListener('pointerenter', this.#pointerenterHandler);
      trigger.removeEventListener('pointerleave', this.#handlePointerLeave);
      this.#pointerenterHandler = null;
    }
    if (this.#focusHandler) {
      trigger.removeEventListener('focus', this.#focusHandler);
      this.#focusHandler = null;
    }

    if (this.#hoverImageEnterHandler) {
      this.removeEventListener('pointerenter', this.#hoverImageEnterHandler);
      this.#hoverImageEnterHandler = null;
    }
    if (this.#hoverImageLeaveHandler) {
      this.removeEventListener('pointerleave', this.#hoverImageLeaveHandler);
      this.#hoverImageLeaveHandler = null;
    }
  }

  /**
   * Handle breakpoint changes
   * @returns {void}
   */
  #handleBreakpointChange = () => {
    // Remove existing listeners
    this.#removeDesktopListeners();

    // Set up desktop hover listeners only (mobile uses on:click in template)
    if (!isMobileBreakpoint() && mediaQueryFinePointer.matches && !isTouchDevice()) {
      this.#setupDesktopListeners();
    } else {
      this.#hotspotsRoot?.resetHoverImage(this);
      void this.closeDialog();
    }
    this.syncMobileSelection(false);
  };

  /**
   * Calculate the placement of the dialog.
   * @returns {void}
   */
  #calculateDialogPlacement() {
    const { trigger, dialog } = this.refs;

    const hotspotsContainer = this.parentElement;

    if (!hotspotsContainer) {
      return;
    }

    // Spacing constants
    const BUTTON_GAP = 10; // Gap between button and dialog
    const CONTAINER_GAP = 10; // Gap from container edges
    const TOTAL_GAP = BUTTON_GAP + CONTAINER_GAP;

    // Get container bounds
    const containerRect = hotspotsContainer?.getBoundingClientRect();

    // Get button dimensions
    const triggerRect = trigger.getBoundingClientRect();

    // To get dialog dimensions, we need to temporarily show it invisibly
    // Show dialog invisibly to measure it
    dialog.style.visibility = 'hidden';
    dialog.style.display = 'block';
    dialog.style.transform = 'none';
    dialog.removeAttribute('data-placement');

    const { width: dialogWidth, height: dialogHeight } = dialog.getBoundingClientRect();

    // Reset dialog state
    dialog.style.removeProperty('display');
    dialog.style.removeProperty('visibility');
    dialog.style.removeProperty('transform');
    // Calculate button position relative to container
    const buttonLeft = triggerRect.left - containerRect.left;
    const buttonRight = triggerRect.right - containerRect.left;
    const buttonTop = triggerRect.top - containerRect.top;
    const buttonBottom = triggerRect.bottom - containerRect.top;

    // Calculate available space
    const spaceRight = containerRect.width - buttonRight - CONTAINER_GAP;
    const spaceLeft = buttonLeft - CONTAINER_GAP;

    // Determine horizontal placement
    let x = 'right';

    if (spaceRight >= dialogWidth + BUTTON_GAP) {
      x = 'right';
    } else if (spaceLeft >= dialogWidth + BUTTON_GAP) {
      x = 'left';
    } else {
      x = 'center';
    }

    // Determine vertical placement
    let y = 'bottom';
    let verticalOffset = 0;

    if (x !== 'center') {
      let dialogStartY = buttonTop; // Default to top-aligned
      let dialogEndY = buttonTop + dialogHeight;

      if (dialogEndY > containerRect.height - CONTAINER_GAP) {
        // If top-aligned overflows bottom
        dialogStartY = buttonBottom - dialogHeight;
        dialogEndY = buttonBottom;
        y = 'top';

        if (dialogStartY < CONTAINER_GAP) {
          // If bottom-aligned overflows top
          verticalOffset = CONTAINER_GAP - dialogStartY;
        } else if (dialogEndY > containerRect.height - CONTAINER_GAP) {
          // If bottom-aligned overflows bottom
          verticalOffset = -(dialogEndY - (containerRect.height - CONTAINER_GAP));
        }
      } else {
        if (dialogStartY < CONTAINER_GAP) {
          // If top-aligned overflows top
          if (dialogStartY < CONTAINER_GAP) {
            verticalOffset = CONTAINER_GAP - dialogStartY;
          }
          y = 'bottom';
        }
      }
    } else {
      // For center horizontal: position below or above button
      if (containerRect.height - buttonBottom >= dialogHeight + TOTAL_GAP) {
        y = 'bottom';
      } else if (buttonTop >= dialogHeight + TOTAL_GAP) {
        y = 'top';
      } else {
        // If neither fits well, choose based on button position
        y = buttonTop < containerRect.height / 2 ? 'bottom' : 'top';
      }
    }

    // Set placement data attribute
    dialog.dataset.placement = `${x},${y}`;

    // Apply vertical offset if needed to keep dialog in bounds
    if (verticalOffset !== 0) {
      dialog.style.setProperty('--dialog-vertical-offset', `${verticalOffset}px`);
    } else {
      dialog.style.removeProperty('--dialog-vertical-offset');
    }

  }

  /**
   * Handle pointer leave.
   * @param {PointerEvent} e - The event.
   * @returns {void}
   */
  #handlePointerLeave = (e) => {
    const { dialog, trigger } = this.refs;

    if (!dialog.open) return;
    if (this.matches(':focus-within')) return;

    const isLeavingTrigger = e.target === trigger;
    const isLeavingDialog = e.target === dialog;
    const isGoingToDialog =
      e.relatedTarget === dialog ||
      (e.relatedTarget instanceof Element && e.relatedTarget.closest('dialog') === dialog);
    const isGoingToTrigger = e.relatedTarget === trigger;

    if ((isLeavingTrigger && !isGoingToDialog) || (isLeavingDialog && !isGoingToTrigger)) {
      this.closeDialog();
    }
  };

  /** @param {FocusEvent} event */
  #handleFocusOut = (event) => {
    if (!this.refs.dialog.open) return;

    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && this.contains(nextTarget)) return;

    void this.closeDialog();
  };

  /**
   * Get the product link for the hotspot product.
   * @returns {HTMLAnchorElement | null} The product link or null.
   */
  getHotspotProductLink() {
    return this.refs.productLink || null;
  }

  /**
   * Handles hotspot click by opening Quick Add when available, otherwise showing the dialog.
   * @param {MouseEvent} e - The click event
   * @returns {Promise<void>}
   */
  handleHotspotClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.dataset.productUrl) return;

    if (this.#hotspotsRoot?.mobilePreviewQuickBuyEnabled) {
      this.#hotspotsRoot.selectMobileHotspot(this);
      return;
    }

    if (!isMobileBreakpoint() && !isTouchDevice() && this.desktopInteractionMode === 'click-preview') {
      if (this.refs.dialog.open) {
        void this.closeDialog();
      } else {
        this.showDialog();
      }
      return;
    }

    this.#hotspotsRoot?.closeOtherPreviews(this);
    if (this.refs.dialog.open) void this.closeDialog();

    const requestId = ++this.#quickAddRequestId;
    const result = await this.#openQuickAddModal();
    if (requestId !== this.#quickAddRequestId || result === 'aborted') return;

    if (result === 'opened') return;

    this.showDialog();
  };

  showDialog = () => {
    const { dialog, trigger } = this.refs;
    if (dialog.open) return;
    this.#hotspotsRoot?.closeOtherPreviews(this);
    this.#calculateDialogPlacement();
    delete dialog.dataset.closing;
    dialog.dataset.showing = 'true';
    dialog.show();
    trigger.setAttribute('aria-expanded', 'true');
    document.body.addEventListener('click', this.lightDismissMouse);
    document.body.addEventListener('keydown', this.lightDismissKeyboard);
    if (this.desktopInteractionMode === 'hover-preview-click-quick-buy') {
      dialog.addEventListener('pointerleave', this.#handlePointerLeave);
    }
  };

  /**
   * Close the dialog.
   * @returns {Promise<void>}
   */
  closeDialog = async () => {
    const { dialog, trigger } = this.refs;
    if (!dialog.open) {
      if (!this.#hotspotsRoot?.mobilePreviewQuickBuyEnabled) trigger.setAttribute('aria-expanded', 'false');
      return;
    }

    dialog.dataset.closing = 'true';
    dialog.close();
    if (!this.#hotspotsRoot?.mobilePreviewQuickBuyEnabled) trigger.setAttribute('aria-expanded', 'false');
    document.body.removeEventListener('click', this.lightDismissMouse);
    document.body.removeEventListener('keydown', this.lightDismissKeyboard);
    // Remove the dialog listener; the trigger listener remains available for the next hover preview.
    dialog.removeEventListener('pointerleave', this.#handlePointerLeave);
    // we need to use a data-attribute to keep transition-behavior working only when open
    const animations = dialog.getAnimations({ subtree: true });
    await Promise.allSettled(animations.map((a) => a.finished));
    if (!dialog.open) {
      delete dialog.dataset.showing;
      delete dialog.dataset.closing;
      delete dialog.dataset.placement;
    }
  };

  /**
   * Light dismiss the dialog.
   * @param {MouseEvent} event - The event.
   * @returns {void}
   */
  lightDismissMouse = (event) => {
    const { dialog } = this.refs;
    if (isClickedOutside(event, dialog)) {
      this.closeDialog();
    }
  };

  /**
   * Light dismiss the dialog.
   * @param {KeyboardEvent} event - The event.
   * @returns {void}
   */
  lightDismissKeyboard = (event) => {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    void this.closeDialog();
    this.refs.trigger.focus();
  };
}

// Register custom element
if (!customElements.get('product-hotspots')) {
  customElements.define('product-hotspots', ProductHotspots);
}

if (!customElements.get('product-hotspot-component')) {
  customElements.define('product-hotspot-component', ProductHotspotComponent);
}
