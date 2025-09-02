/**
 * This is the service worker file for the Weather Dashboard PWA.
 * It handles caching of application assets and API responses to provide an offline experience.
 */

// Define a name for the cache
const CACHE_NAME = 'weather-dashboard-cache-v1';

// List of essential files to cache for the application to work offline
const urlsToCache = [
  '/', // The root of the application
  '/index.html', // The main HTML file
  '/style.css', // The main stylesheet
  '/script.js', // The main JavaScript file
  '/config.js', // The configuration file
  'https://fonts.googleapis.com/css2?family=Material+Icons', // Google Fonts for icons
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap' // Google Fonts for typography
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
  const url = new URL(event.request.url);

  // Handle API requests with a stale-while-revalidate strategy
  if (url.hostname.includes('visualcrossing.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        // Try to fetch the latest data from the network
        return fetch(event.request).then(response => {
          // If successful, cache the new response and return it
          cache.put(event.request, response.clone());
          return response;
        }).catch(() => {
          // If the network request fails (e.g., offline), return the cached response if available
          return caches.match(event.request);
        });
      })
    );
  } else {
    // Use a cache-first strategy for all other requests (e.g., HTML, CSS, JS files)
    event.respondWith(
      caches.match(event.request).then(response => {
        // Return the cached response if found, otherwise fetch from the network
        return response || fetch(event.request);
      })
    );
  }
});
