const CACHE='penalty-family-pro-v3-20260812';
const ASSETS=['./','./index.html','./styles.css','./app.js','./match-v3.js','./manifest.webmanifest','./assets/splash.png','./assets/baba-ali.png','./assets/sepanta.png','./assets/ball.svg','./assets/kick.wav','./assets/goal.wav','./assets/save.wav','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).then(r=>{const c=r.clone();if(e.request.method==='GET'&&new URL(e.request.url).origin===location.origin)caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))));
