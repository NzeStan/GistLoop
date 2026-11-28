/* GistLoop push notifications (Firebase Cloud Messaging web push). No third-party code is loaded here:
 * FCM delivers a standard Web Push message whose payload is the FCM message as JSON. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || "GistLoop";
  const target = data.notification_id ? `/notifications/${encodeURIComponent(data.notification_id)}` : "/notifications";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: notification.body || "",
      tag: data.notification_id || undefined,
      data: { url: target },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data && event.notification.data.url) || "/notifications",
    self.location.origin,
  );
  if (url.origin !== self.location.origin) return; // Only ever open GistLoop pages.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
