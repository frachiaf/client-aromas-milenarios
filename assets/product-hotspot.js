import { Component } from '@theme/component';
import { QuickAddComponent } from '@theme/quick-add';
import { isClickedOutside, isMobileBreakpoint, isTouchDevice, mediaQueryLarge } from '@theme/utilities';

const mediaQueryFinePointer = matchMedia('(hover: hover) and (pointer: fine)');

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
  /** @type {HTMLImageElement | null} */
  #hoverImage = null;
  /** @type {ProductHotspotComponent | null} */
  #activeSource = null;
  /** @type {number | null} */
  #hoverImageAnimationFrame = null;

  connectedCallback() {
    const hoverImage = this.querySelector('[data-hotspot-hover-image]');
    this.#hoverImage = hoverImage instanceof HTMLImageElement ? hoverImage : null;
    this.addEventListener('product-hotspot-hover-image', this.#handleHoverImage);
    this.addEventListener('product-hotspot-reset-image', this.#handleResetImage);
  }

  disconnectedCallback() {
    this.removeEventListener('product-hotspot-hover-image', this.#handleHoverImage);
    this.removeEventListener('product-hotspot-reset-image', this.#handleResetImage);
    this.#cancelHoverImageAnimation();
    this.#activeSource = null;
    this.#hoverImage?.classList.remove('is-active');
    this.#hoverImage = null;
  }

  /** @param {Event} event */
  #handleHoverImage = (event) => {
    if (!(event instanceof CustomEvent)) return;

    const { source, url } = /** @type {HotspotHoverImageDetail} */ (event.detail);
    const hoverImage = this.#hoverImage;
    if (!(source instanceof ProductHotspotComponent) || !hoverImage || typeof url !== 'string' || !url) return;

    this.#activeSource = source;
    this.#cancelHoverImageAnimation();

    if (hoverImage.dataset.src === url) {
      hoverImage.classList.add('is-active');
      return;
    }

    hoverImage.classList.remove('is-active');
    hoverImage.src = url;
    hoverImage.dataset.src = url;
    this.#hoverImageAnimationFrame = requestAnimationFrame(() => {
      this.#hoverImageAnimationFrame = null;
      if (this.#activeSource !== source || this.#hoverImage !== hoverImage) return;
      hoverImage.classList.add('is-active');
    });
  };

  /** @param {Event} event */
  #handleResetImage = (event) => {
    if (!(event instanceof CustomEvent)) return;

    const { source } = /** @type {HotspotResetImageDetail} */ (event.detail);
    if (!(source instanceof ProductHotspotComponent)) return;

    this.resetHoverImage(source);
  };

  /** @param {ProductHotspotComponent} source */
  resetHoverImage(source) {
    if (source !== this.#activeSource) return;

    this.#cancelHoverImageAnimation();
    this.#activeSource = null;
    this.#hoverImage?.classList.remove('is-active');
  }

  #cancelHoverImageAnimation() {
    if (this.#hoverImageAnimationFrame === null) return;

    cancelAnimationFrame(this.#hoverImageAnimationFrame);
    this.#hoverImageAnimationFrame = null;
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
  #hoverImageEnterHandler = null;
  /** @type {(() => void) | null} */
  #hoverImageLeaveHandler = null;
  #quickAddRequestId = 0;
  /** @type {ResizeObserver | null} */
  #quickBuyLabelResizeObserver = null;
  /** @type {ProductHotspots | null} */
  #hotspotsRoot = null;

  connectedCallback() {
    super.connectedCallback();

    const hotspotsRoot = this.closest('product-hotspots');
    this.#hotspotsRoot = hotspotsRoot instanceof ProductHotspots ? hotspotsRoot : null;

    this.#measureQuickBuyLabel();
    requestAnimationFrame(this.#measureQuickBuyLabel);
    document.fonts?.ready?.then(this.#measureQuickBuyLabel);
    this.#observeQuickBuyLabel();

    // Set up initial event listeners based on current breakpoint
    this.#handleBreakpointChange();

    // Listen for breakpoint changes
    mediaQueryLarge.addEventListener('change', this.#handleBreakpointChange);
    mediaQueryFinePointer.addEventListener('change', this.#handleBreakpointChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#quickAddRequestId += 1;
    this.#hotspotsRoot?.resetHoverImage(this);
    this.#hotspotsRoot = null;

    // Clean up listeners
    this.#removeDesktopListeners();
    mediaQueryLarge.removeEventListener('change', this.#handleBreakpointChange);
    mediaQueryFinePointer.removeEventListener('change', this.#handleBreakpointChange);
    this.#quickBuyLabelResizeObserver?.disconnect();
    this.#quickBuyLabelResizeObserver = null;
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
      const pointerenterHandler = () => {
        if (dialog.open) return;
        this.showDialog();
        trigger.addEventListener('pointerleave', this.#handlePointerLeave);
      };

      this.#pointerenterHandler = pointerenterHandler;
      trigger.addEventListener('pointerenter', pointerenterHandler);
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
    }
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

    if (!isMobileBreakpoint() && !isTouchDevice() && this.desktopInteractionMode === 'click-preview') {
      this.showDialog();
      return;
    }

    if (this.refs.dialog.open) this.closeDialog();

    const requestId = ++this.#quickAddRequestId;
    const result = await this.#openQuickAddModal();
    if (requestId !== this.#quickAddRequestId || result === 'aborted') return;

    if (result === 'opened') return;

    this.showDialog();
  };

  showDialog = () => {
    const { dialog } = this.refs;
    if (dialog.open) return;
    this.#calculateDialogPlacement();
    dialog.dataset.showing = 'true';
    dialog.show();
    document.body.addEventListener('click', this.lightDismissMouse);
    document.body.addEventListener('keydown', this.lightDismissKeyboard);
    document.body.addEventListener('keyup', this.lightDismissKeyboard);
    // Add pointerleave listener to dialog when it opens
    dialog.addEventListener('pointerleave', this.#handlePointerLeave);
  };

  /**
   * Close the dialog.
   * @returns {Promise<void>}
   */
  closeDialog = async () => {
    const { dialog, trigger } = this.refs;
    if (!dialog.open) return;

    dialog.dataset.closing = 'true';
    dialog.close();
    document.body.removeEventListener('click', this.lightDismissMouse);
    document.body.removeEventListener('keydown', this.lightDismissKeyboard);
    document.body.removeEventListener('keyup', this.lightDismissKeyboard);
    // Remove pointerleave listeners when closing
    dialog.removeEventListener('pointerleave', this.#handlePointerLeave);
    trigger.removeEventListener('pointerleave', this.#handlePointerLeave);
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
    const { dialog } = this.refs;
    if (
      (event.type === 'keydown' && event.key === 'Escape') ||
      (event.type === 'keyup' && !dialog.matches(':is(:focus, :focus-visible, :focus-within)'))
    ) {
      this.closeDialog();
    }
  };
}

// Register custom element
if (!customElements.get('product-hotspots')) {
  customElements.define('product-hotspots', ProductHotspots);
}

if (!customElements.get('product-hotspot-component')) {
  customElements.define('product-hotspot-component', ProductHotspotComponent);
}
