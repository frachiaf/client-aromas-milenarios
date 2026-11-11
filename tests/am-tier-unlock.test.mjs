import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { nextUnlockBenefit } from '../assets/am--tier-unlock.js';

const tiers = [
  { threshold: 10000, label: 'Envío' },
  { threshold: 20000, label: 'Muestra' },
];
let checks = 0;
const check = (name, actual, expected) => {
  assert.equal(actual, expected, name);
  checks += 1;
  console.log('PASS', name);
};

check('below the next tier stays hidden', nextUnlockBenefit({ cartTotal: 0, unitPrice: 5000, quantity: 1, tiers }), null);
check('an exact threshold unlocks it', nextUnlockBenefit({ cartTotal: 0, unitPrice: 10000, quantity: 1, tiers }), 'Envío');
check('quantity multiplies the variant price', nextUnlockBenefit({ cartTotal: 0, unitPrice: 5000, quantity: 2, tiers }), 'Envío');
check('a cart already on a tier looks at the following one', nextUnlockBenefit({ cartTotal: 10000, unitPrice: 5000, quantity: 1, tiers }), null);
check('reaching the following tier names that tier', nextUnlockBenefit({ cartTotal: 10000, unitPrice: 10000, quantity: 1, tiers }), 'Muestra');
check('jumping two tiers still names the next one', nextUnlockBenefit({ cartTotal: 0, unitPrice: 25000, quantity: 1, tiers }), 'Envío');
check('a completed bar stays hidden', nextUnlockBenefit({ cartTotal: 20000, unitPrice: 1000, quantity: 1, tiers }), null);
check('zero quantity stays hidden', nextUnlockBenefit({ cartTotal: 0, unitPrice: 10000, quantity: 0, tiers }), null);
check('a fractional quantity stays hidden', nextUnlockBenefit({ cartTotal: 0, unitPrice: 10000, quantity: 1.5, tiers }), null);
check('an empty tier list stays hidden', nextUnlockBenefit({ cartTotal: 0, unitPrice: 10000, quantity: 1, tiers: [] }), null);

console.log(`OK ${checks}`);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const candidates = [process.env.LIQUIDJS_PATH, 'liquidjs',
  path.join(process.env.APPDATA || '', 'npm/node_modules/@shopify/theme/node_modules/liquidjs'),
  path.join(path.dirname(process.execPath), 'node_modules/@shopify/cli/node_modules/liquidjs')].filter(Boolean);
let Liquid;
for (const candidate of candidates) {
  try { ({ Liquid } = require(candidate)); break; } catch {}
}
assert.ok(Liquid, 'Install liquidjs or set LIQUIDJS_PATH.');

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const clean = (text) => text.replace(/{%-?\s*(doc|stylesheet|schema|javascript)\s*-?%}[\s\S]*?{%-?\s*end\1\s*-?%}/g, '');
const translations = JSON.parse(read('locales/es.json').replace(/\/\*[\s\S]*?\*\//g, ''));
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid', strictFilters: false });
for (const name of ['doc', 'stylesheet', 'schema', 'javascript']) {
  engine.registerTag(name, { parse(_, tokens) { while (tokens.length && tokens.shift().name !== 'end' + name) {} }, render() { return ''; } });
}
engine.registerFilter('t', (key) => key.split('.').reduce((value, part) => value?.[part], translations) || key);
engine.registerFilter('json', (value) => JSON.stringify(value ?? null));

const schema = JSON.parse(read('blocks/am--product-tier-unlock.liquid').match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
assert.equal(schema.settings.find((setting) => setting.id === 'message').type, 'text');
assert.equal(schema.settings.find((setting) => setting.id === 'highlight_color').default, '#D4AF37');
assert.ok(schema.presets.length === 1);

const baseSettings = {
  am_progress_enabled: true,
  am_progress_1_enabled: true,
  am_progress_1_threshold: 100,
  am_progress_1_label: 'Envío',
  am_progress_2_enabled: true,
  am_progress_2_threshold: 200,
  am_progress_2_label: 'Muestra',
  am_progress_3_enabled: false,
  am_progress_3_threshold: 0,
  am_progress_3_label: '',
};
const variant = (price, available = true) => ({ id: 9, available, price, quantity_rule: { min: 1, increment: 1 } });
const context = (cartTotal, price, extra = {}) => ({
  settings: { ...baseSettings, ...extra.settings },
  cart: { total_price: cartTotal, currency: { iso_code: extra.currency || 'ARS' } },
  shop: { currency: 'ARS' },
  closest: { product: { id: extra.productId || 4, selected_or_first_available_variant: variant(price, extra.available !== false) } },
  block: { settings: { message: extra.message || '', highlight_color: extra.highlight || '', inherit_color_scheme: true, color_scheme: 'scheme-1', 'padding-block-start': 0, 'padding-block-end': 0 }, shopify_attributes: 'data-block' },
  request: { visual_preview_mode: Boolean(extra.preview), design_mode: Boolean(extra.design) },
  routes: { cart_url: '/cart' },
});
const render = (cartTotal, price, extra) => {
  const scope = context(cartTotal, price, extra);
  return engine.parseAndRender(clean(read('blocks/am--product-tier-unlock.liquid')), scope, { globals: scope });
};

const reached = await render(0, 10000);
assert.match(reached, /Agregalo al carrito y desbloqueás Envío\./);
assert.doesNotMatch(reached, /\shidden/);
assert.match(reached, /data-cart-url="\/cart\.js"/);
assert.match(reached, /--am-tier-unlock-highlight:\s*#D4AF37/);

const customHighlight = await render(0, 10000, { highlight: '#112233' });
assert.match(customHighlight, /--am-tier-unlock-highlight:\s*#112233/);

const short = await render(0, 5000);
assert.match(short, /<am-tier-unlock\b[^>]*\shidden/);
assert.match(short, /<p\b[\s\S]*?data-message[\s\S]*?hidden\s*><\/p>/);
const parsedTiers = JSON.parse(short.match(/data-tiers="([^"]*)"/)[1].replaceAll('&quot;', '"').replaceAll('&#34;', '"'));
assert.deepEqual(parsedTiers.map((tier) => tier.label), ['Envío', 'Muestra']);

const second = await render(10000, 10000);
assert.match(second, /Agregalo al carrito y desbloqueás Muestra\./);
assert.doesNotMatch(second, /desbloqueás Envío/);

const currency = await render(0, 10000, { currency: 'USD' });
assert.equal(currency.trim(), '');

const gift = await render(0, 10000, { settings: { am_progress_1_product: { id: 4 } }, productId: 4 });
assert.equal(gift.trim(), '');

const soldOut = await render(0, 10000, { available: false });
assert.match(soldOut, /data-available="false"/);
assert.match(soldOut, /<am-tier-unlock\b[^>]*\shidden/);

const editor = await render(0, 5000, { design: true, settings: { am_progress_enabled: false } });
assert.match(editor, /Este texto aparece solo cuando agregar la cantidad elegida/);
assert.doesNotMatch(editor, /<am-tier-unlock/);

const preview = await render(0, 100, { preview: true });
assert.match(preview, /class="am-tier-unlock__message"/);
assert.match(preview, /el próximo beneficio/);

const custom = await render(0, 10000, { message: 'Sumalo y llega {benefit}' });
assert.match(custom, /Sumalo y llega Envío/);

console.log('PASS liquid render');
