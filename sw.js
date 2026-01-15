const CACHE_NAME = 'pilotage-v3.1.4'; // Change le nom à v2, v3... quand tu fais une grosse mise à jour


const ASSETS = [
  // Fichiers à la racine
  './',
  './index.html',
  './liste_taches.html',
  './responsables.html',
  './liste_taches_hors_projet.html',
  './profil.html',
  './manager.html',
  './manifest.json',
  './stats.html',
  './icon.png',
  './sw.js',
  'https://cdn.tailwindcss.com',

  // Contenu du dossier /asset (vu sur ta 2ème capture)
  './asset/M00.png',
  './asset/smiley_orange.png',
  './asset/smiley_rouge.png',
  './asset/smiley_vert.png',
  './asset/spmi.png'
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
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Optionnel : Mettre en cache les nouvelles ressources trouvées sur le réseau
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Offline : On cherche dans le cache
        return caches.match(event.request).then((matchedResponse) => {
          return matchedResponse || new Response("Contenu indisponible hors-ligne", {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});
