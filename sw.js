const APP_VERSION = "0.3.0";
const CACHE_NAME = `poker-room-story-${APP_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/main.js",
  "./src/app.js",
  "./src/styles.css",
  "./src/config/appMeta.js",
  "./src/data/contentRegistry.js",
  "./src/data/packs/coreV01.js",
  "./src/engine/cards.js",
  "./src/engine/career.js",
  "./src/engine/collections.js",
  "./src/engine/npc.js",
  "./src/engine/poker.js",
  "./src/engine/save.js",
  "./src/engine/update.js",
  "./src/engine/world.js",
  "./src/ui/components.js",
  "./src/ui/screens.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => null)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("poker-room-story-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put("./index.html", response.clone());
    }
    return response;
  } catch (error) {
    return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
  }
}
