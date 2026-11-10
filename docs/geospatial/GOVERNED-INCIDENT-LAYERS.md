# Governed flood incident layers — offline adapter (2026-11-10)

## Purpose and upstream boundary

TSM adapts the declarative **layer registry pattern** of [iamtekson/rasuwa-flood](https://github.com/iamtekson/rasuwa-flood) without copying Nepal flood footprints, imported survey data, satellite assets, imagery, vendor tiles, JavaScript modules or the upstream project license. The Nepal demonstration is a useful **interface concept**, not evidence of flooding in Posey, White, Wabash, Gallatin, Henderson or Union counties.

[awesome-geospatial-data-sources](https://github.com/iamtekson/awesome-geospatial-data-sources) is a **source discovery list**. Its entries have varying authorization, licensing, coordinate systems, acquisition vintages and operational reliability. Discovery is not ingestion or authoritative verification.

## Implemented

- `backend/geospatial/incident_layers.py`: local, bounded, read-only adapter. Requires operator-approved `layers.json`, CRS `EPSG:4326`, 2D GeoJSON geometries, SHA-256 match and display-property allowlist. Rejects path traversal, symlinks, remote inputs, unknown styles, duplicate layer IDs, unreviewed licenses and regulatory authority promotion. Geometry falls within a **broad bounding guard**, not an exact surveyed county intersection.
- `backend/app/main.py`: REST index `GET /api/geospatial/incident-layers` and `GET /api/geospatial/incident-layers/{layer_id}/geojson`. Index without approved manifest says `SOURCE_UNAVAILABLE`; data fetch provides `VERIFIED_LOCAL_ADVISORY` only after byte and geometry checks.
- `scripts/geospatial/stage-incident-layer.py`: explicit local-only dry-run/staging with license and human-display approvals; rejects duplicate IDs. Does not download or auto-poll.
- `backend/tests/test_incident_layers.py`: API mounting, evidence tampering, geometry classes, coordinates, z-values, policy, privacy and symlink security.

### Human reviewed staging example

```bash
python scripts/geospatial/stage-incident-layer.py \
  --root ./offline-data/regional/incidents \
  --source-file ./locally-reviewed-observations.geojson \
  --id local-observations \
  --title "Local observations, not an NFHL flood determination" \
  --source-agency "Reviewed local source" \
  --source-url "https://example.org/official-metadata" \
  --source-license "Reviewed source-specific license" \
  --acquired-at "2026-11-10T00:00:00Z" \
  --attribution "Reviewed local source" \
  --authority OBSERVATION --style circle \
  --display-field name --license-reviewed --approved-for-display \
  --dry-run
```

Remove `--dry-run` after human review; point `TSM_INCIDENT_LAYERS_ROOT` to the absolute staged directory. The API does **not** download files, promote source status, or supply missing water levels. Configure an operator-controlled data package for clean offline Windows 11 startup; an unstaged package must show unavailable.

## Scientific and legal limits

A 2D photo, community report or remotely sensed classification cannot automatically establish water-surface elevation, NAVD88 height, compensatory flood storage, damage claims, hydraulic capacity, or effective FIRM/FIS regulatory determination. Keep NGS/GEOID18/vertical-reference evidence separate. Avoid reconstructing or inventing Z coordinates. Validate exact county footprint, survey control and hydrologic calibration in separate engineering workflows.

**The module adds a backend contract, not a rendered MapLibre sidebar or native Unreal layer.** A future UI must consume this endpoint through explicit operator-controlled local data and must preserve source badges. Do not mistake unit/contract tests for native Windows UE5.8 Shipping validation.

## Additional candidates — evaluation required

- **GeoAgent:** optional natural-language GIS query planner; human-review before execution, bounded spatial queries, no agent write to regulatory evidence.
- **segment-geospatial/Prithvi:** optional separate AI imagery workspace with pinned model, checksum, license and uncertainty; never equal to observed flooding.
- **Rasterio/GeoPandas/Xarray:** reuse existing TSM scientific Python dependencies rather than re-vendor forks.
- **GeoServer/PostGIS/Datacube:** online/enterprise optional; not required in native offline installer.
- **GLOF-simulation/SAFE-python:** reference approaches only until hydrology, damages and regional model assumptions are calibrated and validated.

## Checks

```bash
python -m pytest backend/tests/test_incident_layers.py -q
node scripts/geospatial/report-crs-datum-catalog.mjs /tmp/tsm-datum-report.json
```

Passing these commands is insufficient for a release claim: execute clean offline Windows native startup, headed screenshots, staged TSMData checksums, verified vertical datum, full building footprint count and independent CI checks.
