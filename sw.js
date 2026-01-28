const APP_VERSION = 'tari-network-v1';

// 1. INSTALL: Just set up, don't cache anything
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

// 2. ACTIVATE: Clean up any old garbage if found
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => caches.delete(key)));
    })
  );
  return self.clients.claim();
});

// 3. FETCH: The "Pass-Through" Strategy
// This explicitly tells the browser: "I see this request. Go to the internet."
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
