/* Service worker for back-office desktop notifications (Web Push).
 * Registered by the admin bell (components/admin/NotificationBell.tsx) with scope /admin/.
 * Payloads come from the send-push Edge Function: { id, title, body, url, severity, kind, lang }. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: event.data ? event.data.text() : "Kachabity" };
    }
    const urgent = data.severity === "critical" || data.severity === "warning";
    event.waitUntil(
        self.registration.showNotification(data.title || "Kachabity", {
            body: data.body || "",
            icon: "/assets/images/logoKachabitybg.png",
            badge: "/assets/images/logoKachabitybg.png",
            tag: data.id ? `kachabity-${data.id}` : undefined,
            dir: data.lang === "ar" ? "rtl" : "auto",
            lang: data.lang || "en",
            // Alerts stay on screen until dismissed; orders follow the system default.
            requireInteraction: urgent || data.kind === "order",
            data: { url: data.url || "/admin/notifications", id: data.id },
        })
    );
});

// Clicking opens the related admin page, reusing an open admin tab when there is one.
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || "/admin/notifications", self.location.origin).href;
    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            const admin = windows.find((w) => new URL(w.url).pathname.startsWith("/admin"));
            if (admin) {
                await admin.focus();
                if ("navigate" in admin) return admin.navigate(target);
                return undefined;
            }
            return self.clients.openWindow(target);
        })()
    );
});
