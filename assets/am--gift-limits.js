const isService = (item) => ['wrapping', 'note'].includes(item?.properties?._am_gift_service);

export function giftServiceConfig(root = document) {
  const node = root.querySelector?.('[data-am-gift-service-config]');
  if (!node) return { max: 1, blockDirect: false, products: [] };
  try {
    const config = JSON.parse(node.textContent);
    return {
      max: config.max,
      blockDirect: Boolean(config.blockDirect),
      products: Array.isArray(config.products) ? config.products : [],
    };
  } catch {
    return { max: 1, blockDirect: false, products: [] };
  }
}

export function isBlockedGiftProduct(id, config = giftServiceConfig()) {
  if (!config.blockDirect || id == null || id === '') return false;
  return (config.products || []).some((product) => String(product?.id) === String(id));
}

function maximum(value) {
  const max = Number(value);
  return Number.isInteger(max) && max > 0 ? max : 1;
}

function productIds(config) {
  return new Set((config?.products || []).map((product) => String(product?.id ?? '')).filter(Boolean));
}

function reduceLine(item, floor, state, updates) {
  if (state.total <= state.max) return;
  const next = Math.min(state.max, Math.max(floor, item.quantity - (state.total - state.max)));
  if (next !== item.quantity) updates[item.key] = next;
  state.total -= item.quantity - next;
}

/**
 * @param {object} cart
 * @param {{ max?: number, products?: Array<{ id: number | string }> }} config
 * @param {boolean} hasNormalProduct
 */
export function giftQuantityCorrections(cart, config = { max: 1, products: [] }, hasNormalProduct = false) {
  const max = maximum(config?.max);
  const ids = productIds(config);
  const updates = {};
  const found = new Set();
  for (const item of (cart?.items || []).filter(isService)) {
    const role = item.properties._am_gift_service;
    if (!hasNormalProduct || found.has(role)) updates[item.key] = 0;
    else if (!ids.has(String(item.product_id)) && item.quantity !== 1) updates[item.key] = 1;
    found.add(role);
  }
  for (const id of ids) {
    const lines = (cart?.items || []).filter((item) => String(item.product_id) === id && updates[item.key] !== 0);
    const state = { total: lines.reduce((sum, item) => sum + item.quantity, 0), max };
    if (state.total <= max) continue;
    const loose = lines.filter((item) => !isService(item));
    const services = lines.filter(isService);
    for (let index = loose.length - 1; index >= 0; index -= 1) reduceLine(loose[index], 0, state, updates);
    for (let index = services.length - 1; index >= 0; index -= 1) {
      const remaining = services.some((candidate, candidateIndex) => {
        return candidateIndex !== index && (updates[candidate.key] ?? candidate.quantity) > 0;
      });
      reduceLine(services[index], remaining ? 0 : 1, state, updates);
    }
  }
  return updates;
}
