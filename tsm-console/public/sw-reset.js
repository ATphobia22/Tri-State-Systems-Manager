/* TSM browser migration: no new service worker is registered. */
(() => {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistrations) return;

  // This script lives at the site's own root, including the GitHub Pages project prefix.
  const site = new URL('./', document.currentScript.src);
  const belongsToSite = (value) => {
    if (!value) return false;
    try {
      const url = new URL(value, site);
      return url.origin === site.origin && url.pathname.startsWith(site.pathname);
    } catch {
      return false;
    }
  };
  const reloadKey = `tsm.service-worker-retired:${site.pathname}`;

  return (async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const retired = registrations.filter((registration) =>
      belongsToSite(registration.scope) ||
      [registration.active, registration.waiting, registration.installing]
        .some((worker) => belongsToSite(worker?.scriptURL))
    );

    let removed = 0;
    for (const registration of retired) {
      try {
        if (await registration.unregister()) removed++;
      } catch (error) {
        console.warn('TSM: unable to retire old service worker', error);
      }
    }

    // CacheStorage is shared by every GitHub Pages project on this origin.
    // Delete only this project's cached URLs, not other projects' caches.
    let previouslyCleaned = false;
    try { previouslyCleaned = sessionStorage.getItem(reloadKey) === 'done'; } catch { /* storage disabled */ }
    if (typeof caches !== 'undefined' && (!previouslyCleaned || removed > 0)) {
      try {
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          for (const request of await cache.keys()) {
            if (belongsToSite(request.url)) await cache.delete(request);
          }
        }
      } catch (error) {
        console.warn('TSM: unable to clear old site cache entries', error);
      }
    }

    if (removed > 0 && navigator.serviceWorker.controller) {
      // One reload releases the old controller; the marker avoids reload loops.
      try {
        if (sessionStorage.getItem(reloadKey) !== 'reloading') {
          sessionStorage.setItem(reloadKey, 'reloading');
          location.reload();
          return;
        }
      } catch { /* storage unavailable: do not risk a reload loop */ }
    }
    try { sessionStorage.setItem(reloadKey, 'done'); } catch { /* storage disabled */ }
  })().catch((error) => console.warn('TSM: service worker cleanup failed', error));
})();
