const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = path.resolve(__dirname, '../dist');
fs.copyFileSync(require.resolve('sql.js/dist/sql-wasm-browser.wasm'), path.join(dir, 'sql-wasm-browser.wasm'));
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html.replace('</head>', '<link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/icon-192.png"><meta name="theme-color" content="#424242"><meta name="apple-mobile-web-app-capable" content="yes"></head>');
fs.writeFileSync(path.join(dir, 'index.html'), html);
function files(folder) { return fs.readdirSync(folder, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(folder, e.name)) : [path.join(folder, e.name)]); }
const assets = files(dir).filter(f => !f.endsWith('.map') && !f.endsWith('sw.js')).map(f => '/' + path.relative(dir, f).split(path.sep).join('/'));
const hash = crypto.createHash('sha256').update(assets.join('') + html).digest('hex').slice(0, 12);
// Only app assets are cached. Auth and API responses are never cached.
fs.writeFileSync(path.join(dir, 'sw.js'), `
const CACHE = 'habits-${hash}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('habits-') && k !== CACHE).map(k => caches.delete(k)))), self.clients.claim()])); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.match('/index.html'))); return; }
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
});
`);
console.log('Offline app prepared:', assets.length, 'assets');
