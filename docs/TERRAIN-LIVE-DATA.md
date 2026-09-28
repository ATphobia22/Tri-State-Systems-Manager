# Terrain Elevation Source, Hillshade, Mesh & Live-Data Integration

How the flood simulator gets its ground truth — and what happens when the
network does not cooperate.

## 1. Elevation source: real source-derived screening terrain, bundled

`tools/terrain/fetch-terrarium-dem.py` downloads Terrarium tiles from the AWS
Open Data `elevation-tiles-prod` bucket for a ±0.03° window around the anchor
site (13101 Bonebank Rd, Point Township, Posey County, IN — 37.845887,
−88.005075). Per the Tilezen joerd attribution, the CONUS portion of the
Terrarium mosaic is sourced from USGS 3DEP/NED; the mosaic as a whole blends
multiple sources (SRTM, GMTED, ETOPO1, and others) with mixed native vertical
datums — so "3DEP-derived" describes the CONUS feed, not a uniform pedigree.
The script decodes the Terrarium encoding
(`elev_m = R·256 + G + B/256 − 32768`), mosaics the tiles, and resamples them
onto a canonical 192×192 grid in local ENU feet (±6000 ft, 62.5 ft cells).

Output (committed):

- `tsm-console/src/lib/flood-sim/world/data/source-derived-dem-posey.json` — the
  grid plus provenance (source URLs, tile list, zoom, datums, SHA-256).
- `source-derived-dem-posey.json.manifest.json` — the same provenance without the
  grid bytes.

Current bundle: `source-derived-dem-posey-valley-v1`, z13 tiles, elevation
337.7–372.5 ft (mean 360.3 ft), vertical datum NAVD88 as reported for the 3DEP
portion of the mosaic.

**Screening-level, not survey-grade.** The source posting is ~15 m; the grid is
a resampled derivative. It is strictly better than the procedural approximation
it replaces, but it must never be presented as surveyed, certified, or valid
for regulatory/design elevation decisions. Re-run the fetch script to refresh;
the SHA-256 in the manifest pins the exact bytes in use.

## 2. Hillshade rendering

`world/hillshade.ts` implements Horn's 3×3 finite-difference hillshade (the
standard GIS algorithm) as a pure function — no GL context, fully unit-tested.
`buildTerrainMesh` computes the shade field on the elevation grid and
multiplies it into the hypsometric vertex tint (`floor 0.45 + 0.55·shade`, sun
azimuth 315° / altitude 45° by default, overridable per call). Relief reads
even across flat floodplain country; the shade is a *visual* layer only and
never feeds the simulation engine or any evidence output.

## 3. Terrain mesh and the source fallback chain

`world/terrain.ts` → `resolveElevationGrid()`:

| Preference | Behaviour |
|---|---|
| `auto` (default) | Bundled source-derived screening grid, resampled to the scenario domain — validated (finite, inside the Ohio–Wabash valley envelope, covers the domain) — else the procedural grid with a console warning. Never throws on source problems. |
| `source-derived` | Bundled grid only; throws a descriptive error when it is missing, corrupt, or too small (explicit choice ⇒ fail loudly, never silently downgrade). |
| `procedural` | Deterministic seeded value-noise grid; always succeeds. |

The resolved grid feeds **both** the `FloodSimEngine` config and the three.js
mesh, so physics and visuals agree exactly. The mesh carries `dataQuality`
(`live-terrain-service` | `source-derived-screening` |
`procedural-approximation`), a human `provenance` string, and the
source-derived metadata — surfaced in the simulator's status badge and legend
footer.

## 4. Live-data integration: genuinely real-time, honestly labeled

`world/live-data.ts` (`LiveDataManager` + `TerrainTileClient`):

- **Gauges** poll on a 60 s interval through the existing `startGaugePoll`
  (REST only — the no-websocket source-grep gate still applies to every file
  in the package). The manager owns the single polling loop; UI panels read
  its snapshot rows — no component runs a second poller.
- **Terrain endpoint health** is probed on a 5-minute interval against one
  small tile; tiles carry an in-memory LRU cache with per-request timeouts and
  bounded retries. A failed fetch never poisons the cache — the last good tile
  keeps serving while the endpoint reports STALE.
- Every snapshot uses the repo's provenance taxonomy — **LIVE / STALE /
  SOURCE_UNAVAILABLE / CANDIDATE_NOT_LIVE** — with the timestamp and age of the
  last good read. The simulator shows a status badge: terrain source, tile
  endpoint state, and live gauge count.
- **On-demand live terrain:** the simulator's Terrain selector offers "Live
  tiles". Selecting it runs `resolveTerrainWithFallback()`:

  `live tiles → bundled 3DEP-derived grid → procedural approximation`

  The UI names whichever tier actually rendered and says why it fell back. A
  slow or dead tile service can never block first render (fetch is async; the
  world builds on the current best source meanwhile).

Missing data is reported, never invented: there is no interpolation across a
dead source, and the procedural tier is always labeled
`procedural approximation — not surveyed terrain`.

## 5. Refreshing the elevation

```bash
python3 tools/terrain/fetch-terrarium-dem.py --zoom 13
npx vitest run tests/terrain-*.test.ts tests/live-data-fallback.test.ts
```

Verify the new SHA-256 in the manifest matches the committed JSON before
releasing. The mesh, engine, and legend pick up the new grid with no code
changes.

## 6. Boundaries

- The bundled grid does not change the LOMA evidence position: LiDAR/DEM
  derivatives are not certified LAG, and nothing here replaces the
  PE/RLS-certified elevation documentation FEMA requested.
- Datum: 3DEP CONUS is NAVD88 as reported; the simulator treats elevations as
  datum-consistent feet and does not silently reproject.
- Tile fetches are throttled (≤36 tiles per live request, 8 s timeout,
  2 retries) to stay a polite consumer of the public tile endpoint.
