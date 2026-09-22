// シンプルな Service Worker。
// 静的アセット(アイコンなど)だけを軽くキャッシュし、
// ページやAPI(検索結果・保存データ)は常にネットワークから取得する。
// 医学文献は常に最新の情報を見せたいため、キャッシュを優先しない方針。

const CACHE_NAME = "medical-lit-app-static-v1";
const STATIC_ASSETS = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isStaticAsset = STATIC_ASSETS.includes(url.pathname);

  if (event.request.method !== "GET" || !isStaticAsset) {
    return; // それ以外はブラウザの通常の挙動(常にネットワーク)に任せる
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
