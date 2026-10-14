# Vite PWA Setup for TSM (Deferred — npm blocked)

## Why PWA?

The user requires "local first, air gapped, USB deployable." A Progressive Web App
with a service worker enables:
- Offline access to the app after first load
- Installable on home screen (iOS/Android)
- Background sync when connectivity returns

## Recommended: vite-plugin-pwa

Zero-config PWA with Workbox. When npm is available:

```bash
cd tsm-console
npm install -D vite-plugin-pwa
```

Then in `vite.config.ts`:

```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tri-State Systems Manager',
        short_name: 'TSM',
        description: 'Sovereign public-interest platform for the Tri-State River Valley',
        theme_color: '#0A0F1A',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        scope: '/Tri-State-Systems-Manager/',
        start_url: '/Tri-State-Systems-Manager/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Cache the 3D tiles and building data for offline use
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'basemap-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            urlPattern: /\/3d-tiles\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: '3d-tiles-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              }
            }
          }
        ]
      }
    })
  ]
})
```

## Important Notes

1. **Base path**: Must match `/Tri-State-Systems-Manager/` for GitHub Pages
2. **CSP**: Service workers require `worker-src 'self'` in CSP headers
3. **iOS**: PWA install works on iOS 16.4+, limited on iOS 15
4. **Air-gapped**: First load requires network; subsequent loads work offline

## Current Status

- `public/manifest.json` already exists (basic PWA manifest)
- Service worker not yet implemented (blocked on npm)
- Manual service worker is possible but Workbox is strongly preferred
  for its battle-tested caching strategies

## References

- vite-plugin-pwa: https://vite-pwa-org.netlify.app/
- Workbox: https://developer.chrome.com/docs/workbox/
