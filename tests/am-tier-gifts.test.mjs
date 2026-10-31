import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let config;
globalThis.document = { querySelector: (selector) => selector === '[data-am-tier-gift-config]' ? { textContent: JSON.stringify(config) } : null };
globalThis.location = { origin: 'https://fixture.invalid' };
globalThis.Theme = { routes: { cart_add_url: '/cart/add.js', cart_update_url: '/cart/update.js' } };
const source = readFileSync(new URL('../assets/am--tier-gifts.js', import.meta.url), 'utf8');
const { desiredTierGifts, tierGiftCorrections, reconcileTierGifts, isReservedProduct, isNormalCartProduct } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const tier = (slot, productId = 20 + Number(slot)) => ({ slot, enabled: true, productId, variantId: productId, threshold: Number(slot) * 1000, url: '/products/' + productId, usable: true });
const reset = () => { config = { enabled: true, valid: true, currency: 'USD', unavailable: 'Unavailable gift', tiers: [tier('1'), tier('2'), tier('3')] }; };
const line = (key, id, quantity = 1, properties = {}, price = 0) => ({ key, product_id: id, variant_id: id, quantity, properties, original_price: price });
const normal = line('normal', 1, 1, {}, 4000);
const gift = (slot, quantity = 1) => line('gift-' + slot, 20 + Number(slot), quantity, { _am_tier_gift: slot });
const cart = (total = 4000, items = [normal], currency = 'USD') => ({ items, total_price: total, currency });
let checks = 0;
const check = (name, run) => { reset(); run(); checks++; console.log('PASS', name); };
check('tiers include their exact threshold and accumulate', () => {
  assert.deepEqual(desiredTierGifts(cart(999)), []);
  assert.deepEqual(desiredTierGifts(cart(1000)).map((t) => t.slot), ['1']);
  assert.deepEqual(desiredTierGifts(cart(3000)).map((t) => t.slot), ['1', '2', '3']);
});
check('currency formats match Liquid and Ajax', () => {
  assert.equal(desiredTierGifts(cart(4000, [normal], { iso_code: 'USD' })).length, 3);
  assert.equal(desiredTierGifts(cart(4000, [normal], 'EUR')).length, 0);
});
check('disabled or invalid configuration removes existing gifts', () => {
  config.enabled = false;
  assert.deepEqual(tierGiftCorrections(cart(4000, [normal, gift('1')])).updates, { 'gift-1': 0 });
  assert.equal(isReservedProduct(21), true);
  config.enabled = true; config.valid = false;
  assert.equal(desiredTierGifts(cart()).length, 0);
});
check('paid gift services do not qualify as normal products', () => {
  const wrapping = line('wrap', 10, 1, { _am_gift_service: 'wrapping' }, 4000);
  assert.equal(isNormalCartProduct(wrapping), false);
  assert.equal(desiredTierGifts(cart(4000, [wrapping, gift('1')])).length, 0);
  assert.equal(desiredTierGifts(cart(4000, [normal, wrapping])).length, 3);
});
check('ordinary free products are preserved', () => {
  const free = line('ordinary-free', 99);
  assert.equal(isNormalCartProduct(free), true);
  assert.deepEqual(tierGiftCorrections(cart(4000, [normal, free])).updates, {});
});
check('unmarked copies, duplicates, incorrect variants and selling plans are removed', () => {
  const wrong = { ...gift('2'), variant_id: 999 };
  const plan = { ...gift('3'), selling_plan_allocation: {} };
  const result = tierGiftCorrections(cart(4000, [normal, line('unmarked', 21), gift('1'), { ...gift('1'), key: 'duplicate' }, wrong, plan]));
  assert.deepEqual(result.updates, { unmarked: 0, duplicate: 0, 'gift-2': 0, 'gift-3': 0 });
  assert.deepEqual(result.missing.map((t) => t.slot), ['2', '3']);
});
check('quantity is fixed at one and a changed paid price is removed', () => {
  assert.deepEqual(tierGiftCorrections(cart(4000, [normal, gift('1', 8)])).updates, { 'gift-1': 1 });
  assert.deepEqual(tierGiftCorrections(cart(4000, [normal, { ...gift('1'), original_price: 500 }])).updates, { 'gift-1': 0 });
});
check('lower totals remove only lost tiers', () => {
  assert.deepEqual(tierGiftCorrections(cart(1000, [normal, gift('1'), gift('2'), gift('3')])).updates, { 'gift-2': 0, 'gift-3': 0 });
});
check('old picker selections and unknown tier marks are cleaned', () => {
  config.tiers[0].productId = 88; config.tiers[0].variantId = 88;
  assert.deepEqual(tierGiftCorrections(cart(4000, [normal, gift('1'), line('old', 77, 1, { _am_tier_gift: 'old' })])).updates, { 'gift-1': 0, old: 0 });
});
check('the same product can belong to independent tiers', () => {
  config.tiers[1] = { ...tier('2', 21) };
  const second = line('second', 21, 1, { _am_tier_gift: '2' });
  assert.deepEqual(tierGiftCorrections(cart(2000, [normal, gift('1'), second])), { updates: {}, missing: [] });
});

