/// <reference lib="webworker" />
import { syncClassroom } from "../lib/classroom/sync";

declare const self: ServiceWorkerGlobalScope;
declare const CLASSROOM_VERSION: string;
declare const CLASSROOM_ASSETS: string[];
const CACHE = `market-lab-classroom-${CLASSROOM_VERSION}`;
const SHELL = "/classroom/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll fails the install if ANY dependency is missing. An older, complete
    // version remains usable; never activate a half-downloaded classroom.
    await cache.addAll(CLASSROOM_ASSETS.map((url) => new Request(url, { cache: "reload" })));
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // No forced skipWaiting: open sessions stay on their complete version.
    // Retain the previous cache for an already open tab's resources.
    await self.clients.claim();
    const keys = (await caches.keys()).filter((key) => key.startsWith("market-lab-classroom-"));
    await Promise.all(keys.slice(0, -2).filter((key) => key !== CACHE).map((key) => caches.delete(key)));
  })());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  if (event.request.mode === "navigate" && (url.pathname === "/classroom" || url.pathname.startsWith("/classroom/"))) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(SHELL)) ?? fetch(event.request)));
  } else if (CLASSROOM_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) ?? fetch(event.request)));
  }
  // Never cache authentication, student HTML, APIs, POSTs, or teacher pages.
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "CHECK_READY") {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const complete = (await Promise.all(CLASSROOM_ASSETS.map((url) => cache.match(url)))).every(Boolean);
      event.ports[0]?.postMessage({ ready: complete, version: CLASSROOM_VERSION });
    })());
  }
});
// Silk may omit these APIs. Foreground reconnect/focus/interval sync is always
// implemented separately; no claim that a sleeping tablet can be woken remotely.
self.addEventListener("sync", ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag === "market-lab-trades") event.waitUntil(syncClassroom({ refresh: true }).then(async () => {
    for (const client of await self.clients.matchAll()) client.postMessage({ type: "CLASSROOM_SYNCED" });
  }));
}) as EventListener);
self.addEventListener("periodicsync", ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag === "market-lab-prices") event.waitUntil(syncClassroom({ refresh: true }));
}) as EventListener);
