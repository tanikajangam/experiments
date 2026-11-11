// Loaded into the service worker (vite.config.ts, workbox.importScripts): shows the daily reminder
// and opens Home when it's tapped.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A bad payload still shows a notification: iOS revokes push for apps that receive silent pushes.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Experiments', {
      body: data.body || 'Time to log today.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'daily-reminder',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if ('focus' in client) {
          client.postMessage({ type: 'open-home' })
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})
