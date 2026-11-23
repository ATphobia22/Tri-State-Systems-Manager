# Service Workers — Disabled for TSM Public Console

**Status (2026-11-23): disabled.** This replaces the former deferred Vite PWA/Workbox setup recommendation. Do not install `vite-plugin-pwa`, register a browser service worker, or enable cache-first HTML, JavaScript, 3D Tiles, hydrology, or public-data caching in the GitHub Pages console.

## Rationale

A retained browser service worker can serve obsolete versions of the interactive map and source-dependent engineering UI after deployment. The public Pages experience must load current versioned assets without a service-worker fetch interceptor. The `tsm-console/public/manifest.json` is *metadata only*; a web manifest does not register a worker.

The native Windows offline runtime remains a separate deliverable with local assets and explicit integrity validation. It must **not** depend on browser CacheStorage, Workbox, or service workers.

## Retirement and guardrails

- `tsm-console/index.html` loads `public/sw-reset.js` before the application starts.
- The reset only unregisters TSM-scoped registrations (or workers with a script under TSM's Pages path) and removes cached TSM URLs, preserving unrelated projects on the shared GitHub Pages origin.
- `public/sw.js` is a **retirement tombstone** for browsers still updating a formerly published `sw.js`. It has no fetch handler, does not cache any data, unregisters itself, and is **not registered by the application**.
- `tests/service-worker-disabled.test.mjs` exercises retirement scope, cache isolation, and legacy-control reload behavior; `deploy-pages.yml` requires the retirement assets in the production build and on the published site.
- A previously cached old HTML shell may need one explicit browser hard-refresh to fetch the new reset script. Do not confuse successful source changes with verified deployed behavior.

Reintroducing PWA workers would require a separate reviewed design and explicit engineering-data freshness policy; never silently reactivate this historical recipe.
