// Service worker: alleen voor pushmeldingen (geen offline-cache, zodat een nieuwe versie altijd meteen live is)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: "Fill", body: e.data?.text() || "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Fill", { body: d.body, tag: d.tag, icon: "icon-light-192.png", badge: "icon-light-192.png", renotify: true }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const w = list.find(c => "focus" in c); return w ? w.focus() : self.clients.openWindow("./");
  }));
});
