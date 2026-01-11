const CACHE_NAME = 'pilotage-v2'; // Change le nom à v2, v3... quand tu fais une grosse mise à jour
const ASSETS = [
  './',
  './index.html',
  './liste_taches.html',
  './responsables.html',
  './manifest.json',
  './icon.png',
  'https://cdn.tailwindcss.com' // Optionnel : pour que le style marche aussi sans internet
];

// Installation : Mise en cache des fichiers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Mise en cache des assets');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // Force le nouveau SW à prendre le contrôle immédiatement
});

// Activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Suppression du vieux cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch : Stratégie "Network First, fallback to Cache"
// On essaie d'abord d'avoir les données fraîches de Firebase, sinon on prend le cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
