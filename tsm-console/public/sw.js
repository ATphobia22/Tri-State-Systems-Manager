/* Retirement-only replacement for any previously published /sw.js. Not registered by TSM. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const base = new URL('./', self.location.href);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.filter((client) => {
      const url = new URL(client.url);
      return url.origin === base.origin && url.pathname.startsWith(base.pathname);
    }).map((client) => client.navigate(client.url)));
  })());
});
