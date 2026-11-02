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
let Liquid;
for (const candidate of [process.env.LIQUIDJS_PATH, 'liquidjs',
  path.join(process.env.APPDATA || '', 'npm/node_modules/@shopify/theme/node_modules/liquidjs'),
  path.join(path.dirname(process.execPath), 'node_modules/@shopify/cli/node_modules/liquidjs')].filter(Boolean)) {
  try { ({ Liquid } = require(candidate)); break; } catch {}
}
assert.ok(Liquid, 'Install liquidjs or set LIQUIDJS_PATH.');
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  .find((file) => fs.existsSync(file));
assert.ok(chromePath, 'Set CHROME_PATH to a Chromium browser.');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'am-header-images-qa-'));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (text) => JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
const schema = (file) => json(read(file).match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
const defaults = (file) => Object.fromEntries(schema(file).settings.filter((s) => s.id).map((s) => [s.id, s.default]));
const css = (file) => read(file).match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)?.[1] || '';
const translations = json(read('locales/es.json'));
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const imageBlock = 'blocks/_am--header-menu-image.liquid';
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid', strictFilters: false });
for (const name of ['doc', 'schema', 'stylesheet', 'javascript']) {
  engine.registerTag(name, { parse(_, tokens) { while (tokens.length && tokens.shift().name !== 'end' + name) {} }, render() { return ''; } });
}
for (const name of ['style', 'paginate']) {
  engine.registerTag(name, {
    parse(_, tokens) {
      this.templates = [];
      this.liquid.parser.parseStream(tokens).on('tag:end' + name, function () { this.stop(); })
        .on('template', (template) => this.templates.push(template)).start();
    },
    *render(context) {
      const result = yield this.liquid.renderer.renderTemplates(this.templates, context);
      return name === 'style' ? '<style>' + result + '</style>' : result;
    },
  });
}
engine.registerTag('content_for', {
  parse(token) { this.args = token.args; },
  render(context) {
    const key = this.args.startsWith("'blocks'") ? 'images' : this.args.includes('_header-logo') ? 'logo'
      : this.args.includes("'mobile'") ? 'mobile' : this.args.includes("'navigation_bar'") ? 'navigation_bar' : 'desktop';
    return context.get(['fixture', key]) || '';
  },
});
engine.registerFilter('t', (key) => key.split('.').reduce((value, part) => value?.[part], translations) || key);
engine.registerFilter('asset_url', (name) => '/assets/' + name);
engine.registerFilter('stylesheet_tag', (url) => `<link rel="stylesheet" href="${url}">`);
engine.registerFilter('inline_asset_content', (name) => read('assets/' + name));
engine.registerFilter('image_url', (image) => image.src);
engine.registerFilter('image_tag', (src, ...args) => `<img src="${escape(src)}" width="200" height="100" ${args.filter(Array.isArray)
  .filter(([key]) => !['widths', 'sizes'].includes(key)).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}>`);
const render = (file, context) => engine.parseAndRender(read(file).replace(/render 'header-actions'[^\n]*/, "echo fixture.actions"), context, { globals: context });
const attrs = (id) => `data-shopify-editor-block='${JSON.stringify({ id, type: '_am--header-menu-image' })}'`;
let checks = 0;
const pass = (label) => { checks++; console.log('PASS', label); };

