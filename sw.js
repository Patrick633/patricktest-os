/* Life OS service worker: works offline, shows notifications, and is ready for push. */
const CACHE = "lifeos-v18";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "sync-config.js",
  "css/style.css", "js/store.js", "js/fx.js", "js/screen.js", "js/projects.js", "js/spirit.js",
  "js/news.js", "js/timelog.js", "js/calendar.js", "js/sync.js", "js/app.js",
  "icons/icon-192.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const sameOrigin = (url) => new URL(url).origin === self.location.origin;
const isFont = (url) => /fonts\.(googleapis|gstatic)\.com/.test(url);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (!sameOrigin(req.url) && !isFont(req.url)) return; // APIs (sync, news) always go to the network
  if (req.mode === "navigate") {
    // network first so updates arrive; offline falls back to the cached app
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  // stale-while-revalidate for files
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

// tap on a notification → open / focus Life OS
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ("focus" in c) { if ("navigate" in c && url !== c.url) c.navigate(url).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});

// push from the (future) Life OS push server
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Life OS", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Life OS", { body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: d.tag || "lifeos", data: d }));
});
