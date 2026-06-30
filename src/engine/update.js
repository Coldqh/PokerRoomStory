import { APP_VERSION, BUILD_ID } from "../config/appMeta.js?v=0.7.1";

const UPDATE_EVENT = "prs-update-ready";
const CACHE_PREFIX = "poker-room-story-";
let refreshing = false;
let registrationRef = null;

export function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return Promise.resolve({ ok: false, reason: "service_worker_unavailable" });
  }

  return navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((registration) => {
      registrationRef = registration;
      watchRegistration(registration);
      registration.update().catch(() => {});

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      return { ok: true, version: APP_VERSION, buildId: BUILD_ID };
    })
    .catch((error) => {
      console.warn("Service worker registration failed", error);
      return { ok: false, reason: "registration_failed" };
    });
}

export function onUpdateReady(callback) {
  window.addEventListener(UPDATE_EVENT, callback);
}

export async function checkForRemoteVersion() {
  try {
    const response = await fetch(`./version.json?check=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!response.ok) return { ok: false, reason: "version_fetch_failed" };

    const remote = await response.json();
    const remoteVersion = String(remote.appVersion ?? "");
    const remoteBuild = String(remote.buildId ?? "");

    if (remoteVersion && (remoteVersion !== APP_VERSION || (remoteBuild && remoteBuild !== BUILD_ID))) {
      dispatchUpdateReady({
        remoteVersion,
        remoteBuild,
        message: `Доступна версия v${remoteVersion}.`,
      });
      return { ok: true, updateAvailable: true, remote };
    }

    return { ok: true, updateAvailable: false, remote };
  } catch (error) {
    return { ok: false, reason: "offline_or_blocked" };
  }
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

  await checkForRemoteVersion();
  return { ok: false, reason: "no_waiting_worker" };
}

export async function forceAppUpdate() {
  try {
    const registration = registrationRef || (await navigator.serviceWorker?.getRegistration?.());
    await registration?.update?.();

    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return { ok: true, mode: "service_worker_update" };
    }

    await clearAppCaches();
    await unregisterAppWorkers();

    const url = new URL(window.location.href);
    url.searchParams.set("forceUpdate", Date.now().toString());
    url.searchParams.set("v", APP_VERSION);
    window.location.replace(url.toString());
    return { ok: true, mode: "cache_clear_reload" };
  } catch (error) {
    console.warn("Force update failed", error);
    window.location.reload();
    return { ok: false, reason: "force_update_failed" };
  }
}

export async function clearAppCaches() {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)));
}

export async function unregisterAppWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
}

export function getRuntimeStatus() {
  return {
    serviceWorker: "serviceWorker" in navigator,
    controlled: Boolean(navigator.serviceWorker?.controller),
    online: navigator.onLine,
    version: APP_VERSION,
    buildId: BUILD_ID,
  };
}

function watchRegistration(registration) {
  if (registration.waiting) dispatchUpdateReady({ message: "Обновление уже загружено." });

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        dispatchUpdateReady({ message: "Новая версия готова к установке." });
      }
    });
  });
}

function dispatchUpdateReady(detail = {}) {
  window.dispatchEvent(
    new CustomEvent(UPDATE_EVENT, {
      detail: {
        version: APP_VERSION,
        buildId: BUILD_ID,
        ...detail,
      },
    }),
  );
}
