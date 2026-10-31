// Service worker for CampusMarket.
// Rule: try the internet first. If it fails or is very slow, use a saved copy.

const CACHE = "campusmarket-v1";          // change the number to clear old saved copies
const OFFLINE_URL = "offline.html";       // shown when there is no internet and no saved copy
const PRECACHE = [OFFLINE_URL, "icons/icon-192.png", "icons/icon-512.png"];

// When installed: save the offline page and icons
self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(PRECACHE);
  }));
  self.skipWaiting(); // start working straight away
});

// When started: delete saved copies from older versions
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Every request made by the site passes through here
self.addEventListener("fetch", function (event) {
  const request = event.request;

  // Only handle normal page and file loads
  if (request.method !== "GET") return;

  // Leave other websites alone (Supabase, photos, fonts...)
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    // Wait up to 5 seconds for the internet
    const fresh = await fetchWithTimeout(request, 5000);
    // Keep a copy for later, only if the file loaded properly
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    // No internet (or too slow): use the saved copy if we have one
    const saved = await cache.match(request);
    if (saved) return saved;
    // A page that was never saved: show the friendly offline page
    if (request.mode === "navigate") return cache.match(OFFLINE_URL);
    return Response.error();
  }
}

// A normal fetch, but it gives up after "ms" milliseconds
function fetchWithTimeout(request, ms) {
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () { reject(new Error("timeout")); }, ms);
    fetch(request).then(
      function (response) { clearTimeout(timer); resolve(response); },
      function (error) { clearTimeout(timer); reject(error); }
    );
  });
}