async function simulation({ initial = cart(), reject = new Set(), paid = new Set(), unavailable = new Set(), lost = false, oscillate = false, network = false } = {}) {
  let state = structuredClone(initial), writes = [], warnings = [], serial = 0;
  globalThis.fetch = async (url) => {
    if (network) throw new Error('Offline product check');
    const id = Number(new URL(url).pathname.split('/').pop().replace('.js', ''));
    return { ok: true, json: async () => ({ id, variants: [{ id, available: !unavailable.has(id), price: paid.has(id) ? 100 : 0 }] }) };
  };
  const read = async () => structuredClone(state);
  const write = async (url, payload) => {
    writes.push({ url, payload });
    if (payload.updates) {
      state.items = state.items.map((item) => ({ ...item, quantity: payload.updates[item.key] ?? item.quantity })).filter((item) => item.quantity > 0);
    } else for (const item of payload.items) {
      if (reject.has(item.properties._am_tier_gift)) throw new Error('Out of stock');
      state.items.push(line('added-' + ++serial, item.id, item.quantity, item.properties));
      if (lost) { lost = false; throw new Error('Response lost after write'); }
    }
    if (oscillate) state.total_price = state.items.some((item) => item.properties?._am_tier_gift) ? 0 : 4000;
    return read();
  };
  state = await reconcileTierGifts(state, { read, write, unavailable: (message) => warnings.push(message) });
  return { state, writes, warnings };
}
for (const [name, run] of [
  ['all tiers are added once in ascending order', async () => {
    const result = await simulation();
    assert.deepEqual(result.state.items.slice(1).map((item) => item.properties._am_tier_gift), ['1', '2', '3']);
    assert.equal(result.writes.length, 3);
  }],
  ['lost responses are verified before another add', async () => {
    const result = await simulation({ lost: true });
    assert.equal(result.writes.length, 3);
    assert.equal(result.state.items.length, 4);
  }],
  ['stock rejection skips one tier and retains other gifts', async () => {
    const result = await simulation({ reject: new Set(['2']) });
    assert.deepEqual(result.state.items.slice(1).map((item) => item.properties._am_tier_gift), ['1', '3']);
    assert.equal(result.warnings.length, 1);
  }],
  ['live price and availability checks prevent unsafe additions', async () => {
    const result = await simulation({ paid: new Set([21]), unavailable: new Set([22]) });
    assert.deepEqual(result.writes.map((entry) => entry.payload.items[0].id), [23]);
  }],
  ['product lookup failure leaves normal checkout possible', async () => {
    const result = await simulation({ network: true });
    assert.equal(result.writes.length, 0);
    assert.equal(result.state.items.length, 1);
    assert.equal(result.warnings.length, 3);
  }],
  ['gift-only carts are emptied', async () => {
    const result = await simulation({ initial: cart(4000, [gift('1'), gift('2')]) });
    assert.deepEqual(result.state.items, []);
  }],
  ['discount interactions stop instead of oscillating indefinitely', async () => {
    const result = await simulation({ oscillate: true });
    assert.ok(result.writes.length <= 9);
    assert.deepEqual(result.state.items, [normal]);
  }],
]) {
  reset(); await run(); checks++; console.log('PASS', name);
}
console.log(JSON.stringify({ checks }));
