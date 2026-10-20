const CACHE="higan-rio-reader-sales-v1.3.1";
const ASSETS=["./","./index.html","./style.css","./app.js","./appearance.js","./assets/rio-jewel.png","./assets/rio-wisteria.png","./assets/rio-woodland.png","./assets/chizuru-honey.png","./rio-config.js","./manifest.webmanifest","./assets/rio-icon.svg","./assets/rio-favicon.svg","./assets/rio-botanical.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("higan-rio-reader-sales-") && k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
    const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r;
  }).catch(()=>caches.match("./index.html"))));
});


