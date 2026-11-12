// Cache somente do shell público. Nunca armazenar respostas de /api, mídia ou sessão.
const CACHE='zuna-v21-1-shell-2';
const STATIC=['/','/index.html','/style.css','/app.js','/logo.svg','/favicon.svg','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('zuna-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(!STATIC.includes(url.pathname))return;
 event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));}return res;}).catch(()=>caches.match(req).then(cached=>cached||new Response('Sem conexão',{status:503}))));
});
