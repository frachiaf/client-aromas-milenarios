import { CartUpdateEvent, ThemeEvents } from '@theme/events';
import { fetchConfig } from '@theme/utilities';
import { sectionRenderer } from '@theme/section-renderer';

let mutationQueue = Promise.resolve();
let pending = 0;
let reconciliationScheduled = false;
let refreshRequested = false;
let draft = { From: '', To: '', Message: '' };
const roles = new Set(['wrapping', 'note']);
const service = (item) => roles.has(item.properties?._am_gift_service);
const modal = () => document.getElementById('AMGiftNoteModal');
const route = (url) => `${url.replace(/\.js$/, '')}.js`;

export const isCartMutationBusy = () => pending > 0;

function setBusy() {
  document.documentElement.toggleAttribute('data-am-cart-busy', pending > 0);
  for (const owner of document.querySelectorAll('cart-items-component')) {
    owner.setAttribute('aria-busy', String(pending > 0));
  }
  const fieldset = modal()?.querySelector('fieldset');
  if (fieldset) fieldset.disabled = pending > 0;
}

export function runCartMutation(task) {
  pending += 1;
  setBusy();
  const result = mutationQueue.then(task);
  mutationQueue = result.catch(() => {});
  return result.finally(() => {
    pending -= 1;
    setBusy();
  });
}

