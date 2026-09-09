// Cache del "shell" de la app para que abra offline una vez instalada.
// Los mangas que el usuario importa viven en memoria del navegador, no
// aquí — este cache es solo la interfaz (HTML/CSS/JS/íconos).
const CACHE_NAME = 'manga-voice-shell-v1';
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

// Estrategia: cache primero para el shell propio; para todo lo demás
// (CDNs de Tesseract/JSZip/FontAwesome, etc.) va directo a la red, ya
// que esas librerías las necesitas online la primera vez de cualquier
// forma para poder usarlas.
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
