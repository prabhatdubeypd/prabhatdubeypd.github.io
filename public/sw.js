// bump VERSION whenever you change the caching rules
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const DATA = `data-${VERSION}`;
const IMGS = `img-${VERSION}`;
const KEEP = [SHELL, ASSETS, DATA, IMGS];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.add("/").catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(name, req) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}

async function networkFirst(name, req) {
  const c = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch {
    return (await c.match(req)) || Response.error();
  }
}

async function staleWhileRevalidate(name, req) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req)
    .then((res) => {
      if (res.ok || res.type === "opaque") c.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return; // videos are never cached
  const url = new URL(req.url);

  // the page itself: network first, saved copy when offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // built files have hashed names that never change: cache first
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    e.respondWith(cacheFirst(ASSETS, req));
    return;
  }

  if (url.hostname.endsWith(".supabase.co")) {
    if (url.pathname.startsWith("/rest/v1/")) {
      e.respondWith(networkFirst(DATA, req)); // your content: fresh when online, saved when offline
    } else if (url.pathname.startsWith("/storage/v1/") && req.destination === "image") {
      e.respondWith(staleWhileRevalidate(IMGS, req));
    }
  }
});