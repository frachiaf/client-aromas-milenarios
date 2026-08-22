(() => {
  if (customElements.get('am-hover-explorer')) return;

  class AmHoverExplorer extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.abortController = new AbortController();
      this.desktopButtons = [...this.querySelectorAll('[data-am-desktop-button]')];
      this.mobileButtons = [...this.querySelectorAll('[data-am-mobile-button]')];
      this.desktopItems = [...this.querySelectorAll('[data-am-desktop-item]')];
      this.mediaItems = [...this.querySelectorAll('[data-am-media-item]')];
      this.contentItems = [...this.querySelectorAll('[data-am-content-item]')];
      this.mobileItems = [...this.querySelectorAll('[data-am-mobile-item]')];

      this.desktopButtons.forEach((button, index) => {
        button.addEventListener('mouseenter', () => this.setDesktopActive(index), { signal: this.abortController.signal });
        button.addEventListener('focus', () => this.setDesktopActive(index), { signal: this.abortController.signal });
      });

      this.mobileButtons.forEach((button, index) => {
        button.addEventListener('click', () => this.toggleMobile(index), { signal: this.abortController.signal });
      });

      window.addEventListener('resize', () => this.refreshMobileHeights(), {
        signal: this.abortController.signal,
        passive: true,
      });

      this.refreshMobileHeights();
    }

    disconnectedCallback() {
      this.abortController?.abort();
      this.initialized = false;
    }

    setDesktopActive(index) {
      this.desktopItems.forEach((item, itemIndex) => item.classList.toggle('am--is-active', itemIndex === index));
      this.desktopButtons.forEach((button, buttonIndex) => {
        const active = buttonIndex === index;
        button.classList.toggle('am--is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      this.mediaItems.forEach((item, itemIndex) => item.classList.toggle('am--is-active', itemIndex === index));
      this.contentItems.forEach((item, itemIndex) => {
        const active = itemIndex === index;
        item.classList.toggle('am--is-active', active);
        item.setAttribute('aria-hidden', String(!active));
      });
    }

    toggleMobile(index) {
      const button = this.mobileButtons[index];
      const item = this.mobileItems[index];
      const content = item?.querySelector('[data-am-mobile-content]');
      if (!button || !item || !content) return;

      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      content.setAttribute('aria-hidden', String(expanded));
      item.classList.toggle('am--is-active', !expanded);
      content.style.maxHeight = expanded ? '0px' : `${content.scrollHeight}px`;
    }

    refreshMobileHeights() {
      this.mobileItems.forEach((item) => {
        const content = item.querySelector('[data-am-mobile-content]');
        if (!content) return;
        content.style.maxHeight = item.classList.contains('am--is-active') ? `${content.scrollHeight}px` : '0px';
      });
    }
  }

  customElements.define('am-hover-explorer', AmHoverExplorer);
})();
