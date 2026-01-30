const APP_VERSION = 'tari-repair-v5-final';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => Promise.all(keyList.map((key) => caches.delete(key))))
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 1. IGNORE API & SUPABASE (Let them go straight to network)
  if (
    event.request.method === 'POST' || 
    event.request.url.includes('supabase') || 
    event.request.url.includes('ipify')
  ) {
    return;
  }

  // 2. NETWORK FIRST, NO CACHE (For HTML/JS/CSS)
  // This ensures you always get the latest version and never a "frozen" old file
  event.respondWith(
    fetch(event.request, { cache: 'no-store', mode: 'cors' }).catch(() => {
      // Simple fallback if completely offline
      return new Response("<h3>No Internet Connection</h3>", {
         headers: { 'Content-Type': 'text/html' }
      });
    })
  );
});
