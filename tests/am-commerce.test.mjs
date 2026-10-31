import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const candidates = [process.env.LIQUIDJS_PATH, 'liquidjs',
  path.join(process.env.APPDATA || '', 'npm/node_modules/@shopify/theme/node_modules/liquidjs'),
  path.join(path.dirname(process.execPath), 'node_modules/@shopify/cli/node_modules/liquidjs')].filter(Boolean);
let Liquid;
for (const candidate of candidates) {
  try { ({ Liquid } = require(candidate)); break; } catch {}
}
assert.ok(Liquid, 'Install liquidjs or set LIQUIDJS_PATH to its module path.');
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
assert.ok(chromePath, 'Set CHROME_PATH to a Chromium browser.');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'am-commerce-qa-'));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (text) => JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, ''));
const translations = json(read('locales/es.json'));
const clean = (text) => text.replace(/{%-?\s*(doc|stylesheet|schema|javascript)\s*-?%}[\s\S]*?{%-?\s*end\1\s*-?%}/g, '').replace(/{%\s*#[\s\S]*?%}/g, '');
const css = (file) => read(file).match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)?.[1] || '';
const defaults = (file) => Object.fromEntries(JSON.parse(read(file).match(/{% schema %}([\s\S]*?){% endschema %}/)[1]).settings.filter((s) => s.id).map((s) => [s.id, s.default]));
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid', strictFilters: false });
for (const name of ['doc', 'stylesheet', 'schema', 'javascript']) engine.registerTag(name, { parse(_, tokens) { while (tokens.length && tokens.shift().name !== 'end' + name) {} }, render() { return ''; } });
engine.registerTag('form', {
  parse(token, tokens) {
    this.idVariable = token.args.match(/\bid:\s*([\w.]+)/)?.[1];
    this.templates = [];
    const stream = this.liquid.parser.parseStream(tokens).on('tag:endform', () => stream.stop()).on('template', (template) => this.templates.push(template));
    stream.start();
  },
  *render(context) { return `<form method="post" action="/cart/add"${this.idVariable ? ` id="${context.get(this.idVariable.split('.'))}"` : ''}>` + (yield this.liquid.renderer.renderTemplates(this.templates, context)) + '</form>'; },
});
engine.registerTag('style', {
  parse(_, tokens) {
    this.templates = [];
    const stream = this.liquid.parser.parseStream(tokens).on('tag:endstyle', () => stream.stop()).on('template', (template) => this.templates.push(template));
    stream.start();
  },
  *render(context) { return '<style>' + (yield this.liquid.renderer.renderTemplates(this.templates, context)) + '</style>'; },
});
engine.registerTag('paginate', {
  parse(_, tokens) {
    this.templates = [];
    const stream = this.liquid.parser.parseStream(tokens).on('tag:endpaginate', () => stream.stop()).on('template', (template) => this.templates.push(template));
    stream.start();
  },
  *render(context) { return yield this.liquid.renderer.renderTemplates(this.templates, context); },
});
engine.registerTag('content_for', { parse(token) { this.isBlocks = token.args.trim().startsWith("'blocks'"); }, render(context) { return this.isBlocks ? context.get(['fixtureBlocks']) || '' : ''; } });
engine.registerFilter('t', (key, ...args) => {
  let value = key.split('.').reduce((o, k) => o?.[k], translations) || key;
  for (const [k, v] of args.filter(Array.isArray)) value = value.replaceAll('{{ ' + k + ' }}', String(v));
  return value;
});
engine.registerFilter('asset_url', (name) => '/assets/' + name);
engine.registerFilter('stylesheet_tag', (url) => `<link rel="stylesheet" href="${url}">`);
engine.registerFilter('inline_asset_content', (name) => read('assets/' + name));
engine.registerFilter('image_url', (image) => image?.src || '/image.svg');
engine.registerFilter('image_tag', (src, ...args) => `<img src="${src}" width="600" height="600" ${args.filter(Array.isArray).map(([k, v]) => `${k}="${v}"`).join(' ')}>`);
engine.registerFilter('placeholder_svg_tag', (_, cls) => `<svg class="${cls || ''}" viewBox="0 0 600 600"><rect width="600" height="600" fill="#ccc"/></svg>`);
engine.registerFilter('money', (n) => '$' + (Number(n || 0) / 100).toFixed(2));
engine.registerFilter('money_with_currency', (n) => '$' + (Number(n || 0) / 100).toFixed(2) + ' USD');
engine.registerFilter('sort_by', (url, order) => url + '?sort_by=' + order);
const render = (file, context) => engine.parseAndRender(clean(read(file)), context, { globals: context });
const image = { src: '/image.svg', width: 600, height: 600, aspect_ratio: 1, alt: 'Producto' };
function product(id, price) {
  const variant = { id, available: true, price, quantity_rule: { min: 1, increment: 1 }, featured_media: { preview_image: image }, url: '/products/test-' + id };
  return { id, title: 'Producto ' + id, handle: 'test-' + id, available: true, has_only_default_variant: true, variants_count: 1,
    variants: [variant], selected_or_first_available_variant: variant, options: ['Title'], options_with_values: [], url: variant.url,
    price, featured_image: image, featured_media: { ...image, preview_image: image }, media: [{ id: id * 10, ...image, preview_image: image, media_type: 'image' }], images: [image] };
}
const products = new Map([[1, product(1, 1000)], [2, product(2, 1500)], [10, product(10, 650)], [11, product(11, 500)]]);
for (const id of [3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15]) products.set(id, product(id, id * 175));
Object.assign(products.get(4), { available: false });
Object.assign(products.get(3), { variants_count: 2, has_only_default_variant: false, options: ['Size'] });
products.get(3).variants.push({ ...products.get(3).variants[0], id: 103, title: 'Grande' });
products.set(103, products.get(3));
products.get(5).compare_at_price = 1250;
products.get(5).selected_or_first_available_variant.compare_at_price = 1250;
const upsellCollection = { id: 77, handle: 'upsell', url: '/collections/upsell', title: 'Productos del fixture' };
const popularityOrder = [4, 1, 10, 11, 3, 2, 5, 6, 7, 8, 9, 12, 13, 14, 15];
let collectionRequests = [], failUpsell = false, delayUpsellNext = 0, upsellCandidates = popularityOrder;
let items = [], serial = 0, writes = [], failNext = '', nullSections = false, delayNext = 0, discount = 0;
let activeCartRequests = 0, maxActiveCartRequests = 0;
let current = new URLSearchParams();
const settings = Object.fromEntries(json(read('config/settings_schema.json')).flatMap((g) => g.settings || []).filter((s) => s.id).map((s) => [s.id, s.default]));
Object.assign(settings, { am_gift_wrapping_enabled: true, am_gift_note_enabled: true,
  am_gift_wrapping_product: products.get(10), am_gift_note_product: products.get(11),
  am_gift_modal_image: image, am_progress_enabled: true, drawer_color_scheme: 'scheme-1',
  show_cart_note: false, show_add_discount_code: true, show_installments: false, show_accelerated_checkout_buttons: false,
  cart_type: 'drawer', am_progress_1_enabled: true, am_progress_1_threshold: 20, am_progress_1_label: 'Beneficio 1',
  am_progress_2_enabled: true, am_progress_2_threshold: 30, am_progress_2_label: 'Beneficio 2',
  am_progress_3_enabled: true, am_progress_3_threshold: 40, am_progress_3_label: 'Beneficio 3' });
function add(id, quantity = 1, properties = {}) {
  const p = products.get(Number(id));
  assert.ok(p, 'Known fixture variant');
  const existing = items.find((item) => item.id === Number(id) && JSON.stringify(item.properties) === JSON.stringify(properties));
  if (existing) existing.quantity += quantity;
  else items.push({ id: Number(id), variant_id: Number(id), product_id: p.id, key: `${id}:${++serial}`, quantity, properties, product: p,
    variant: p.selected_or_first_available_variant, title: p.title, image, url: p.url, price: p.price, original_price: p.price,
    final_price: p.price, options_with_values: [], item_components: [], instructions: { can_remove: true, can_update_quantity: true } });
}
function cart() {
  const lines = items.map((item, index) => ({ ...item, index, original_line_price: item.price * item.quantity, final_line_price: item.price * item.quantity }));
  const subtotal = lines.reduce((n, item) => n + item.final_line_price, 0);
  return { items: lines, item_count: lines.reduce((n, item) => n + item.quantity, 0), total_price: Math.max(0, subtotal - discount), items_subtotal_price: subtotal,
    currency: { iso_code: current.get('currency') || 'USD' }, cart_level_discount_applications: discount ? [{ title: 'FIXTURE', type: 'discount_code', total_allocated_amount: discount }] : [],
    discount_codes: discount ? [{ code: 'FIXTURE', applicable: true }] : [], 'empty?': !lines.length, empty: !lines.length, note: 'Nota general conservada' };
}
function context(extra = {}) {
  return { settings, cart: cart(), shop: { currency: 'USD', customer_accounts_enabled: false }, request: { design_mode: current.has('editor') },
    template: { name: current.get('view') === 'page' ? 'cart' : 'index' }, routes: { cart_url: '/cart', all_products_collection_url: '/collections/all' }, ...extra };
}
async function section() {
  const section = { id: 'fixture', settings: {} };
  if (current.get('view') !== 'page') return `<div id="shopify-section-fixture" class="shopify-section">${await render('snippets/header-actions.liquid', context({ section }))}</div>`;
  const contents = `<div class="cart-page"><h2>Carrito</h2>${await render('snippets/am--cart-progress.liquid', context())}<div class="cart-page__items">${await render('snippets/cart-products.liquid', context())}</div><div class="cart-page__summary">${await render('snippets/cart-summary.liquid', context({ section_id: 'fixture' }))}</div></div>`;
  return `<div id="shopify-section-fixture" class="shopify-section">${await render('snippets/cart-items-component.liquid', context({ section_id: 'fixture', children: contents }))}</div>`;
}
async function card(style = 'circular', id = 'card-test') {
  const p = products.get(1), block = { id, settings: { image_ratio: 'portrait', product_card_gap: 4 }, shopify_attributes: '' };
  const c = context({ closest: { product: p }, product: p, block, section: { id: 'fixture', settings: { am_product_card_style: style } }, card_style: style });
  const children = await render('blocks/_product-card-gallery.liquid', c);
  return render('snippets/product-card.liquid', { ...c, children });
}
async function hotspots() {
  let fixtureBlocks = '';
  for (let i = 1; i <= 3; i++) fixtureBlocks += await render('snippets/product-hotspot.liquid', context({ product: products.get(i === 3 ? 1 : i),
    instance_id: 'hot-' + i, x_position: i * 25, y_position: 50, hover_image: { ...image, src: `/hover-${i}.svg` },
    desktop_interaction_mode: current.get('mode') || 'click-quick-buy', section_id: 'hotspots', button_size: 40 }));
  return render('sections/product-hotspots.liquid', context({ fixtureBlocks, section: { id: 'hotspots', settings: { ...defaults('sections/product-hotspots.liquid'), image, section_height: 'auto' } } }));
}
async function mediaCarousel() {
  const section = { id: 'media-carousel', index: 2, blocks: [{ id: 'a' }, { id: 'b' }], settings: { ...defaults('sections/am--media-product-carousel.liquid'), image, section_width: 'full-width', carousel_source: 'blocks', show_arrows: true, arrow_shape: 'circle', carousel_overlap: Number(current.get('overlap') || 8) } };
  let fixtureBlocks = '';
  for (const id of ['a', 'b']) fixtureBlocks += await render('blocks/am--media-carousel-card.liquid', context({ section, block: { id, shopify_attributes: '', settings: { ...defaults('blocks/am--media-carousel-card.liquid'), image, title: 'Card editorial ' + id, button_label: 'Ver producto', button_link: '/products/test-1', content_position: 'overlay' } } }));
  return `<div class="shopify-section">${await render('sections/am--media-product-carousel.liquid', context({ fixtureBlocks, section }))}</div>`;
}
async function upsellSection(order) {
  let sorted = upsellCandidates.map((id) => products.get(id));
  if (order === 'price-ascending') sorted = [...sorted].sort((a, b) => a.price - b.price);
  if (order === 'price-descending') sorted = [...sorted].sort((a, b) => b.price - a.price);
  return `<div id="shopify-section-am--cart-upsell" class="shopify-section">${await render('sections/am--cart-upsell.liquid', context({ section: { id: 'am--cart-upsell', settings: {} }, collection: { ...upsellCollection, products: sorted } }))}</div>`;
}
function productPage(id) {
  const p = products.get(id);
  return `<div data-product-grid-content><div class="product-details"><h2>${p.title}</h2><product-form-component data-section-id="fixture" data-product-id="${p.id}" on:submit="/handleSubmit"><div ref="liveRegion" role="status"></div><form id="QuickBuyFixture-${id}"><input name="id" ref="variantId" value="${id}"><input name="quantity" value="1"><span ref="addToCartTextError" class="hidden"></span><add-to-cart-component ref="addToCartButtonContainer" data-add-to-cart-animation="false"><button type="submit" class="button" ref="addToCartButton">Agregar variante</button></add-to-cart-component></form></product-form-component></div></div>`;
}
const styles = ['snippets/accordion-custom-component.liquid', 'snippets/header-actions.liquid', 'snippets/cart-items-component.liquid', 'snippets/cart-products.liquid', 'snippets/cart-summary.liquid', 'sections/main-cart.liquid',
  'snippets/product-card.liquid', 'snippets/card-gallery.liquid', 'snippets/quick-add-styles.liquid', 'snippets/add-to-cart-button.liquid', 'snippets/slideshow-styles.liquid',
  'snippets/slideshow-slide.liquid', 'snippets/slideshow-arrows.liquid', 'snippets/slideshow-arrow.liquid', 'snippets/quick-add-modal-styles.liquid', 'blocks/am--media-carousel-card.liquid', 'sections/am--media-product-carousel.liquid', 'sections/product-hotspots.liquid'].map(css).join('\n') + ':root{--height-buy-buttons:48px;--icon-size-xs:16px;--icon-size-sm:20px;--icon-size-md:24px;--padding-2xs:6px;--margin-sm:12px;--margin-2xs:8px;--animation-speed:.25s;--animation-easing:ease;--animation-speed-fast:.15s;--layer-heightened:2}';
const imports = JSON.parse(read('snippets/scripts.liquid').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1].replace(/\{\{\s*'([^']+)'\s*\|\s*asset_url\s*\}\}/g, '/assets/$1'));
async function page() {
  const cards = `<div class="fixture-cards">${await card()}${await card('original', 'original-test')}<div class="am-media-product-carousel__product-slide" style="--am-card-height:360px;--am-card-content-padding:16px">${await card('circular', 'carousel-test')}</div></div>`;
  const upsellStyles = ['snippets/am--cart-upsell.liquid', 'sections/am--cart-upsell.liquid'].filter((file) => fs.existsSync(path.join(root, file))).map(css).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/base.css"><link rel="stylesheet" href="/assets/product-hotspot.css"><link rel="stylesheet" href="/assets/am--cart-upsell.css"><style>:root{--sidebar-width:480px;--page-margin:20px;--page-width:1200px;--spacing-scale:1;--color-background:#fff;--color-foreground:#222;--color-border:#ddd;--color-foreground-rgb:34 34 34;--color-primary-button-background:#624534;--color-primary-button-text:#fff;--button-size:40px;--button-size-md:44px;--minimum-touch-target:44px;--focus-outline-width:2px;--focus-outline-offset:3px;--padding-sm:12px;--padding-md:16px;--padding-lg:20px;--padding-xl:24px;--padding-2xl:28px;--gap-xl:24px;--gap-2xs:6px;--gap-xs:8px;--font-size--2xs:12px;--cart-font-size--sm:14px;--font-paragraph--family:Arial;--font-paragraph--size:16px;--font-paragraph--weight:400;--font-paragraph--line-height:1.4}body{margin:0;font-family:Arial}button{cursor:pointer}[hidden]{display:none!important}.fixture-cards{display:flex;overflow:auto;max-width:calc(100% - 48px);gap:24px;margin:24px}.fixture-cards>*{flex:0 0 230px}.fixture-cards product-card{width:230px}.cart-page{max-width:1200px;margin:auto}.section-product-hotspots{min-height:480px} ${styles} ${upsellStyles}</style><script>window.Shopify={designMode:false,routes:{root:'/'},locale:'es'};window.Theme={utilities:{},routes:{cart_url:'/cart',cart_add_url:'/cart/add.js',cart_change_url:'/cart/change',cart_update_url:'/cart/update'},translations:{cart_count:'Productos',added:'Agregado'}};</script><script type="importmap">${JSON.stringify(imports)}</script><script type="module" src="/assets/accordion-custom.js"></script><script type="module" src="/assets/cart-discount.js"></script><script type="module" src="/assets/product-card.js"></script><script type="module" src="/assets/slideshow.js"></script><script type="module" src="/assets/product-form.js"></script><script type="module" src="/assets/quick-add.js"></script><script type="module" src="/assets/am--cart-upsell.js"></script></head><body>${await section()}${await render('snippets/am--cart-features.liquid', context())}${await render('snippets/quick-add-modal.liquid', context())}${current.has('carousel') ? await mediaCarousel() : ''}${cards}${await hotspots()}</body></html>`;
}

const server = http.createServer(async (req, res) => {
  let mutationStarted = false;
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/fixture') {
      res.setHeader('Content-Type', 'text/html');
      if (url.searchParams.has('section_id')) return res.end(await section());
      current = url.searchParams;
      return res.end(await page());
    }
    if (url.pathname === '/cart.js') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(cart())); }
    if (url.pathname === upsellCollection.url && url.searchParams.get('section_id') === 'am--cart-upsell') {
      collectionRequests.push(url.searchParams.get('sort_by'));
      const delay = delayUpsellNext; delayUpsellNext = 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (failUpsell) { failUpsell = false; res.writeHead(500); return res.end('Collection fixture error'); }
      res.setHeader('Content-Type', 'text/html');
      return res.end(await upsellSection(url.searchParams.get('sort_by')));
    }
    if (/^\/products\/test-\d+$/.test(url.pathname)) {
      res.setHeader('Content-Type', 'text/html');
      return res.end(productPage(Number(url.pathname.split('-').pop())));
    }
    if (/^\/cart\/(add|update|change)(\.js)?$/.test(url.pathname)) {
      mutationStarted = true; activeCartRequests++;
      maxActiveCartRequests = Math.max(maxActiveCartRequests, activeCartRequests);
      let raw = ''; for await (const chunk of req) raw += chunk;
      let body;
      if (req.headers['content-type']?.startsWith('multipart/form-data')) {
        const form = await new Request('http://fixture/cart/add', { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] }, body: raw }).formData();
        body = { items: [{ id: Number(form.get('id')), quantity: Number(form.get('quantity') || 1), properties: {} }], sections: form.get('sections') };
      } else body = JSON.parse(raw);
      writes.push({ path: url.pathname, body });
      const delay = delayNext; delayNext = 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      res.setHeader('Content-Type', 'application/json');
      if (failNext === 'reject') { failNext = ''; res.writeHead(422); return res.end(JSON.stringify({ status: 422, message: 'Sin stock', description: 'Sin stock' })); }
      if (url.pathname.includes('/add')) for (const item of body.items) add(item.id, item.quantity, item.properties);
      if (url.pathname.includes('/update')) for (const [key, quantity] of Object.entries(body.updates || {})) { const item = items.find((i) => i.key === key); if (item) item.quantity = quantity; }
      if (body.discount !== undefined) discount = body.discount ? 2500 : 0;
      if (url.pathname.includes('/change')) {
        const item = body.id ? items.find((i) => i.key === body.id) : items[body.line - 1];
        if (!item) { res.writeHead(422); return res.end(JSON.stringify({ description: 'Clave inválida' })); }
        item.quantity = body.quantity;
        if (body.properties) { item.properties = body.properties; item.key = item.id + ':' + ++serial; }
      }
      items = items.filter((item) => item.quantity > 0);
      if (failNext === 'lost') { failNext = ''; return res.destroy(); }
      const sections = { fixture: nullSections ? null : await section() };
      return res.end(JSON.stringify({ ...cart(), sections }));
    }
    if (url.pathname.startsWith('/assets/')) {
      const file = path.join(root, url.pathname) + (path.extname(url.pathname) ? '' : '.js');
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
      return res.end(fs.readFileSync(file));
    }
    if (url.pathname.endsWith('.svg')) { res.setHeader('Content-Type', 'image/svg+xml'); return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${url.pathname.includes('hover') ? '#c99' : '#dda'}"/><circle cx="300" cy="300" r="170" fill="#b86"/></svg>`); }
    res.writeHead(404); res.end();
  } catch (error) { console.error(error.stack); res.writeHead(500); res.end(error.stack); }
  finally { if (mutationStarted) activeCartRequests--; }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws, checks = 0;
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = fs.readFileSync(path.join(output, 'chrome/DevToolsActivePort'), 'utf8').split('\n')[0]; break; } catch { await pause(100); } }
  assert.ok(port, 'Chrome CDP available');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let serial = 0;
  const pending = new Map(), errors = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { const task = pending.get(message.id); if (task) { pending.delete(message.id); message.error ? task.reject(message.error) : task.resolve(message.result); } }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Page.bringToFront');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (expression) => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await pause(30); } throw new Error('Timeout: ' + expression + '\n' + errors.join('\n') + '\n' + await evaluate(`document.body.innerText.slice(0,2000)`)); };
  const check = async (label, expression) => { assert.equal(await evaluate(expression), true, label); checks++; console.log('PASS', label); };
  const idle = () => wait(`!document.documentElement.hasAttribute('data-am-cart-busy')`);
  const load = async (query = '') => {
    await evaluate(`window.amQaLeavingDocument = true`);
    await cdp('Page.navigate', { url: base + '/fixture?' + query });
    await wait(`!window.amQaLeavingDocument && customElements.get('am-gift-note-modal') && document.querySelector('cart-items-component')?.refs && document.querySelector('product-hotspot-component')?.refs?.trigger`);
    await idle(); await pause(150);
  };
  const viewport = (width, height = 900) => cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 750 });
  const openDrawer = async () => {
    await evaluate(`document.querySelector('cart-drawer-component').open()`);
    await wait(`document.querySelector('.cart-drawer__dialog').open`);
    await evaluate(`Promise.all(document.querySelector('.cart-drawer__dialog').getAnimations().map(animation=>animation.finished.catch(()=>{})))`);
  };
  const toggle = async (role) => { await evaluate(`document.querySelector('[data-am-gift-toggle="${role}"]').click()`); await idle(); };
  const submitNote = async (text = 'Mensaje de prueba') => {
    await evaluate(`{ const modal=document.getElementById('AMGiftNoteModal'); modal.querySelector('[name="From"]').value='Remitente';modal.querySelector('[name="To"]').value='Destinatario';modal.querySelector('[name="Message"]').value=${JSON.stringify(text)};modal.querySelector('[name="Message"]').dispatchEvent(new Event('input',{bubbles:true}));modal.querySelector('form').requestSubmit(); }`);
  };
  const note = async (text) => { await submitNote(text); await idle(); };
  const drawerGiftConfirmation = `(()=>{const d=document.querySelector('cart-drawer-component'),n=d.querySelector('[data-am-cart-feedback]'),s=d.querySelector('.cart-drawer__summary');if(!n || n.hidden)return false;const r=n.getBoundingClientRect(),height=s.getBoundingClientRect().height;n.hidden=true;const without=s.getBoundingClientRect().height;n.hidden=false;return n.textContent==='Actualizamos tu carrito.' && n.getAttribute('role')==='status' && n.getAttribute('aria-live')==='polite' && n.classList.contains('visually-hidden') && !n.classList.contains('am-cart-error') && getComputedStyle(n).position==='absolute' && r.width<=1 && r.height<=1 && Math.abs(height-without)<1})()`;
  const centeredTierLabels = `(()=>{const area=document.querySelector('.am-cart-progress').getBoundingClientRect();return [...document.querySelectorAll('.am-cart-progress__check')].every(p=>{const badge=p.getBoundingClientRect(),label=p.nextElementSibling.getBoundingClientRect();return Math.abs(badge.left+badge.width/2-label.left-label.width/2)<1 && label.left>=area.left && label.right<=area.right})})()`;
  const metrics = [];
  const progressAt = async (amount, percent, reached, label, drawer = false) => {
    items = []; add(1); Object.assign(items[0], { price: amount, original_price: amount, final_price: amount });
    await load(drawer ? '' : 'view=page');
    if (drawer) await openDrawer();
    await check(label, `(()=>{const track=document.querySelector('.am-cart-progress__track'),box=track.getBoundingClientRect(),fill=track.firstElementChild.getBoundingClientRect();return Math.abs(Number(track.getAttribute('aria-valuenow'))-${percent})<0.0001 && Math.abs(fill.width-box.width*${percent}/100)<1 && document.querySelectorAll('.am-cart-progress [data-complete]').length===${reached}})()`);
    await check('marker alignment: ' + label, `(()=>{const track=document.querySelector('.am-cart-progress__track').getBoundingClientRect(),points=[...document.querySelectorAll('.am-cart-progress__check')];return points.every((p,i)=>{const r=p.getBoundingClientRect();return Math.abs(r.left+r.width/2-track.left-track.width*(i+${drawer ? '.5' : '1'})/points.length)<1})})()`);
    await check('numbers centered over tier labels: ' + label, centeredTierLabels);
  };
  const refreshFixture = async () => {
    await evaluate(`(async()=>{const {sectionRenderer}=await import('@theme/section-renderer');await sectionRenderer.renderSection('fixture',{cache:false})})()`);
    await pause(80);
  };
  const drawerDetails = async () => {
    const noteSpacing = async (label) => {
      const gaps = await evaluate(`(()=>{const r=document.querySelector('.cart-drawer [data-am-gift-service="note"]'),rows=[r.querySelector('.cart-items__product-info'),...r.querySelector('.am-gift-properties').children,r.querySelector('.cart-items__unit-price-wrapper'),r.querySelector('.cart-items__quantity')].map(e=>e.getBoundingClientRect());return rows.slice(1).map((box,i)=>box.top-rows[i].bottom)})()`);
      assert.ok(gaps.every((gap) => Math.abs(gap - 4) < 1), label + ': ' + JSON.stringify(gaps)); checks++;
      console.log('PASS', label);
    };
    const line = items.find((item) => item.properties._am_gift_service === 'note');
    const longMessage = ('Un mensaje personal para vos, con mucho cariño. '.repeat(6) + '\nSegunda línea del regalo.').slice(0, 400);
    line.properties.Message = longMessage;
    await viewport(1440); await load(); await openDrawer();
    await wait(`document.querySelector('am-gift-message [data-am-message-toggle]').hidden===false`);
    await check('long gift message reserves one inline ellipsis and an accessible control', `(()=>{const h=document.querySelector('am-gift-message'),v=h.querySelector('[data-am-message-viewport]'),t=h.querySelector('[data-am-message-text]'),b=h.querySelector('button'),e=b.querySelector('.am-gift-message__ellipsis');return b.getAttribute('aria-expanded')==='false' && b.getAttribute('aria-controls')===v.id && b.querySelector('[data-am-message-label]').textContent==='Ver más' && e.textContent==='…\\u00a0' && h.querySelectorAll('.am-gift-message__ellipsis').length===1 && getComputedStyle(e).display!=='none' && getComputedStyle(t).whiteSpace==='nowrap' && getComputedStyle(t).textOverflow==='clip' && parseFloat(getComputedStyle(b,'::after').height)>=44 && Math.abs(v.clientHeight-b.getBoundingClientRect().height)<1})()`);
    await noteSpacing('collapsed note has four-pixel gaps around every row');
    await check('empty property containers do not reserve note spacing', `[...document.querySelectorAll('.cart-drawer [data-am-gift-service="note"] .cart-items__properties:empty')].every(e=>getComputedStyle(e).display==='none')`);
    const messageAligned = `(()=>{const h=document.querySelector('am-gift-message'),row=h.closest('.am-gift-properties__message'),t=h.querySelector('[data-am-message-text]'),b=h.querySelector('button'),glyph=e=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects()[0]};const dt=glyph(row.querySelector('dt')),text=glyph(t),label=glyph(b.querySelector('[data-am-message-label]'));return Math.abs(dt.top-text.top)<1 && Math.abs(text.top-label.top)<1 && dt.right<=text.left+1 && t.getBoundingClientRect().right<=b.getBoundingClientRect().left+1 && b.getBoundingClientRect().right<=h.getBoundingClientRect().right+1})()`;
    await check('Message label, clipped text and Show more share the same baseline', messageAligned);
    await check('only drawer property labels are semibold with a visible space after colon', `(()=>{const p=document.querySelector('.am-gift-properties');return [...p.querySelectorAll('dt')].every(d=>d.textContent.endsWith(':\\u00a0') && getComputedStyle(d).fontWeight==='600') && [...p.querySelectorAll('dd')].every(d=>getComputedStyle(d).fontWeight!=='600') && getComputedStyle(p.querySelector('button')).fontWeight!=='600'})()`);
    const actionsAligned = `(()=>{const row=document.querySelector('[data-am-gift-service="note"]'),actions=row.querySelector('.cart-items__quantity-controls'),edit=actions.querySelector('[data-am-gift-edit]'),remove=actions.querySelector('.cart-items__remove');if(!edit || !remove)return false;const a=edit.getBoundingClientRect(),b=remove.getBoundingClientRect();return edit.nextElementSibling===remove && a.right<=b.left+1 && Math.abs(a.top+a.height/2-b.top-b.height/2)<1 && [edit,remove].every(e=>parseFloat(getComputedStyle(e,'::after').height)>=44 && e.getBoundingClientRect().width>=44)})()`;
    await check('drawer has a single edit action immediately before trash', `document.querySelectorAll('.cart-drawer [data-am-gift-edit]').length===1 && !document.querySelector('am-cart-gifts [data-am-gift-edit]') && ${actionsAligned}`);
    for (const selector of ['[data-am-message-toggle]', '.cart-drawer [data-am-gift-edit]']) {
      const point = await evaluate(`(()=>{const b=document.querySelector('${selector}');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await check('note action has pointer and emphasized hover: ' + selector, `(()=>{const b=document.querySelector('${selector}'),t=b.querySelector('[data-am-message-label]')||b;return getComputedStyle(b).cursor==='pointer' && getComputedStyle(t).textDecorationThickness==='2px'})()`);
    }
    for (const selector of ['[data-am-message-toggle]', '[data-am-gift-edit]', '.cart-items__remove']) {
      await evaluate(`document.querySelector('.cart-drawer [data-am-gift-service="note"]').querySelector('${selector}').scrollIntoView({block:'center',behavior:'instant'})`); await pause(80);
      const hits = await evaluate(`(()=>{const b=document.querySelector('.cart-drawer [data-am-gift-service="note"]').querySelector('${selector}'),r=b.getBoundingClientRect(),v=b.closest('.cart-drawer__items').getBoundingClientRect();return [r.top+r.height/2-21,r.top+r.height/2+21].map(y=>{const hit=document.elementFromPoint(r.left+r.width/2,y);return{inside:b.contains(hit),target:hit?.className,y,top:v.top,bottom:v.bottom}})})()`);
      assert.ok(hits.every((hit) => hit.inside), 'Extended note hit area ' + selector + ': ' + JSON.stringify(hits)); checks++;
      console.log('PASS extended note hit area', selector);
    }
    assert.equal(await evaluate(`document.querySelector('[data-am-message-text]').textContent`), longMessage); checks++;
    await evaluate(`window.messageHost=document.querySelector('am-gift-message');window.messageClosedHeight=messageHost.querySelector('[data-am-message-viewport]').getBoundingClientRect().height;messageHost.querySelector('button').click();window.messageInitialDuration=messageHost.querySelector('[data-am-message-viewport]').getAnimations()[0]?.effect.getTiming().duration`);
    await pause(80);
    await check('message expansion animates and clips height for 250ms', `(()=>{const v=messageHost.querySelector('[data-am-message-viewport]'),a=v.getAnimations()[0];window.messageMidHeight=v.getBoundingClientRect().height;return !!a && messageInitialDuration===250 && a.effect.getTiming().duration<=250 && getComputedStyle(v).overflow==='hidden' && messageMidHeight>messageClosedHeight && messageHost.querySelector('button').getAttribute('aria-expanded')==='true'})()`);
    await evaluate(`window.messageCloseStart=messageHost.querySelector('[data-am-message-viewport]').getBoundingClientRect().height;messageHost.querySelector('button').click()`); await pause(70);
    await check('closing reverses the running message animation without jumping', `messageHost.querySelector('[data-am-message-viewport]').getBoundingClientRect().height<messageCloseStart && messageHost.querySelector('button').getAttribute('aria-expanded')==='false'`);
    await evaluate(`messageHost.querySelector('button').click()`); await pause(300);
    await check('expanded message respects newlines and shows inline Show less without ellipsis', `messageHost.querySelector('[data-am-message-label]').textContent==='Ver menos' && getComputedStyle(messageHost.querySelector('.am-gift-message__ellipsis')).display==='none' && getComputedStyle(messageHost.querySelector('[data-am-message-text]')).whiteSpace==='pre-wrap' && messageHost.querySelector('[data-am-message-viewport]').clientHeight>messageClosedHeight*2`);
    await check('Show less follows the last text line when it fits', `(()=>{const t=messageHost.querySelector('[data-am-message-text]').firstChild,r=document.createRange(),b=document.createRange();r.setStart(t,t.length-1);r.setEnd(t,t.length);b.selectNodeContents(messageHost.querySelector('[data-am-message-label]'));return Math.abs(r.getBoundingClientRect().top-b.getBoundingClientRect().top)<1})()`);
    await noteSpacing('expanded long note preserves four-pixel gaps around price and actions');
    await check('settled message releases clipping for extended hit areas', `getComputedStyle(messageHost.querySelector('[data-am-message-viewport]')).overflow==='visible'`);
    await evaluate(`document.querySelector('cart-items-component').updateQuantity({line:1,quantity:${items[0].quantity},action:'change'})`); await idle(); await pause(80);
    await check('quantity updates preserve the expanded message and component', `window.messageHost===document.querySelector('am-gift-message') && messageHost.querySelector('button').getAttribute('aria-expanded')==='true'`);
    await viewport(390); await pause(100);
    const expandedShot = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'note-expanded-390.png'), Buffer.from(expandedShot.data, 'base64'));
    await evaluate(`messageHost.querySelector('button').click()`); await pause(300);
    await check('settled compact message keeps the ellipsis immediately before Show more', `(()=>{const b=messageHost.querySelector('button'),e=b.querySelector('.am-gift-message__ellipsis'),l=b.querySelector('[data-am-message-label]'),r=e.getBoundingClientRect(),t=l.getBoundingClientRect();return b.getAttribute('aria-expanded')==='false' && getComputedStyle(e).display!=='none' && r.width>0 && r.right<=t.left+1})()`);
    const collapsedShot = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'note-collapsed-390.png'), Buffer.from(collapsedShot.data, 'base64'));
    await evaluate(`messageHost.querySelector('button').click()`); await pause(300);
    await viewport(1440); await pause(80);
    line.properties.Message = 'Mensaje corto'; await refreshFixture();
    await check('editing a message resets disclosure and hides unnecessary control', `document.querySelector('am-gift-message button').hidden && document.querySelector('am-gift-message button').getAttribute('aria-expanded')==='false' && document.querySelector('[data-am-message-text]').textContent==='Mensaje corto'`);
    await noteSpacing('short note has the same four-pixel gaps without Show more');
    line.properties.Message = 'A\nB'; await refreshFixture();
    await check('an explicit newline can be expanded even when each line is short', `!document.querySelector('am-gift-message button').hidden && getComputedStyle(document.querySelector('[data-am-message-text]')).whiteSpace==='nowrap'`);
    await evaluate(`document.querySelector('am-gift-message button').click()`); await pause(300);
    await check('expanded Message label stays beside the first line of multiline text', `(()=>{const h=document.querySelector('am-gift-message'),r=document.createRange(),d=document.createRange();r.selectNodeContents(h.querySelector('[data-am-message-text]'));d.selectNodeContents(h.closest('.am-gift-properties__message').querySelector('dt'));return Math.abs(r.getClientRects()[0].top-d.getBoundingClientRect().top)<1 && h.querySelector('[data-am-message-text]').textContent==='A\\nB'})()`);
    line.properties.Message = 'L'.repeat(400); await refreshFixture();
    for (const width of [320, 390, 1440]) {
      await viewport(width); await pause(80);
      await check('unbroken message stays inside drawer ' + width, `(()=>{const d=document.querySelector('.cart-drawer__dialog'),t=document.querySelector('[data-am-message-text]');return d.scrollWidth<=d.clientWidth+1 && t.getBoundingClientRect().width<=d.clientWidth && !document.querySelector('am-gift-message button').hidden})()`);
      await check('inline message and edit/delete actions fit at ' + width, `${messageAligned} && ${actionsAligned}`);
      await noteSpacing('compact note spacing at ' + width);
    }
    await viewport(390); await pause(80);
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const tapExtended = async (selector) => {
      const point = await evaluate(`(()=>{const b=document.querySelector('.cart-drawer [data-am-gift-service="note"]').querySelector('${selector}');b.scrollIntoView({block:'center',behavior:'instant'});const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2+21}})()`);
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await tapExtended('[data-am-message-toggle]'); await pause(300);
    await check('touch beyond the compact Show more row expands the message', `document.querySelector('am-gift-message button').getAttribute('aria-expanded')==='true'`);
    await noteSpacing('expanded unbroken mobile note preserves compact spacing');
    await tapExtended('[data-am-message-toggle]'); await pause(300);
    await check('touch beyond the compact Show less row collapses the message', `document.querySelector('am-gift-message button').getAttribute('aria-expanded')==='false'`);
    await tapExtended('[data-am-gift-edit]'); await wait(`document.querySelector('.am-gift-modal').open`);
    await check('extended edit touch target opens the note editor with its original text', `document.querySelector('.am-gift-modal [name="Message"]').value==='${'L'.repeat(400)}'`);
    await evaluate(`document.querySelector('[data-am-gift-close]').click()`);
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    await viewport(1440); await pause(80);
    line.instructions.can_remove = false; await refreshFixture();
    await check('moving edit preserves restrictions on deleting the note', `!document.querySelector('.cart-drawer [data-am-gift-edit]').hidden && document.querySelector('[data-am-gift-service="note"] .cart-items__remove').hidden`);
    line.instructions.can_remove = true; await refreshFixture();
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate(`document.querySelector('am-gift-message button').focus()`);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
    await check('keyboard expands message immediately with reduced motion', `document.querySelector('am-gift-message button').getAttribute('aria-expanded')==='true' && document.querySelector('[data-am-message-viewport]').getAnimations().length===0`);
    await check('inline toggle retains an emphasized visible keyboard focus', `(()=>{const b=document.querySelector('am-gift-message button'),s=getComputedStyle(b);return b.matches(':focus-visible') && s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>=1 && getComputedStyle(b.querySelector('[data-am-message-label]')).textDecorationThickness==='2px'})()`);
    await evaluate(`document.querySelector('am-gift-message button').click()`);
    await check('reduced motion closes without animation', `document.querySelector('am-gift-message button').getAttribute('aria-expanded')==='false' && document.querySelector('[data-am-message-viewport]').getAnimations().length===0`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    assert.equal(line.properties.Message, 'L'.repeat(400), 'Disclosure never mutates cart properties'); checks++;
    line.properties.Message = longMessage;
    await load('view=page');
    await check('cart page keeps full gift message without drawer disclosure', `!document.querySelector('am-gift-message') && document.querySelector('.am-gift-properties').textContent.includes('Segunda línea del regalo.')`);
    await check('cart page retains detail and accordion edit actions and its property presentation', `!!document.querySelector('.cart-items__details [data-am-gift-edit]') && !!document.querySelector('am-cart-gifts [data-am-gift-edit]') && !document.querySelector('.cart-items__quantity-controls [data-am-gift-edit]') && !document.querySelector('.am-gift-properties--drawer')`);
    await check('cart page keeps native note spacing and full-height edit controls', `(()=>{const r=document.querySelector('[data-am-gift-service="note"]');return getComputedStyle(r).getPropertyValue('--am-gift-row-gap')==='' && r.querySelector('[data-am-gift-edit]').getBoundingClientRect().height>=44})()`);
    line.properties.Message = 'Mensaje de prueba';
    await viewport(1440, 1200); await load(); await openDrawer();
    await wait(`document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await check('scroll button is hidden when body content fits', `document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await evaluate(`(()=>{const filler=document.createElement('div');filler.id='scroll-fixture';filler.style.height='1200px';document.querySelector('.cart-form').append(filler);window.outerScroll=scrollY;window.summaryScroll=document.querySelector('.cart-totals').scrollTop})()`);
    await wait(`!document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await check('scroll control floats outside the body scroll mask', `document.querySelector('[data-am-cart-scroll-bottom]').parentElement.classList.contains('cart-drawer__body') && !document.querySelector('.cart-drawer__items').contains(document.querySelector('[data-am-cart-scroll-bottom]'))`);
    await evaluate(`document.querySelector('[data-am-cart-scroll-bottom]').focus();document.querySelector('[data-am-cart-scroll-bottom]').click()`);
    await wait(`(()=>{const v=document.querySelector('.cart-drawer__body .cart-drawer__items');return v.scrollTop>0})()`);
    await check('scroll button starts a smooth body-only transition', `(()=>{const v=document.querySelector('.cart-drawer__body .cart-drawer__items');return v.scrollTop>0 && v.scrollHeight-v.clientHeight-v.scrollTop>2 && scrollY===window.outerScroll && document.querySelector('.cart-totals').scrollTop===window.summaryScroll})()`);
    await wait(`document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await check('scroll button hides at bottom and hands focus to body', `document.activeElement===document.querySelector('.cart-drawer__body .cart-drawer__items') && scrollY===window.outerScroll`);
    await evaluate(`{const v=document.querySelector('.cart-drawer__body .cart-drawer__items');v.scrollTo({top:v.scrollHeight-v.clientHeight-8,behavior:'instant'})}`);
    await wait(`!document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await evaluate(`{const v=document.querySelector('.cart-drawer__body .cart-drawer__items');v.scrollTo({top:v.scrollHeight-v.clientHeight-1,behavior:'instant'})}`);
    await wait(`document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await check('scroll visibility tolerates two pixels at the bottom', `document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await evaluate(`document.getElementById('scroll-fixture').remove()`);
    await wait(`document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await viewport(390, 500); await pause(100);
    await check('scroll visibility responds to resizing the drawer', `(()=>{const v=document.querySelector('.cart-drawer__body .cart-drawer__items');return document.querySelector('[data-am-cart-scroll-bottom]').hidden===(v.scrollHeight-v.clientHeight-v.scrollTop<=2)})()`);
    await evaluate(`document.querySelector('am-gift-message').dataset.message='Texto largo '.repeat(80);document.querySelector('am-gift-message button').hidden=false`); await pause(80);
    await evaluate(`document.querySelector('am-gift-message button').click()`); await pause(300);
    await wait(`!document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await check('expanding a message makes the scroll control available', `!document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate(`document.querySelector('[data-am-cart-scroll-bottom]').click()`);
    await wait(`document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await check('reduced-motion scrolling reaches bottom without moving page', `(()=>{const v=document.querySelector('.cart-drawer__body .cart-drawer__items');return v.scrollHeight-v.clientHeight-v.scrollTop<=2 && scrollY===window.outerScroll})()`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await viewport(1440); await load(); await openDrawer();
  };
  const upsellLoop = async (label) => {
    const host = `document.querySelector('am-cart-upsell slideshow-component')`;
    const atStart = `(()=>{const v=${host}.refs.scroller;return Math.abs(v.scrollLeft)<2})()`;
    const atEnd = `(()=>{const v=${host}.refs.scroller;return Math.abs(v.scrollWidth-v.clientWidth-v.scrollLeft)<2})()`;
    await evaluate(`new Promise(resolve=>{const v=${host}.refs.scroller;let timer;const done=()=>{v.removeEventListener('scroll',changed);resolve()};const changed=()=>{clearTimeout(timer);timer=setTimeout(done,120)};v.addEventListener('scroll',changed);changed()})`);
    await evaluate(`${host}.scrollIntoView({block:'center',behavior:'instant'});${host}.select(${host}.slides.length-1,undefined,{animate:false})`);
    await wait(atEnd); await wait(`!${host}.hasAttribute('transitioning')`); await pause(80);
    await check('upsell Next remains available at the last product ' + label, `${host}.infinite && !${host}.refs.next.disabled && !${host}.autoplay`);
    await evaluate(`${host}.refs.next.click()`); await wait(atStart); await wait(`!${host}.hasAttribute('transitioning')`); await pause(100);
    await check('upsell Next wraps to the first product ' + label, atStart);
    await evaluate(`${host}.refs.previous.focus()`);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
    await wait(atEnd); await wait(`!${host}.hasAttribute('transitioning')`); await pause(100);
    await check('keyboard Previous wraps to the last product ' + label, `${atEnd} && !${host}.refs.previous.disabled && document.activeElement===${host}.refs.previous`);
    await evaluate(`${host}.refs.next.click();${host}.refs.next.click();${host}.refs.next.click()`); await pause(600);
    await check('consecutive upsell clicks keep navigation valid ' + label, `${host}.current>=0 && ${host}.current<${host}.slides.length && !${host}.refs.next.disabled && document.querySelector('.cart-drawer__dialog').scrollWidth<=document.querySelector('.cart-drawer__dialog').clientWidth+1`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate(`${host}.select(0,undefined,{animate:false});${host}.refs.previous.click()`); await wait(atEnd);
    await evaluate(`${host}.refs.next.click()`); await wait(atStart);
    await check('upsell loops with reduced motion ' + label, atStart);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  };
  const upsellColors = async () => {
    const selector = '[data-am-upsell-product-id="3"]';
    const appearance = `(()=>{const s=document.querySelector('${selector}'),b=s.querySelector('button');return{card:getComputedStyle(s).backgroundColor,text:getComputedStyle(s.querySelector('.am-cart-upsell__title')).color,price:getComputedStyle(s.querySelector('.price')).color,button:getComputedStyle(b).backgroundColor,buttonText:getComputedStyle(b).color,heading:getComputedStyle(document.querySelector('.am-cart-upsell__heading')).color,arrow:getComputedStyle(document.querySelector('.am-cart-upsell__arrows button')).color}})()`;
    const baseline = await evaluate(appearance);
    const before = collectionRequests.length;
    const colors = { card_background: '#f1e7d0', card_text: '#413122', button_background: '#04614c', button_text: '#ffffff' };
    Object.entries(colors).forEach(([key, value]) => { settings['am_drawer_upsell_' + key] = value; });
    await refreshFixture(); await pause(300);
    assert.deepEqual(await evaluate(appearance), { ...baseline, card: 'rgb(241, 231, 208)', text: 'rgb(65, 49, 34)', price: 'rgb(65, 49, 34)', button: 'rgb(4, 97, 76)', buttonText: 'rgb(255, 255, 255)' }, 'Upsell colors apply only to cards and their Add buttons'); checks++;
    const point = await evaluate(`(()=>{const r=document.querySelector('${selector} button').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await check('custom upsell button colors remain on hover', `getComputedStyle(document.querySelector('${selector} button')).backgroundColor==='rgb(4, 97, 76)' && getComputedStyle(document.querySelector('${selector} button')).color==='rgb(255, 255, 255)'`);
    await evaluate(`document.querySelector('${selector} button').focus();document.querySelector('${selector} button').click()`);
    await wait(`document.querySelector('#quick-add-dialog dialog').open`);
    await check('upsell colors do not override the Quick Buy modal', `getComputedStyle(document.querySelector('#quick-add-modal-content button')).backgroundColor===${JSON.stringify(baseline.button)}`);
    await evaluate(`document.querySelector('#quick-add-dialog').closeDialog()`); await wait(`!document.querySelector('#quick-add-dialog dialog').open`);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
    await evaluate(`document.querySelector('${selector} button').focus()`);
    await check('custom button keeps a visible keyboard focus indicator', `(()=>{const b=document.querySelector('${selector} button'),s=getComputedStyle(b);return b.matches(':focus-visible') && s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>=1 && s.backgroundColor==='rgb(4, 97, 76)'})()`);
    await evaluate(`document.querySelector('${selector} button').disabled=true`);
    await check('custom button retains disabled state styling', `getComputedStyle(document.querySelector('${selector} button')).opacity==='0.5'`);
    await evaluate(`document.querySelector('${selector} button').disabled=false`);
    for (const key of Object.keys(colors)) {
      Object.keys(colors).forEach((field) => { settings['am_drawer_upsell_' + field] = field === key ? colors[field] : ''; });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
      await refreshFixture(); await pause(300);
      const expected = { ...baseline };
      if (key === 'card_background') expected.card = 'rgb(241, 231, 208)';
      if (key === 'card_text') expected.text = expected.price = 'rgb(65, 49, 34)';
      if (key === 'button_background') expected.button = 'rgb(4, 97, 76)';
      if (key === 'button_text') expected.buttonText = 'rgb(255, 255, 255)';
      assert.deepEqual(await evaluate(appearance), expected, 'Independent upsell setting ' + key); checks++;
    }
    Object.keys(colors).forEach((key) => { settings['am_drawer_upsell_' + key] = ''; });
    await refreshFixture(); await pause(300);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    await check('clearing upsell colors restores the existing appearance', `(()=>{const s=document.querySelector('${selector}'),b=s.querySelector('button');return getComputedStyle(s).backgroundColor===${JSON.stringify(baseline.card)} && getComputedStyle(s.querySelector('.am-cart-upsell__title')).color===${JSON.stringify(baseline.text)} && getComputedStyle(b).backgroundColor===${JSON.stringify(baseline.button)} && getComputedStyle(b).color===${JSON.stringify(baseline.buttonText)}})()`);
    assert.equal(collectionRequests.length, before, 'Color updates never reload recommended products'); checks++;
  };
  const emptyDrawer = async () => {
    const savedSettings = { ...settings };
    items = []; discount = 0;
    assert.equal(settings.am_drawer_hide_continue_shopping, true, 'Empty drawer hides Continue shopping by default'); checks++;
    settings.am_drawer_upsell_enabled = true; settings.am_drawer_upsell_collection = upsellCollection;
    for (const [width, height] of [[320, 900], [390, 900], [749, 900], [750, 900], [1440, 900], [1837, 900], [390, 420]]) {
      await viewport(width, height); await load();
      await check('empty upsell stays lazy ' + width + '/' + height, `!!document.querySelector('am-cart-upsell') && !document.querySelector('[data-am-upsell-product-id]')`);
      await openDrawer(); await wait(`document.querySelectorAll('[data-am-upsell-product-id]').length===8`);
      await check('empty drawer order and accessible heading ' + width + '/' + height, `(()=>{const d=document.querySelector('.cart-drawer__dialog'),h=d.querySelector('#cart-drawer-heading'),p=d.querySelector('.am-cart-progress'),e=d.querySelector('.cart-drawer__empty-state'),u=d.querySelector('am-cart-upsell');return d.getAttribute('aria-labelledby')===h.id && h.getBoundingClientRect().bottom<=p.getBoundingClientRect().top+1 && p.getBoundingClientRect().bottom<=e.getBoundingClientRect().top+1 && e.getBoundingClientRect().bottom<=u.getBoundingClientRect().top+1 && !d.querySelector('.cart-drawer__summary, #checkout, .cart-items__empty-button, #empty-cart-template')})()`);
      await check('empty progress starts at zero ' + width, `document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='0' && document.querySelector('.am-cart-progress__track span').style.getPropertyValue('--am-progress')==='0%' && !document.querySelector('.am-cart-progress [data-complete]') && document.querySelector('.am-cart-progress__messages').textContent.includes('$20.00')`);
      await check('empty drawer fits viewport ' + width + '/' + height, `(()=>{const d=document.querySelector('.cart-drawer__dialog'),r=d.getBoundingClientRect(),v=d.querySelector('.cart-drawer__items').getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1 && d.scrollWidth<=d.clientWidth+1 && v.height>0 && v.bottom<=r.bottom+1 && d.querySelector('.cart-drawer__close-button').getBoundingClientRect().bottom<=innerHeight})()`);
      const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(output, `empty-drawer-${width}-${height}.png`), Buffer.from(screenshot.data, 'base64'));
    }
    await check('short empty drawer offers scroll control', `!document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await evaluate(`document.querySelector('[data-am-cart-scroll-bottom]').focus();document.querySelector('[data-am-cart-scroll-bottom]').click()`);
    await wait(`document.querySelector('[data-am-cart-scroll-bottom]').hidden`);
    await check('empty scroll control returns focus to viewport', `document.activeElement===document.querySelector('.cart-drawer__body .cart-drawer__items')`);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    await wait(`!document.querySelector('.cart-drawer__dialog').open`);
    await pause(350);
    await viewport(1440); settings.am_drawer_hide_continue_shopping = false;
    settings.empty_cart_button_link = '/collections/fixture'; await load(); await openDrawer();
    await check('disabling hide restores configured Continue shopping link', `document.querySelector('.cart-items__empty-button').getAttribute('href')==='/collections/fixture'`);
    settings.am_drawer_hide_continue_shopping = true;
    await load('view=page');
    await check('empty page retains its button and hides drawer modules', `!!document.querySelector('.cart-items__empty-button') && !document.querySelector('.am-cart-progress, am-cart-upsell')`);
    await load('currency=ARS'); await openDrawer();
    await check('empty drawer keeps currency validation', `!document.querySelector('.am-cart-progress')`);
    settings.am_progress_2_threshold = 10; await load('editor'); await openDrawer();
    await check('invalid empty progress keeps editor help', `!document.querySelector('.am-cart-progress') && !!document.querySelector('.am-cart-help')`);
    settings.am_progress_2_threshold = savedSettings.am_progress_2_threshold;
    settings.am_progress_enabled = false; settings.am_drawer_upsell_enabled = false;
    await load(); await openDrawer();
    await check('disabled modules leave an accessible empty drawer', `!!document.querySelector('#cart-drawer-heading') && !!document.querySelector('.cart-drawer__empty-state') && !document.querySelector('.am-cart-progress, am-cart-upsell, #checkout')`);
    settings.am_progress_enabled = true; settings.am_drawer_upsell_enabled = true;
    upsellCandidates = [4, 10, 11];
    await load(); await openDrawer(); await pause(200);
    await check('empty drawer excludes unavailable and service products', `!document.querySelector('[data-am-upsell-product-id]') && getComputedStyle(document.querySelector('am-cart-upsell')).display==='none'`);
    upsellCandidates = popularityOrder; failUpsell = true;
    await load(); await openDrawer(); await pause(200);
    await check('empty upsell errors preserve empty message and progress', `!document.querySelector('[data-am-upsell-product-id]') && !!document.querySelector('.cart-drawer__empty-state') && !!document.querySelector('.am-cart-progress')`);
    await evaluate(`document.querySelector('cart-drawer-component').close()`); await pause(350); await openDrawer();
    await wait(`document.querySelector('[data-am-upsell-product-id="1"]')`);
    await evaluate(`document.querySelector('[data-am-upsell-product-id="1"] form').requestSubmit()`);
    await idle(); await wait(`!!document.querySelector('#checkout') && !document.querySelector('.cart-drawer__empty-state')`);
    assert.equal(cart().item_count, 1, 'First direct upsell adds once'); checks++;
    await check('first direct upsell updates progress and keeps drawer open', `document.querySelector('.cart-drawer__dialog').open && Number(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'))>0 && !document.querySelector('[data-am-upsell-product-id="1"]')`);
    delayNext = 300;
    await evaluate(`document.querySelector('cart-items-component').onLineItemRemove(1)`);
    await wait(`document.documentElement.hasAttribute('data-am-cart-busy')`);
    await check('last drawer line waits for confirmed removal', `!!document.querySelector('.cart-form') && !document.querySelector('.cart-drawer__empty-state')`);
    await idle(); await wait(`!!document.querySelector('.cart-drawer__empty-state') && !!document.querySelector('[data-am-upsell-product-id="1"]')`);
    await check('last removal resets progress and removes checkout without reload', `document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='0' && !document.querySelector('#checkout') && document.querySelector('.cart-drawer__dialog').open && !!document.getElementById(document.querySelector('.cart-drawer__dialog').getAttribute('aria-labelledby'))`);
    await evaluate(`document.querySelector('[data-am-upsell-product-id="3"] button').focus();document.querySelector('[data-am-upsell-product-id="3"] button').click()`);
    await wait(`document.querySelector('#quick-add-dialog dialog').open`);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    await wait(`!document.querySelector('#quick-add-dialog dialog').open`);
    await check('empty Quick Buy cancel returns focus to its trigger', `document.activeElement===document.querySelector('[data-am-upsell-product-id="3"] button') && document.body.style.position==='fixed'`);
    await evaluate(`document.querySelector('[data-am-upsell-product-id="3"] button').click()`);
    await wait(`document.querySelector('#quick-add-dialog dialog').open`);
    await evaluate(`document.querySelector('#quick-add-modal-content form').requestSubmit()`);
    await idle(); await wait(`!!document.querySelector('#checkout') && !document.querySelector('#quick-add-dialog dialog').open`);
    assert.equal(cart().item_count, 1, 'First Quick Buy adds once'); checks++;
    await check('first Quick Buy keeps drawer open with live focus', `document.querySelector('.cart-drawer__dialog').open && document.querySelector('.cart-drawer__dialog').contains(document.activeElement) && !document.querySelector('.cart-drawer__empty-state')`);
    await evaluate(`document.querySelector('cart-items-component').onLineItemRemove(1)`);
    await idle(); await wait(`!!document.querySelector('.cart-drawer__empty-state') && !!document.querySelector('[data-am-upsell-product-id="1"]')`);
    delayNext = 300;
    await evaluate(`document.querySelector('[data-am-upsell-product-id="1"] form').requestSubmit()`);
    await wait(`document.documentElement.hasAttribute('data-am-cart-busy')`);
    await evaluate(`document.querySelector('cart-drawer-component').close()`);
    await idle(); await pause(350);
    await check('first add never reopens a closed empty drawer', `!document.querySelector('.cart-drawer__dialog').open && !!document.querySelector('#checkout')`);
    Object.assign(settings, savedSettings); items = []; discount = 0;
  };
  if (!process.env.AM_QA_DETAILS_ONLY && !process.env.AM_QA_HOTSPOTS_ONLY && !process.env.AM_QA_DENSITY_ONLY && !process.env.AM_QA_UPSELL_ONLY) await emptyDrawer();
  add(1); add(2);
  if (process.env.AM_QA_EMPTY_ONLY) {
    await check('empty drawer scenario leaves no browser exceptions', `${errors.length}===0`);
  } else if (process.env.AM_QA_DETAILS_ONLY) {
    add(11, 1, { _am_gift_service: 'note', From: 'Remitente', To: 'Destinatario', Message: 'Mensaje de prueba' });
    await drawerDetails();
    items = []; add(1);
    settings.am_drawer_upsell_enabled = true; settings.am_drawer_upsell_collection = upsellCollection;
    await viewport(1440); await load(); await openDrawer(); await wait(`document.querySelectorAll('[data-am-upsell-product-id]').length===8`);
    await upsellColors();
  } else {
  if (!process.env.AM_QA_HOTSPOTS_ONLY) {
  if (!process.env.AM_QA_DENSITY_ONLY && !process.env.AM_QA_UPSELL_ONLY) {
  await viewport(1440); await load(); await openDrawer();
  await check('drawer defaults close gifts and hide discounts', `!document.querySelector('[data-am-gift-accordion]').open && !document.querySelector('.cart-discount') && !document.querySelector('.am-cart-checkout-text') && !document.querySelector('am-cart-upsell')`);
  await load('view=page');
  await check('page retains its independent gift and discount defaults', `document.querySelector('[data-am-gift-accordion]').open && !!document.querySelector('.cart-discount') && !document.querySelector('am-cart-upsell')`);
  settings.am_drawer_checkout_text = '<p>Texto editable con <a href="/policies/refund-policy">enlace de ayuda</a>.</p>';
  await load(); await openDrawer();
  await check('drawer rich text appears directly after checkout', `(()=>{const text=document.querySelector('.am-cart-checkout-text');return text.previousElementSibling.id==='checkout' && text.querySelector('a').getAttribute('href')==='/policies/refund-policy'})()`);
  await load('view=page');
  await check('checkout message never leaks into cart page', `!document.querySelector('.am-cart-checkout-text')`);
  settings.am_drawer_checkout_text = '';
  settings.am_drawer_gift_open = true; settings.am_drawer_show_discount = true;
  await viewport(1440); await load(); await openDrawer();
  await check('gift and discount use the same native accordion styling', `(()=>{const style=s=>{const l=document.querySelector(s),c=getComputedStyle(l);return [c.fontFamily,c.fontSize,c.fontWeight,c.color,c.lineHeight].join('|')};return style('.am-cart-gifts__label')===style('.cart-discount__label') && document.querySelector('am-cart-gifts > accordion-custom')!==null})()`);
  await check('action separators have a single source', `(()=>{const actions=document.querySelector('.cart-actions');return actions.contains(document.querySelector('am-cart-gifts')) && !document.querySelector('.cart-actions__divider') && getComputedStyle(document.querySelector('am-cart-gifts')).borderTopWidth==='0px' && getComputedStyle(document.querySelector('.cart-discount')).borderTopWidth==='1px'})()`);
  await check('gift option layout overrides native label styles', `getComputedStyle(document.querySelector('.am-cart-gifts__option')).display==='grid'`);
  await evaluate(`window.giftHeightBefore=document.querySelector('am-cart-gifts').getBoundingClientRect().height`);
  delayNext = 600;
  await evaluate(`void document.querySelector('cart-items-component').updateQuantity({line:1,quantity:1,action:'change'})`);
  await wait(`document.documentElement.hasAttribute('data-am-cart-busy')`);
  await check('ordinary cart updates never add a gift spinner or shift its accordion', `!document.documentElement.hasAttribute('data-am-gift-loading') && getComputedStyle(document.querySelector('am-cart-gifts'),'::after').content==='none' && Math.abs(document.querySelector('am-cart-gifts').getBoundingClientRect().height-window.giftHeightBefore)<1`);
  await idle();
  delayNext = 600;
  await evaluate(`document.querySelector('[data-am-gift-toggle="wrapping"]').click()`);
  await wait(`document.documentElement.hasAttribute('data-am-cart-busy')`);
  await check('wrapping loads inline at its own checkbox without changing accordion height', `(()=>{const label=document.querySelector('[data-am-gift-toggle="wrapping"]').closest('label'),s=getComputedStyle(label,'::before');return document.documentElement.getAttribute('data-am-gift-loading')==='wrapping' && s.content==='""' && s.position==='absolute' && s.animationName==='am-cart-spin' && getComputedStyle(document.querySelector('[data-am-gift-toggle="note"]')).opacity==='1' && getComputedStyle(document.querySelector('am-cart-gifts'),'::after').content==='none' && Math.abs(document.querySelector('am-cart-gifts').getBoundingClientRect().height-window.giftHeightBefore)<1})()`);
  await idle();
  await check('gift loading clears after success', `!document.documentElement.hasAttribute('data-am-gift-loading')`);
  assert.equal(items.filter((i) => i.properties._am_gift_service === 'wrapping').length, 1); checks++;
  await check('wrapping synchronizes checkbox', `document.querySelector('[data-am-gift-toggle="wrapping"]').checked`);
  for (const width of [1440, 390]) {
    await viewport(width); await pause(80);
    await check('gift confirmation is screen-reader-only without footer space at ' + width, drawerGiftConfirmation);
  }
  await viewport(1440);
  await toggle('note');
  await check('opening note does not add a service', `document.querySelector('.am-gift-modal').open && !document.querySelector('[data-am-gift-toggle="note"]').checked`);
  await note('   ');
  await check('blank message cannot add a card', `document.querySelector('.am-gift-modal').open && !document.querySelector('[data-am-gift-toggle="note"]').checked`);
  await note('x'.repeat(401));
  await check('message limit enforced', `document.querySelector('.am-gift-modal').open && !document.querySelector('[data-am-gift-toggle="note"]').checked`);
  delayNext = 600;
  await submitNote();
  await wait(`document.documentElement.hasAttribute('data-am-cart-busy')`);
  await check('note loading stays scoped to the note and save button', `document.documentElement.getAttribute('data-am-gift-loading')==='note' && getComputedStyle(document.querySelector('.am-gift-modal__save'),'::after').animationName==='am-cart-spin' && getComputedStyle(document.querySelector('[data-am-gift-toggle="wrapping"]')).opacity==='1' && document.querySelector('.am-gift-modal fieldset').disabled`);
  await check('starting a gift operation clears the previous feedback completely', `(()=>{const n=document.querySelector('.cart-drawer__summary [data-am-cart-feedback]');return n.hidden && n.textContent==='' && !n.classList.contains('visually-hidden') && !n.classList.contains('am-cart-error')})()`);
  await idle();
  assert.equal(items.find((i) => i.properties._am_gift_service === 'note').properties.Message, 'Mensaje de prueba'); checks++;
  await check('saved note closes modal and preserves drawer scroll lock', `!document.querySelector('.am-gift-modal').open && document.querySelector('.cart-drawer__dialog').open && document.body.style.position==='fixed'`);
  await check('saving a note keeps its success announcement visually hidden', drawerGiftConfirmation);
  await check('translated properties and single-unit services', `document.querySelector('.am-gift-properties').textContent.includes('Remitente') && [...document.querySelectorAll('[data-am-gift-service="note"], [data-am-gift-service="wrapping"]')].every(row=>!row.querySelector('quantity-selector-component, cart-quantity-selector-component'))`);
  await drawerDetails();
  const oldKey = items.find((i) => i.properties._am_gift_service === 'note').key;
  await evaluate(`document.querySelector('[data-am-gift-edit]').click()`); await idle(); await note('Mensaje editado');
  assert.notEqual(items.find((i) => i.properties._am_gift_service === 'note').key, oldKey); checks++;
  assert.equal(items.filter((i) => i.properties._am_gift_service === 'note').length, 1); checks++;
  await check('editing a note keeps its success announcement visually hidden', drawerGiftConfirmation);
  await check('progress includes gift services and crosses levels', `document.querySelectorAll('.am-cart-progress [data-complete]').length===2`);
  await toggle('note');
  await check('removing note clears checkbox and properties', `!document.querySelector('[data-am-gift-toggle="note"]').checked && !document.querySelector('.am-gift-properties')`);
  await check('removing a note keeps its success announcement visually hidden', drawerGiftConfirmation);
  await toggle('note');
  await check('unsaved draft retained in memory', `document.querySelector('[name="Message"]').value==='Mensaje editado'`);
  await evaluate(`document.querySelector('[data-am-gift-close]').click()`);
  const countBefore = items.length;
  failNext = 'reject'; await toggle('wrapping');
  assert.equal(items.length, countBefore); checks++;
  await check('rejected removal rolls back and shows recoverable error', `document.querySelector('[data-am-gift-toggle="wrapping"]').checked && [...document.querySelectorAll('[data-am-cart-feedback]')].some(n=>n.textContent.includes('Sin stock')) && !document.documentElement.hasAttribute('data-am-gift-loading')`);
  await check('gift failures remain visible alerts in the drawer', `(()=>{const n=document.querySelector('.cart-drawer__summary [data-am-cart-feedback]');return !n.hidden && !n.classList.contains('visually-hidden') && n.classList.contains('am-cart-error') && n.getAttribute('role')==='alert' && n.getBoundingClientRect().height>1})()`);
  await toggle('wrapping');
  await check('a successful retry clears the visible error and hides only the confirmation', drawerGiftConfirmation);
  failNext = 'lost'; await toggle('wrapping');
  await check('recovered successful gift response has no visible confirmation', drawerGiftConfirmation);
  assert.equal(items.filter((i) => i.properties._am_gift_service === 'wrapping').length, 1); checks++;
  await toggle('wrapping');
  delayNext = 150;
  await evaluate(`document.querySelector('[data-am-gift-toggle="wrapping"]').click();setTimeout(async()=>{const resource=await(await fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{id:2,quantity:1,properties:{}}]})})).json();const e=new Event('cart:update');e.detail={resource,data:{source:'product-form',sections:resource.sections,itemCount:resource.item_count}};document.dispatchEvent(e);},20)`);
  await idle();
  await check('external add during gift mutation renders latest count', `document.querySelector('[ref="cartItemCount"]').textContent.trim()==='${cart().item_count}' && document.querySelector('[data-am-gift-toggle="wrapping"]').checked`);
  await check('lost response reconciles authoritative state', `document.querySelector('[data-am-gift-toggle="wrapping"]').checked && !document.documentElement.hasAttribute('data-am-cart-unverified') && !document.documentElement.hasAttribute('data-am-gift-loading')`);
  nullSections = true; await toggle('wrapping'); nullSections = false;
  await check('missing section HTML uses fresh section fallback', `!document.querySelector('[data-am-gift-toggle="wrapping"]').checked`);
  await evaluate(`document.querySelector('[data-am-gift-toggle="wrapping"]').click();document.querySelector('[data-am-gift-toggle="wrapping"]').click()`); await idle();
  assert.equal(items.filter((i) => i.properties._am_gift_service === 'wrapping').length, 1); checks++;
  await evaluate(`document.querySelector('[data-am-gift-accordion]').open=false`); await toggle('wrapping');
  await check('accordion state survives morph', `!document.querySelector('[data-am-gift-accordion]').open`);
  await toggle('wrapping'); await toggle('note'); await note();
  await load('view=page');
  await check('page restores both services', `document.querySelector('[data-am-gift-toggle="wrapping"]').checked && document.querySelector('[data-am-gift-toggle="note"]').checked`);
  settings.show_cart_note = true; await load('view=page');
  await check('general note coexists with one separator per action', `document.querySelector('[name="note"]').value==='Nota general conservada' && ['cart-note','.cart-discount'].every(s=>getComputedStyle(document.querySelector('.cart-actions '+s)).borderTopWidth==='1px') && !document.querySelector('.cart-actions__divider')`);
  settings.show_cart_note = false; await load('view=page');
  await evaluate(`document.querySelector('[data-am-gift-service="note"] .cart-items__remove').click()`); await idle();
  await check('line removal synchronizes checkbox', `!document.querySelector('[data-am-gift-toggle="note"]').checked`);
  await check('cart page keeps its visible success confirmation', `(()=>{const n=document.querySelector('[data-am-cart-feedback]');return n.textContent==='Actualizamos tu carrito.' && !n.hidden && !n.classList.contains('visually-hidden') && n.getAttribute('role')==='status' && n.getBoundingClientRect().height>1})()`);
  for (const id of [1, 2]) {
    const key = items.find((item) => item.id === id).key;
    await evaluate(`document.querySelector('[data-key="${key}"] .cart-items__remove').click()`); await idle();
  }
  assert.equal(items.length, 0, 'Last normal line removes services atomically'); checks++;
  add(1); await load('view=page');
  await evaluate(`document.querySelector('[data-am-gift-edit]')?.click()`);
  await toggle('note'); await note('<script>alert(1)</script>\nMensaje');
  await check('customer note is escaped', `document.querySelector('.am-gift-properties').textContent.includes('<script>') && !document.querySelector('.am-gift-properties script')`);
  await check('general order note is independent', `!document.querySelector('[name="note"]')`);
  for (const [total, expected] of [[1000, 0], [2000, 1], [3000, 2], [4000, 3]]) {
    items = []; add(1, total / 1000); await load('view=page');
    await check('threshold ' + total, `document.querySelectorAll('.am-cart-progress [data-complete]').length===${expected}`);
  }
  await check('completed progress has no stale pending message', `!document.querySelector('.am-cart-progress__messages').textContent.includes('Te faltan')`);
  await load('view=page&currency=ARS'); await check('other currency hides progress', `!document.querySelector('.am-cart-progress')`);
  const originalThreshold = settings.am_progress_2_threshold; settings.am_progress_2_threshold = 10;
  await load('view=page&editor'); await check('invalid thresholds show editor help', `!document.querySelector('.am-cart-progress') && document.querySelector('.am-cart-help').textContent.includes('umbrales')`);
  settings.am_progress_2_threshold = originalThreshold;
  for (const [slots, thresholds, samples] of [
    [[1], [20], [[0, 0, 0], [1999, 99.95, 0], [2000, 100, 1], [2001, 100, 1]]],
    [[1, 3], [20, 100], [[1999, 49.975, 0], [2000, 50, 1], [2001, 50.00625, 1], [6000, 75, 1], [9999, 99.99375, 1], [10000, 100, 2]]],
    [[1, 2, 3], [20, 60, 100], [[1999, 33.3166667, 0], [2000, 33.3333333, 1], [2001, 33.3416667, 1], [4000, 50, 1], [5999, 66.6583333, 1], [6000, 66.6666667, 2], [6001, 66.675, 2], [8000, 83.3333333, 2], [9999, 99.9916667, 2], [10000, 100, 3]]],
  ]) {
    for (let slot = 1; slot <= 3; slot++) settings[`am_progress_${slot}_enabled`] = slots.includes(slot);
    slots.forEach((slot, i) => { settings[`am_progress_${slot}_threshold`] = thresholds[i]; });
    for (const [amount, percent, reached] of samples) await progressAt(amount, percent, reached, `${slots.length} tiers / amount ${amount}`);
  }
  settings.am_progress_2_label = 'A longer benefit label that must wrap inside its own segment';
  await load('view=page');
  await check('page keeps its original progress density', `getComputedStyle(document.querySelector('.am-cart-progress')).paddingTop==='16px' && getComputedStyle(document.querySelector('.am-cart-progress__track')).height==='8px'`);
  await check('labels stay within the progress area', `(()=>{const area=document.querySelector('.am-cart-progress').getBoundingClientRect();return [...document.querySelectorAll('.am-cart-progress__label')].every(p=>{const r=p.getBoundingClientRect();return r.left>=area.left && r.right<=area.right})})()`);
  await check('long labels remain centered under numbers', centeredTierLabels);
  await evaluate(`document.documentElement.dir='rtl'`);
  await check('RTL labels remain centered under numbers', centeredTierLabels);
  await evaluate(`document.documentElement.dir='ltr'`);
  settings.am_progress_2_label = 'Beneficio 2';
  items = []; add(1, 8); await load('view=page');
  await evaluate(`document.querySelector('[data-am-gift-accordion]').open=false;document.querySelector('.cart-discount details').open=true;document.querySelector('cart-items-component').updateQuantity({line:1,quantity:4,action:'change'})`);
  await idle();
  await check('quantity removal regresses the visual stage and preserves accordion state', `Math.abs(Number(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'))-50)<0.001 && !document.querySelector('[data-am-gift-accordion]').open && document.querySelector('.cart-discount details').open`);
  await evaluate(`document.querySelector('[name="discount"]').value='FIXTURE';document.querySelector('.cart-discount__form').requestSubmit()`);
  await wait(`document.querySelector('.cart-discount__pill')`);
  await check('discount recalculates amount and stage', `Number(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'))===25 && document.querySelectorAll('.am-cart-progress [data-complete]').length===0 && document.querySelector('.am-cart-progress__messages').textContent.includes('$5.00')`);
  discount = 0;
  for (let slot = 1; slot <= 3; slot++) settings[`am_progress_${slot}_threshold`] = [20, 30, 40][slot - 1];
  }
  if (!process.env.AM_QA_UPSELL_ONLY) {
  if (process.env.AM_QA_DENSITY_ONLY) { items = []; add(1, 4); }
  settings.am_drawer_gift_open = true; settings.am_drawer_show_discount = true;
  for (const width of [320, 390, 749, 750, 1440, 1837]) {
    await viewport(width); await load(); await openDrawer();
    await check('first product has a 12px inset ' + width, `getComputedStyle(document.querySelector('.cart-drawer__items')).paddingTop==='12px' && Math.abs(document.querySelector('.cart-items__table-row').getBoundingClientRect().top-document.querySelector('.cart-drawer__items').getBoundingClientRect().top-12)<=1`);
    await check('compact progress and accessible summaries ' + width, `getComputedStyle(document.querySelector('.am-cart-progress__track')).height==='6px' && document.querySelector('.am-cart-gifts__summary').getBoundingClientRect().height>=44 && document.querySelector('.cart-discount__summary').getBoundingClientRect().height>=44`);
    await check('drawer numbers and labels centered ' + width, centeredTierLabels);
    await check('drawer track shares both header gutters ' + width, `(()=>{const h=document.querySelector('.cart-drawer__header'),r=h.getBoundingClientRect(),s=getComputedStyle(h),t=document.querySelector('.am-cart-progress__track').getBoundingClientRect(),g=getComputedStyle(document.querySelector('.cart-drawer')).getPropertyValue('--am-cart-gutter');return Math.abs(t.left-r.left-parseFloat(s.paddingLeft))<1 && Math.abs(t.right-r.right+parseFloat(g))<1})()`);
    for (const expanded of [false, true]) {
      await evaluate(`document.querySelector('[data-am-gift-accordion]').open=${expanded};document.querySelector('.cart-discount details').open=${expanded}`);
      await pause(150);
      metrics.push(await evaluate(`({width:innerWidth,expanded:${expanded},header:document.querySelector('.cart-drawer__header').getBoundingClientRect().height,bar:document.querySelector('.am-cart-progress').getBoundingClientRect().height,products:document.querySelector('.cart-drawer__items').getBoundingClientRect().height,footer:document.querySelector('.cart-drawer__summary').getBoundingClientRect().height})`));
      await check('footer stays bounded and checkout accessible ' + width + '/' + expanded, `(()=>{const content=document.querySelector('.cart-drawer__content').getBoundingClientRect(),footer=document.querySelector('.cart-drawer__summary').getBoundingClientRect(),button=document.querySelector('#checkout').getBoundingClientRect();return footer.height<=content.height*.55+1 && button.bottom<=innerHeight+1 && button.height>=44})()`);
      if (width === 390 || width === 1440) { const shot = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, `density-${width}-${expanded}.png`), Buffer.from(shot.data, 'base64')); }
    }
    await check('checkout remains inside drawer ' + width, `(()=>{const d=document.querySelector('.cart-drawer__dialog').getBoundingClientRect(),b=document.querySelector('#checkout').getBoundingClientRect();return b.bottom<=d.bottom+1 && b.top>=d.top})()`);
    await check('cart does not overflow horizontally ' + width, `document.querySelector('.cart-drawer__dialog').scrollWidth<=document.querySelector('.cart-drawer__dialog').clientWidth+1`);
    await toggle('note');
    await check('modal fits viewport ' + width, `(()=>{const r=document.querySelector('.am-gift-modal').getBoundingClientRect();return r.width<=innerWidth && r.bottom<=innerHeight+1})()`);
    await evaluate(`document.querySelector('[data-am-gift-close]').click();document.querySelector('cart-drawer-component').close()`); await pause(250);
    await check('circular gallery remains square ' + width, `['card-test','carousel-test'].every(id=>{const r=document.querySelector('#product-card-'+id+' .card-gallery').getBoundingClientRect();return Math.abs(r.width-r.height)<2})`);
    await check('original media ratio preserved ' + width, `getComputedStyle(document.querySelector('#product-card-original-test .card-gallery')).getPropertyValue('--gallery-aspect-ratio').trim()==='4 / 5'`);
    if (width === 390 || width === 1440) {
      await openDrawer(); const shot = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, `cart-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  settings.am_progress_2_label = 'Un segundo beneficio con una etiqueta larga';
  settings.am_progress_3_label = 'Otro regalo especial';
  await viewport(390, 500); await load(); await openDrawer();
  await evaluate(`document.querySelector('[data-am-gift-accordion]').open=true;document.querySelector('.cart-discount details').open=true`);
  await pause(150);
  await check('short viewport keeps checkout visible', `document.querySelector('#checkout').getBoundingClientRect().bottom<=innerHeight+1`);
  await check('long mobile labels remain inside the drawer', `(()=>{const area=document.querySelector('.cart-drawer__dialog').getBoundingClientRect();return [...document.querySelectorAll('.am-cart-progress__label')].every(p=>{const r=p.getBoundingClientRect();return r.left>=area.left && r.right<=area.right})})()`);
  settings.am_progress_2_label = 'Beneficio 2'; settings.am_progress_3_label = 'Beneficio 3';
  if (!process.env.AM_QA_DENSITY_ONLY) {
  await viewport(1440);
  for (const [slots, thresholds, samples] of [
    [[1], [20], [[0, 0, 0], [1000, 25, 0], [1999, 49.975, 0], [2000, 100, 1]]],
    [[1, 3], [20, 100], [[2000, 25, 1], [6000, 50, 1], [9999, 74.99375, 1], [10000, 100, 2]]],
    [[1, 2, 3], [20, 60, 100], [[1999, 16.6583333, 0], [2000, 16.6666667, 1], [4000, 33.3333333, 1], [6000, 50, 2], [8000, 66.6666667, 2], [9999, 83.325, 2], [10000, 100, 3]]],
  ]) {
    for (let slot = 1; slot <= 3; slot++) settings[`am_progress_${slot}_enabled`] = slots.includes(slot);
    slots.forEach((slot, i) => { settings[`am_progress_${slot}_threshold`] = thresholds[i]; });
    for (const [amount, percent, reached] of samples) await progressAt(amount, percent, reached, `drawer ${slots.length} tiers / amount ${amount}`, true);
  }
  for (let slot = 1; slot <= 3; slot++) settings[`am_progress_${slot}_threshold`] = [20, 30, 40][slot - 1];
  await evaluate(`document.documentElement.dir='rtl'`);
  await check('drawer symmetric labels support RTL', centeredTierLabels);
  settings.am_drawer_gift_open = false; settings.am_drawer_show_discount = false;
  settings.am_drawer_checkout_text = '<p>' + 'Mensaje de ayuda para tu compra. '.repeat(8) + '</p>';
  await viewport(390, 500); await load(); await openDrawer();
  await check('drawer message remains scrollable without hiding checkout on short screens', `(()=>{const b=document.querySelector('#checkout').getBoundingClientRect();return b.top>=0 && b.bottom<=innerHeight+1 && document.querySelector('.am-cart-checkout-text').textContent.length>200})()`);
  await check('hidden discount action leaves no separator element', `!document.querySelector('.cart-discount') && document.querySelector('.cart-actions').children.length===1`);
  settings.am_drawer_checkout_text = '';
  }
  }
  if (!process.env.AM_QA_DENSITY_ONLY) {
  items = []; add(1);
  settings.am_drawer_upsell_enabled = true; settings.am_drawer_upsell_collection = upsellCollection;
  settings.am_drawer_upsell_heading = ''; settings.am_drawer_upsell_sort = 'best-selling';
  collectionRequests = [];
  await viewport(1440); await load();
  await check('upsell fetch waits until drawer opens', `!!document.querySelector('am-cart-upsell') && !document.querySelector('[data-am-upsell-product-id]')`);
  assert.equal(collectionRequests.length, 0, 'Closed drawer does not request a collection'); checks++;
  await openDrawer(); await wait(`document.querySelectorAll('[data-am-upsell-product-id]').length===8`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-am-upsell-product-id]')].map(e=>Number(e.dataset.amUpsellProductId))`), [3, 2, 5, 6, 7, 8, 9, 12]); checks++;
  await upsellColors();
  await check('upsell renders native prices and compare-at without reviews', `document.querySelector('[data-am-upsell-product-id="5"] .compare-at-price')!==null && !document.querySelector('am-cart-upsell [data-rating], am-cart-upsell .rating')`);
  await check('upsell uses unique product form identifiers', `(()=>{const ids=[...document.querySelectorAll('am-cart-upsell form[id]')].map(f=>f.id);return ids.length===8 && new Set(ids).size===ids.length})()`);
  await evaluate(`window.upsellFirst=document.querySelector('[data-am-upsell-product-id]');document.querySelector('.am-cart-upsell__arrows .slideshow-control--next').click()`);
  await wait(`document.querySelector('am-cart-upsell slideshow-slides').scrollLeft>20`);
  await pause(350);
  const requestCount = collectionRequests.length;
  await evaluate(`window.upsellScroll=document.querySelector('am-cart-upsell slideshow-slides').scrollLeft;document.querySelector('cart-items-component').updateQuantity({line:1,quantity:2,action:'change'})`);
  await idle(); await pause(100);
  assert.equal(collectionRequests.length, requestCount, 'Quantity changes do not reload recommendations'); checks++;
  await check('quantity morph preserves upsell nodes, scroll and looping', `window.upsellFirst===document.querySelector('[data-am-upsell-product-id]') && Math.abs(window.upsellScroll-document.querySelector('am-cart-upsell slideshow-slides').scrollLeft)<1 && document.querySelector('am-cart-upsell slideshow-component').infinite`);
  await evaluate(`(()=>{const drawer=document.querySelector('cart-drawer-component'),parent=drawer.parentNode,next=drawer.nextSibling;document.body.append(drawer);parent.insertBefore(drawer,next)})()`);
  await pause(50);
  await check('moving an open drawer preserves its modal state and scroll lock', `document.querySelector('.cart-drawer__dialog').open && document.body.style.position==='fixed'`);
  for (const order of ['price-ascending', 'price-descending', 'best-selling']) {
    settings.am_drawer_upsell_sort = order;
    await load(); await openDrawer(); await wait(`document.querySelectorAll('[data-am-upsell-product-id]').length===8`);
    assert.equal(collectionRequests.at(-1), order, 'Requests native collection order ' + order); checks++;
    const eligible = upsellCandidates.map((id) => products.get(id)).filter((p) => p.available && ![1, 10, 11].includes(p.id));
    if (order !== 'best-selling') eligible.sort((a, b) => order === 'price-ascending' ? a.price - b.price : b.price - a.price);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-am-upsell-product-id]')].map(e=>Number(e.dataset.amUpsellProductId))`), eligible.slice(0, 8).map((p) => p.id), 'Keeps native sorted and filtered collection order'); checks++;
  }
  for (const width of [320, 390, 749, 750, 1440, 1837]) {
    await viewport(width); await load(); await openDrawer(); await wait(`document.querySelectorAll('[data-am-upsell-product-id]').length===8`);
    await check('upsell shows exactly 1.2 cards ' + width, `(()=>{const s=document.querySelector('am-cart-upsell slideshow-slides').getBoundingClientRect(),slides=[...document.querySelectorAll('[data-am-upsell-product-id]')],a=slides[0].getBoundingClientRect(),b=slides[1].getBoundingClientRect();return Math.abs((s.right-b.left)/b.width-.2)<.015 && a.width<s.width && b.left>a.right})()`);
    await check('upsell has no drawer overflow and checkout stays visible ' + width, `(()=>{const d=document.querySelector('.cart-drawer__dialog'),r=d.getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1 && d.scrollWidth<=d.clientWidth+1 && document.querySelector('#checkout').getBoundingClientRect().bottom<=innerHeight+1})()`);
    if (width === 390 || width === 1440) {
      await evaluate(`document.querySelector('am-cart-upsell').scrollIntoView({block:'center',behavior:'instant'})`);
      const shot = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, `upsell-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    if (width === 390) {
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      const r = await evaluate(`(()=>{const r=document.querySelector('am-cart-upsell slideshow-slides').getBoundingClientRect();return{x:r.left+r.width*.8,y:r.top+r.height*.5,step:r.width*.1}})()`);
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
      for (let step = 1; step <= 6; step++) { await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x - r.step * step, y: r.y }] }); await pause(20); }
      await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await wait(`document.querySelector('am-cart-upsell slideshow-slides').scrollLeft>20`);
      await check('upsell responds to a real touch swipe', `document.querySelector('am-cart-upsell slideshow-slides').scrollLeft>20`);
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    if (width === 390 || width === 1440) await upsellLoop('8 products / ' + width);
  }
  await viewport(1440); await load(); await openDrawer(); await wait(`document.querySelector('[data-am-upsell-product-id="2"]')`);
  const beforeDirect = cart().item_count;
  await evaluate(`document.querySelector('[data-am-upsell-product-id="2"] form').requestSubmit()`);
  await wait(`!document.querySelector('[data-am-upsell-product-id="2"]')`); await idle();
  assert.equal(cart().item_count, beforeDirect + 1, 'Direct upsell adds the product once'); checks++;
  await check('upsell addition refreshes count and keeps drawer open', `document.querySelector('.cart-drawer__dialog').open && document.querySelector('[ref="cartItemCount"]').textContent.trim()==='${cart().item_count}'`);
  await evaluate(`document.querySelector('[data-am-upsell-product-id="3"] button').focus();document.querySelector('[data-am-upsell-product-id="3"] button').click()`);
  await wait(`document.querySelector('#quick-add-dialog dialog').open`);
  await check('multivariant upsell uses the shared modal with cart context', `document.querySelectorAll('#quick-add-dialog').length===1 && document.querySelector('#quick-add-modal-content product-form-component').hasAttribute('data-am-cart-upsell') && document.querySelector('.cart-drawer__dialog').open`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await wait(`!document.querySelector('#quick-add-dialog dialog').open`);
  await check('Escape returns focus to the upsell trigger and preserves drawer scroll lock', `document.activeElement===document.querySelector('[data-am-upsell-product-id="3"] button') && document.querySelector('.cart-drawer__dialog').open && document.body.style.position==='fixed'`);
  await evaluate(`document.querySelector('[data-am-upsell-product-id="3"] button').click()`);
  await wait(`document.querySelector('#quick-add-dialog dialog').open`);
  const beforeVariantWrites = writes.length;
  await evaluate(`(async()=>{const {VariantSelectedEvent}=await import('@theme/events');history.replaceState({},'',location.pathname+'?variant=1');const f=document.querySelector('#quick-add-modal-content product-form-component');f.dispatchEvent(new VariantSelectedEvent({id:'new-size'}));f.querySelector('form').requestSubmit();f.querySelector('form').requestSubmit()})()`);
  await pause(75);
  assert.equal(writes.length, beforeVariantWrites, 'Variant selection waits for the resolved variant before adding'); checks++;
  await evaluate(`(async()=>{const {VariantUpdateEvent}=await import('@theme/events');const f=document.querySelector('#quick-add-modal-content product-form-component');f.dispatchEvent(new VariantUpdateEvent({id:103,available:true},'fixture',{html:new DOMParser().parseFromString(f.outerHTML,'text/html'),productId:'3'}))})()`);
  await wait(`!document.querySelector('#quick-add-dialog dialog').open && !document.querySelector('[data-am-upsell-product-id="3"]')`); await idle();
  assert.equal(items.find((i) => i.id === 103)?.product_id, 3, 'Quick Buy adds the selected variant'); checks++;
  assert.equal(items.find((i) => i.id === 103)?.quantity, 1, 'Double submit while resolving a variant adds one unit'); checks++;
  assert.equal(writes.length, beforeVariantWrites + 1, 'Pending variant submits collapse to one cart request'); checks++;
  await check('closing Quick Buy preserves drawer scroll lock', `document.querySelector('.cart-drawer__dialog').open && document.body.style.position==='fixed'`);
  await pause(150);
  await check('Quick Buy focus stays in drawer when its recommended product disappears', `document.querySelector('.cart-drawer__dialog').contains(document.activeElement) && document.activeElement.isConnected`);
  failNext = 'reject';
  await evaluate(`document.querySelector('[data-am-upsell-product-id="5"] form').requestSubmit()`);
  await idle(); await wait(`document.querySelector('[data-am-upsell-product-id="5"] [ref="addToCartTextError"]').textContent.includes('Sin stock')`);
  await idle();
  await check('failed upsell leaves checkout available and product retryable', `!document.documentElement.hasAttribute('data-am-cart-busy') && !document.querySelector('[data-am-upsell-product-id="5"] button').disabled && document.querySelector('.cart-drawer__dialog').open`);
  delayNext = 250; maxActiveCartRequests = 0;
  await evaluate(`document.querySelector('[data-am-upsell-product-id="5"] form').requestSubmit();document.querySelector('[data-am-upsell-product-id="5"] form').requestSubmit()`);
  await wait(`document.documentElement.hasAttribute('data-am-cart-busy')`);
  await evaluate(`document.querySelector('cart-items-component').updateQuantity({line:1,quantity:3,action:'change'})`);
  await idle(); await wait(`!document.querySelector('[data-am-upsell-product-id="5"]')`);
  assert.equal(items.find((i) => i.product_id === 5)?.quantity, 1, 'Double submit adds one upsell unit'); checks++;
  assert.equal(maxActiveCartRequests, 1, 'Upsell and quantity mutations share one request queue'); checks++;
  delayNext = 200;
  await evaluate(`document.querySelector('[data-am-upsell-product-id="6"] form').requestSubmit()`);
  await wait(`document.documentElement.hasAttribute('data-am-cart-busy')`);
  await evaluate(`document.querySelector('[data-am-upsell-product-id="6"]').remove()`);
  await idle(); await wait(`document.querySelector('[ref="cartItemCount"]').textContent.trim()==='${cart().item_count}'`);
  assert.equal(items.find((i) => i.product_id === 6)?.quantity, 1, 'An in-flight add survives its source card being removed'); checks++;
  await check('detached upsell form still refreshes the cart', `document.querySelector('[ref="cartItemCount"]').textContent.trim()==='${cart().item_count}' && document.querySelector('.cart-drawer__dialog').open`);
  await wait(`document.querySelector('[data-am-upsell-product-id="7"]')`);
  delayNext = 200;
  await evaluate(`document.querySelector('[data-am-upsell-product-id="7"] form').requestSubmit()`);
  await wait(`document.documentElement.hasAttribute('data-am-cart-busy')`);
  await evaluate(`document.querySelector('cart-drawer-component').close()`);
  await idle(); await pause(350);
  await check('finishing an upsell does not reopen a drawer the customer closed', `!document.querySelector('.cart-drawer__dialog').open && document.body.style.position!=='fixed'`);
  delayUpsellNext = 300;
  await load(); const beforeCancel = collectionRequests.length; await openDrawer();
  await wait(`!!document.querySelector('am-cart-upsell')`);
  for (let i = 0; collectionRequests.length === beforeCancel && i < 100; i++) await pause(10);
  await evaluate(`document.querySelector('am-cart-upsell').dataset.url=document.querySelector('am-cart-upsell').dataset.url.replace('best-selling','price-descending')`);
  await wait(`document.querySelector('[data-am-upsell-product-id]')`); await pause(400);
  assert.equal(collectionRequests.at(-1), 'price-descending', 'Changed configuration requests a fresh collection order'); checks++;
  await check('late collection response cannot replace a newer order', `document.querySelector('[data-am-upsell-product-id]').dataset.amUpsellProductId==='15'`);
  upsellCandidates = [8, 9];
  for (const width of [390, 1440]) {
    await viewport(width); await load(); await openDrawer(); await wait(`document.querySelectorAll('[data-am-upsell-product-id]').length===2`);
    await upsellLoop('2 products / ' + width);
  }
  upsellCandidates = [8];
  await load(); await openDrawer(); await wait(`document.querySelectorAll('[data-am-upsell-product-id]').length===1`);
  await check('single recommendation uses full width without arrows or looping', `(()=>{const s=document.querySelector('am-cart-upsell slideshow-slides').getBoundingClientRect(),a=document.querySelector('[data-am-upsell-product-id]').getBoundingClientRect();return Math.abs(s.width-a.width)<1 && !document.querySelector('.am-cart-upsell__arrows') && !document.querySelector('am-cart-upsell slideshow-component').infinite})()`);
  upsellCandidates = [1, 10, 11, 4];
  await load(); await openDrawer(); await pause(200);
  await check('no eligible recommendations hides entire module', `document.querySelector('am-cart-upsell').children.length===0 && getComputedStyle(document.querySelector('am-cart-upsell')).display==='none'`);
  upsellCandidates = popularityOrder; failUpsell = true;
  await load(); await openDrawer(); await pause(200);
  await check('collection errors stay inside upsell', `!document.querySelector('[data-am-upsell-product-id]') && document.querySelector('.cart-drawer__dialog').open && document.querySelector('#checkout').getBoundingClientRect().height>=44`);
  await evaluate(`document.querySelector('cart-drawer-component').close()`); await pause(300); await openDrawer();
  await wait(`document.querySelector('[data-am-upsell-product-id]')`);
  await check('opening drawer again retries a failed collection request', `!!document.querySelector('[data-am-upsell-product-id]')`);
  await load('view=page');
  await check('upsell setting leaves the cart page unchanged', `!document.querySelector('am-cart-upsell') && !!document.querySelector('.cart-discount')`);
  settings.am_drawer_upsell_enabled = false;
  for (const width of [320, 390, 749, 750, 1440, 1837]) {
    await viewport(width); await load('carousel');
    await evaluate(`document.querySelector('.am-media-product-carousel__slideshow').scrollIntoView({block:'center',behavior:'instant'});document.activeElement.blur()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }); await pause(300);
    const point = await evaluate(`(()=>{const r=document.querySelector('.am-media-product-carousel__slideshow').getBoundingClientRect();return{x:r.left+r.width*.4,y:r.top+r.height*.5}})()`);
    await evaluate(`window.overflowSamples=[];window.overflowTimer=setInterval(()=>window.overflowSamples.push(document.documentElement.scrollWidth-document.documentElement.clientWidth),5)`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }); await pause(300);
    await evaluate(`clearInterval(window.overflowTimer)`);
    await check('outer carousel hover animation stays inside viewport ' + width, `Math.max(...window.overflowSamples)<=1`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }); await pause(300);
    await evaluate(`window.overflowSamples=[];window.overflowTimer=setInterval(()=>window.overflowSamples.push(document.documentElement.scrollWidth-document.documentElement.clientWidth),5);document.querySelector('.am-media-product-carousel__slideshow .slideshow-control--next').focus()`); await pause(300);
    await evaluate(`clearInterval(window.overflowTimer)`);
    await check('outer carousel keyboard animation stays inside viewport ' + width, `Math.max(...window.overflowSamples)<=1`);
  }
  }
  }
  await viewport(1440); await load();
  await evaluate(`document.querySelector('product-hotspot-component').scrollIntoView({block:'center',behavior:'instant'})`);
  const point = await evaluate(`(()=>{const r=document.querySelector('product-hotspot-component').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }); await pause(650);
  await check('desktop hides inactive hotspots', `document.querySelector('product-hotspots').hasAttribute('data-desktop-preview-active') && [...document.querySelectorAll('product-hotspot-component')].filter(p=>getComputedStyle(p).opacity==='0').length===2`);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await pause(500);
  await check('desktop restores hotspots after leave', `!document.querySelector('product-hotspots').hasAttribute('data-desktop-preview-active')`);
  await evaluate(`document.querySelectorAll('product-hotspot-component')[1].querySelector('button').focus()`); await pause(500);
  await check('keyboard reveals focused hotspot', `getComputedStyle(document.activeElement.closest('product-hotspot-component')).opacity==='1'`);
  await evaluate(`document.querySelector('product-hotspots').resetState()`);
  await check('reset clears desktop visibility state', `!document.querySelector('product-hotspots').hasAttribute('data-desktop-preview-active')`);
  for (const mode of ['hover-preview-click-quick-buy', 'click-preview']) {
    await load('mode=' + mode);
    await evaluate(`document.querySelector('product-hotspot-component').scrollIntoView({block:'center',behavior:'instant'})`);
    const p = await evaluate(`(()=>{const r=document.querySelector('product-hotspot-component').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p }); await pause(650);
    await check('inactive hotspots hidden in ' + mode, `document.querySelector('product-hotspots').hasAttribute('data-desktop-preview-active')`);
    // Inspect the synchronous reset before the pointer can start a new preview between CDP calls.
    await check('editor selection restores base in ' + mode, `(()=>{document.querySelectorAll('product-hotspot-component')[1].dispatchEvent(new CustomEvent('shopify:block:select',{bubbles:true}));return !document.querySelector('product-hotspots').hasAttribute('data-desktop-preview-active')})()`);
  }
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await load();
  await evaluate(`document.activeElement.blur();document.querySelector('product-hotspot-component').scrollIntoView({block:'center',behavior:'instant'});document.querySelector('product-hotspot-component').querySelector('button').focus()`);
  await wait(`document.querySelector('product-hotspots').hasAttribute('data-desktop-preview-active')`);
  await check('reduced motion does not animate alternate images', `document.querySelectorAll('[data-hotspot-hover-image]')[0].getAnimations().length===0 && document.querySelectorAll('[data-hotspot-hover-image]')[1].getAnimations().length===0`);
  await evaluate(`document.querySelector('product-hotspots').removeAttribute('data-hide-inactive-desktop');document.querySelector('product-hotspots').resetState();document.activeElement.blur();document.querySelectorAll('product-hotspot-component')[1].querySelector('button').focus()`);
  await pause(100);
  await check('shared consumer without opt-in keeps all hotspots visible', `[...document.querySelectorAll('product-hotspot-component')].every(p=>getComputedStyle(p).opacity==='1')`);
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await viewport(390); await load();
  await evaluate(`{const source=document.querySelector('product-hotspot-component');source.dispatchEvent(new CustomEvent('product-hotspot-hover-image',{bubbles:true,detail:source.getHoverMedia(true)}));}`);
  await pause(100);
  await check('mobile does not enable desktop visibility state', `!document.querySelector('product-hotspots').hasAttribute('data-desktop-preview-active')`);
  await check('touch cards expose Quick Add', `getComputedStyle(document.querySelector('#product-card-card-test .quick-add__button--add')).opacity==='1'`);
  }
  assert.deepEqual(errors, [], 'No browser exceptions'); checks++;
  fs.writeFileSync(path.join(output, 'density.json'), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ checks, writes: writes.length, artifacts: output }, null, 2));
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
}
