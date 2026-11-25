/* Sky NoHope - service worker
   Đổi VERSION mỗi lần cập nhật game để máy người chơi tải bản mới. */
const VERSION = 'v6';
const CACHE = 'sky-nohope-' + VERSION;
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './thumbnail.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // thiếu file nào cũng không làm hỏng việc cài đặt
      Promise.all(CORE.map((u) => c.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sky-nohope-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return; // PFIX-range

  const url = new URL(req.url);
  // Chỉ xử lý file cùng domain. Firebase (bảng xếp hạng, config, đăng nhập admin, EventSource)
  // và mọi request ngoài luôn đi thẳng ra mạng, không bị cache.
  if (url.origin !== self.location.origin) return;

  // Trang chính: ưu tiên mạng (luôn có bản mới), mất mạng thì dùng bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) { // PFIX-navok
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req)
          .then((r) => r || caches.match('./index.html'))
          .then((r) => r || caches.match('./'))) // PFIX-fallback
    );
    return;
  }

  // File tĩnh: dùng cache ngay, đồng thời cập nhật ngầm
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
