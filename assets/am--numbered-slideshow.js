(() => {
  if (customElements.get('am-numbered-slideshow')) return;

  class AmNumberedSlideshow extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.abortController = new AbortController();
      this.slides = [...this.querySelectorAll('[data-am-slide]')];
      this.controls = [...this.querySelectorAll('[data-am-control]')];
      this.captions = [...this.querySelectorAll('[data-am-caption]')];
      this.progress = this.querySelector('[data-am-progress]');
      this.currentIndex = Math.max(0, this.slides.findIndex((slide) => slide.classList.contains('am--is-active')));
      this.autoplay = this.dataset.amAutoplay === 'true' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.loop = this.dataset.amLoop === 'true';
      this.interval = Math.max(1000, Number(this.dataset.amInterval) || 8000);

      this.controls.forEach((control, index) => {
        control.addEventListener('click', () => this.goTo(index, true), { signal: this.abortController.signal });
        control.addEventListener('keydown', (event) => this.onControlKeydown(event, index), { signal: this.abortController.signal });
      });

      this.addEventListener('mouseenter', () => this.pause(), { signal: this.abortController.signal });
      this.addEventListener('mouseleave', () => this.play(), { signal: this.abortController.signal });
      this.addEventListener('focusin', () => this.pause(), { signal: this.abortController.signal });
      this.addEventListener('focusout', (event) => {
        if (!this.contains(event.relatedTarget)) this.play();
      }, { signal: this.abortController.signal });
      document.addEventListener('visibilitychange', () => document.hidden ? this.pause() : this.play(), {
        signal: this.abortController.signal,
      });

      this.observeIllustrations();
      this.goTo(this.currentIndex, false);
      this.play();
    }

    disconnectedCallback() {
      this.pause();
      this.observer?.disconnect();
      this.abortController?.abort();
      this.initialized = false;
    }

    goTo(index, userInitiated = false) {
      if (!this.slides.length) return;
      const boundedIndex = Math.min(Math.max(index, 0), this.slides.length - 1);
      this.currentIndex = boundedIndex;

      this.slides.forEach((slide, slideIndex) => {
        const active = slideIndex === boundedIndex;
        slide.classList.toggle('am--is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
        slide.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
          if (active) {
            if (element.hasAttribute('data-am-previous-tabindex')) {
              const previous = element.getAttribute('data-am-previous-tabindex');
              previous ? element.setAttribute('tabindex', previous) : element.removeAttribute('tabindex');
              element.removeAttribute('data-am-previous-tabindex');
            }
          } else if (!element.hasAttribute('data-am-previous-tabindex')) {
            element.setAttribute('data-am-previous-tabindex', element.getAttribute('tabindex') || '');
            element.setAttribute('tabindex', '-1');
          }
        });
      });

      this.controls.forEach((control, controlIndex) => {
        const active = controlIndex === boundedIndex;
        control.classList.toggle('am--is-active', active);
        control.setAttribute('aria-selected', String(active));
        control.setAttribute('tabindex', active ? '0' : '-1');
      });

      this.captions.forEach((caption, captionIndex) => {
        const active = captionIndex === boundedIndex;
        caption.classList.toggle('am--is-active', active);
        caption.setAttribute('aria-hidden', String(!active));
      });

      this.restartProgress();
      if (userInitiated) {
        this.pause();
        this.play();
      }
    }

    next() {
      const nextIndex = this.currentIndex + 1;
      if (nextIndex < this.slides.length) {
        this.goTo(nextIndex);
      } else if (this.loop) {
        this.goTo(0);
      } else {
        this.pause();
      }
    }

    play() {
      if (!this.autoplay || this.slides.length < 2 || document.hidden) return;
      this.pause(false);
      this.restartProgress();
      this.timer = window.setInterval(() => this.next(), this.interval);
    }

    pause(resetProgress = true) {
      window.clearInterval(this.timer);
      this.timer = null;
      if (resetProgress && this.progress) {
        this.progress.style.transition = 'none';
        this.progress.style.width = '0%';
      }
    }

    restartProgress() {
      if (!this.progress) return;
      this.progress.style.transition = 'none';
      this.progress.style.width = '0%';
      if (!this.autoplay) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.progress.style.transition = `width ${this.interval}ms linear`;
        this.progress.style.width = '100%';
      }));
    }

    onControlKeydown(event, index) {
      let targetIndex = null;
      if (event.key === 'ArrowRight') targetIndex = (index + 1) % this.controls.length;
      if (event.key === 'ArrowLeft') targetIndex = (index - 1 + this.controls.length) % this.controls.length;
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = this.controls.length - 1;
      if (targetIndex === null) return;
      event.preventDefault();
      this.goTo(targetIndex, true);
      this.controls[targetIndex]?.focus();
    }

    observeIllustrations() {
      const illustrations = [...this.querySelectorAll('[data-am-illustration]')];
      if (!illustrations.length) return;
      if (!('IntersectionObserver' in window)) {
        illustrations.forEach((item) => item.classList.add('am--is-visible'));
        return;
      }
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          illustrations.forEach((item) => item.classList.toggle('am--is-visible', entry.isIntersecting));
        });
      }, { rootMargin: '250px 0px' });
      this.observer.observe(this);
    }
  }

  customElements.define('am-numbered-slideshow', AmNumberedSlideshow);
})();
