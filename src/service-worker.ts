/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';
import { generateEmojiIcon } from '$lib/utils/emojiIcon';

const EMOJI_ICONS = generateEmojiIcon('🌤️');

const ASSETS = [
    ...build,
    ...files,
    ...EMOJI_ICONS.map(icon => icon.src)
];

const CACHE = `cache-${version}`;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(async (keys) => {
            for (const key of keys) {
                if (key !== CACHE) await caches.delete(key);
            }
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Check if request is for an icon
    if (EMOJI_ICONS.some(icon => event.request.url === icon.src)) {
        event.respondWith(caches.match(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const networked = fetch(event.request)
                .then((response) => {
                    const cache = caches.open(CACHE);
                    cache.then((cache) => cache.put(event.request, response.clone()));
                    return response;
                })
                .catch(() => cached);

            return cached || networked;
        })
    );
});
