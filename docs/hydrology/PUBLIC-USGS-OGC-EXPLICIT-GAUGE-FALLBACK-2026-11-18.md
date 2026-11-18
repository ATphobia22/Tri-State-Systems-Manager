# Public USGS OGC gauge constellation — explicit fallback

The public `/map` gauge panel normally obtains observations from the server-side TSM hydrology API. Static GitHub Pages does not host that API. When the user **clicks** `Fetch all local water levels` and the server observation for a configured station is unavailable, the client may now attempt that **same station ID** through the official USGS OGC API v1 `latest-continuous/items` endpoint.

## Trust, privacy and data quality

- The UI never automatically fetches the official direct feed on page load, and no timer/poller or `SessionLiveShadow` path opts into this fallback. All requests are user initiated. No login or API key.
- The only allowed USGS stations are the existing reviewed identities in `GAGE_DATUM_TABLE`: `03378500`, `03322000`, and `03322420`; each feature must match `USGS-` plus the exact requested ID and parameter `00065` (gage height) or `00060` (discharge).
- Values must be valid finite observations with an explicit time-zone timestamp and approved unit; not sentinel values. No valid data produces `unavailable`, not a fabricated zero. Positive future-skew >5 minutes is rejected and observations older than 6 hours display **stale**, not current.
- USGS 00065 gage height is **GAGE_DATUM**, not NAVD88; all three conversions are unpublished. The UI retains `wse_navd88_ft=null`, `conversion_applied=false`, and no estimated elevation, station-to-site transfer, site flood class or regulatory approval.
- Existing valid server observations are not replaced; the direct API is invoked only for unavailable station rows after the explicit button click.
- The public map's primary Wabash observation card retains its retrieved USGS stage when the server is unavailable, rather than immediately overwriting it with a second failed API call.

## Tests

```sh
cd tsm-console
node --experimental-strip-types --test tests/usgs-constellation-fallback.test.mjs
node --experimental-strip-types --test tests/usgs-direct-validation.test.mjs
```

The `public-viewer-recovery.cy.ts` headed browser test uses **synthetic** USGS responses and a 503 server fixture; that test validates UI wiring and does not attest current river stages. Independently checking an actual official response, station network availability, authorized published conversions, deployed route and browser console is a separate production acceptance gate.

Official references:
- [USGS Water Data APIs](https://api.waterdata.usgs.gov/docs/)
- [USGS OGC v1 migration](https://api.waterdata.usgs.gov/docs/ogcapi/migration/)
- [USGS station observations](https://waterdata.usgs.gov/)

Human Authority Final. A station's stage must never be used as a parcel's flood-surface elevation without an independently reviewed hydraulic and datum model.
