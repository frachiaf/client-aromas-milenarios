import { Component } from '@theme/component';
import { debounce, isClickedOutside, onAnimationEnd } from '@theme/utilities';

const scrollLockOwners = new Set();
/** @type {{ y: number, width: string, position: string, top: string } | null} */
let scrollLockState = null;

/** @param {DialogComponent} owner */
function acquireScrollLock(owner) {
  if (scrollLockOwners.size === 0) {
    const { style } = document.body;
    scrollLockState = { y: window.scrollY, width: style.width, position: style.position, top: style.top };
    if (style.position !== 'fixed') {
      style.width = '100%';
      style.position = 'fixed';
      style.top = `-${scrollLockState.y}px`;
    }
  }
  scrollLockOwners.add(owner);
}

/** @param {DialogComponent} owner */
function releaseScrollLock(owner) {
  if (!scrollLockOwners.delete(owner) || scrollLockOwners.size > 0 || !scrollLockState) return;
  const state = scrollLockState;
  scrollLockState = null;
  document.body.style.width = state.width;
  document.body.style.position = state.position;
  document.body.style.top = state.top;
  if (state.position !== 'fixed') window.scrollTo({ top: state.y, behavior: 'instant' });
}

/**
 * A custom element that manages a dialog.
 *
 * @typedef {object} Refs
 * @property {HTMLDialogElement} dialog – The dialog element.
 *
 * @extends Component<Refs>
 */
export class DialogComponent extends Component {
  requiredRefs = ['dialog'];

  connectedCallback() {
    super.connectedCallback();

    const { dialog } = this.refs;
    if (dialog.open) {
      acquireScrollLock(this);
      if (!dialog.matches(':modal')) {
        dialog.close();
        dialog.showModal();
      }
    }

    if (this.minWidth || this.maxWidth) {
      window.addEventListener('resize', this.#handleResize);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (!this.isConnected) releaseScrollLock(this);
    });
    if (this.minWidth || this.maxWidth) {
      window.removeEventListener('resize', this.#handleResize);
    }
  }

  #handleResize = debounce(() => {
    const { minWidth, maxWidth } = this;

    if (!minWidth && !maxWidth) return;

    const windowWidth = window.innerWidth;
    if (windowWidth < minWidth || windowWidth > maxWidth) {
      this.closeDialog();
    }
  }, 50);

  /**
   * Shows the dialog.
   * @param {(() => boolean) | Event} [shouldOpen] - Optional guard, or a declarative trigger event.
   */
  showDialog(shouldOpen) {
    const { dialog } = this.refs;

    if (dialog.open) return;

    // Prevent layout thrashing by separating DOM reads from DOM writes
    requestAnimationFrame(() => {
      if (typeof shouldOpen === 'function' && !shouldOpen()) return;
      if (dialog.open || !this.isConnected || !dialog.isConnected || dialog !== this.refs.dialog) return;
      acquireScrollLock(this);

      try {
        dialog.showModal();
      } catch (error) {
        releaseScrollLock(this);
        throw error;
      }
      this.dispatchEvent(new DialogOpenEvent());

      this.addEventListener('click', this.#handleClick);
      this.addEventListener('keydown', this.#handleKeyDown);
    });
  }

  /**
   * Closes the dialog.
   */
  closeDialog = async () => {
    const { dialog } = this.refs;

    if (!dialog.open) return;

    this.removeEventListener('click', this.#handleClick);
    this.removeEventListener('keydown', this.#handleKeyDown);

    // Force browser to restart animation by resetting it
    // Temporarily remove any existing animation state
    dialog.style.animation = 'none';

    // Force a reflow
    void dialog.offsetWidth;

    // Now add the closing class and restore animation
    dialog.classList.add('dialog-closing');
    dialog.style.animation = '';

    await onAnimationEnd(dialog, undefined, {
      subtree: false,
    });

    dialog.close();
    releaseScrollLock(this);
    dialog.classList.remove('dialog-closing');

    this.dispatchEvent(new DialogCloseEvent());
  };

  /**
   * Toggles the dialog.
   */
  toggleDialog = () => {
    if (this.refs.dialog.open) {
      this.closeDialog();
    } else {
      this.showDialog();
    }
  };

  /**
   * Closes the dialog when the user clicks outside of it.
   *
   * @param {MouseEvent} event - The mouse event.
   */
  #handleClick(event) {
    const { dialog } = this.refs;

    if (isClickedOutside(event, dialog)) {
      this.closeDialog();
    }
  }

  /**
   * Closes the dialog when the user presses the escape key.
   *
   * @param {KeyboardEvent} event - The keyboard event.
   */
  #handleKeyDown(event) {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    this.closeDialog();
  }

  /**
   * Gets the minimum width of the dialog.
   *
   * @returns {number} The minimum width of the dialog.
   */
  get minWidth() {
    return Number(this.getAttribute('dialog-active-min-width'));
  }

  /**
   * Gets the maximum width of the dialog.
   *
   * @returns {number} The maximum width of the dialog.
   */
  get maxWidth() {
    return Number(this.getAttribute('dialog-active-max-width'));
  }
}

if (!customElements.get('dialog-component')) customElements.define('dialog-component', DialogComponent);

export class DialogOpenEvent extends CustomEvent {
  constructor() {
    super(DialogOpenEvent.eventName);
  }

  static eventName = 'dialog:open';
}

export class DialogCloseEvent extends CustomEvent {
  constructor() {
    super(DialogCloseEvent.eventName);
  }

  static eventName = 'dialog:close';
}

document.addEventListener(
  'toggle',
  (event) => {
    if (event.target instanceof HTMLDetailsElement) {
      if (event.target.hasAttribute('scroll-lock')) {
        const { open } = event.target;
        if (open) {
          document.documentElement.setAttribute('scroll-lock', '');
        } else {
          document.documentElement.removeAttribute('scroll-lock');
        }
      }
    }
  },
  { capture: true }
);
