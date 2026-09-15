const CACHE='cse-2026-v2';
const SHELL=['./','./index.html','./data.js','./viewmodel.js','./manifest.webmanifest','./pwa/icon-192.png','./pwa/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=e.request.url;
  // Planilha: sempre rede, nunca cacheada aqui — o app cuida do próprio
  // fallback (último dado bom) em localStorage, sem intermediar via SW.
  if(url.indexOf('docs.google.com')!==-1)return;
  e.respondWith(fetch(e.request).then(r=>{
    const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});return r;
  }).catch(()=>caches.match(e.request)));
});