# Provenance — data/idnr-posey/registry-v1.json

- **Source:** pasted contributor stack, verified 2026-10-06 before ingest.
- **USGS 03322420:** verified live via USGS NWIS site service — "OHIO RIVER AT
  UNIONTOWN DAM, KY", 37.79715556/-87.9983356 (NAD83), 310.95 ft NAVD88.
  This is the J.T. Myers Locks and Dam reach (USACE NID KY03060).
- **Hovey Lake FWA / Twin Swamps:** real IDNR properties in Posey County;
  coordinates as contributed, not field-verified.
- **gage_zero_navd88: null** is intentional fail-closed — no unpublished datum
  conversion is applied. Missing means unavailable, never zero or invented.
- **Not ingested:** the accompanying `MapManager.js` (references PMTiles that
  return HTTP 404), `floodSim.wgsl` (bathtub fill labeled "hydrodynamic" —
  mislabeled; held as a future WebGPU experiment, not a model).
