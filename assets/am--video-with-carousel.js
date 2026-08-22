(() => {
  if (customElements.get('am-video-with-carousel')) return;

  class AmVideoWithCarousel extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.abortController = new AbortController();
      this.slides = [...this.querySelectorAll('[data-am-slide]')];
      this.currentIndex = Math.max(0, this.slides.findIndex((slide) => slide.classList.contains('am--is-active')));
      this.interval = Math.max(1000, Number(this.dataset.amInterval) || 5000);
      this.autoplayEnabled = this.dataset.amAutoplay !== 'false' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.userPaused = !this.autoplayEnabled;
      this.autoplayButton = this.querySelector('[data-am-carousel-toggle]');
      this.autoplayButton?.setAttribute('aria-pressed', String(this.userPaused));
      this.autoplayButton?.setAttribute('aria-label', this.userPaused ? 'Play carousel' : 'Pause carousel');

      this.querySelector('[data-am-previous]')?.addEventListener('click', () => this.move(-1), { signal: this.abortController.signal });
      this.querySelector('[data-am-next]')?.addEventListener('click', () => this.move(1), { signal: this.abortController.signal });
      this.autoplayButton?.addEventListener('click', () => this.toggleAutoplay(), { signal: this.abortController.signal });
      this.querySelector('[data-am-slides]')?.addEventListener('focusin', () => this.stopAutoplay(), { signal: this.abortController.signal });
      this.querySelector('[data-am-slides]')?.addEventListener('focusout', (event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !this.userPaused) this.startAutoplay();
      }, { signal: this.abortController.signal });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopAutoplay();
          this.pauseSlideVideos();
        } else {
          this.playActiveSlideVideo();
          if (!this.userPaused) this.startAutoplay();
        }
      }, { signal: this.abortController.signal });

      this.setupVideo();
      this.observeIllustrations();
      this.updateSlides();
      this.startAutoplay();
    }

    disconnectedCallback() {
      this.stopAutoplay();
      this.pauseSlideVideos(true);
      this.observer?.disconnect();
      this.abortController?.abort();
      this.initialized = false;
    }

    move(direction) {
      if (!this.slides.length) return;
      this.currentIndex = (this.currentIndex + direction + this.slides.length) % this.slides.length;
      this.updateSlides();
      if (!this.userPaused) this.startAutoplay();
    }

    updateSlides() {
      if (!this.slides.length) return;
      const total = this.slides.length;
      this.slides.forEach((slide, index) => {
        const active = index === this.currentIndex;
        slide.classList.remove('am--is-active', 'am--is-next', 'am--is-second-next', 'am--is-inactive');
        if (active) slide.classList.add('am--is-active');
        else if (index === (this.currentIndex + 1) % total) slide.classList.add('am--is-next');
        else if (index === (this.currentIndex + 2) % total) slide.classList.add('am--is-second-next');
        else slide.classList.add('am--is-inactive');
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
      this.updateSlideVideos();
      this.restartProgress();
    }

    updateSlideVideos() {
      this.pauseSlideVideos(true);
      this.playActiveSlideVideo(true);
    }

    pauseSlideVideos(reset = false) {
      this.querySelectorAll('.am--video-with-carousel__slide-video').forEach((video) => {
        if (!(video instanceof HTMLVideoElement)) return;
        video.pause();
        if (reset) this.resetSlideVideo(video);
      });
    }

    playActiveSlideVideo(restart = false) {
      if (document.hidden) return;

      const slides = Array.isArray(this.slides) ? this.slides : [];
      const currentIndex = typeof this.currentIndex === 'number' ? this.currentIndex : 0;
      const activeSlide = slides[currentIndex];
      if (!(activeSlide instanceof HTMLElement)) return;
      const video = activeSlide?.querySelector('.am--video-with-carousel__slide-video');
      if (!(video instanceof HTMLVideoElement)) return;

      video.muted = true;
      if (restart) this.resetSlideVideo(video);

      const playPromise = video.play();
      if (!(playPromise instanceof Promise)) return;
      playPromise.then(() => {
        if (document.hidden || !activeSlide.classList.contains('am--is-active')) {
          video.pause();
          this.resetSlideVideo(video);
        }
      }).catch(() => {});
    }

    /** @param {HTMLVideoElement} video */
    resetSlideVideo(video) {
      try {
        video.currentTime = 0;
      } catch {
        // Some browsers do not allow seeking until video metadata is available.
      }
    }

    startAutoplay() {
      this.stopAutoplay();
      if (this.userPaused || this.slides.length < 2 || document.hidden || this.matches(':focus-within')) return;
      this.restartProgress();
      this.timer = window.setInterval(() => this.move(1), this.interval);
    }

    stopAutoplay() {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    toggleAutoplay() {
      this.userPaused = !this.userPaused;
      this.autoplayButton?.setAttribute('aria-pressed', String(this.userPaused));
      this.autoplayButton?.setAttribute('aria-label', this.userPaused ? 'Play carousel' : 'Pause carousel');
      if (this.userPaused) {
        this.stopAutoplay();
        this.resetProgress();
      } else {
        this.startAutoplay();
      }
    }

    resetProgress() {
      const progress = this.slides[this.currentIndex]?.querySelector('[data-am-progress]');
      if (!progress) return;
      progress.style.transition = 'none';
      progress.style.width = '0%';
    }

    restartProgress() {
      this.querySelectorAll('[data-am-progress]').forEach((progress) => {
        progress.style.transition = 'none';
        progress.style.width = '0%';
      });
      if (this.userPaused) return;
      const progress = this.slides[this.currentIndex]?.querySelector('[data-am-progress]');
      if (!progress) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        progress.style.transition = `width ${this.interval}ms linear`;
        progress.style.width = '100%';
      }));
    }

    setupVideo() {
      const video = this.querySelector('[data-am-video]');
      const playButton = this.querySelector('[data-am-video-play]');
      const muteButton = this.querySelector('[data-am-video-mute]');
      const progress = this.querySelector('[data-am-video-progress]');
      if (!video || !playButton || !muteButton || !progress) return;

      const updatePlayState = () => {
        playButton.setAttribute('aria-pressed', String(video.paused));
        playButton.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
      };
      const updateMuteState = () => {
        muteButton.setAttribute('aria-pressed', String(video.muted));
        muteButton.setAttribute('aria-label', video.muted ? 'Unmute video' : 'Mute video');
      };

      playButton.addEventListener('click', () => video.paused ? video.play() : video.pause(), { signal: this.abortController.signal });
      muteButton.addEventListener('click', () => { video.muted = !video.muted; updateMuteState(); }, { signal: this.abortController.signal });
      video.addEventListener('play', updatePlayState, { signal: this.abortController.signal });
      video.addEventListener('pause', updatePlayState, { signal: this.abortController.signal });
      video.addEventListener('volumechange', updateMuteState, { signal: this.abortController.signal });
      video.addEventListener('timeupdate', () => {
        progress.value = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      }, { signal: this.abortController.signal });
      progress.addEventListener('input', () => {
        if (!video.duration) return;
        video.currentTime = (Number(progress.value) / 100) * video.duration;
      }, { signal: this.abortController.signal });
      updatePlayState();
      updateMuteState();
    }

    observeIllustrations() {
      const illustrations = [...this.querySelectorAll('[data-am-illustration]')];
      if (!illustrations.length) return;
      if (!('IntersectionObserver' in window)) {
        illustrations.forEach((item) => item.classList.add('am--is-visible'));
        return;
      }
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => illustrations.forEach((item) => item.classList.toggle('am--is-visible', entry.isIntersecting)));
      }, { rootMargin: '250px 0px' });
      this.observer.observe(this);
    }
  }

  customElements.define('am-video-with-carousel', AmVideoWithCarousel);
})();
