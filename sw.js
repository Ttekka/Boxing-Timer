// Service worker : met l'app en cache pour qu'elle marche sans réseau (salle de sport, sous-sol…).
// Changer VERSION à chaque mise en ligne pour forcer la mise à jour du cache.

const VERSION = 'v1';
const CACHE = `boxing-timer-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/audio.js',
  './js/presets.js',
  './js/program.js',
  './js/settings.js',
  './js/storage.js',
  './js/timer.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Réponse immédiate depuis le cache (pratique avec un réseau capricieux),
// et mise à jour du cache en arrière-plan pour la prochaine ouverture.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network.catch(() => cache.match('./index.html'));
    }),
  );
});
