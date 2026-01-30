const APP_VERSION = 'tari-fix-freeze-v4';

// 1. INSTALL: Force the browser to kick out the old Service Worker immediately
self.addEventListener('install', (event) => {
  self.skipWaiting(); 
});

// 2. ACTIVATE: Delete ANY cache we find. Start fresh.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => caches.delete(key)));
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// 3. FETCH: Smart Filter (The Fix for Freezing)
self.addEventListener('fetch', (event) => {
  
  // 🛑 RULE 1: IGNORE API CALLS & UPLOADS
  // If it's a POST request (Order) or going to Supabase, let the browser handle it naturally.
  // This prevents the "Freeze" by bypassing the Service Worker completely for data.
  if (event.request.method === 'POST' || event.request.url.includes('supabase')) {
    return; 
  }

  // 🟢 RULE 2: FORCE REFRESH FOR APP FILES
  // Only apply the "No-Cache" rule to your own files (HTML, JS, CSS)
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(() => {
      // Optional: Return a simple offline message
      return new Response("No Internet Connection");
    })
  );
});
