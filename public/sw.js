/**
 * DropWave service worker — offline app shell.
 *
 * Strategy: precache the shell on install; serve navigations with a network-first /
 * cache-fallback so the app opens even with no internet (critical for the same-Wi-Fi,
 * offline-LAN use case). Static assets use stale-while-revalidate.
 *
 * NOTE: the service worker has nothing to do with the file transfer itself — transfers
 * are live WebRTC DataChannels between two devices and never touch the cache or any
 * server. This SW only makes the UI installable and resilient offline.
 */

const CACHE = "dropwave-shell-v1";
const SHELL = ["/", "/send", "/receive", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle same-origin; never interfere with signaling (ws) or cross-origin.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
