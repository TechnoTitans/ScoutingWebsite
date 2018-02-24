'use strict';
console.log('in sw.js');
importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.0.0-beta.0/workbox-sw.js');
if (workbox) {
    console.log(`Yay! Workbox is loaded 🎉`);
} else {
    console.log(`Boo! Workbox didn't load 😬`);
}
// lessens network usage
workbox.routing.registerRoute(
    /\.(?:js|css)$/, // reg exp
    workbox.strategies.cacheFirst({
        cacheName: 'static-resources',
    }),
);
