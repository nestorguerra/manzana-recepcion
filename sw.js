'use strict';
const CACHE='manzana-shell-v2';
const ASSETS=['./','index.html','styles.css','app.js','vendor/xlsx.full.min.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable.png'];
const URLS=ASSETS.map(path=>new URL(path,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('manzana-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  // A navigation can retain its hash in Request.url; the cached shell has no hash.
  url.hash='';
  if(!URLS.includes(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {const response=await fetch(event.request);if(response.ok)await cache.put(url.href,response.clone());return response;}
    catch {const cached=await cache.match(url.href);if(cached)return cached;return Response.error();}
  })());
});
