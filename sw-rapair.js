const APP_VERSION = 'tari-ghost-fix-v5';

// 1. INSTALL: Force immediate takeover
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// 2. ACTIVATE: The "Janitor" Mode
// This runs ONCE. It deletes all old cached files to fix the layout.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => caches.delete(key)));
        })
    );
    return self.clients.claim();
});

// 3. FETCH: THE EMPTY LISTENER
// We keep this empty listener so the PWA is still "Installable".
// But because it's empty, we do NOT intercept any requests.
// The browser handles the network 100% naturally. NO FREEZING.
self.addEventListener('fetch', (event) => {
    return;
});
