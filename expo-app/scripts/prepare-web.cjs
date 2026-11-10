const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = path.resolve(__dirname, '../dist');
fs.copyFileSync(require.resolve('sql.js/dist/sql-wasm-browser.wasm'), path.join(dir, 'sql-wasm-browser.wasm'));
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html.replace(/<html([^>]*)>/, '<html$1 data-type="software" data-radius="round" data-buttons="solid" data-motion>');
html = html.replace(/<title>[^<]*<\/title>/, '<title>Habits: personal habit tracker</title>');
html = html.replace('</head>', '<meta name="page-type" content="software"><meta name="site-kind" content="software"><meta name="description" content="Record daily habits, measure targets and review your history. Works on this device with optional account sync."><meta property="og:title" content="Habits: personal habit tracker"><meta property="og:description" content="Your daily entries and habit history in one log."><meta property="og:type" content="website"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preload" href="/fonts/host-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/appearance.css"><link rel="stylesheet" href="/assets/motion/motion.css"><script type="module" src="/assets/motion/motion.js"></script><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/icon-192.png"><meta name="theme-color" content="#ffffff"><meta name="apple-mobile-web-app-capable" content="yes"></head>');
html = html.replace(/<body([^>]*)>/, '<body$1><!-- software; white-mint-tiles; Host Grotesk + JetBrains Mono; operational habit log, adapted from collage to live application --><a class="skip-link" href="#habit-content">Skip to habit log</a>');
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
