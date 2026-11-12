import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/am--gift-limits.js', import.meta.url), 'utf8');
const { giftQuantityCorrections, isBlockedGiftProduct } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const config = { max: 1, blockDirect: true, products: [{ id: 10, role: 'wrapping' }, { id: 11, role: 'note' }] };
const line = (key, id, quantity = 1, properties = {}) => ({ key, product_id: id, quantity, properties });
const service = (key, id, role, quantity = 1) => line(key, id, quantity, { _am_gift_service: role });
const cart = (items) => ({ items });
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log('PASS', name); };

check('a service line already at the cap stays', () => {
  assert.deepEqual(giftQuantityCorrections(cart([line('normal', 1), service('wrap', 10, 'wrapping')]), config, true), {});
});
check('a service line above the cap is reduced to the cap', () => {
  assert.deepEqual(giftQuantityCorrections(cart([line('normal', 1), service('wrap', 10, 'wrapping', 4)]), config, true), { wrap: 1 });
  assert.deepEqual(giftQuantityCorrections(cart([line('normal', 1), service('wrap', 10, 'wrapping', 4)]), { ...config, max: 3 }, true), { wrap: 3 });
});
check('a service line below a higher cap is not increased', () => {
  assert.deepEqual(giftQuantityCorrections(cart([line('normal', 1), service('wrap', 10, 'wrapping', 2)]), { ...config, max: 5 }, true), {});
});
check('loose units are reduced before the chosen service line', () => {
  const items = [line('normal', 1), service('wrap', 10, 'wrapping'), line('loose', 10, 3)];
  assert.deepEqual(giftQuantityCorrections(cart(items), config, true), { loose: 0 });
  assert.deepEqual(giftQuantityCorrections(cart(items), { ...config, max: 2 }, true), { loose: 1 });
});
check('loose lines without a service are capped and keep one remainder', () => {
  assert.deepEqual(giftQuantityCorrections(cart([line('a', 10, 2), line('b', 10, 2)]), config, true), { b: 0, a: 1 });
  assert.deepEqual(giftQuantityCorrections(cart([line('only', 11, 4)]), config, true), { only: 1 });
});
check('note and wrapping caps are independent', () => {
  const items = [line('normal', 1), service('wrap', 10, 'wrapping', 2), service('note', 11, 'note', 2)];
  assert.deepEqual(giftQuantityCorrections(cart(items), config, true), { wrap: 1, note: 1 });
});
check('duplicate service roles are removed and an orphan service is cleared', () => {
  const duplicate = giftQuantityCorrections(cart([
    line('normal', 1), service('wrap', 10, 'wrapping', 3), service('copy', 10, 'wrapping', 2),
  ]), config, true);
  assert.equal(duplicate.copy, 0);
  assert.equal(duplicate.wrap, 1);
  assert.deepEqual(giftQuantityCorrections(cart([service('wrap', 10, 'wrapping', 4)]), config, false), { wrap: 0 });
});
check('a service outside the configured products is still forced to one', () => {
  assert.deepEqual(giftQuantityCorrections(cart([
    line('normal', 1), service('old', 99, 'wrapping', 4),
  ]), config, true), { old: 1 });
});
check('the same product listed twice is capped once', () => {
  const shared = { max: 1, products: [{ id: 10, role: 'wrapping' }, { id: 10, role: 'note' }] };
  const result = giftQuantityCorrections(cart([
    line('normal', 1), service('wrap', 10, 'wrapping'), service('note', 10, 'note'),
  ]), shared, true);
  assert.equal(result.note, 0);
  assert.equal(result.wrap, undefined);
});
check('direct purchase is blocked only for the configured products', () => {
  assert.equal(isBlockedGiftProduct(10, config), true);
  assert.equal(isBlockedGiftProduct(11, config), true);
  assert.equal(isBlockedGiftProduct(1, config), false);
  assert.equal(isBlockedGiftProduct(10, { ...config, blockDirect: false }), false);
});

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
engine.registerTag('form', {
  parse(_, tokens) {
    const stream = this.liquid.parser.parseStream(tokens).on('tag:endform', () => stream.stop()).on('template', () => {});
    stream.start();
  },
  render() { return ''; },
});
engine.registerTag('content_for', { parse() {}, render() { return ''; } });
engine.registerTag('#', { parse() {}, render() { return ''; } });
engine.registerFilter('t', (key) => key.split('.').reduce((value, part) => value?.[part], translations) || key);
engine.registerFilter('json', (value) => JSON.stringify(value ?? null));
engine.registerFilter('asset_url', (name) => '/assets/' + name);
engine.registerFilter('image_url', () => '/image.jpg');
engine.registerFilter('image_tag', (src) => `<img src="${src}">`);
engine.registerFilter('money', (value) => `$${value}`);
engine.registerFilter('money_with_currency', (value) => `$${value} ARS`);
engine.registerFilter('inline_asset_content', () => '');
engine.registerFilter('stylesheet_tag', (href) => `<link rel="stylesheet" href="${href}">`);
engine.registerFilter('handleize', (value) => String(value ?? '').toLowerCase().replace(/\s+/g, '-'));
engine.registerFilter('strip_html', (value) => String(value ?? ''));
const render = (file, scope) => engine.parseAndRender(clean(read(file)), scope, { globals: scope });
const variant = { id: 10, available: true, quantity_rule: { min: 1, increment: 1 } };
const product = { id: 10, title: 'Envoltorio', url: '/products/packaging-de-regalo', selected_or_first_available_variant: variant };
const other = { ...product, id: 4, title: 'Vela', url: '/products/vela' };
const scope = (blocked, current = product) => ({
  settings: {
    am_gift_block_direct_add: blocked,
    am_gift_max_quantity: 2,
    am_gift_wrapping_product: product,
    am_gift_note_product: { id: 11 },
  },
  closest: { product: current },
  product: current,
  block: { id: 'buy', shopify_attributes: 'data-block', settings: { show_pickup_availability: false } },
  section: { id: 'product' },
  request: {},
});

