# Open-World Live Tile Fabric v1

## Runtime source policy

TSM's Open-World Twin consumes authoritative services through a provenance-aware source manifest. The renderer never treats an unverified, historical, unavailable or future-program dataset as current real-world truth.

### Current visual planes

| Plane | Source | Runtime role |
|---|---|---|
| Terrain | USGS 3DEP / newest published Indiana elevation product | Real elevation surface |
| Imagery | Indiana Current Imagery | Photorealistic aerial surface |
| Regulatory floodplain | FEMA effective NFHL/FIRM/FIS | Federal regulatory reference |
| Indiana floodplain | Indiana DNR BAFM/INFIP | State planning/Flood Control Act context |
| Parcels | Indiana 2025 parcel service | Current cadastral framework |
| Hydrology | USGS + NOAA/NWS | Live observations/forecasts |
| Levee/flood-control | USACE NLD + Indiana embankment data | Infrastructure context |
| Historical | Point Township atlas | Historical comparison/replay only |

## Tile-generation rule

TSM does not bulk-commit government raster datasets merely to make the simulator appear photorealistic. Published authoritative services remain the source of truth. If a local cache or derivative tile package is generated, its manifest records the exact source, acquisition/retrieval timestamp, CRS, vertical datum, transformation, software version and SHA-256 hash.

## Terrain rule

Visualization exaggeration is a rendering parameter. It never changes engineering source elevations. Any elevation used by HEC-RAS, survey comparison, grade design or engineering calculation must retain source CRS/vertical datum and transformation evidence.

## Imagery rule

Current imagery is an observational visualization layer, not a legal survey. Acquisition date and pixel resolution are retained when available. Historical atlas imagery/pages are never silently blended into current imagery.

## Failure behavior

- `LIVE` — current telemetry within freshness policy.
- `VERIFIED` — published authoritative static source.
- `STALE` — live source outside freshness policy.
- `PROGRAM_PENDING` — announced future acquisition without a published runtime product.
- `HISTORICAL` — historical evidence/reference layer.
- `SOURCE_UNAVAILABLE` — source cannot currently be used.

No failure state is converted to synthetic production data.

## Open-world scene composition

The scene is layered as:

```text
current imagery
       ↓
3DEP/current elevation
       ↓
hydrography + roads + parcels + PLSS
       ↓
FEMA effective + Indiana BAFM
       ↓
levees/embankments/infrastructure
       ↓
live river observations + forecasts
       ↓
model depth/velocity/shear
       ↓
engineering scenario geometry
       ↓
historical replay/comparison
```

Model and scenario layers remain visibly distinct from observations and regulatory products.

## Security and governance

Source URLs are not treated as authorization to redistribute restricted data. API credentials remain server-side. Private property information is excluded from public source identifiers. Historical evidence is generalized to community context where privacy requires it.
