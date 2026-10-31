const service = (item) => ['wrapping', 'note'].includes(item.properties?._am_gift_service);

export function tierGiftConfig(root = document) {
  const node = root.querySelector('[data-am-tier-gift-config]');
  if (!node) return { tiers: [] };
  try { return JSON.parse(node.textContent); } catch { return { tiers: [] }; }
}

export function hasTierGifts() {
  const config = tierGiftConfig();
  return config.tiers.some((tier) => tier.productId) || config.hasLines || Boolean(document.querySelector('[data-am-tier-gift]'));
}

export function isReservedProduct(id, config = tierGiftConfig()) {
  return Boolean(id) && config.tiers.some((tier) => String(tier.productId) === String(id));
}

export function isTierGift(item, config = tierGiftConfig()) {
  return item.properties?._am_tier_gift !== undefined || isReservedProduct(item.product_id, config);
}

export function isNormalCartProduct(item, config = tierGiftConfig()) {
  return !service(item) && !isTierGift(item, config);
}

export function desiredTierGifts(cart, config = tierGiftConfig()) {
  const currency = typeof cart.currency === 'string' ? cart.currency : cart.currency?.iso_code;
  if (!config.enabled || !config.valid || currency !== config.currency || !cart.items.some((item) => isNormalCartProduct(item, config))) return [];
  return config.tiers.filter((tier) => tier.enabled && tier.productId && tier.usable && cart.total_price >= tier.threshold);
}

export function tierGiftCorrections(cart, config = tierGiftConfig(), excluded = new Set()) {
  const desired = desiredTierGifts(cart, config).filter((tier) => !excluded.has(tier.slot));
  const kept = new Set();
  const updates = {};
  for (const item of cart.items.filter((line) => isTierGift(line, config))) {
    const tier = desired.find((candidate) => candidate.slot === item.properties?._am_tier_gift && String(candidate.variantId) === String(item.variant_id));
    if (!tier || kept.has(tier.slot) || item.original_price !== 0 || item.selling_plan_allocation || service(item)) updates[item.key] = 0;
    else {
      kept.add(tier.slot);
      if (item.quantity !== 1) updates[item.key] = 1;
    }
  }
  return { updates, missing: desired.filter((tier) => !kept.has(tier.slot)) };
}

async function liveGift(tier) {
  const url = new URL(tier.url, location.origin);
  url.pathname = `${url.pathname.replace(/\.js$/, '')}.js`;
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
  if (!response.ok) return false;
  const product = await response.json();
  const variant = product.variants?.[0];
  return String(product.id) === String(tier.productId) && product.variants.length === 1 &&
    String(variant?.id) === String(tier.variantId) && variant.available && variant.price === 0 &&
    (variant.quantity_rule?.min ?? 1) <= 1 && (variant.quantity_rule?.increment ?? 1) <= 1;
}

export async function reconcileTierGifts(cart, { read, write, unavailable }) {
  const config = tierGiftConfig();
  const excluded = new Set();
  const attempted = new Set();
  for (let pass = 0; pass < 8; pass++) {
    const correction = tierGiftCorrections(cart, config, excluded);
    if (Object.keys(correction.updates).length) {
      cart = await write(Theme.routes.cart_update_url, { updates: correction.updates });
      continue;
    }
    const tier = correction.missing[0];
    if (!tier) return cart;
    if (attempted.has(tier.slot)) {
      excluded.add(tier.slot);
      unavailable(config.unavailable);
      continue;
    }
    attempted.add(tier.slot);
    let available = false;
    try { available = await liveGift(tier); } catch {}
    if (!available) {
      excluded.add(tier.slot);
      unavailable(config.unavailable);
      continue;
    }
    try {
      await write(Theme.routes.cart_add_url, { items: [{ id: tier.variantId, quantity: 1, properties: { _am_tier_gift: tier.slot } }] });
      cart = await read();
    } catch {
      cart = await read();
      const added = cart.items.some((item) => item.properties?._am_tier_gift === tier.slot && String(item.variant_id) === String(tier.variantId) && item.quantity === 1 && item.original_price === 0);
      if (!added) {
        excluded.add(tier.slot);
        unavailable(config.unavailable);
      }
    }
  }
  const cleanup = tierGiftCorrections(cart, config, new Set(config.tiers.map((tier) => tier.slot))).updates;
  if (Object.keys(cleanup).length) cart = await write(Theme.routes.cart_update_url, { updates: cleanup });
  unavailable(config.unavailable);
  return cart;
}
