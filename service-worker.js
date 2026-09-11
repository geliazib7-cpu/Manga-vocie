// Cache del "shell" de la app para que abra rápido una vez instalada.
// La carpeta library/ (biblioteca compartida vía GitHub) NUNCA se cachea:
// tiene que verse siempre actualizada en todos los dispositivos.
const CACHE_NAME = 'manga-voice-shell-v2';
const SHELL_FILES = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    // La biblioteca compartida (índice + páginas de manga) siempre a la red:
    // cambia todo el tiempo y otros dispositivos dependen de ver lo último.
    if (url.pathname.includes('/library/')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // El resto (la interfaz de la app) sí puede servirse desde cache primero.
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
