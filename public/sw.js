const CACHE_NAME = 'clean-shop-v3';
const DYNAMIC_CACHE = 'clean-shop-dynamic-v2';
const API_CACHE = 'clean-shop-api-v2';

const PRECACHE_URLS = ['/', '/offline', '/catalog', '/cart', '/comparison'];

const MAX_DYNAMIC_PAGES = 50;
const MAX_API_ENTRIES = 100;
const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Install: precache essential pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  const VALID_CACHES = [CACHE_NAME, DYNAMIC_CACHE, API_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !VALID_CACHES.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Trim cache to max entries (FIFO)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(
      keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key))
    );
  }
}

// Fetch strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Cacheable API: products, categories (read-only GET)
  if (
    request.method === 'GET' &&
    (url.pathname.startsWith('/api/v1/products') ||
      url.pathname.startsWith('/api/v1/categories'))
  ) {
    event.respondWith(networkFirstWithApiCache(request));
    return;
  }

  // Skip other API requests (banners, auth, admin, cron, webhooks, etc.)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Product & catalog pages: network-first with dynamic cache
  if (
    request.mode === 'navigate' &&
    (url.pathname.startsWith('/product/') ||
      url.pathname.startsWith('/catalog'))
  ) {
    event.respondWith(networkFirstWithDynamicCache(request));
    return;
  }

  // Other navigation: network-first, fallback to cache, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
        .then((response) => response || caches.match('/offline'))
    );
    return;
  }
});

// Network-first with dynamic page caching
async function networkFirstWithDynamicCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, clone);
      trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_PAGES);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/offline');
  }
}

// Network-first for API with stale-while-revalidate fallback
async function networkFirstWithApiCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(API_CACHE);
      // Store with timestamp header for TTL checks
      const headers = new Headers(clone.headers);
      headers.set('sw-cache-time', Date.now().toString());
      const timedResponse = new Response(await clone.blob(), {
        status: clone.status,
        statusText: clone.statusText,
        headers,
      });
      await cache.put(request, timedResponse);
      trimCache(API_CACHE, MAX_API_ENTRIES);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      // Check TTL - serve stale if within limit
      const cacheTime = parseInt(cached.headers.get('sw-cache-time') || '0');
      if (Date.now() - cacheTime < API_CACHE_TTL) {
        return cached;
      }
    }
    // Return empty JSON for failed API calls
    return new Response(JSON.stringify({ success: false, offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_URLS') {
    // Allow the app to proactively cache specific URLs
    const urls = event.data.urls || [];
    if (urls.length > 0) {
      caches.open(DYNAMIC_CACHE).then((cache) => {
        urls.forEach((url) => {
          fetch(url)
            .then((response) => {
              if (response.ok) cache.put(url, response);
            })
            .catch(() => {});
        });
      });
    }
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/images/icon-192.png',
      badge: '/images/icon-192.png',
      data: { url: payload.url || '/' },
      vibrate: [200, 100, 200],
      tag: 'poroshok-notification',
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(payload.title || 'Порошок', options)
    );
  } catch {
    // Invalid payload, ignore
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      return self.clients.openWindow(url);
    })
  );
});
