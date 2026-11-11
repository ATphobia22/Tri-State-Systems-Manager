# GeoBIM and GIS open-source evaluation — 2026-11-11

This is an **evaluation record**, not a claim that external code has been installed or tested. Machine-readable inventory: `artifacts/tsm-geobim-source-evaluation-v1.json`.

## Immediate adoption candidates
- **IfcOpenShell** (upstream, not one of the seven forks): prefer a separate, version-pinned IFC-to-geometry conversion CLI. Preserve IFC GlobalId, source file hash, IfcProjectedCRS, IfcMapConversion, units, placement transform, and any vertical reference evidence. **Do not infer NAVD88** from a projected CRS alone. Reference: https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/georeference/index.html
- **openBIMstudio** (MIT fork): evaluate IFC authoring and BCF issue exchange in a sandbox. Do not add a second production web editor to the offline native Windows release without an architecture decision.
- **map3d** (MIT fork): use as a *reference* for React Three Fiber interaction patterns and city-style presentation. TSM already owns geospatial 3D Tiles, CityJSON conversion and building validation paths. Do not replace authoritative IGIO building footprints with OSM/procedural shapes.
- **img2threejs** (Apache-2.0 fork): procedural art and cinematics only; separate from evidence-backed terrain, buildings and hydraulic outputs.

## Separate tools / deferred
- **ingetrazo** GPL-3.0: separately deployed BIM authoring; no source vendoring or static linking until license obligations are reviewed.
- **artcraft** Apache-2.0/MIT: optional cinematic asset authoring, not a source of survey geometry.
- **xtool** MIT: potential CI-only SwiftPM/iOS build support; not a Windows runtime dependency.
- **rea** MIT: reverse-engineering is outside the required GeoBIM release gates; defer.

## Required IFC-to-TSM integration contract
1. Require immutable source revision, SPDX review, transitive-license review, input hash, and reproducible converter version.
2. Parse and retain IFC GlobalId and object classification; reject duplicate IDs and record unsupported entities.
3. Require explicit IFC map conversion, horizontal CRS, model length units, and vertical datum or mark **UNRESOLVED_DATUM**. No automatic feet/meters or ellipsoidal/orthometric mixing.
4. Preserve original coordinates, transformation parameters and precision. Validate at least three known control points before approving geospatial placement.
5. Produce a reviewable intermediate geometry artifact with per-building source IDs and SHA-256 before generating 3D Tiles or native Unreal assets.
6. Keep derived visualization geometry separate from authoritative FEMA/USGS/IGIO/DNR/USACE records. Do not call procedural LOD2/LOD3 geometry surveyed or certified.
7. Test offline execution, invalid IFC, huge geometry, path traversal, embedded external references, and deterministic round-trip conversion.
8. Track Posey County's **23,082 source footprints** independently from any BIM import; IFC ingestion cannot close the existing missing-building evidence gap by itself.

## Existing TSM integration points
- `scripts/geospatial/cityjson_to_3d_tiles.py`
- `scripts/geospatial/build-building-3d-tiles.py`
- `scripts/geospatial/validate-building-3d-tiles.py`
- `docs/3D-TILES-CITYGML-PIPELINE.md`
- `artifacts/tsm-3d-tiles-fabric-v1.json`

## Release boundary
No new runtime service, cloud requirement, login, web view, or mandatory external package is introduced. This inventory is non-executable until a separate reviewed implementation PR and its tests pass.
