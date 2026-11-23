// Service Worker mínim orientat a xarxa (DOCUMENT_MESTRE.md §11: connexió a internet obligatòria).
// Habilita la instal·lació com a PWA sense simular ni emmagatzemar escriptures fora de línia.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through directe a la xarxa per mantenir integritat multiusuari en temps real.
  if (event.request.method !== 'GET') {
    return;
  }
});
