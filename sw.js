// Service worker：快取遊戲檔案，第一次開啟後可以離線使用。
// 更新遊戲內容後，請把 VERSION 加一。
const VERSION = 'fatkee-v1';
const FILES = [
  './', './index.html', './css/style.css',
  './js/app.js', './js/checker.js', './js/progress.js', './js/content-ui.js',
  './levels.json', './data/data_a.sql', './data/patch_b.sql',
  './vendor/sql-wasm.js', './vendor/sql-wasm.wasm',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 先用快取（快、可離線），同時在背景更新快取，下次開啟便是新版本。
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
