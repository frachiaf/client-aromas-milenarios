import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
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

const templates = {
  'templates/product.json': 'am_product_tier_unlock_KEjX7Y',
  'templates/product.velas.json': 'am_product_tier_unlock_DmhbTk',
  'templates/product.splash.json': 'am_product_tier_unlock_kwzkWA',
};
const findParent = (node, id) => {
  if (!node || typeof node !== 'object') return null;
  if (node.blocks?.[id]) return node;
  for (const value of Object.values(node)) {
    const found = findParent(value, id);
    if (found) return found;
  }
  return null;
};
for (const [file, id] of Object.entries(templates)) {
  const source = read(file);
  const parent = findParent(JSON.parse(source.replace(/^\s*\/\*[\s\S]*?\*\//, '')), id);
  assert.equal(parent?.type, 'add-to-cart', `${file} nests the unlock block`);
  assert.deepEqual(parent.block_order, [id]);
  assert.equal(parent.blocks[id].settings.highlight_color, '#FFC300');
  assert.equal(parent.blocks[id].settings.message, '');
  assert.equal(source.split(`"${id}"`).length - 1, 2, `${file} keeps a single instance`);
  checks += 1;
  console.log('PASS', file);
}

const addToCart = read('blocks/add-to-cart.liquid');
const buttonIndex = addToCart.indexOf("render 'add-to-cart-button'");
const nestedIndex = addToCart.indexOf("content_for 'blocks'");
assert.ok(buttonIndex > 0 && nestedIndex > buttonIndex, 'the message renders after the button');
assert.match(addToCart, /class="am-add-to-cart"/);
assert.match(addToCart, /"type": "am--product-tier-unlock"/);
assert.match(addToCart, /\.product-form-buttons:has\(\.am-add-to-cart :is\(am-tier-unlock, \.am-tier-unlock\)\) \{\s*align-items: flex-start;/);
assert.match(addToCart, /\.product-form-buttons > \.am-add-to-cart\.am-add-to-cart \{\s*display: grid;[\s\S]*align-self: flex-start;/);
const styles = read('blocks/am--product-tier-unlock.liquid');
assert.match(styles, /\.am-add-to-cart > :is\(am-tier-unlock, \.am-tier-unlock\) \{[\s\S]*min-width: 100%;[\s\S]*text-align: center;/);
assert.match(styles, /\.am-add-to-cart \.am-tier-unlock__message,\s*\.am-add-to-cart \.am-tier-unlock__help \{\s*min-width: 0;\s*text-align: center;/);
checks += 1;
console.log('PASS placement contract');

const stylesheet = [addToCart, styles].map((source) => source.match(/\{% stylesheet %\}([\s\S]*?)\{% endstylesheet %\}/)[1]).join('\n');
const row = (id, message) => `<div id="${id}"><div class="product-form-buttons">
  <div class="quantity-selector-wrapper"><div class="quantity-selector">1</div></div>
  <span class="am-add-to-cart"><add-to-cart-component><button class="add-to-cart-button button" type="button">Agregar al carrito</button></add-to-cart-component>${message}</span>
</div></div>`;
const message = '<am-tier-unlock class="am-tier-unlock"><p class="am-tier-unlock__message">Agregalo al carrito y desbloqueás envío gratis en todo el país.</p></am-tier-unlock>';
const fixture = `<!doctype html><html><head><style>
  :root { --gap-xs: 8px; --gap-sm: 16px; }
  body { margin: 0; }
  #column { width: min(560px, 100%); }
  .product-form-buttons { display: flex; flex-wrap: wrap; gap: var(--gap-sm); }
  .product-form-buttons > *:not(.quantity-selector-wrapper) { flex: 1 1 185px; min-width: fit-content; }
  .quantity-selector { width: 110px; height: 48px; }
  .product-form-buttons button { width: 100%; height: 48px; padding: 0; }
  ${stylesheet}
</style></head><body><div data-am-main-product><div id="column">
  ${row('visible', message)}
  ${row('hidden', message.replace('<am-tier-unlock', '<am-tier-unlock hidden'))}
  ${row('bare', '')}
</div></div></body></html>`;
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'am-tier-unlock-'));
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fixture);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((item) => fs.existsSync(item));
assert.ok(chromePath, 'Set CHROME_PATH to a Chromium browser.');
const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { port = fs.readFileSync(path.join(output, 'chrome/DevToolsActivePort'), 'utf8').split('\n')[0]; break; } catch { await pause(100); }
  }
  assert.ok(port, 'Chrome CDP available');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let serial = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const payload = JSON.parse(data);
    if (!payload.id) return;
    const task = pending.get(payload.id);
    if (!task) return;
    pending.delete(payload.id);
    payload.error ? task.reject(payload.error) : task.resolve(payload.result);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  for (let attempt = 0; attempt < 50 && !await evaluate('Boolean(document.querySelector("#visible .am-tier-unlock__message"))'); attempt += 1) await pause(50);
  const measure = `(() => {
    const box = (selector) => { const node = document.querySelector(selector); const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; };
    const textOf = (selector) => { const range = document.createRange(); range.selectNodeContents(document.querySelector(selector)); return range.getBoundingClientRect(); };
    const button = box('#visible .add-to-cart-button');
    const text = textOf('#visible .am-tier-unlock__message');
    const quantity = box('#visible .quantity-selector');
    const hidden = box('#hidden .product-form-buttons');
    const bare = box('#bare .product-form-buttons');
    const visible = box('#visible .product-form-buttons');
    return {
      centerDelta: Math.abs((text.left + text.right) / 2 - (button.left + button.right) / 2),
      below: text.top >= button.bottom - 1,
      quantityLeft: quantity.right <= button.left + 1,
      aligned: Math.abs(quantity.top - button.top) <= 1,
      inside: text.left >= button.left - 1 && text.right <= button.right + 1,
      hiddenSame: Math.abs(hidden.height - bare.height) <= 1,
      taller: visible.height > hidden.height + 8,
    };
  })()`;
  for (const width of [1280, 390]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 750 });
    await pause(50);
    const layout = await evaluate(measure);
    assert.ok(layout.centerDelta <= 1, `${width}px text center ${layout.centerDelta}`);
    assert.equal(layout.below, true, `${width}px message is below the button`);
    assert.equal(layout.quantityLeft, true, `${width}px quantity stays left`);
    assert.equal(layout.aligned, true, `${width}px quantity aligns with the button`);
    assert.equal(layout.inside, true, `${width}px text stays within the button`);
    assert.equal(layout.hiddenSame, true, `${width}px hidden message adds no height`);
    assert.equal(layout.taller, true, `${width}px visible message adds height`);
    checks += 1;
    console.log('PASS', `${width}px`, JSON.stringify(layout));
  }
} finally {
  ws?.close();
  chrome.kill();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`OK ${checks}`);
