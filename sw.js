const APP_VERSION = "2.8.0";
const CACHE_NAME = `poker-room-story-${APP_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./version.json",
  "./manifest.webmanifest?v=2.8.0",
  "./src/main.js?v=2.8.0",
  "./src/app.js?v=2.8.0",
  "./src/app/state.js?v=2.8.0",
  "./src/app/navigation.js?v=2.8.0",
  "./src/app/inputController.js?v=2.8.0",
  "./src/app/tableSessionFlow.js?v=2.8.0",
  "./src/app/bettingModalFlow.js?v=2.8.0",
  "./src/app/handFlow.js?v=2.8.0",
  "./src/app/systemFlow.js?v=2.8.0",
  "./src/app/renderShell.js?v=2.8.0",
  "./src/styles.css?v=2.8.0",
  "./src/styles/00-base-layout.css?v=2.8.0",
  "./src/styles/01-table-cards.css?v=2.8.0",
  "./src/styles/02-career-tasks.css?v=2.8.0",
  "./src/styles/03-mobile-responsive.css?v=2.8.0",
  "./src/styles/04-club-drawer-settings.css?v=2.8.0",
  "./src/styles/05-result-modals.css?v=2.8.0",
  "./src/styles/06-table-lobby-polish.css?v=2.8.0",
  "./src/styles/07-readability-hotfix.css?v=2.8.0",
  "./src/styles/08-opponent-reads.css?v=2.8.0",
  "./src/styles/09-story-goals-polish.css?v=2.8.0",
  "./src/styles/10-city-map.css?v=2.8.0",
  "./src/styles/11-life-hub.css?v=2.8.0",
  "./src/config/appMeta.js?v=2.8.0",
  "./src/data/contentRegistry.js?v=2.8.0",
  "./src/data/namePools.js?v=2.8.0",
  "./src/data/namePools/index.js?v=2.8.0",
  "./src/data/namePools/russia.js?v=2.8.0",
  "./src/data/validateContent.js?v=2.8.0",
  "./src/data/packs/index.js?v=2.8.0",
  "./src/data/packs/coreV01.js?v=2.8.0",
  "./src/data/packs/russia/riverRoomPack.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/index.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/countryCity.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/club.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/tables.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/archetypes.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/npcs.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/glossary.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/collections.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/challenges.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/learning.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/events.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/storylines.js?v=2.8.0",
  "./src/data/packs/russia/riverRoom/venues.js?v=2.8.0",
  "./src/engine/cards.js?v=2.8.0",
  "./src/engine/career.js?v=2.8.0",
  "./src/engine/club.js?v=2.8.0",
  "./src/engine/collections.js?v=2.8.0",
  "./src/engine/clubGoals.js?v=2.8.0",
  "./src/engine/storylines.js?v=2.8.0",
  "./src/engine/locations.js?v=2.8.0",
  "./src/engine/life.js?v=2.8.0",
  "./src/engine/lifeContent.js?v=2.8.0",
  "./src/engine/tablePresence.js?v=2.8.0",
  "./src/engine/sessionStats.js?v=2.8.0",
  "./src/engine/locationState.js?v=2.8.0",
  "./src/engine/businessContent.js?v=2.8.0",
  "./src/engine/businesses.js?v=2.8.0",
  "./src/engine/venues.js?v=2.8.0",
  "./src/engine/npc.js?v=2.8.0",
  "./src/engine/progression.js?v=2.8.0",
  "./src/engine/poker.js?v=2.8.0",
  "./src/engine/poker/constants.js?v=2.8.0",
  "./src/engine/poker/state.js?v=2.8.0",
  "./src/engine/poker/seats.js?v=2.8.0",
  "./src/engine/poker/betting.js?v=2.8.0",
  "./src/engine/poker/events.js?v=2.8.0",
  "./src/engine/poker/rounds.js?v=2.8.0",
  "./src/engine/poker/setup.js?v=2.8.0",
  "./src/engine/poker/tableNpcs.js?v=2.8.0",
  "./src/engine/poker/results.js?v=2.8.0",
  "./src/engine/poker/streets.js?v=2.8.0",
  "./src/engine/poker/npcDecision.js?v=2.8.0",
  "./src/engine/poker/handInfo.js?v=2.8.0",
  "./src/engine/save.js?v=2.8.0",
  "./src/engine/selectors.js?v=2.8.0",
  "./src/engine/update.js?v=2.8.0",
  "./src/engine/world.js?v=2.8.0",
  "./src/ui/components.js?v=2.8.0",
  "./src/ui/screens.js?v=2.8.0",
  "./src/ui/screens/index.js?v=2.8.0",
  "./src/ui/screens/common.js?v=2.8.0",
  "./src/ui/screens/lifeScreen.js?v=2.8.0",
  "./src/ui/screens/locationScreen.js?v=2.8.0",
  "./src/ui/screens/cityMapScreen.js?v=2.8.0",
  "./src/ui/screens/venueScreen.js?v=2.8.0",
  "./src/ui/screens/clubScreen.js?v=2.8.0",
  "./src/ui/screens/tableScreen.js?v=2.8.0",
  "./src/ui/screens/careerScreen.js?v=2.8.0",
  "./src/ui/screens/tasksScreen.js?v=2.8.0",
  "./src/ui/screens/npcScreen.js?v=2.8.0",
  "./src/ui/screens/glossaryScreen.js?v=2.8.0",
  "./src/ui/screens/collectionsScreen.js?v=2.8.0",
  "./src/ui/screens/settingsScreen.js?v=2.8.0",
  "./src/ui/screens/modals.js?v=2.8.0",
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
