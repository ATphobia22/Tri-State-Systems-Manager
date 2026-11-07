# Ingestion worker + DB scaffold (v1)

**Status:** Foundation only. Not complete HEC-RAS, MODFLOW, PDAL, IFC, STEP, OpenMI, or Unreal integrations.

## Delivered

| Path | Purpose |
|------|---------|
| `db/migrations/120_core_ingestion.sql` | imported_assets, ingestion_runs, evidence_bundles, spatial_layers, replay_verifications |
| `db/migrations/121_ingestion_indexes.sql` | Indexes |
| `packages/ingestion-worker/` | Adapter registry, worker, OGR adapters, PMTiles job |

## Pipeline

acquire → quarantine → validate → normalize → provenance → promote → derive → publish

- SHA-256 required
- engineering_use/regulatory_use default false
- HEC-RAS/MODFLOW = evidence hash schemas only

Human authority remains final.
