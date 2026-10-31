import { Component } from '@theme/component';
import { ThemeEvents, VariantUpdateEvent, ZoomMediaSelectedEvent, SlideshowSelectEvent } from '@theme/events';

/** @param {Element} gallery */
export function prepareQuickBuyGallery(gallery) {
  const slideshow = gallery.querySelector('slideshow-component');
  if (!slideshow || gallery.hasAttribute('data-am-quick-buy-gallery')) return;

  const template = gallery.querySelector('template[data-am-quick-buy-thumbnails]');
  gallery.setAttribute('data-am-quick-buy-gallery', '');
  gallery.setAttribute('data-presentation', 'carousel');
  gallery.classList.remove('media-gallery--grid', 'media-gallery--hint');
  gallery.classList.add('media-gallery--carousel');
  gallery.querySelector('.media-gallery__grid')?.remove();
  gallery.querySelector('zoom-dialog')?.remove();
  slideshow.querySelectorAll('slideshow-controls, slideshow-arrows').forEach((control) => control.remove());
  if (template instanceof HTMLTemplateElement) {
    slideshow.append(template.content.cloneNode(true));
    template.remove();
  }
  for (const slide of slideshow.querySelectorAll('slideshow-slide')) {
    slide.removeAttribute('on:click');
    slide.classList.remove('product-media-container--zoomable');
  }
}

/**
 * A custom element that renders a media gallery.
 *
 * @typedef {object} Refs
 * @property {import('./zoom-dialog').ZoomDialog} [zoomDialogComponent] - The zoom dialog component.
 * @property {import('./slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {HTMLElement[]} [media] - The media elements.
 *
 * @extends Component<Refs>
 */
export class MediaGallery extends Component {
  connectedCallback() {
    super.connectedCallback();

    this.#controller = new AbortController();
    const { signal } = this.#controller;
    const target = this.closest('.shopify-section, dialog');

    target?.addEventListener(ThemeEvents.variantUpdate, this.#handleVariantUpdate, { signal });
    this.refs.zoomDialogComponent?.addEventListener(ThemeEvents.zoomMediaSelected, this.#handleZoomMediaSelected, {
      signal,
    });
    this.addEventListener(SlideshowSelectEvent.eventName, this.#updateQuickBuyMedia, { signal });
    this.#updateQuickBuyMedia();
  }

  #controller = new AbortController();

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
  }

  /**
   * Handles a variant update event by replacing the current media gallery with a new one.
   *
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #handleVariantUpdate = (event) => {
    const source = event.detail.data.html;

    if (!source) return;
    const newMediaGallery = source.querySelector('media-gallery');

    if (!newMediaGallery) return;

    if (this.hasAttribute('data-am-quick-buy-gallery')) prepareQuickBuyGallery(newMediaGallery);
    this.replaceWith(newMediaGallery);
  };

  /** @param {SlideshowSelectEvent} [event] */
  #updateQuickBuyMedia = (event) => {
    if (!this.hasAttribute('data-am-quick-buy-gallery')) return;
    const activeSlide = event?.detail.slide || this.querySelector('slideshow-slide[aria-hidden="false"]');
    for (const slide of this.querySelectorAll('slideshow-slide')) {
      if (!(slide instanceof HTMLElement)) continue;
      slide.inert = slide !== activeSlide;
      if (!slide.inert) continue;
      for (const media of slide.querySelectorAll('deferred-media, product-model')) {
        if ('pauseMedia' in media && typeof media.pauseMedia === 'function') media.pauseMedia();
      }
    }
  };

  /**
   * Handles the 'zoom-media:selected' event.
   * @param {ZoomMediaSelectedEvent} event - The zoom-media:selected event.
   */
  #handleZoomMediaSelected = async (event) => {
    this.slideshow?.select(event.detail.index, undefined, { animate: false });
  };

  /**
   * Zooms the media gallery.
   *
   * @param {number} index - The index of the media to zoom.
   * @param {PointerEvent} event - The pointer event.
   */
  zoom(index, event) {
    this.refs.zoomDialogComponent?.open(index, event);
  }

  /**
   * Preloads an image.
   * @param {number} index - The index of the media to preload.
   */
  preloadImage(index) {
    const zoomDialogMedia = this.refs.zoomDialogComponent?.refs.media[index];
    if (!zoomDialogMedia) return;

    this.refs.zoomDialogComponent?.loadHighResolutionImage(zoomDialogMedia);
  }

  get slideshow() {
    return this.refs.slideshow;
  }

  get media() {
    return this.refs.media;
  }

  get presentation() {
    return this.dataset.presentation;
  }
}

if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', MediaGallery);
}
