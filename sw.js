const CACHE_NAME = 'tari-cache-v4.0'; // Increment this!
const ASSETS = [
  './', 
  './index.html',  // Arabic
  './en.html',     // English <--- CRITICAL ADDITION
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  // Add your local images/icons here if needed
];

// 1. INSTALL: Cache both languages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 2. FETCH: The Smart Network Guard
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // RULE 1: NEVER cache Supabase or API calls (Keep Menu Live!)
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/api/')) {
    return; // Let the network handle it directly
  }

  // RULE 2: Stale-While-Revalidate for Assets (Fast load, background update)
  event.respondWith(
    caches.match(event.request).then((cachedRes) => {
      const fetchPromise = fetch(event.request).then((networkRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkRes.clone());
          return networkRes;
        });
      });
      return cachedRes || fetchPromise;
    })
  );
});

// 3. NOTIFICATIONS: Smart Language Redirect
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Logic: If user was on English page, open English. Otherwise Arabic.
      // This is hard to detect perfectly, so we default to the landing page
      // which allows them to choose, OR we can check the URL of open clients.
      if (clients.openWindow) {
        return clients.openWindow('./index.html'); 
      }
    })
  );
});
