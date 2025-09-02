// service-worker.js

// Define a name for the cache
const CACHE_NAME = 'weather-dashboard-cache-v1';

// List of files to cache
const urlsToCache = [
  '/',
  '/index.html',
  // NOTE: If you had separate CSS or JS files, you would add them here.
  // '/styles/main.css',
  // '/scripts/main.js',
  'https://fonts.googleapis.com/css2?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
];

// Install event: triggered when the service worker is first installed.
self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Add all the specified URLs to the cache
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Handle API requests with a stale-while-revalidate strategy
  if (url.hostname.includes('visualcrossing.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request).then(response => {
          cache.put(event.request, response.clone());
          return response;
        }).catch(() => {
          return caches.match(event.request);
        });
      })
    );
  } else {
    // Use cache-first for all other requests
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
