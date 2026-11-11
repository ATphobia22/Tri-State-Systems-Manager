# Point Township native digital-twin integration contract

## Scope
The included Python validator is **headless** and validates separately captured Unreal inspection records. It does not assert FEMA compliance or verify a source hash against original evidence bytes. Source checksums must be validated by the upstream evidence ledger. The threshold is an independently verified local rule input, never a universal FEMA requirement.

Run: `python -m unittest discover -s tests/engineering -p test_validate_unreal_inspection_audit.py -v`
Then: `python scripts/engineering/validate_unreal_inspection_audit.py --input Saved/AuditLogs/inspection.json --output Saved/AuditLogs/inspection_review.json`

## Required native producer contract
Each Unreal building inspection event must contain StructureID, SourceID, SourceSHA256, HorizontalCRS, VerticalDatum, ElevationUnits, LAGSourceType, RuleID, RuleVerified, FloodZoneIntersection, LowestAdjacentGradeFt, BaseFloodElevationFt, RequiredFreeboardFt, ScreeningStatus and FreeboardDeficitFt. Missing fields yield NOT_EVALUATED, never a passing status. An actual survey and authority-approved rule must back any claim beyond screening.

## Native Unreal implementation gates
- Use the actual project module export macro, not an assumed POINTTOWNSHIP_API. Add Unreal build dependencies only when linked and built.
- H3 v4 `latLngToCell`, `gridDisk`, and `cellToParent` require actual linked H3 C library; store indexes as unsigned 64-bit values (or canonical strings for JSON/Blueprint interoperability). H3 parent cells do not form exact nested polygons. Use camera ECEF/WGS84 transform rather than a fixed location or fabricated index.
- Asset load state is REQUESTED, LOADING, LOADED, FAILED, or UNLOADED. Do not set LOADED until completion and a valid asset exists. Cancel callbacks safely and track spawned actors for cleanup. `FStreamableManager` loads cooked Unreal assets, not raw .gpkg files; use a separate bounded native GIS IO worker.
- GeoPackage geometry starts with a variable-length header: GP magic, flags, SRS ID, optional envelope, then WKB. Validate table/column identifiers against gpkg metadata, use read-only prepared queries, check endian and geometry type, and transform source CRS to Unreal coordinates before geometry generation.
- Do not derive a physical foundation elevation from LAG. Building height and footprints require verified provenance. Extrusion must triangulate concave polygons and preserve holes, winding and units; do not fan-triangulate arbitrary polygons or assume default 4.5m height is measured.
- UMG and material styling must distinguish NOT_EVALUATED, THRESHOLD_MET, THRESHOLD_NOT_MET and DISCREPANCY. No binary green/red 'FEMA compliant' claim. Audit logs need UTC timestamps, source hashes, scenario IDs, datum and version.
- USGS 03322000 is the Wabash River at Mount Carmel, Illinois, not an Ohio River Mount Vernon gauge. Never add stage to NAVD88 without a verified station datum offset. USGS OGC Water Data endpoints should be assessed against the current API rather than assuming legacy NWIS is permanent.
- NOAA forecast precipitation probability is not observed precipitation rate; do not fabricate an intensity from probability. Remove hard-coded soil moisture, water quality, weather and pressure readings; mark absent telemetry SOURCE_UNAVAILABLE.
- Weather shaders may display forecast or synthetic scenarios only with explicit labels. Model outputs are asynchronous, provenance-checked snapshots; do not imply that Niagara rainfall alone computes hydraulic inundation.
- Windows 11 Shipping, Cesium tileset rendering, native UI interaction, offline asset startup, and headed screenshot/FPS/VRAM verification remain separate release gates.
