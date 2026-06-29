import { APP_VERSION } from "../config/appMeta.js";

const UPDATE_EVENT = "prs-update-ready";
const CACHE_PREFIX = "poker-room-story-";
let refreshing = false;
let registrationRef = null;

export function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return Promise.resolve({ ok: false, reason: "service_worker_unavailable" });
  }

  return navigator.serviceWorker
    .register("./sw.js")
    .then((registration) => {
      registrationRef = registration;
      watchRegistration(registration);
      registration.update().catch(() => {});

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      return { ok: true, version: APP_VERSION };
    })
    .catch((error) => {
      console.warn("Service worker registration failed", error);
      return { ok: false, reason: "registration_failed" };
    });
}

export function onUpdateReady(callback) {
  window.addEventListener(UPDATE_EVENT, callback);
}

export async function applyPendingUpdate() {
  const registration = registrationRef || (await navigator.serviceWorker?.getRegistration?.());
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return { ok: true, mode: "waiting" };
  }

  await registration?.update?.();
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return { ok: true, mode: "updated" };
  }

  return { ok: false, reason: "no_waiting_worker" };
}

export async function forceAppUpdate() {
  const registration = registrationRef || (await navigator.serviceWorker?.getRegistration?.());
  await registration?.update?.();

  if (registration?.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return { ok: true, mode: "service_worker_update" };
  }

  await clearAppCaches();
  const url = new URL(window.location.href);
  url.searchParams.set("forceUpdate", Date.now().toString());
  window.location.replace(url.toString());
  return { ok: true, mode: "cache_clear_reload" };
}

export async function clearAppCaches() {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)));
}

export function getRuntimeStatus() {
  return {
    serviceWorker: "serviceWorker" in navigator,
    controlled: Boolean(navigator.serviceWorker?.controller),
    online: navigator.onLine,
    version: APP_VERSION,
  };
}

function watchRegistration(registration) {
  if (registration.waiting) dispatchUpdateReady();

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        dispatchUpdateReady();
      }
    });
  });
}

function dispatchUpdateReady() {
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { version: APP_VERSION } }));
}
