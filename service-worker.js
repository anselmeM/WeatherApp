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

// Fetch event: triggered for every network request made by the page.
self.addEventListener('fetch', event => {
  event.respondWith(
    // Check if the request is in the cache
    caches.match(event.request)
      .then(response => {
        // If a cached response is found, return it.
        if (response) {
          return response;
        }
        // Otherwise, fetch the request from the network.
        return fetch(event.request);
      }
    )
  );
});
