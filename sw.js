// جلسة: عامل خدمة بسيط يخلي اللعبة تنثبّت كتطبيق. ما يحفظ نسخ قديمة، كل شي يجي من النت مباشرة.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
