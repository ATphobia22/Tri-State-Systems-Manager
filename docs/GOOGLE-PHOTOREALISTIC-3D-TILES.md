# Google Photorealistic 3D Tiles integration

## Decision: stream tiles; do not mirror or bulk-download them

Google Photorealistic 3D Tiles are delivered by the Google Maps Platform Map Tiles API. The supported renderer workflow requests a root tileset and then loads child tiles as the user explores the scene. Do **not** crawl the tile hierarchy to build an offline cache, mirror Google tile payloads into this repository/GitHub Pages, use the imagery for object extraction or machine interpretation, or treat the mesh as authoritative engineering data. Google's Map Tiles API policies restrict pre-fetching, indexing, storage/caching outside stated exceptions, non-visualization use, and offline use. Review the live policies and the agreement for the actual Cloud project before release.

Official references:
- https://developers.google.com/maps/documentation/tile/3d-tiles
- https://developers.google.com/maps/documentation/tile/policies
- https://developers.google.com/maps/documentation/tile/cloud-setup
- https://developers.google.com/maps/documentation/tile/get-api-key
- https://developers.google.com/maps/documentation/tile/create-renderer

## Existing TSM capability

The console already declares CesiumJS and `3d-tiles-renderer` in `tsm-console/package.json`. It has a self-hosted Cesium runtime and an OGC 3D Tiles 1.1 viewer for locally generated USGS 3DEP-derived terrain. That local terrain workflow is distinct from Google's hosted photorealistic basemap. Do not replace the 3DEP terrain product or its provenance with Google's photorealistic mesh.

## Enable Google-hosted photorealistic tiles

1. In Google Cloud, configure billing, enable the **Map Tiles API**, and create a dedicated API key.
2. Restrict the key to the Map Tiles API and to the production site's HTTP referrers (and separate development referrers). Apply quota/budget alerts. A browser API key is visible to clients by design; restrictions, not secrecy in the frontend bundle, are the security boundary.
3. In a local `.env.local` (never commit it), set `VITE_GOOGLE_MAPS_API_KEY=...`. For a static Pages build, inject this variable through the deployment environment only after configuring HTTP-referrer restrictions. Treat the resulting value as public.
4. In a dedicated Google basemap layer, construct the API root URL from the key and use the existing self-hosted Cesium runtime. For current CesiumJS, use `Cesium3DTileset.fromUrl('https://tile.googleapis.com/v1/3dtiles/root.json?key=' + encodeURIComponent(apiKey), { showCreditsOnScreen: true })`, add the returned tileset to `viewer.scene.primitives`, and allow Cesium to request child tiles on demand. Confirm this option signature against the exact CesiumJS version pinned by TSM before merging the implementation.
5. Update the site's Content Security Policy `connect-src` to allow `https://tile.googleapis.com` only when the Google layer is enabled. Do not broaden it to arbitrary hosts.
6. Keep the Google Maps logo and the dynamically aggregated tile-level copyright/provider credits visible and unaltered. For CesiumJS, enable `showCreditsOnScreen`; test the actual UI at the target viewport so the credits are not obscured by TSM overlays.
7. Add explicit UI labels distinguishing **Google Photorealistic 3D Tiles (visual context)** from **USGS 3DEP-derived terrain (elevation analysis)**. Do not extract roof/building geometry from Google imagery or infer survey-grade elevations from its mesh. Use licensed authoritative LiDAR/DEM and documented vertical-datum transformations for engineering outputs.

## Runtime and release checks

- No API key in source control, test fixtures, logs, screenshots, generated artifacts, or checked-in `.env` files.
- Verify the key is restricted to Map Tiles API and expected HTTP referrers; verify billing/quota alerts.
- Verify CSP permits the API host but remains deny-by-default.
- Verify visible Google logo and all tile-provided attributions in desktop and mobile layouts.
- Verify graceful error states for missing key, API rejection, quota exhaustion, offline network, and unsupported browser.
- Verify that no service worker, proxy, CDN rule, backend job, or static build process persists Google tile payloads beyond the API's permitted caching behavior.
- Verify the existing self-hosted 3DEP tiles continue to load when Google tiles are disabled or unavailable.
- Do not describe Google tile availability as coverage for every location; verify the target viewport at runtime.

## Public code references reviewed

- CesiumJS API and official example: https://developers.google.com/maps/documentation/tile/3d-tiles
- NASA AMMOS 3D Tiles Renderer JS: https://github.com/NASA-AMMOS/3DTilesRendererJS
- CesiumJS implementation and API history: https://github.com/CesiumGS/cesium
- kepler.gl 3D Tiles layer documentation: https://github.com/keplergl/kepler.gl/blob/master/docs/user-guides/c-types-of-layers/p-3d-tile-layer.md

The public repository examples are implementation references, not permission to download or redistribute Google's tiles. Review each project's license and current maintenance status before adopting code.
