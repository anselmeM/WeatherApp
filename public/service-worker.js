// service-worker.js

// Define a name for the cache
const CACHE_NAME = 'weather-dashboard-cache-v8';

const urlsToCache = [
  '/',
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
    }).then(() => self.clients.claim()) // Claim clients immediately so the new SW controls the page
  );
});
