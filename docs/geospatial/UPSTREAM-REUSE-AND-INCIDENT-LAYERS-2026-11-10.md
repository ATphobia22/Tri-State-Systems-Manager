# Governed upstream geospatial source discovery and offline incident layers

## Provenance and upstream reuse audit — 2026-11-10

Source forks:
- [ATphobia22/rasuwa-flood](https://github.com/ATphobia22/rasuwa-flood), immutable commit `a942163046643b661564df3344a15d11f74175dd`; upstream [iamtekson/rasuwa-flood](https://github.com/iamtekson/rasuwa-flood).
- [ATphobia22/awesome-geospatial-data-sources](https://github.com/ATphobia22/awesome-geospatial-data-sources), immutable commit `9a07ad2d93361a0f54ea3a9eda6cfd9a2bb91e90`; upstream [iamtekson/awesome-geospatial-data-sources](https://github.com/iamtekson/awesome-geospatial-data-sources).

These two forks had no LICENSE file in their repository trees at inspection. TSM **does not redistribute their code, data, imagery, GIS styles, icons, scraped datasets or trained weights**. The incident-layer module is original TSM code implementing a general, data-driven map inventory pattern with independently enforced provenance. The Rasuwa incident is in Nepal, so its incident polygons and observed geometry are **not** Tri-State ground truth.

The reviewed catalog contains 71 proposed or discovered geospatial repositories and 12 official/provider discovery links:
`data/registries/tsm-geospatial-upstream-discovery-20261110.json`.
Each project remains *uninstalled and unbundled*. A name in this index is not a license approval, software integration, live URL health check or scientific validation. For a specific repo, review its pinned commit, direct and transitive licenses, dependencies, legal data rights, tests and release compatibility before integration.

## New live endpoints in existing FastAPI companion

| Endpoint | Behavior |
|---|---|
| `GET /api/geospatial/source-discovery` | Returns catalog, SHA-256 of catalog bytes, candidate project decisions and authoritative source links; does not fetch the internet |
| `GET /api/geospatial/incident-layers` | Lists only local explicitly approved incident overlay manifests, reporting data as *unverified until opened* |
| `GET /api/geospatial/incident-layers/{id}/geojson` | Checks file containment, SHA-256, WGS84 2D coordinate range, FeatureCollection geometry type and public property field allowlist before returning GeoJSON |

All routes are read-only, do not contact the internet, do not run GIS models or LLMs, and do not change engineering authority. Missing staged data returns an explicit `SOURCE_UNAVAILABLE` catalog. A hash mismatch, invalid manifest, privacy or geometry violation yields an error rather than accepting a result as verified.

## Windows 11 / PowerShell data staging

Use a *public, legally reusable local GeoJSON file* with a known source and no individual private data. The following command is a template; **replace the sample input path and metadata with actual reviewed data**:

```powershell
Set-Location C:\Tri-State-Systems-Manager
$env:TSM_INCIDENT_LAYERS_ROOT = "C:\TSMData\regional\incidents"
python .\scripts\geospatial\stage-incident-layer.py `
  --source-file "C:\TSMData\incoming\bridges.geojson" `
  --root $env:TSM_INCIDENT_LAYERS_ROOT `
  --id "bridge-observations" `
  --title "Reviewed bridge observations" `
  --source-agency "Agency named on source dataset" `
  --source-url "https://example.gov/data-source-record" `
  --source-license "Verified license or usage terms" `
  --acquired-at "2026-11-10T15:00:00Z" `
  --attribution "Original data producer attribution" `
  --authority "CONTEXT" --style circle `
  --display-field "name" `
  --license-reviewed --approved-for-display --dry-run

# Remove --dry-run only after checking output and source rights.
python -m pytest backend/tests/test_incident_layers.py backend/tests/test_geospatial_source_discovery.py -q
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8790
```

Source files must already be EPSG:4326 longitude/latitude (GeoJSON 2D); use existing `backend/geospatial/vector_io.py` or GDAL/PROJ with recorded source CRS if reprojection is needed. `--dry-run` performs source/geometry/permission checks without changing files. A real staging command copies the source into the configured offline root, writes a SHA-256-pinned `layers.json`, and rejects duplicate layer IDs. No overwrite of verified prior layers is automatic.

Use the **operator's** downloaded data, not arbitrary scraped websites or Nepal example layers. For 3D/building elevation models use the existing EPSG/NAVD88/GEOID18 evidence stack, not this 2D overlay plane.

## What is implemented vs. what is not

**Implemented in this change:** source discovery, pinned repository inventory, local bounded overlay staging, hash/provenance verification, safe public attribute projection, read-only FastAPI routes and tests.

**Not implemented by this change:** automatic acquisition for all 71 upstream projects; downloading proprietary or restricted datasets; licensed QGIS plugin embedding; new FastAPI→Node/public-console wire; UE5.8 runtime map actor binding; Windows Shipping package; clean-host offline screenshots; flood prediction calibration; a FEMA effective-map certification.

Planned safe integration order: (1) exact 8-county source-verified clipping and joins; (2) operator-reviewed source/layer picker in existing TSM React/MapLibre fabric; (3) deterministic optional QGIS/GeoAgent processing adapter; (4) separately licensed segmentation and watershed model research; (5) native UE offline asset staging and a real clean-Windows-11 acceptance run. None of these are silently claimed complete.

**Scientific authority boundary:** Imagery segmentation, community reports, OSM context, WRC-style impact mapping, planning datasets, and model output may inform a human engineer. They do not overwrite FEMA effective NFHL/FIRM/FIS, approved local datum conversion evidence, professional field surveying or a calibrated HEC-RAS plan.

**AWS/Drive decision:** No AWS resource is provisioned by this change. The native desktop target does not need a hosted GeoServer, a cloud data cube or a live AWS database. Oversized independently verified raster snapshots and signed release artifacts belong in private external storage with manifests and checksums, not Git history; the previously designated private Google Drive input/output folders remain the intended destinations.
