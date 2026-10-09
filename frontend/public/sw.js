// Service Worker for منصة المناهج الذكية PWA
const CACHE_NAME = "edu-platform-v2";
const DATA_CACHE = "edu-platform-data-v1";

// API reads that should keep working offline once opened (Quizlet-style
// offline study): an activity, a lesson's flashcards, flashcard progress.
const OFFLINE_API = [
  /\/activities\/[0-9a-f-]{36}$/,
  /\/ai\/lesson\/[0-9a-f-]{36}\/flashcards$/,
  /\/study\/[0-9a-f-]{36}$/,
];
const OFFLINE_URL = "/offline";

// Assets to pre-cache
const PRECACHE_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
];

// Install — pre-cache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Some assets may fail — that's OK
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//  - API calls: network-first, no cache
//  - Navigation: network-first, fallback to /offline
//  - Static assets: cache-first
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API requests
  if (request.method !== "GET") return;

  // Offline-capable API reads — network first, cached copy when offline.
  if (request.mode !== "navigate" && OFFLINE_API.some((re) => re.test(url.pathname))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(request.url, clone));
          }
          return response;
        })
        .catch(() => caches.match(request.url, { cacheName: DATA_CACHE }).then((cached) => cached || Response.error()))
    );
    return;
  }
  if (url.pathname.startsWith("/api/") || url.port === "8000") return;

  // Navigation (HTML pages) — network first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigations
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Static assets — cache first, then network
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});

// Push notifications (placeholder — can be extended)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || "منصة المناهج", {
    body: data.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    dir: "rtl",
    lang: "ar",
  });
});
