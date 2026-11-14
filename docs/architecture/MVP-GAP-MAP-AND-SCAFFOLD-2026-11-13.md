# TSM MVP Gap Map vs Digital-Twin Platform Guide
**Date:** 2026-11-13  
**Authority:** Human final. Soft-label only. Never hard-stop.

## Existing (wired / production path)
| Guide area | TSM location | Status |
|------------|--------------|--------|
| GIS / PostGIS / NFHL | packages/geo, server tiles, data/posey, NFHL fabric | Live |
| Hydrology / flood | backend/domain, gage-datums, LOMA 26-05-2022A, scientific-analytics | Live |
| Evidence / Merkle / Zero-Trust | server/store, merkle, auth OIDC | Live |
| Visualization | frontend MapLibre, Cesium path, WebGPU, UE5.8 docs | Live |
| Ingestion | services/ingestion-worker, USGS/NOAA adapters | Live |
| Unreal | docs/unreal (Nanite+VSM), native/ | Documented 5.8 |
| Governance | ADR-004/006, soft-label policy, COMPLIANCE | Live |

## Scaffolded this pass (minimal, non-blocking)
| Path | Purpose |
|------|---------|
| `domains/flood|water|transportation|governance|environment/` | Domain soft registries |
| `digital-twin-core/ontology/` | Twin core model stub |
| `services/asset-service|twin-service|telemetry-service/` | Thin FastAPI health stubs |
| This gap map | Tracking only |

## Deferred (label, do not invent full stack)
- Full BIM IFC pipeline, Neo4j graph, Kafka, MinIO, GeoServer containers
- Kubernetes manifests, full AI training
- Parallel digital-twin-platform/ root (reject; use existing tree)

## MVP outcome target (unchanged)
Regional OS ingesting GIS + public infra + live stage into unified twin with web dashboard + Unreal viewer.  
Bonebank / Posey / Tri-State River Valley anchors remain authoritative.
