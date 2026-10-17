# NFHL canonical layer registry — implementation

## Artifacts

| Path | Role |
|------|------|
| `docs/fabrics/nfhl-geometry-types.json` | Canonical JSON registry (32 layers, groups, priorities) |
| `tsm-console/src/lib/nfhl/NfhlLayerRegistry.ts` | TypeScript enum + helpers |
| `tsm-console/src/lib/nfhl/nfhl-maplibre-style.json` | Priority MapLibre style fragment |
| `server/tiles/nfhl-layers-metadata.sql` | PostGIS `nfhl_layers` seed |

## Ingestion path

```text
FEMA NFHL MapServer
  → geometry-aware registry
  → PostGIS (nfhl_layers + feature tables)
  → Martin / MVT (optional)
  → MapLibre (fill / line / circle)
  → Unreal (mesh / spline / actors)
  → Evidence Ledger (REGULATORY_DISPLAY label only)
```

## UACF capabilities

```text
geo.nfhl.layers | geo.nfhl.zones | geo.nfhl.boundaries
geo.nfhl.lomas | geo.nfhl.levees | geo.nfhl.bfes
```

## Unreal binding

| Geometry | Runtime |
|----------|---------|
| Polygon | Procedural mesh overlay |
| Polyline | Spline components (+ BFE text) |
| Point | Actor instances |

## Priority first paint

28, 27, 23, 16, 34, 3, 22, 32
