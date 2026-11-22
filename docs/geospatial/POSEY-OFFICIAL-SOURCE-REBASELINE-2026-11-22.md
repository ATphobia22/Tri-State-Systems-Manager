# Posey County official-source rebaseline

Date: 2026-11-22 UTC.
Status: SOURCE-IDENTITY CODE IMPLEMENTED; LIVE DATA AND 3D ACCEPTANCE NOT YET VERIFIED.

## Source counts versus 3D coverage

Indiana GIO's 2016-2020 building footprints are reference polygons derived from LiDAR. The official FeatureServer currently advertises hasZ=false and Web Mercator source coordinates. These polygons are not independently surveyed elevations or roofs. The earlier fixed all-buildings numerical target must not substitute for the current official county inventory.

The new tools independently query official count and all unique OBJECTIDs, require equality, capture the service lastEditDate, hash the sorted IDs, optionally acquire all polygon pages by source ID, and reject source edits during acquisition. No count such as 23,082 is assumed in this workflow.

The independent renderability tool compares a height-enriched GeoJSON against the source inventory hash. It never drops a missing source ID from the 2D authority set and records the missing/uncertain subset separately. Eligible geometry remains PROVISIONAL_VISUALIZATION_ONLY until independent terrain, geoid, source quality and Cesium validation. Neither script makes a regulatory or civil-engineering certification.

## Commands

Run synthetic no-network tests:

    python -m unittest discover -s tests -p test_posey_official_inventory.py -v
    python -m unittest discover -s tests -p test_posey_renderable_receipt.py -v

Acquire a new government snapshot on a network-enabled CI runner:

    python scripts/geospatial/posey_official_inventory.py --output /secure/posey-source-inventory.json --geometry-dir /secure/raw-pages

Compare existing height enrichment against a complete source-identity receipt:

    python scripts/geospatial/posey_renderable_receipt.py --source-receipt /secure/posey-source-inventory.json --enriched-geojson /secure/posey-height-enriched.geojson --receipt-out /secure/posey-renderability.json --provisional-subset-out /secure/posey-preview-only.geojson

CI workflow: Posey Official Source Inventory. Normal PR checks are offline unit tests; workflow_dispatch acquires live data and saves time-stamped content hashes and source response receipts as GitHub Actions artifacts. Successful ID coverage is not successful 3D Tiles coverage.

## Indiana source domains

The source register in data/authorities/indiana-posey-source-register-2026-11-22.json names Indiana GIO buildings, parcel boundaries, addresses, road centerlines, administrative boundaries, LiDAR/DEM catalog, dated ortho tile footprints, plus Indiana DNR INFIP, BAFL, hydrology/hydraulic engineering references and DoWORC. Sources have different roles and publication cycles. The registry does not claim all files are downloaded or government-certified, and DNR BAFL is distinct from effective FEMA NFHL regulatory data. Native vertical datum and units must be read and verified per raster or LiDAR tile, not inferred from filename or an assumed EPSG.

## Drive cryptographic receipt (actual bytes checked)

On 2026-11-22 the existing TSM-Posey-DEM Google Drive folder received a versioned evidence ZIP, SHA256 sidecar, JSON receipt, and JSON SHA256 sidecar. Seven existing Drive files were downloaded and hashed. The IGIO candidate audit ZIP and the elevation evidence ZIP hashes exactly matched values in the prior saved manifest. ZIP integrity checks passed. This is stored-file integrity, not an agency digital signature or validation of raw source features.

The previous November 19 transfer status explicitly reports zero bulk raster files transferred, transfer not completed, and engineering validation pending. A correct digest cannot close these gaps.

## Still required before production acceptance

- Network-enabled real current IGIO source count, unique IDs, complete geometry pages and comparison against official county boundary
- Original elevation/imagery tile content, full SHA256, CRS, vertical datum and control-point verification
- All missing/occluded roof measurements explicitly classified by source OBJECTID
- Provenance-linked per-feature building/terrain placement and OGC 3D Tiles validation
- Offline native UE5.8 Shipping app independent launch proof

## Official references

- https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0
- https://www.arcgis.com/sharing/rest/content/items/384f2d5041a14c34bd9e807c568784da/info/metadata/metadata.xml?format=default&output=html
- https://registry.opendata.aws/in-elevation/
- https://www.in.gov/gis/geoinsights/posts/data-harvest-naming-convention-update/
- https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping/
