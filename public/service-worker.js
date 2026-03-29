// service-worker.js

// Define a name for the cache
const CACHE_NAME = 'weather-dashboard-cache-v12';

const urlsToCache = [
  '/',
  '/landing.html',
  '/index.html',
  '/style.css',
  '/script.js',
  '/utils.js',
  '/chart.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
];

// Install event: triggered when the service worker is first installed.
self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: triggered for every network request made by the page.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // ⚡ Performance: Use stale-while-revalidate for API calls (get fresh data in background)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Network failed, return cached or error
            return cachedResponse || new Response(JSON.stringify({ error: 'Offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
          
          // Return cached immediately, then update cache in background
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
  
  // ⚡ Performance: Cache-first for app shell (fast load)
  // Network-first for API data handled above
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          // Cache successful responses for future offline use
          if (networkResponse.ok && event.request.method === 'GET') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
  );
});

// Activate event: fired when the service worker starts up
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