async function readCart() {
  const response = await fetch(route(Theme.routes.cart_url), {
    cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(modal()?.dataset.error);
  return response.json();
}

function sectionIds() {
  return [...new Set([...document.querySelectorAll('cart-items-component')].map((owner) => owner.dataset.sectionId).filter(Boolean))].slice(0, 5);
}

async function writeCart(url, payload) {
  const response = await fetch(route(url), {
    ...fetchConfig('json', { body: JSON.stringify({ ...payload, sections: sectionIds(), sections_url: location.pathname }) }),
    credentials: 'same-origin', signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || result.errors) {
    const error = new Error(typeof result.errors === 'string' ? result.errors : result.description || modal()?.dataset.error);
    error.cartRejected = true;
    throw error;
  }
  return result;
}

function feedback(message, error = false) {
  for (const node of document.querySelectorAll('[data-am-cart-feedback]')) {
    node.hidden = !message;
    node.textContent = message || '';
    node.classList.toggle('am-cart-error', error);
    node.setAttribute('role', error ? 'alert' : 'status');
  }
}

async function publish(cart, sections) {
  const owners = [...document.querySelectorAll('cart-items-component')];
  const accordions = owners.map((owner) => [owner.dataset.sectionId, owner.querySelector('[data-am-gift-accordion]')?.open]);
  const html = { ...sections };
  const url = new URL(location.href);
  url.searchParams.set('_am_cart', String(Date.now()));
  await Promise.all(sectionIds().map(async (id) => {
    if (!html[id]) html[id] = await sectionRenderer.getSectionHTML(id, false, url);
  }));
  document.dispatchEvent(new CartUpdateEvent(cart, 'am-cart-gifts', {
    source: 'am-cart-gifts', sections: html, itemCount: cart.item_count,
  }));
  for (const [id, open] of accordions) {
    const owner = [...document.querySelectorAll('cart-items-component')].find((element) => element.dataset.sectionId === id);
    const details = owner?.querySelector('[data-am-gift-accordion]');
    if (details && open !== undefined) details.open = open;
  }
  setBusy();
}

function corrections(cart) {
  const updates = {};
  const hasProducts = cart.items.some((item) => !service(item));
  const found = new Set();
  for (const item of cart.items.filter(service)) {
    const role = item.properties._am_gift_service;
    if (!hasProducts || found.has(role)) updates[item.key] = 0;
    else if (item.quantity !== 1) updates[item.key] = 1;
    found.add(role);
  }
  return updates;
}

async function normalizeCart(cart) {
  const updates = corrections(cart);
  return Object.keys(updates).length ? writeCart(Theme.routes.cart_update_url, { updates }) : cart;
}

async function recover(error, expected) {
  try {
    const cart = await normalizeCart(await readCart());
    await publish(cart);
    document.documentElement.removeAttribute('data-am-cart-unverified');
    if (expected?.(cart)) {
      feedback(modal()?.dataset.success);
      const errorNode = modal()?.querySelector('[data-am-gift-modal-error]');
      if (errorNode) errorNode.hidden = true;
      return true;
    }
  } catch {
    document.documentElement.setAttribute('data-am-cart-unverified', '');
  }
  const message = error.cartRejected ? error.message : modal()?.dataset.error;
  feedback(message, true);
  const errorNode = modal()?.querySelector('[data-am-gift-modal-error]');
  if (errorNode) {
    errorNode.hidden = false;
    errorNode.textContent = message;
  }
  return false;
}

async function updateService(role, enabled, values) {
  document.documentElement.setAttribute('data-am-gift-loading', role);
  try {
    await runCartMutation(async () => {
      feedback('');
      const cart = await readCart();
      const lines = cart.items.filter((item) => item.properties?._am_gift_service === role);
      if (role === 'note' && !enabled && lines[0]) draft = noteValues(lines[0].properties);
      let response = cart;
      if (!enabled) {
        if (lines.length) response = await writeCart(Theme.routes.cart_update_url, { updates: Object.fromEntries(lines.map((item) => [item.key, 0])) });
      } else {
        if (!cart.items.some((item) => !service(item))) throw new Error(modal()?.dataset.error);
        const properties = { ...lines[0]?.properties, _am_gift_service: role, ...values };
        if (lines[0]) {
          response = await writeCart(Theme.routes.cart_change_url, { id: lines[0].key, quantity: 1, properties });
        } else {
          const id = Number(role === 'wrapping' ? modal()?.dataset.wrappingId : modal()?.dataset.noteId);
          if (!id) throw new Error(modal()?.dataset.error);
          response = await writeCart(Theme.routes.cart_add_url, { items: [{ id, quantity: 1, properties }] });
        }
      }
      const updated = await normalizeCart(response.items && response.item_count !== undefined ? response : await readCart());
      await publish(updated, updated.sections || response.sections);
      document.documentElement.removeAttribute('data-am-cart-unverified');
      feedback(modal()?.dataset.success);
    });
    return true;
  } catch (error) {
    return await runCartMutation(() => recover(error, (cart) => {
      const lines = cart.items.filter((item) => item.properties?._am_gift_service === role);
      if (!enabled) return lines.length === 0;
      return lines.length === 1 && lines[0].quantity === 1 && Object.entries(values || {}).every(([key, value]) => lines[0].properties[key] === value);
    }));
  } finally {
    document.documentElement.removeAttribute('data-am-gift-loading');
  }
}

export function removeGiftCartLine(owner, line) {
  if (!owner.querySelector('[data-am-gift-service="wrapping"], [data-am-gift-service="note"]')) return false;
  const key = owner.querySelectorAll('[ref="cartItemRows[]"]')[line - 1]?.dataset.key;
  if (!key) return false;
  void runCartMutation(async () => {
    const cart = await readCart();
    const removed = cart.items.find((item) => item.key === key);
    if (removed?.properties?._am_gift_service === 'note') draft = noteValues(removed.properties);
    const remaining = cart.items.filter((item) => item.key !== key && item.parent_relationship?.parent?.key !== key);
    const updates = { [key]: 0 };
    if (!remaining.some((item) => !service(item))) {
      for (const item of remaining.filter(service)) updates[item.key] = 0;
    }
    const updated = await writeCart(Theme.routes.cart_update_url, { updates });
    await publish(updated, updated.sections);
    document.documentElement.removeAttribute('data-am-cart-unverified');
    feedback(modal()?.dataset.success);
  }).catch((error) => runCartMutation(() => recover(error)));
  return true;
}

function scheduleReconciliation() {
  if (reconciliationScheduled) return;
  if (!refreshRequested && !document.documentElement.hasAttribute('data-am-cart-unverified') && !document.querySelector('[data-am-gift-service="wrapping"], [data-am-gift-service="note"]')) return;
  reconciliationScheduled = true;
  void runCartMutation(async () => {
    const cart = await readCart();
    const refresh = refreshRequested;
    refreshRequested = false;
    if (refresh || Object.keys(corrections(cart)).length || document.documentElement.hasAttribute('data-am-cart-unverified')) {
      const normalized = await normalizeCart(cart);
      await publish(normalized, normalized.sections);
    }
    document.documentElement.removeAttribute('data-am-cart-unverified');
  }).catch((error) => runCartMutation(() => recover(error))).finally(() => {
    reconciliationScheduled = false;
    if (refreshRequested) scheduleReconciliation();
  });
}

function noteValues(values = {}) {
  return Object.fromEntries(['From', 'To', 'Message'].map((key) => [key, String(values[key] || '')]));
}

class GiftNoteModal extends HTMLElement {
  #controller;
  #returnTarget;
  #returnId;
  #bodyStyle;
  #scrollY = 0;
  #ownsScroll = false;

  connectedCallback() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const options = { signal: this.#controller.signal };
    const dialog = this.querySelector('dialog');
    this.querySelector('form').addEventListener('submit', this.#save, options);
    this.addEventListener('input', this.#count, options);
    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-am-gift-close]')) this.close();
      if (event.target.closest('[data-am-gift-remove]')) void this.#remove();
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close();
      }
    }, options);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); this.close(); }, options);
    queueMicrotask(scheduleReconciliation);
  }

  disconnectedCallback() {
    this.close();
    this.#controller?.abort();
  }

  async open(trigger) {
    if (isCartMutationBusy() || this.querySelector('dialog').open) return;
    this.#returnTarget = trigger;
    this.#returnId = trigger.id;
    try {
      await runCartMutation(async () => {
        const cart = await readCart();
        const line = cart.items.find((item) => item.properties?._am_gift_service === 'note');
        const values = line ? noteValues(line.properties) : draft;
        for (const [name, value] of Object.entries(values)) this.querySelector(`[name="${name}"]`).value = value;
        this.querySelector('[data-am-gift-remove]').hidden = !line;
        this.querySelector('[data-am-gift-modal-error]').hidden = true;
        const price = document.querySelector('[data-am-gift-toggle="note"]')?.closest('label')?.querySelector('.am-cart-gifts__price');
        if (price) this.querySelector('.am-gift-modal__price').textContent = price.textContent.replace(/^\+/, '');
        this.#count();
        this.#ownsScroll = !document.querySelector('dialog[open]');
        if (this.#ownsScroll) {
          this.#scrollY = window.scrollY;
          this.#bodyStyle = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
          Object.assign(document.body.style, { position: 'fixed', top: `-${this.#scrollY}px`, width: '100%' });
        }
        trigger.closest('cart-drawer-component')?.addEventListener('dialog:close', this.close, { once: true, signal: this.#controller.signal });
        this.querySelector('dialog').showModal();
      });
      this.querySelector('[name="Message"]').focus();
    } catch (error) {
      feedback(this.dataset.error, true);
    }
  }

  close = () => {
    const dialog = this.querySelector('dialog');
    if (!dialog?.open) return;
    draft = this.#values();
    dialog.close();
    if (this.#ownsScroll) {
      Object.assign(document.body.style, this.#bodyStyle);
      window.scrollTo({ top: this.#scrollY, behavior: 'instant' });
      this.#ownsScroll = false;
    }
    const target = this.#returnTarget?.isConnected ? this.#returnTarget : document.getElementById(this.#returnId) || document.querySelector('[data-am-gift-toggle="note"], .cart-drawer__close-button');
    target?.focus({ preventScroll: true });
  };

  #values() {
    return Object.fromEntries(['From', 'To', 'Message'].map((name) => [name, this.querySelector(`[name="${name}"]`).value]));
  }

  #count = () => {
    const textarea = this.querySelector('[name="Message"]');
    textarea.setCustomValidity('');
    this.querySelector('#AMGiftCount').textContent = `${textarea.value.length} / 400`;
  };

  #save = async (event) => {
    event.preventDefault();
    if (isCartMutationBusy()) return;
    const values = this.#values();
    const textarea = this.querySelector('[name="Message"]');
    textarea.setCustomValidity(values.Message.trim() && values.Message.length <= 400 ? '' : this.dataset.error);
    if (!this.querySelector('form').reportValidity()) return;
    draft = values;
    if (await updateService('note', true, values)) this.close();
  };

  #remove = async () => {
    if (isCartMutationBusy()) return;
    draft = this.#values();
    if (await updateService('note', false)) this.close();
  };
}

