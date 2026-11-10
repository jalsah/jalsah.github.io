// جلسة: عامل خدمة بسيط يخلي اللعبة تنثبّت كتطبيق، ويستقبل الإشعارات.
// ما يحفظ نسخ قديمة، كل شي يجي من النت مباشرة.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// إشعار جاي من سيرفر جلسة
self.addEventListener("push", e => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = j.data || j.notification || j; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "جلسة";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    lang: "ar",
    dir: "rtl",
    data: { link: d.link || "./" }
  }));
});

// الضغط على الإشعار يفتح جلسة (أو يرجع لها لو كانت مفتوحة)
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = new URL((e.notification.data && e.notification.data.link) || "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        if (link.includes("?r=") && "navigate" in c) { try { await c.navigate(link); } catch (err) {} }
        return;
      }
    }
    await self.clients.openWindow(link);
  })());
});
