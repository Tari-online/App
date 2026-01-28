// 1. VERSIONING: Bump this to force every user's phone to update immediately
const CACHE_NAME = 'tari-customer-v27-fix'; 

// 2. ASSETS: Added your NEW logo names to prevent the "Yellow Truck"
const ASSETS = [
  './', 
  './index.html',
  './manifest.json',
  './icon-192.png', // <--- MAKE SURE your file is named exactly this
  './icon-512.png', // <--- MAKE SURE your file is named exactly this
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// INSTALL: Force immediate activation
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Instantly activates the new Service Worker
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// ACTIVATE: Kill the "Zombie" cache (v25) and take control
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Controls open tabs immediately
});

// FETCH: The "Network-First" Strategy to fix the connection death
self.addEventListener('fetch', (e) => {
  
  // A. NUCLEAR SAFETY: Never cache Supabase, API calls, or POST requests
  // This keeps the live connection to your database OPEN.
  if (e.request.url.includes('supabase') || e.request.method !== 'GET') {
    return; // Go directly to Network
  }

  // B. HTML PAGES (The App Shell): Network First
  // Try to get the live page from the internet. Only use cache if offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match(e.request)) 
    );
    return;
  }

  // C. IMAGES & CSS: Cache First
  // Load these fast from memory.
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
