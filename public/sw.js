/**
 * Service worker cho Web Push — KHÔNG cache gì cả
 * (app dùng Supabase realtime + poll, cache từng gây lỗi đồng bộ)
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Nhận push -> hiện thông báo
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Xưởng 81 Hồ Văn Huê', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Xưởng 81 Hồ Văn Huê';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/don-hang' },
    })
  );
});

// Bấm vào thông báo -> mở/focus app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/don-hang';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
