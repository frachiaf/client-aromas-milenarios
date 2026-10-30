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
  parse(_, tokens) {
    this.templates = [];
    const stream = this.liquid.parser.parseStream(tokens).on('tag:endform', () => stream.stop()).on('template', (template) => this.templates.push(template));
    stream.start();
  },
  *render(context) { return '<form>' + (yield this.liquid.renderer.renderTemplates(this.templates, context)) + '</form>'; },
});
engine.registerTag('style', {
  parse(_, tokens) {
    this.templates = [];
    const stream = this.liquid.parser.parseStream(tokens).on('tag:endstyle', () => stream.stop()).on('template', (template) => this.templates.push(template));
    stream.start();
  },
  *render(context) { return '<style>' + (yield this.liquid.renderer.renderTemplates(this.templates, context)) + '</style>'; },
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
const render = (file, context) => engine.parseAndRender(clean(read(file)), context, { globals: context });
const image = { src: '/image.svg', width: 600, height: 600, aspect_ratio: 1, alt: 'Producto' };
function product(id, price) {
  const variant = { id, available: true, price, quantity_rule: { min: 1, increment: 1 }, featured_media: { preview_image: image }, url: '/products/test-' + id };
  return { id, title: 'Producto ' + id, handle: 'test-' + id, available: true, has_only_default_variant: true, variants_count: 1,
    variants: [variant], selected_or_first_available_variant: variant, options: ['Title'], options_with_values: [], url: variant.url,
    price, featured_image: image, featured_media: { ...image, preview_image: image }, media: [{ id: id * 10, ...image, preview_image: image, media_type: 'image' }], images: [image] };
}
const products = new Map([[1, product(1, 1000)], [2, product(2, 1500)], [10, product(10, 650)], [11, product(11, 500)]]);
let items = [], serial = 0, writes = [], failNext = '', nullSections = false, delayNext = 0, discount = 0;
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
  else items.push({ id: Number(id), variant_id: Number(id), key: `${id}:${++serial}`, quantity, properties, product: p,
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
const styles = ['snippets/accordion-custom-component.liquid', 'snippets/header-actions.liquid', 'snippets/cart-items-component.liquid', 'snippets/cart-products.liquid', 'snippets/cart-summary.liquid', 'sections/main-cart.liquid',
  'snippets/product-card.liquid', 'snippets/card-gallery.liquid', 'snippets/quick-add-styles.liquid', 'snippets/add-to-cart-button.liquid', 'snippets/slideshow-styles.liquid',
  'snippets/slideshow-slide.liquid', 'sections/am--media-product-carousel.liquid', 'sections/product-hotspots.liquid'].map(css).join('\n') + ':root{--height-buy-buttons:48px;--icon-size-xs:16px;--icon-size-sm:20px;--icon-size-md:24px;--padding-2xs:6px;--margin-sm:12px;--margin-2xs:8px}';
const imports = JSON.parse(read('snippets/scripts.liquid').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1].replace(/\{\{\s*'([^']+)'\s*\|\s*asset_url\s*\}\}/g, '/assets/$1'));
async function page() {
  const cards = `<div class="fixture-cards">${await card()}${await card('original', 'original-test')}<div class="am-media-product-carousel__product-slide" style="--am-card-height:360px;--am-card-content-padding:16px">${await card('circular', 'carousel-test')}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/base.css"><link rel="stylesheet" href="/assets/product-hotspot.css"><style>:root{--sidebar-width:480px;--page-margin:20px;--page-width:1200px;--spacing-scale:1;--color-background:#fff;--color-foreground:#222;--color-border:#ddd;--color-foreground-rgb:34 34 34;--color-primary-button-background:#624534;--color-primary-button-text:#fff;--button-size:40px;--button-size-md:44px;--minimum-touch-target:44px;--focus-outline-width:2px;--focus-outline-offset:3px;--padding-sm:12px;--padding-md:16px;--padding-lg:20px;--padding-xl:24px;--padding-2xl:28px;--gap-xl:24px;--gap-2xs:6px;--gap-xs:8px;--font-size--2xs:12px;--cart-font-size--sm:14px;--font-paragraph--family:Arial;--font-paragraph--size:16px;--font-paragraph--weight:400;--font-paragraph--line-height:1.4}body{margin:0;font-family:Arial}button{cursor:pointer}[hidden]{display:none!important}.fixture-cards{display:flex;overflow:auto;max-width:calc(100% - 48px);gap:24px;margin:24px}.fixture-cards>*{flex:0 0 230px}.fixture-cards product-card{width:230px}.cart-page{max-width:1200px;margin:auto}.section-product-hotspots{min-height:480px} ${styles}</style><script>window.Shopify={designMode:false,routes:{root:'/'},locale:'es'};window.Theme={utilities:{},routes:{cart_url:'/cart',cart_add_url:'/cart/add.js',cart_change_url:'/cart/change',cart_update_url:'/cart/update'},translations:{cart_count:'Productos',added:'Agregado'}};</script><script type="importmap">${JSON.stringify(imports)}</script><script type="module" src="/assets/accordion-custom.js"></script><script type="module" src="/assets/cart-discount.js"></script><script type="module" src="/assets/product-card.js"></script><script type="module" src="/assets/slideshow.js"></script></head><body>${await section()}${await render('snippets/am--cart-features.liquid', context())}${cards}${await hotspots()}</body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/fixture') {
      res.setHeader('Content-Type', 'text/html');
      if (url.searchParams.has('section_id')) return res.end(await section());
      current = url.searchParams;
      return res.end(await page());
    }
    if (url.pathname === '/cart.js') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(cart())); }
    if (/^\/cart\/(add|update|change)(\.js)?$/.test(url.pathname)) {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw); writes.push({ path: url.pathname, body });
      const delay = delayNext; delayNext = 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      res.setHeader('Content-Type', 'application/json');
      if (failNext === 'reject') { failNext = ''; res.writeHead(422); return res.end(JSON.stringify({ description: 'Sin stock' })); }
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
    await cdp('Page.navigate', { url: base + '/fixture?' + query });
    await wait(`customElements.get('am-gift-note-modal') && document.querySelector('cart-items-component')?.refs && document.querySelector('product-hotspot-component')?.refs?.trigger`);
    await idle(); await pause(150);
  };
  const viewport = (width, height = 900) => cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 750 });
  const openDrawer = async () => { await evaluate(`document.querySelector('cart-drawer-component').open()`); await wait(`document.querySelector('.cart-drawer__dialog').open`); };
  const toggle = async (role) => { await evaluate(`document.querySelector('[data-am-gift-toggle="${role}"]').click()`); await idle(); };
  const submitNote = async (text = 'Mensaje de prueba') => {
    await evaluate(`{ const modal=document.getElementById('AMGiftNoteModal'); modal.querySelector('[name="From"]').value='Remitente';modal.querySelector('[name="To"]').value='Destinatario';modal.querySelector('[name="Message"]').value=${JSON.stringify(text)};modal.querySelector('[name="Message"]').dispatchEvent(new Event('input',{bubbles:true}));modal.querySelector('form').requestSubmit(); }`);
  };
  const note = async (text) => { await submitNote(text); await idle(); };
  const centeredTierLabels = `(()=>{const area=document.querySelector('.am-cart-progress').getBoundingClientRect();return [...document.querySelectorAll('.am-cart-progress__check')].every(p=>{const badge=p.getBoundingClientRect(),label=p.nextElementSibling.getBoundingClientRect();return Math.abs(badge.left+badge.width/2-label.left-label.width/2)<1 && label.left>=area.left && label.right<=area.right})})()`;
  const metrics = [];
  const progressAt = async (amount, percent, reached, label) => {
    items = []; add(1); Object.assign(items[0], { price: amount, original_price: amount, final_price: amount });
    await load('view=page');
    await check(label, `(()=>{const track=document.querySelector('.am-cart-progress__track'),box=track.getBoundingClientRect(),fill=track.firstElementChild.getBoundingClientRect();return Math.abs(Number(track.getAttribute('aria-valuenow'))-${percent})<0.0001 && Math.abs(fill.width-box.width*${percent}/100)<1 && document.querySelectorAll('.am-cart-progress [data-complete]').length===${reached}})()`);
    await check('marker alignment: ' + label, `(()=>{const track=document.querySelector('.am-cart-progress__track').getBoundingClientRect(),points=[...document.querySelectorAll('.am-cart-progress__check')];return points.every((p,i)=>{const r=p.getBoundingClientRect();return Math.abs(r.left+r.width/2-track.left-track.width*(i+1)/points.length)<1})})()`);
    await check('numbers centered over tier labels: ' + label, centeredTierLabels);
  };
  add(1); add(2);
  if (!process.env.AM_QA_HOTSPOTS_ONLY) {
  if (!process.env.AM_QA_DENSITY_ONLY) {
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
  await idle();
  assert.equal(items.find((i) => i.properties._am_gift_service === 'note').properties.Message, 'Mensaje de prueba'); checks++;
  await check('saved note closes modal and preserves drawer scroll lock', `!document.querySelector('.am-gift-modal').open && document.querySelector('.cart-drawer__dialog').open && document.body.style.position==='fixed'`);
  await check('translated properties and single-unit services', `document.querySelector('.am-gift-properties').textContent.includes('Remitente') && [...document.querySelectorAll('[data-am-gift-service="note"], [data-am-gift-service="wrapping"]')].every(row=>!row.querySelector('quantity-selector-component, cart-quantity-selector-component'))`);
  const oldKey = items.find((i) => i.properties._am_gift_service === 'note').key;
  await evaluate(`document.querySelector('[data-am-gift-edit]').click()`); await idle(); await note('Mensaje editado');
  assert.notEqual(items.find((i) => i.properties._am_gift_service === 'note').key, oldKey); checks++;
  assert.equal(items.filter((i) => i.properties._am_gift_service === 'note').length, 1); checks++;
  await check('progress includes gift services and crosses levels', `document.querySelectorAll('.am-cart-progress [data-complete]').length===2`);
  await toggle('note');
  await check('removing note clears checkbox and properties', `!document.querySelector('[data-am-gift-toggle="note"]').checked && !document.querySelector('.am-gift-properties')`);
  await toggle('note');
  await check('unsaved draft retained in memory', `document.querySelector('[name="Message"]').value==='Mensaje editado'`);
  await evaluate(`document.querySelector('[data-am-gift-close]').click()`);
  const countBefore = items.length;
  failNext = 'reject'; await toggle('wrapping');
  assert.equal(items.length, countBefore); checks++;
  await check('rejected removal rolls back and shows recoverable error', `document.querySelector('[data-am-gift-toggle="wrapping"]').checked && [...document.querySelectorAll('[data-am-cart-feedback]')].some(n=>n.textContent.includes('Sin stock')) && !document.documentElement.hasAttribute('data-am-gift-loading')`);
  await toggle('wrapping');
  failNext = 'lost'; await toggle('wrapping');
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
  if (process.env.AM_QA_DENSITY_ONLY) { items = []; add(1, 4); }
  for (const width of [320, 390, 749, 750, 1440]) {
    await viewport(width); await load(); await openDrawer();
    await check('first product has a 12px inset ' + width, `getComputedStyle(document.querySelector('.cart-drawer__items')).paddingTop==='12px' && Math.abs(document.querySelector('.cart-items__table-row').getBoundingClientRect().top-document.querySelector('.cart-drawer__items').getBoundingClientRect().top-12)<=1`);
    await check('compact progress and accessible summaries ' + width, `getComputedStyle(document.querySelector('.am-cart-progress__track')).height==='6px' && document.querySelector('.am-cart-gifts__summary').getBoundingClientRect().height>=44 && document.querySelector('.cart-discount__summary').getBoundingClientRect().height>=44`);
    await check('drawer numbers and labels centered ' + width, centeredTierLabels);
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
    await evaluate(`document.querySelectorAll('product-hotspot-component')[1].dispatchEvent(new CustomEvent('shopify:block:select',{bubbles:true}))`);
    await check('editor selection restores base in ' + mode, `!document.querySelector('product-hotspots').hasAttribute('data-desktop-preview-active')`);
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
  assert.deepEqual(errors, [], 'No browser exceptions'); checks++;
  fs.writeFileSync(path.join(output, 'density.json'), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ checks, writes: writes.length, artifacts: output }, null, 2));
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
}