const blockedSnippet = (await render('snippets/am--is-gift-service-product.liquid', { ...scope(true), product })).trim();
assert.equal(blockedSnippet, 'true');
assert.equal((await render('snippets/am--is-gift-service-product.liquid', { ...scope(false), product })).trim(), 'false');
assert.equal((await render('snippets/am--is-gift-service-product.liquid', { ...scope(true), product: other })).trim(), 'false');
checks += 3;
console.log('PASS gift service classification');

const blockedPage = await render('blocks/buy-buttons.liquid', scope(true));
assert.match(blockedPage, /Este producto se agrega desde las opciones de regalo del carrito\./);
assert.doesNotMatch(blockedPage, /<form|product-form-component|<button/);
const openPage = await render('blocks/buy-buttons.liquid', scope(false, other));
assert.doesNotMatch(openPage, /gift_service_only|opciones de regalo del carrito/);
assert.match(openPage, /product-form-component/);
checks += 2;
console.log('PASS product page message');

const hiddenQuickAdd = (await render('snippets/quick-add.liquid', scope(true))).trim();
assert.equal(hiddenQuickAdd, '');
checks += 1;
console.log('PASS product card hides quick add');

const configHtml = await render('snippets/am--gift-service-config.liquid', scope(true));
const parsed = JSON.parse(configHtml.replace(/<[^>]+>/g, ''));
assert.equal(parsed.max, 2);
assert.equal(parsed.blockDirect, true);
assert.deepEqual(parsed.products, [{ id: 10, role: 'wrapping' }, { id: 11, role: 'note' }]);
checks += 1;
console.log('PASS gift service config');

const cartLine = (productLine, properties, url) => ({
  key: productLine.id + '-line',
  url,
  index: productLine.id,
  quantity: 1,
  title: productLine.title,
  image: 'image.jpg',
  product: { ...productLine, has_only_default_variant: true, vendor: '' },
  variant: { id: productLine.id, title: 'Default', quantity_rule: { min: 1, increment: 1, max: null }, quantity_price_breaks: [], compare_at_price: null },
  properties,
  final_price: 1000,
  original_price: 1000,
  final_line_price: 1000,
  original_line_price: 1000,
  line_level_discount_allocations: [],
  item_components: [],
  instructions: { can_update_quantity: true, can_remove: true },
});
const noteLine = cartLine({ id: 11, title: 'Nota personalizada' }, { _am_gift_service: 'note', From: 'Ana', To: 'Luis', Message: 'Hola' }, '/products/nota-personalizada');
const normalLine = cartLine({ id: 1, title: 'Vela' }, {}, '/products/vela');
const cartHtml = await render('snippets/cart-products.liquid', {
  settings: {
    ...scope(false).settings,
    cart_thumbnail_border_opacity: 0,
    cart_thumbnail_border_width: 0,
    cart_thumbnail_border: 'none',
    cart_thumbnail_border_radius: 0,
    product_title_case: 'none',
  },
  cart: { 'empty?': false, item_count: 2, total_price: 2000, items: [noteLine, normalLine], currency: { iso_code: 'ARS' } },
  block: { shopify_attributes: 'data-block', settings: { vendor: false, dividers: false, gap: 0, image_ratio: 'square' } },
  section: { id: 'cart' },
  routes: { cart_url: '/cart', all_products_collection_url: '/collections/all' },
  shop: { customer_accounts_enabled: false, currency: 'ARS' },
  request: {},
  is_drawer: false,
});
const noteRow = cartHtml.slice(cartHtml.indexOf('Nota personalizada') - 800, cartHtml.indexOf('Nota personalizada') + 200);
assert.match(noteRow, /<div class="cart-items__media-container"/);
assert.match(noteRow, /<span class="cart-items__title">Nota personalizada<\/span>/);
assert.doesNotMatch(noteRow, /<a [^>]*href="\/products\/nota-personalizada"/);
const normalRow = cartHtml.slice(cartHtml.indexOf('>Vela<') - 500, cartHtml.indexOf('>Vela<') + 40);
assert.match(normalRow, /<a\s+href="\/products\/vela"\s+class="cart-items__title"/);
assert.doesNotMatch(cartHtml, /am-cart-tier-gift-label/);
checks += 2;
console.log('PASS cart note line has no product link');

const videoScope = (eager) => ({
  section: {
    id: 'video',
    blocks: [],
    settings: {
      video_url: 'https://cdn.example/video.mp4',
      eager_video: eager,
      video_loop: false,
      replacing_image: null,
      carousel_timer: 5,
      media_width_desktop: 50,
      slide_width_desktop: 30,
      carousel_button_margin_top: 0,
      section_height: 'auto',
      show_mobile: true,
      show_tablet: true,
      show_desktop: true,
    },
  },
});
const eagerVideo = await render('sections/am--video-with-carousel.liquid', videoScope(true));
assert.match(eagerVideo, /<link rel="preload" as="video" href="https:\/\/cdn\.example\/video\.mp4" type="video\/mp4" fetchpriority="high">/);
assert.match(eagerVideo, /preload="auto"/);
assert.match(eagerVideo, /fetchpriority="high"/);
const lazyVideo = await render('sections/am--video-with-carousel.liquid', videoScope(false));
assert.match(lazyVideo, /preload="metadata"/);
assert.doesNotMatch(lazyVideo, /rel="preload"|preload="auto"|fetchpriority="high"/);
checks += 2;
console.log('PASS eager video preload');

console.log(`OK ${checks}`);
