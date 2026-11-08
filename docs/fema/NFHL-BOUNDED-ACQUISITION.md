# Bounded effective FEMA NFHL evidence acquisition

This optional **online preparation** tool produces offline GeoJSON and SHA-256
manifests for the existing TSM NFHL registry, geospatial joins, tile fabric, and
Unreal renderer. It does not change the native offline runtime.

```bash
python scripts/geospatial/acquire_nfhl_effective.py \
  --bbox -88.2 37.7 -87.8 38.0 \
  --layers firm_panels flood_hazard_zones bfe cross_sections \
  --output /path/to/tsm-staging/nfhl --max-features 10000
python -m unittest discover -s tests/fema -p 'test_*.py' -v
```

The bounding box is **illustrative**, not a validated county boundary. The
tool verifies feature-ID completeness per request, records SHA-256 for each
chunk, and fails when the configured limit is exceeded. It does **not**
claim countywide completeness or publication-date authority. For county/state
coverage, acquire and independently reconcile the official FEMA Map Service
Center bulk NFHL download.

**Provenance:** official FEMA effective service
https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer ;
service documentation
https://hazards.fema.gov/femaportal/resources/flood_map_svc.htm .

**Regulatory separation:** Preliminary, pending, and draft NFHL are not mixed
with effective layers. Horizontal source geometry is NAD83 / EPSG:4269; output
is EPSG:4326 GeoJSON. Elevation fields are never assumed NAVD88 and are
labeled UNVERIFIED until their source-specific vertical datum and units are
verified. No automatic flood determination, LOMA/LOMR, survey seal, or
engineering certification is generated.

**Integration contract:** Treat the output as an unreviewed staging dataset.
Review metadata, dates, CRS, geometry validity, field units, county extent,
FIRM panel identity, and all chunk hashes before importing into the existing
PostGIS/Martin/MapLibre/Unreal tile pipeline. This script does not install
third-party dependencies, render a native map, or execute an Unreal build.
