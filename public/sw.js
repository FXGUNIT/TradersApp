/**
 * sw.js — Service Worker for TradersApp offline queuing.
 *
 * Responsibilities:
 * 1. Cache the app shell (cache-first for static assets)
 * 2. Queue failed POST requests (network errors) in IndexedDB
 * 3. Replay queued requests automatically when navigator.onLine returns true
 * 4. Respond with cached content for navigation requests when offline
 */

const CACHE_NAME = "tradersapp-v1";
const QUEUE_DB = "tradersapp-offline-queue";
const QUEUE_STORE = "pending";

const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
];

// ─── Cache helpers ──────────────────────────────────────────────────────────────

async function cacheAppShell() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL_ASSETS);
  } catch {
    // Cache is best-effort only
  }
}

// ─── IndexedDB queue helpers ────────────────────────────────────────────────────

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueRequest(request) {
  try {
    const body = await request.clone().text();
    const db = await openQueueDb();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    await tx.objectStore(QUEUE_STORE).put({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });
    await tx.complete;
  } catch {
    // Queue is best-effort
  }
}

async function flushQueue() {
  try {
    const db = await openQueueDb();
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.getAll();
    const records = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!records.length) return;

    for (const record of records) {
      try {
        await fetch(record.url, {
          method: record.method,
          headers: record.headers,
          body: record.body,
          // credentials: 'same-origin' to include auth cookies
        });
        // Remove from queue on success
        const delTx = db.transaction(QUEUE_STORE, "readwrite");
        const del = delTx.objectStore(QUEUE_STORE).delete(record.id);
        await new Promise((res, rej) => {
          del.onsuccess = res;
          del.onerror = rej;
        });
      } catch {
        // Leave in queue — will retry next flush
      }
    }
  } catch {
    // Flush is best-effort
  }
}

// ─── Online/offline detection ────────────────────────────────

function sendStatusToClients(isOnline) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: "OFFLINE_STATUS", online: isOnline });
    });
  });
}

// ─── Service Worker lifecycle ──────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
  // Flush any queued requests from a previous session
  flushQueue();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "FLUSH_QUEUE") {
    flushQueue();
  }
});

// ─── Fetch handler ────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET/HEAD cross-origin requests
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (url.origin !== self.location.origin) return;

    // Queue POST/PUT/DELETE to own origin when offline
    event.respondWith(
      fetch(request).catch(async () => {
        if (!navigator.onLine) {
          await enqueueRequest(request);
          sendStatusToClients(false);
          // Return a synthetic "queued" response
          return new Response(
            JSON.stringify({ queued: true, message: "Request queued — will sync when online." }),
            { status: 202, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error("Network error");
      }),
    );
    return;
  }

  // For GET — cache-first for static assets, network-first for HTML
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return caches.match("/index.html");
        }),
      ),
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});

// Listen for online/offline events from the browser
self.addEventListener("online", () => {
  sendStatusToClients(true);
  flushQueue();
});

self.addEventListener("offline", () => {
  sendStatusToClients(false);
});
