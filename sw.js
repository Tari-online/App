// ═══════════════════════════════════════════════════════════════════
//  TARI CUSTOMER APP — SERVICE WORKER (PRODUCTION v2)
// ═══════════════════════════════════════════════════════════════════
//  Upgrades from v1:
//    ✅ Fixed icon filename typo (155 → 512)
//    ✅ Resilient caching (one missing file won't break install)
//    ✅ Navigation timeout (don't hang if network is slow)
//    ✅ Split runtime cache from shell cache (can clean separately)
//    ✅ Cache size limit for runtime assets (prevents bloat)
//    ✅ Proper clients.claim inside waitUntil
//    ✅ Update notification flow (message-based skipWaiting)
//    ✅ Push notification handler
//    ✅ Notification click handler (opens/focuses app)
// ═══════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v6';
const SHELL_CACHE = `tari-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `tari-runtime-${CACHE_VERSION}`;

// How long to wait for network on navigation before falling back to cache
const NAVIGATION_TIMEOUT_MS = 3000;

// Max entries in the runtime cache (trims oldest when exceeded)
const RUNTIME_CACHE_MAX_ENTRIES = 60;

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    // Add additional local assets here as they're added to the project
];

// ── 1. INSTALL ────────────────────────────────────────────────────
// 🔥 FIX: Removed self.skipWaiting() — let the page-side update banner
// prompt the user before activation. The page calls skipWaiting via the
// 'SKIP_WAITING' message handler below when the user taps "Update".
// This makes the banner flow reliable instead of racing with auto-activation.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => {
            console.log('📦 Caching App Shell...');
            // Cache each asset individually so one missing file doesn't kill install
            return Promise.all(
                ASSETS_TO_CACHE.map(url =>
                    cache.add(url).catch(err => {
                        console.warn(`⚠️ Failed to cache ${url}:`, err.message);
                        // Silently continue — don't break install for one missing asset
                    })
                )
            );
        })
    );
});

// ── 2. ACTIVATE — clean old caches + claim clients ────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Delete all caches that aren't current
            caches.keys().then((keys) =>
                Promise.all(
                    keys
                        .filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
                        .map(key => {
                            console.log('🧹 Clearing Old Cache:', key);
                            return caches.delete(key);
                        })
                )
            ),
            // Take control of open tabs immediately
            self.clients.claim()
        ])
    );
});

// ── 3. MESSAGE HANDLER — for update notifications from page ──────
// Accepts BOTH message formats for forward compatibility:
//   - 'SKIP_WAITING' (string, used by current customer banner code)
//   - { type: 'SKIP_WAITING' } (object, legacy admin format)
self.addEventListener('message', (event) => {
    if (
        event.data === 'SKIP_WAITING' ||
        (event.data && event.data.type === 'SKIP_WAITING')
    ) {
        self.skipWaiting();
    }
});

// ── 4. CACHE TRIMMING — keeps runtime cache from bloating ────────
async function trimCache(cacheName, maxEntries) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length > maxEntries) {
            // Delete oldest entries (FIFO)
            const toDelete = keys.length - maxEntries;
            for (let i = 0; i < toDelete; i++) {
                await cache.delete(keys[i]);
            }
        }
    } catch (e) {
        // Non-critical — just log and continue
        console.warn('Cache trim failed:', e);
    }
}

// ── 5. FETCH STRATEGIES ──────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // A. SKIP: non-GET, Supabase API, ipify, browser extensions
    if (
        event.request.method !== 'GET' ||
        url.includes('supabase') ||
        url.includes('ipify') ||
        url.includes('chrome-extension') ||
        url.includes('moz-extension') ||
        url.startsWith('data:')
    ) {
        return; // Let browser handle normally
    }

    // B. NAVIGATION (HTML) — Network-first with timeout, cache fallback
    // Ensures users get updates while keeping offline support.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            Promise.race([
                fetch(event.request).then((networkResponse) => {
                    // Cache the fresh HTML for offline use
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(SHELL_CACHE).then(cache =>
                            cache.put(event.request, clone)
                        );
                    }
                    return networkResponse;
                }),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error('Navigation timeout')),
                        NAVIGATION_TIMEOUT_MS
                    )
                )
            ]).catch(() => {
                // Network failed or timed out — serve cached index
                return caches.match('./index.html')
                    .then(cached => cached || caches.match('./'));
            })
        );
        return;
    }

    // C. ASSETS (images, CSS, JS) — Stale-while-revalidate
    // Serve from cache instantly, update in background.
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    // Only cache successful responses
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                        const clone = networkResponse.clone();
                        caches.open(RUNTIME_CACHE).then(cache => {
                            cache.put(event.request, clone);
                            // Trim periodically to prevent unbounded growth
                            trimCache(RUNTIME_CACHE, RUNTIME_CACHE_MAX_ENTRIES);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // If network fails completely, return cached response (if any)
                    return cachedResponse;
                });

            // Return cache immediately if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});

// ── 6. PUSH NOTIFICATIONS ────────────────────────────────────────
// Fires when server sends a push message.
// Expects payload JSON shape:
//   { title, body, icon?, badge?, tag?, url?, actions? }
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data = {};
    try {
        data = event.data.json();
    } catch (e) {
        // Fallback if data isn't JSON
        data = { title: 'TARI', body: event.data.text() };
    }

    const title = data.title || 'TARI';
    const options = {
        body: data.body || '',
        icon: data.icon || './icon-192.png',
        badge: data.badge || './icon-192.png',
        tag: data.tag || 'tari-notification',
        data: {
            url: data.url || '/',
            timestamp: Date.now()
        },
        actions: data.actions || [],
        // Vibration pattern for mobile (200ms vibrate, 100ms pause, 200ms vibrate)
        vibrate: [200, 100, 200],
        // Renotify = replace previous notification with same tag
        renotify: true,
        // Don't require user interaction to dismiss
        requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ── 7. NOTIFICATION CLICK — open or focus the app ────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            // If app is already open in a tab, focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin)) {
                    if ('focus' in client) {
                        // Tell the page to navigate to the target URL
                        client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            url: targetUrl
                        });
                        return client.focus();
                    }
                }
            }
            // No open tab — open a new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});

// ── 8. NOTIFICATION CLOSE (optional analytics hook) ──────────────
self.addEventListener('notificationclose', (event) => {
    // Could log dismissal analytics here if desired
    // console.log('Notification dismissed:', event.notification.tag);
});
