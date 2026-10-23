# GitHub Pages status — https://atphobia22.github.io/Tri-State-Systems-Manager/

**Checked:** 2026-10-23

## Live and healthy

| Check | Result |
|-------|--------|
| Site root | HTTP 200 |
| `index.html` assets (JS/CSS) | HTTP 200 |
| `spa-redirect.js` + `404.html` | Present (SPA deep-link restore) |
| `manifest.json` | HTTP 200 |
| `3d-tiles/tileset.json` | HTTP 200 (buildings DERIVED) |
| `data/posey-parcels.geojson` | HTTP 200 |
| `terrain_3dep/tiles.json` | HTTP 200 |
| deploy-pages workflow | Recent runs **success** on main |
| Vite `base` | `/Tri-State-Systems-Manager/` in GITHUB_ACTIONS |
| Router `basename` | `import.meta.env.BASE_URL` (strip trailing slash) |

## How SPA routes work

1. Deep link e.g. `/Tri-State-Systems-Manager/map` → GitHub serves `404.html`.
2. `404.html` client-redirects to `/?/map`.
3. `spa-redirect.js` restores `/map` via `history.replaceState` before React Router boots.
4. `curl` without JS will show 404 body; **browsers** get the app.

## Terrain-RGB tiles

- Template: `https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png`
- `tiles.json` is published; individual PNGs must be present under `tsm-console/public/terrain_3dep/` on main for the build to copy them into `dist`.
- Missing PNGs → MapLibre terrain falls back / empty (fail closed at provider layer when unpublished).

## Operator

- `TSM_API_BASE_URL` / `TSM_PAGES_ENABLED` repo variables control live API and deploy gate.
- Secrets never in Pages static bundle.

**Human authority remains final.**