for (const file of fs.readdirSync(path.join(root, 'locales'))) {
  if (!file.endsWith('.json')) continue;
  const data = json(read('locales/' + file));
  if (file.endsWith('.schema.json')) {
    for (const key of ['menu_image', 'menu_item_text', 'menu_item_text_info', 'size_desktop', 'size_mobile', 'text_gap', 'position_desktop', 'position_mobile']) {
      assert.ok(data.am_header[key], `${file}: ${key}`);
    }
  } else assert.ok(data.am_header.menu_image_help, file);
}
assert.deepEqual(schema('sections/header.liquid').blocks, [{ type: '_am--header-menu-image' }]);
assert.equal(schema(imageBlock).tag, null);
assert.equal(schema(imageBlock).presets.length, 1);
assert.deepEqual(defaults(imageBlock), { image: undefined, menu_item_text: undefined, position_desktop: 'top', position_mobile: 'top', size_desktop: 48, size_mobile: 32, text_gap: 6 });
for (const id of ['position_desktop', 'position_mobile']) {
  assert.deepEqual(schema(imageBlock).settings.find((setting) => setting.id === id).options.map(({ value }) => value), ['top', 'left', 'right']);
}
pass('schemas, defaults, private targeting and all 51 locale files');

const link = (title, handle, links = []) => ({ title, handle, url: '/collections/' + handle, links, type: 'http_link', current: handle === 'shop', active: handle === 'shop' });
async function fixture(options = {}) {
  const scheme = { id: 'scheme-1', settings: { background: { rgb: '247, 247, 247', rgba: '247, 247, 247, 1', alpha: 1 } } };
  const section = { id: 'header-test', index: options.hydrated ? null : 1, blocks: [], settings: {
    ...defaults('sections/header.liquid'), color_scheme_top: scheme, color_scheme_bottom: scheme,
    menu_row: options.row || 'top', logo_position: 'left', menu_position: 'center', show_search: false,
    enable_transparent_header_home: !!options.transparent, enable_sticky_header: options.sticky || 'always',
  } };
  const menu = { levels: options.levels || 2, links: [link('Shop', 'shop'),
    link('Entertaining', 'entertaining', [link('Shop', 'child-shop', options.levels === 3 ? [link('Explore', 'grandchild')] : [])]),
    link('Explore', 'explore'), link('Shop all', 'shop-all'),
    ...(options.repeated ? [link('SHOP', 'second-shop')] : []),
    ...Array.from({ length: options.extra || 0 }, (_, i) => link('Other item ' + i, 'other-' + i))] };
  const context = { section, request: { design_mode: options.editor !== false, page_type: 'index' }, template: { name: 'index' },
    shop: { name: 'Aromas', customer_accounts_enabled: false }, settings: {},
    localization: { available_languages: [], available_countries: [] }, fixture: {} };
  const block = { id: 'header-menu', shopify_attributes: '', settings: {
    ...defaults('blocks/_header-menu.liquid'), menu, color_scheme: scheme, menu_style: 'text',
    type_font_primary_link: 'body', menu_font_style: 'regular', navigation_bar: options.bar !== false,
    drawer_accordion: options.accordion !== false,
  } };
  for (const variant of ['', 'mobile', 'navigation_bar']) {
    context.fixture[variant || 'desktop'] = await render('blocks/_header-menu.liquid', { ...context, block, variant });
  }
  context.fixture.logo = '<a class="header-logo" href="/">AROMAS</a>';
  context.fixture.actions = '<a href="/cart">Carrito</a>';
  const images = options.empty ? [] : [
    ['shop', '  SHOP  ', '/square.svg'], ['entertaining', 'Entertaining', '/wide.png'], ['explore', 'explore', '/tall.svg'],
    ['unmatched', 'Shop al', '/square.svg'], ['empty', 'Shop', null], ['duplicate', 'Shop', '/tall.svg'],
  ];
  section.blocks = images.map(([id]) => ({ id }));
  context.fixture.images = '';
  for (const [id, name, src] of images) {
    const imageSettings = {
      ...defaults(imageBlock), menu_item_text: name, image: src ? { src } : null,
      ...(options.sizes || {}), ...(options.positions || {}),
    };
    if (options.legacyPositions) {
      delete imageSettings.position_desktop;
      delete imageSettings.position_mobile;
    }
    context.fixture.images += await render(imageBlock, { ...context, block: { id, shopify_attributes: attrs(id), settings: imageSettings } });
  }
  const html = await render('sections/header.liquid', context);
  const importmap = Object.fromEntries([...read('snippets/scripts.liquid').matchAll(/"(@theme\/[^\"]+)": "{{ '([^']+)' \| asset_url }}"/g)]
    .map(([, key, value]) => [key, '/assets/' + value]));
  const styles = ['sections/header.liquid', 'blocks/_header-menu.liquid', 'snippets/header-drawer.liquid',
    'snippets/accordion-custom-component.liquid', imageBlock].map(css).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <script type="importmap">${JSON.stringify({ imports: importmap })}</script>
    <script>window.Theme={utilities:{},mediaQueries:{mobile:'(max-width: 749px)'}};window.Shopify={designMode:${options.editor !== false}};</script>
    <link rel="stylesheet" href="/assets/base.css"><style>:root{--color-foreground:#222;--color-foreground-rgb:34,34,34;--color-background:#f7f7f7;
    --font-body--family:Georgia,serif;--font-body--style:normal;--font-body--weight:400;--font-size--xl:20px;--font-size--xlarge:24px;
    --font-size--body:16px;--font-size--body-sm:14px;--menu-font-sm--size:14px;--menu-font-sm--line-height:1.2;
    --menu-font-md--size:16px;--menu-font-md--line-height:1.2;--menu-font-2xl--size:22px;--menu-font-2xl--line-height:1.2;
    --gap-xl:24px;--gap-xs:4px;--gap-sm:8px;--padding-2xs:4px;--padding-3xs:2px;--padding-xs:8px;--padding-sm:12px;
    --padding-md:16px;--padding-lg:20px;--padding-xl:24px;--padding-2xl:32px;--padding-3xl:40px;
    --margin-2xs:4px;--minimum-touch-target:44px;--icon-size-sm:24px;--icon-size-xs:20px;--icon-stroke-width:1px;
    --focus-outline-offset:2px;--focus-outline-width:2px;--page-margin:20px;--section-padding-inline:20px;
    --page-content-width:1200px;--full-page-grid-with-margins:20px minmax(0,1fr) 20px;--opacity-subdued-text:.7;
    --animation-speed:250ms;--animation-speed-fast:150ms;--animation-speed-slow:300ms;--animation-easing:ease;--ease-out-cubic:ease;
    --layer-header-menu:10;--layer-menu-drawer:20;--layer-overlay:5;--layer-raised:1;--style-border-radius-lg:0;--page-width:1440px;
    --drawer-width:100vw;--drawer-max-width:400px;}
    ${styles}
    ${options.extra ? 'header-menu,.header-menu__inner{width:600px}header-menu .menu-list,header-menu overflow-list{width:100%}' : ''}
    </style></head><body><div id="header-group"><header class="shopify-section header-section" id="shopify-section-header-test">${html}</header></div>
    <main style="min-height:2000px">Contenido</main><script type="module" src="/assets/accordion-custom.js"></script>
    <script type="module" src="/assets/overflow-list.js"></script></body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/assets/')) {
      const file = path.basename(url.pathname);
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
      return res.end(read('assets/' + file));
    }
    if (url.pathname === '/wide.png') {
      res.setHeader('Content-Type', 'image/png');
      return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVQImWNkYGD4z8AAAAYCAQBF4YfdAAAAAElFTkSuQmCC', 'base64'));
    }
    if (url.pathname.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${url.pathname === '/tall.svg' ? '50 100' : '100 100'}"><circle cx="25" cy="25" r="24" fill="#444"/></svg>`);
    }
    if (url.pathname === '/fixture') {
      res.setHeader('Content-Type', 'text/html');
      return res.end(await fixture(json(url.searchParams.get('options') || '{}')));
    }
    res.writeHead(204); res.end();
  } catch (error) { res.writeHead(500); res.end(error.stack); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = fs.readFileSync(path.join(output, 'chrome/DevToolsActivePort'), 'utf8').split('\n')[0]; break; } catch { await pause(100); }
  }
  assert.ok(port, 'Chrome CDP available');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let serial = 0;
  const pending = new Map(), errors = [];
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const task = pending.get(message.id);
      if (task) { pending.delete(message.id); message.error ? task.reject(message.error) : task.resolve(message.result); }
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Page.bringToFront');
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (expression) => {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(30); }
    fs.writeFileSync(path.join(output, 'failure.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    throw new Error('Timeout: ' + expression + '\n' + errors.join('\n') + '\n' + await evaluate(`JSON.stringify([...document.querySelectorAll('header-component,.header__columns,header-menu,overflow-list')].map(e=>({tag:e.tagName,width:e.getBoundingClientRect().width,style:e.getAttribute('style'),mode:e.dataset.menuStyle,shadow:e.shadowRoot?.innerHTML})))`) + '\n' + output);
  };
  const check = async (label, expression) => { assert.equal(await evaluate(expression), true, label); pass(label); };
  const viewport = (width) => cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 750 });
  const load = async (options = {}) => {
    await evaluate('window.leaving = true');
    await cdp('Page.navigate', { url: base + '/fixture?options=' + encodeURIComponent(JSON.stringify(options)) });
    await wait(`!window.leaving && customElements.get('am-header-menu-images') && customElements.get('overflow-list') && document.querySelector('header-menu')?.refs?.overflowMenu && document.querySelector('header-drawer')?.refs?.details`);
    if (!options.empty) await wait(`document.querySelectorAll('[data-am-header-menu-image]').length>=6`);
    await pause(200);
  };
  const source = (id) => `document.querySelector('[data-am-header-image-source="${id}"]')`;
  const images = `document.querySelectorAll('[data-am-header-menu-image]')`;
  const label = (name, surface = 'header-menu') => `document.querySelector('${surface} [data-am-header-menu-label][data-am-menu-title="${name}"]')`;
  const positioned = (query, position, size, gap = 6) => `(()=>{
    const l=${query},box=l?.querySelector('.am-header-menu-image'),img=box?.querySelector('img');
    if(!box || !img)return false;
    const text=[...l.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
    if(!text)return false;
    const range=document.createRange();range.selectNodeContents(text);
    const r=box.getBoundingClientRect(),t=range.getBoundingClientRect(),p=l.getBoundingClientRect(),s=getComputedStyle(box),ls=getComputedStyle(l);
    const margins=[s.marginTop,s.marginRight,s.marginBottom,s.marginLeft].map(parseFloat);
    const expected=${JSON.stringify(position === 'top' ? [0, 0, gap, 0] : position === 'left' ? [0, gap, 0, 0] : [0, 0, 0, gap])};
    const placed=${position === 'top' ? 'r.bottom<=t.top+1 && Math.abs(r.left+r.width/2-(p.left+p.width/2))<1' : position === 'left' ? 'r.right<=t.left+1 && Math.abs(r.top+r.height/2-(p.top+p.height/2))<1' : 't.right<=r.left+1 && Math.abs(r.top+r.height/2-(p.top+p.height/2))<1'};
    const aligned=${position === 'top' ? "ls.textAlign==='center'" : "ls.textAlign==='start' && Math.abs(Math.min(r.left,t.left)-p.left-parseFloat(ls.paddingLeft))<1"};
    return placed && aligned && r.width===${size} && r.height===${size} && margins.every((v,i)=>v===expected[i]) && img.alt==='' && getComputedStyle(img).objectFit==='contain' && box.hasAttribute('data-shopify-editor-block');
  })()`;
  const allPositioned = (surface, position, size, gap = 6) => ['Shop', 'Entertaining', 'Explore']
    .map((name) => positioned(label(name, surface), position, size, gap)).join(' && ');
  const multilineAligned = (surface, position) => ['Shop', 'Entertaining', 'Explore'].map((name) => `(()=>{
    const l=${label(name, surface)},text=[...l.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
    const range=document.createRange();range.selectNodeContents(text);
    const lines=[...range.getClientRects()].filter(r=>r.width>0),p=l.getBoundingClientRect();
    return lines.length>=2 && lines.every(r=>${position === 'top' ? 'Math.abs(r.left+r.width/2-(p.left+p.width/2))<1' : 'Math.abs(r.left-lines[0].left)<1'});
  })()`).join(' && ');
  await viewport(1440); await load();
  await check('one decoration per matched top-level item on all three surfaces', `${images}.length===9 && [...${images}].every(i=>i.parentElement.hasAttribute('data-am-header-menu-label'))`);
  await check('exact case-insensitive matching preserves navigation labels and current page', `!${label('Shop all')}.querySelector('img') && ${label('Shop')}.textContent.trim()==='Shop' && ${label('Shop')}.closest('a').getAttribute('aria-current')==='page'`);
  await check('child links, Back and More remain undecorated', `![...document.querySelectorAll('.menu-drawer__menu-item--child,.menu-drawer__back-button,[slot="more"]')].some(n=>n.querySelector('[data-am-header-menu-image]'))`);
  await check('invalid and duplicate blocks have selectable editor helpers', `['unmatched','empty','duplicate'].every(id=>!document.querySelector('[data-am-header-image-source="'+id+'"]').hidden) && ${source('shop')}.hidden`);
  await check('image is centered above the unchanged text with a reserved box', `(()=>{const l=${label('Shop')},i=l.querySelector('img'),box=i.parentElement,r=box.getBoundingClientRect(),s=getComputedStyle(box);return r.width===48 && r.height===48 && Math.abs(r.left+r.width/2-(l.getBoundingClientRect().left+l.getBoundingClientRect().width/2))<1 && s.marginBottom==='6px' && getComputedStyle(i).objectFit==='contain' && i.alt==='' && !box.querySelector('a,button') && box.hasAttribute('data-shopify-editor-block')})()`);
  await check('images load successfully as SVG and PNG', `[...${images}].every(i=>i.querySelector('img').complete && i.querySelector('img').naturalWidth>0)`);
  await evaluate(`${label('Entertaining')}.closest('a').focus()`);
  await wait(`${label('Entertaining')}.closest('a').getAttribute('aria-expanded')==='true'`);
  await check('keyboard focus still opens the original submenu', `${label('Entertaining')}.closest('a').getAttribute('aria-haspopup')==='true' && !!document.getElementById(${label('Entertaining')}.closest('a').getAttribute('aria-controls'))`);
  await evaluate(`document.activeElement.blur();window.beforeResize=[...${images}]`);
  for (const width of [390, 750, 1440]) {
    await viewport(width); await pause(200);
    await check('changing viewport preserves decorations at ' + width, `window.beforeResize.every(i=>i.isConnected) && ${images}.length===9`);
  }
  await evaluate(`window.savedImages=[...${images}];for(let n=0;n<5;n++){const s=document.createElement('span');document.querySelector('header-component').append(s);s.remove()}`);
  await pause(150);
  await check('repeated synchronization preserves nodes and creates no duplicates', `window.savedImages.every(i=>i.isConnected) && ${images}.length===9`);
  await evaluate(`${source('shop')}.dataset.amMenuTitle='Shop all'`);
  await wait(`${label('Shop all')}.querySelector('[data-am-header-menu-image="shop"]')`);
  await check('editing association restores the next valid block at the previous name', `${label('Shop')}.querySelector('[data-am-header-menu-image="duplicate"]')!==null && ${images}.length===12`);
  await evaluate(`document.querySelector('am-header-menu-images').prepend(${source('duplicate')});${source('shop')}.dataset.amMenuTitle='Shop'`);
  await wait(`${source('shop')}.hidden===false`);
  await check('reordering duplicate mappings changes precedence', `${label('Shop')}.querySelector('[data-am-header-menu-image="duplicate"]')!==null && ${images}.length===9`);
  await evaluate(`${source('duplicate')}.remove()`);
  await wait(`${label('Shop')}.querySelector('[data-am-header-menu-image="shop"]')`);
  await evaluate(`${source('shop')}.remove();${source('empty')}.remove()`);
  await wait(`${label('Shop')}.querySelector('img')===null`);
  await check('deleting mappings removes obsolete images', `${images}.length===6`);

  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  for (const width of [320, 390, 749, 750, 1440]) {
    await viewport(width); await load();
    await evaluate(`document.querySelector('header-drawer summary').click()`);
    await pause(350);
    await check('drawer image size and centered stack at ' + width, `(()=>{const l=${label('Shop', 'header-drawer')},i=l.querySelector('img'),r=i.getBoundingClientRect(),p=l.getBoundingClientRect();return r.width===32 && r.height===32 && Math.abs(r.left+r.width/2-(p.left+p.width/2))<1 && getComputedStyle(l).flexDirection==='column'})()`);
    await check('no page overflow at ' + width, `document.documentElement.scrollWidth<=innerWidth+1`);
    if (width < 750) {
      await check('mobile bar uses the mobile image size at ' + width, `${label('Shop','.menu-list--mobile')}.querySelector('img').getBoundingClientRect().width===32`);
    }
  }
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  for (const [size, gap] of [[16, 0], [120, 32]]) {
    await viewport(1440); await load({ sizes: { size_desktop: size, size_mobile: size, text_gap: gap } });
    await check('size and spacing extremes ' + size + '/' + gap, `${label('Shop')}.querySelector('img').getBoundingClientRect().width===${size} && getComputedStyle(${label('Shop')}.querySelector('.am-header-menu-image')).marginBottom==='${gap}px'`);
  }
  for (const options of [{ accordion: false }, { levels: 3 }, { row: 'bottom', transparent: true, sticky: 'scroll-up' }]) {
    await viewport(390); await load({ ...options, positions: { position_desktop: 'left', position_mobile: 'right' } });
    await evaluate(`document.querySelector('header-drawer summary').click()`); await pause(350);
    await check('main drawer items remain decorated ' + JSON.stringify(options), `document.querySelectorAll('header-drawer [data-am-header-menu-image]').length===3`);
    const control = `document.querySelector('header-drawer summary .am-header-menu-image')`;
    if (options.accordion !== false) {
      await check('submenu control stays outside the lateral image label', `(()=>{const l=${control}.parentElement,s=l.closest('summary'),icon=s.querySelector('.svg-wrapper');return icon.getBoundingClientRect().left>=l.getBoundingClientRect().right-1})()`);
      await evaluate(`${control}.querySelector('img').click()`); await pause(350);
      await check('decorated controls still open native submenus', `${control}.closest('details').open`);
    }
  }
  await viewport(1440); await load({ repeated: true, editor: false });
  await check('repeated main item names each receive the same mapping', `document.querySelectorAll('header-menu [data-am-header-menu-image="shop"]').length===2 && [...document.querySelectorAll('[data-am-header-image-source]')].every(s=>s.hidden)`);
  await load({ empty: true });
  await check('header without mappings retains native links and no decorations', `${images}.length===0 && ${label('Shop')}.textContent.trim()==='Shop'`);

  for (const desktop of ['top', 'left', 'right']) {
    for (const mobile of ['top', 'left', 'right']) {
      const pair = desktop + '/' + mobile;
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
      await viewport(1440); await load({ positions: { position_desktop: desktop, position_mobile: mobile } });
      await check('desktop placement for ' + pair, allPositioned('header-menu', desktop, 48));
      if (pair === 'left/right') {
        fs.writeFileSync(path.join(output, 'desktop-left.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      }
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      await load({ positions: { position_desktop: desktop, position_mobile: mobile } });
      await wait(`document.querySelector('header-component').dataset.menuStyle==='drawer'`);
      await evaluate(`window.beforePositionResize=[...${images}]`);
      await evaluate(`document.querySelector('header-drawer summary').click()`); await pause(350);
      await check('desktop touch drawer uses mobile placement for ' + pair, allPositioned('header-drawer', mobile, 32));
      await viewport(390); await pause(150);
      await check('mobile drawer placement for ' + pair, allPositioned('header-drawer', mobile, 32));
      await check('mobile bar placement for ' + pair, allPositioned('.menu-list--mobile', mobile, 32));
      await check('placement switch preserves image nodes for ' + pair, `window.beforePositionResize.every(i=>i.isConnected) && ${images}.length===9 && document.documentElement.scrollWidth<=innerWidth+1`);
      if (pair === 'left/right') {
        fs.writeFileSync(path.join(output, 'drawer-right.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      }
    }
  }
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  for (const position of ['top', 'left', 'right']) {
    await viewport(1440); await load({ positions: { position_desktop: position, position_mobile: position } });
    await evaluate(`document.querySelectorAll('[data-am-header-menu-label]:has(>.am-header-menu-image)').forEach(l=>{
      l.style.inlineSize='240px';l.style.whiteSpace='pre-line';
      const text=[...l.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
      text.nodeValue=l.dataset.amMenuTitle+String.fromCharCode(10)+'Collections';
    })`);
    await pause(150);
    await check('wide desktop labels align multiline text for ' + position, allPositioned('header-menu', position, 48) + ' && ' + multilineAligned('header-menu', position));
    await viewport(390); await pause(150);
    await evaluate(`document.querySelector('header-drawer summary').click()`); await pause(350);
    await check('wide drawer labels align multiline text for ' + position, allPositioned('header-drawer', position, 32) + ' && ' + multilineAligned('header-drawer', position));
    await check('wide mobile bar labels align multiline text for ' + position, allPositioned('.menu-list--mobile', position, 32) + ' && ' + multilineAligned('.menu-list--mobile', position));
  }
  for (const position of ['top', 'left', 'right']) {
    for (const [size, gap] of [[16, 0], [120, 32]]) {
      await viewport(1440); await load({ positions: { position_desktop: position, position_mobile: position },
        sizes: { size_desktop: size, size_mobile: size, text_gap: gap } });
      await check('desktop placement at size/spacing extremes ' + position + '/' + size + '/' + gap, allPositioned('header-menu', position, size, gap));
      await viewport(390); await pause(150);
      await evaluate(`document.querySelector('header-drawer summary').click()`); await pause(350);
      await check('drawer placement at size/spacing extremes ' + position + '/' + size + '/' + gap, allPositioned('header-drawer', position, size, gap));
      await check('bar placement at size/spacing extremes ' + position + '/' + size + '/' + gap, allPositioned('.menu-list--mobile', position, size, gap));
    }
  }
  await viewport(1440); await load({ legacyPositions: true });
  await check('legacy blocks without position settings keep top on desktop', allPositioned('header-menu', 'top', 48));
  await viewport(390); await pause(150);
  await evaluate(`document.querySelector('header-drawer summary').click()`); await pause(350);
  await check('legacy blocks without position settings keep top on mobile', allPositioned('header-drawer', 'top', 32));

  await viewport(1440); await load();
  for (const [desktop, mobile] of [['left', 'right'], ['right', 'left'], ['top', 'top']]) {
    const updated = await fixture({ positions: { position_desktop: desktop, position_mobile: mobile }, hydrated: true });
    await evaluate(`(async()=>{const {morphSection}=await import('@theme/section-renderer');await morphSection('header-test',${JSON.stringify(updated)},{mode:'hydration'})})()`);
    await wait(`${label('Shop')}.querySelector('.am-header-menu-image')?.dataset.amPositionDesktop===${JSON.stringify(desktop)} && ${images}.length===9`);
    await check('native hydration updates position only ' + desktop + '/' + mobile, allPositioned('header-menu', desktop, 48));
    await viewport(390); await pause(150);
    await evaluate(`document.querySelector('header-drawer summary').click()`); await pause(350);
    await check('native hydration updates mobile position only ' + desktop + '/' + mobile, allPositioned('header-drawer', mobile, 32));
    await evaluate(`document.querySelector('header-drawer').close()`); await pause(350);
    await viewport(1440); await pause(150);
  }

  await load();
  const replacement = await fixture({ sizes: { size_desktop: 64, size_mobile: 40, text_gap: 0 }, hydrated: true });
  await evaluate(`(async()=>{const {morphSection}=await import('@theme/section-renderer');await morphSection('header-test',${JSON.stringify(replacement)},{mode:'hydration'})})()`);
  await wait(`${images}.length===9`);
  await wait(`${label('Shop')}.querySelector('img').getBoundingClientRect().width===64`);
  await check('native hydration updates image templates and dimensions without stale copies', `${label('Shop')}.querySelector('img').getBoundingClientRect().width===64`);
  await evaluate(`document.querySelector('header-component').replaceWith(new DOMParser().parseFromString(${JSON.stringify(replacement)},'text/html').querySelector('header-component'))`);
  await wait(`${images}.length===9`);
  await check('section reload reconnects the controller without duplicating images', `${label('Shop')}.querySelectorAll('img').length===1`);

  await viewport(1100); await load({ extra: 12, positions: { position_desktop: 'right', position_mobile: 'left' } });
  await wait(`document.querySelector('li[slot="overflow"]')`);
  await evaluate(`{const list=document.querySelector('header-menu').refs.overflowMenu;window.exploreImage=${label('Explore')}.querySelector('.am-header-menu-image');list.append(window.exploreImage.closest('.menu-list__list-item'));list.dispatchEvent(new CustomEvent('reflow',{detail:{}}))}`);
  await wait(`window.exploreImage.closest('[slot="overflow"]')`);
  await check('native overflow carries the same image node with its menu item', `window.exploreImage.isConnected && ${images}.length===9 && window.exploreImage.parentElement.dataset.amMenuTitle==='Explore'`);
  await evaluate(`${source('explore')}.dispatchEvent(new CustomEvent('shopify:block:select',{bubbles:true}))`);
  await wait(`window.exploreImage.closest('a').getAttribute('aria-expanded')==='true'`);
  await check('editor selection reveals a decorated item in More', `window.exploreImage.closest('a')===document.activeElement && getComputedStyle(window.exploreImage).visibility!=='hidden'`);
  await check('More preserves the desktop image position', positioned('window.exploreImage.parentElement', 'right', 48));
  await viewport(390); await load({ bar: false });
  await evaluate(`${source('shop')}.dispatchEvent(new CustomEvent('shopify:block:select',{bubbles:true}))`);
  await wait(`document.querySelector('header-drawer details').open`);
  await check('editor selection reveals a matching block in the closed mobile drawer', `document.querySelector('header-drawer details').open && ${label('Shop','header-drawer')}.querySelector('img').getBoundingClientRect().width===32`);
  await pause(350);
  fs.writeFileSync(path.join(output, 'mobile-drawer.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.querySelector('header-drawer').close()`);
  await pause(400);
  await check('drawer can close after editor selection', `!document.querySelector('header-drawer details').open`);
  const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(output, 'mobile.png'), Buffer.from(screenshot.data, 'base64'));
  await viewport(1440); await load({ editor: false });
  fs.writeFileSync(path.join(output, 'desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  assert.deepEqual(errors, [], 'No browser exceptions'); pass('no browser exceptions');
  console.log(JSON.stringify({ checks, artifacts: output }));
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
}