if (!customElements.get('am-gift-note-modal')) customElements.define('am-gift-note-modal', GiftNoteModal);

document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches('[data-am-gift-toggle]')) return;
  const role = input.dataset.amGiftToggle;
  const enabled = input.checked;
  input.checked = !enabled;
  if (isCartMutationBusy()) return;
  if (role === 'note' && enabled) void modal()?.open(input);
  else void updateService(role, enabled);
});

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const edit = event.target.closest('[data-am-gift-edit]');
  if (edit) void modal()?.open(edit);
});

for (const type of ['click', 'change', 'submit', 'keydown']) {
  document.addEventListener(type, (event) => {
    if (type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    if (!(event.target instanceof Element)) return;
    const blocked = isCartMutationBusy() && event.target.closest('.cart-form, .cart__ctas, am-cart-gifts');
    const unverified = document.documentElement.hasAttribute('data-am-cart-unverified') && event.target.closest('.cart__ctas');
    if (blocked || unverified) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (unverified) scheduleReconciliation();
    }
  }, true);
}

function handleExternalCartUpdate(event) {
  const source = event.detail?.data?.source;
  if (source === 'am-cart-gifts') return;
  if (isCartMutationBusy() && source !== 'cart-items-component' && modal()) refreshRequested = true;
  queueMicrotask(scheduleReconciliation);
}

document.addEventListener(ThemeEvents.cartUpdate, handleExternalCartUpdate);
document.addEventListener(ThemeEvents.discountUpdate, handleExternalCartUpdate);

document.addEventListener('shopify:section:load', scheduleReconciliation);
