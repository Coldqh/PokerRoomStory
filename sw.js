const APP_VERSION = "0.5.0";
const CACHE_NAME = `poker-room-story-${APP_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./version.json",
  "./manifest.webmanifest?v=0.5.0",
  "./src/main.js?v=0.5.0",
  "./src/app.js?v=0.5.0",
  "./src/styles.css?v=0.5.0",
  "./src/config/appMeta.js?v=0.5.0",
  "./src/data/contentRegistry.js?v=0.5.0",
  "./src/data/packs/coreV01.js?v=0.5.0",
  "./src/engine/cards.js?v=0.5.0",
  "./src/engine/career.js?v=0.5.0",
  "./src/engine/collections.js?v=0.5.0",
  "./src/engine/npc.js?v=0.5.0",
  "./src/engine/poker.js?v=0.5.0",
  "./src/engine/save.js?v=0.5.0",
  "./src/engine/update.js?v=0.5.0",
  "./src/engine/world.js?v=0.5.0",
  "./src/ui/components.js?v=0.5.0",
  "./src/ui/screens.js?v=0.5.0",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/card-back.png"
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

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (isFreshFirstAsset(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

function isFreshFirstAsset(request, url) {
  if (url.pathname.endsWith("/version.json")) return true;
  if (url.pathname.endsWith("/index.html")) return true;
  if (request.destination === "script" || request.destination === "style" || request.destination === "manifest") return true;
  return url.pathname.includes("/src/");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request, { cache: "reload" });
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cached || Response.error();
  }
}

async function networkFirst(request, fallbackUrl = null) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) return (await caches.match(fallbackUrl)) || (await caches.match("./")) || Response.error();
    return Response.error();
  }
}
