const CACHE_NAME = "truenorth-v2";
const STATIC_ASSETS = ["/", "/manifest.json"];

// ============================================================
// IndexedDB helpers for offline pulse storage
// ============================================================

function openPulseDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("truenorth-offline", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("pending_pulses")) {
        db.createObjectStore("pending_pulses", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storePulse(pulse) {
  const db = await openPulseDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_pulses", "readwrite");
    const store = tx.objectStore("pending_pulses");
    const req = store.add({ ...pulse, queued_at: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getPendingPulses() {
  const db = await openPulseDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_pulses", "readonly");
    const store = tx.objectStore("pending_pulses");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function deletePulse(id) {
  const db = await openPulseDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_pulses", "readwrite");
    const store = tx.objectStore("pending_pulses");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function clearAllPulses() {
  const db = await openPulseDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_pulses", "readwrite");
    const store = tx.objectStore("pending_pulses");
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

// ============================================================
// Install: cache app shell
// ============================================================

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ============================================================
// Activate: clean old caches
// ============================================================

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// Fetch: network-first with cache fallback
// ============================================================

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Skip cross-origin requests and Supabase auth endpoints
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match("/");
        return cached || new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      })
  );
});

// ============================================================
// Message handler: offline pulse storage + sync
// ============================================================

self.addEventListener("message", (event) => {
  const { type } = event.data || {};

  if (type === "STORE_OFFLINE_PULSE") {
    storePulse(event.data.pulse)
      .then((id) => {
        event.source?.postMessage({
          type: "PULSE_STORED",
          id,
          pulse: event.data.pulse,
        });
      })
      .catch((err) => {
        event.source?.postMessage({
          type: "PULSE_STORE_ERROR",
          error: err?.message ?? "Failed to store pulse offline",
        });
      });
  }

  if (type === "GET_PENDING_PULSES") {
    getPendingPulses()
      .then((pulses) => {
        event.source?.postMessage({ type: "PENDING_PULSES", pulses });
      })
      .catch(() => {
        event.source?.postMessage({ type: "PENDING_PULSES", pulses: [] });
      });
  }

  if (type === "DELETE_SYNCED_PULSE") {
    deletePulse(event.data.id).catch(() => {});
  }

  if (type === "CLEAR_SYNCED_PULSES") {
    clearAllPulses().catch(() => {});
  }
});
