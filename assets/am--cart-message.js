import { prefersReducedMotion } from '@theme/utilities';

class GiftMessage extends HTMLElement {
  static observedAttributes = ['data-message', 'data-more', 'data-less'];

  /** @type {HTMLElement | null} */
  #viewport = null;
  /** @type {HTMLElement | null} */
  #content = null;
  /** @type {HTMLElement | null} */
  #text = null;
  /** @type {HTMLElement | null} */
  #label = null;
  /** @type {HTMLButtonElement | null} */
  #button = null;
  /** @type {AbortController | null} */
  #controller = null;
  /** @type {Animation | null} */
  #animation = null;
  /** @type {number | null} */
  #frame = null;
  /** @type {string | null} */
  #message = null;
  #expanded = false;
  #overflow = false;
  #fullHeight = 0;
  #collapsedHeight = 0;
  #width = -1;
  #motion = matchMedia('(prefers-reduced-motion: reduce)');
  #resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0;
    if (Math.abs(width - this.#width) < 0.5) return;
    this.#width = width;
    this.#scheduleMeasure();
  });

  connectedCallback() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#viewport = this.querySelector('[data-am-message-viewport]');
    this.#content = this.querySelector('[data-am-message-content]');
    this.#text = this.querySelector('[data-am-message-text]');
    this.#label = this.querySelector('[data-am-message-label]');
    this.#button = this.querySelector('[data-am-message-toggle]');
    if (!this.#viewport || !this.#content || !this.#text || !this.#label || !this.#button) return;

    this.#button.addEventListener('click', this.#toggle, { signal });
    this.#motion.addEventListener('change', this.#handleMotion, { signal });
    document.fonts?.addEventListener('loadingdone', this.#scheduleMeasure, { signal });
    document.fonts?.ready.then(() => {
      if (!signal.aborted) this.#scheduleMeasure();
    });
    this.#resizeObserver.observe(this);
    this.#scheduleMeasure();
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#resizeObserver.disconnect();
    this.#cancelAnimation();
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }

  /** @param {string} _name @param {string | null} previous @param {string | null} next */
  attributeChangedCallback(_name, previous, next) {
    if (previous !== next) this.#scheduleMeasure();
  }

  #scheduleMeasure = () => {
    if (!this.isConnected || this.#frame !== null) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#measure();
    });
  };

  #measure() {
    if (!this.#viewport || !this.#content || !this.#text || !this.#button || this.#viewport.clientWidth === 0) return;
    const message = this.dataset.message || '';
    const messageChanged = message !== this.#message;
    const animation = this.#animation;
    const height = this.#viewport.getBoundingClientRect().height;
    const remaining = animation ? Math.max(0, Number(animation.effect?.getTiming().duration) - Number(animation.currentTime)) : 0;
    if (messageChanged) {
      this.#expanded = false;
      this.#message = message;
      this.#text.textContent = message;
    }

    const probe = /** @type {HTMLElement} */ (this.#content.cloneNode(true));
    const text = /** @type {HTMLElement} */ (probe.querySelector('[data-am-message-text]'));
    const button = /** @type {HTMLButtonElement} */ (probe.querySelector('[data-am-message-toggle]'));
    const label = /** @type {HTMLElement} */ (probe.querySelector('[data-am-message-label]'));
    probe.setAttribute('aria-hidden', 'true');
    probe.inert = true;
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${this.#viewport.clientWidth}px;`;
    // Detect overflow using the entire line before reserving space for the inline control.
    button.hidden = true;
    probe.classList.add('is-collapsed');
    this.append(probe);
    const lineHeight = probe.getBoundingClientRect().height;
    const horizontalOverflow = text.scrollWidth > text.clientWidth + 1;
    probe.classList.remove('is-collapsed');
    this.#overflow = horizontalOverflow || probe.getBoundingClientRect().height > lineHeight + 1;

    button.hidden = !this.#overflow;
    button.setAttribute('aria-expanded', 'false');
    label.textContent = this.dataset.more || '';
    probe.classList.add('is-collapsed');
    this.#collapsedHeight = probe.getBoundingClientRect().height;
    probe.classList.remove('is-collapsed');
    button.setAttribute('aria-expanded', 'true');
    label.textContent = this.dataset.less || '';
    this.#fullHeight = probe.getBoundingClientRect().height;
    probe.remove();

    if (!this.#overflow) this.#expanded = false;
    this.#cancelAnimation();
    // A newly visible scrollbar can change the width during expansion. Retarget without jumping.
    if (animation && !messageChanged && this.#overflow && remaining > 0 && !prefersReducedMotion()) {
      this.#animateHeight(height, this.#expanded ? this.#fullHeight : this.#collapsedHeight, remaining);
    } else {
      this.#settle();
    }
  }

  #toggle = () => {
    if (!this.#overflow || !this.#viewport || !this.#content) return;
    const height = this.#viewport.getBoundingClientRect().height;
    this.#cancelAnimation();
    this.#expanded = !this.#expanded;
    this.#content.classList.remove('is-collapsed');
    const target = this.#expanded ? this.#fullHeight : this.#collapsedHeight;
    this.#viewport.style.height = `${target}px`;
    this.#updateButton();

    if (prefersReducedMotion()) {
      this.#settle();
      return;
    }

    this.#animateHeight(height, target, 250);
  };

  /** @param {number} height @param {number} target @param {number} duration */
  #animateHeight(height, target, duration) {
    if (!this.#viewport || !this.#content) return;
    this.#content.classList.remove('is-collapsed');
    this.#viewport.style.height = `${target}px`;
    this.#viewport.classList.add('is-animating');
    const animation = this.#viewport.animate([{ height: `${height}px` }, { height: `${target}px` }], {
      duration,
      easing: 'ease-in-out',
    });
    this.#animation = animation;
    animation.onfinish = () => {
      if (this.#animation !== animation) return;
      this.#animation = null;
      this.#settle();
    };
  }

  #updateButton() {
    if (!this.#button || !this.#label) return;
    this.#button.setAttribute('aria-expanded', String(this.#expanded));
    this.#label.textContent = (this.#expanded ? this.dataset.less : this.dataset.more) || '';
    if (!this.#overflow && document.activeElement === this.#button && this.#viewport) {
      this.#viewport.tabIndex = -1;
      this.#viewport.focus({ preventScroll: true });
    }
    this.#button.hidden = !this.#overflow;
  }

  #settle() {
    if (!this.#viewport || !this.#content) return;
    this.#viewport.classList.remove('is-animating');
    this.#content.classList.toggle('is-collapsed', !this.#expanded);
    this.#viewport.style.height = this.#expanded ? 'auto' : `${this.#collapsedHeight}px`;
    this.#updateButton();
  }

  #cancelAnimation() {
    this.#animation?.cancel();
    this.#animation = null;
    this.#viewport?.classList.remove('is-animating');
  }

  #handleMotion = () => {
    if (!this.#motion.matches) return;
    this.#cancelAnimation();
    this.#settle();
  };
}

if (!customElements.get('am-gift-message')) customElements.define('am-gift-message', GiftMessage);
