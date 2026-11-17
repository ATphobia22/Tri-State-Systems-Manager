# USFWS National Wetlands Inventory — Tri-State source and UX integration

Source reviewed 2026-11-17: https://www.fws.gov/program/national-wetlands-inventory/data-download

## Authority and access

- Agency: U.S. Fish and Wildlife Service, National Wetlands Inventory (NWI).
- Official state downloads: https://www.fws.gov/program/national-wetlands-inventory/download-state-wetlands-data
- Official live services: https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services
- REST service root (agency published): https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest
- Wetlands WMS capabilities: https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetlands/MapServer/WMSServer?request=GetCapabilities&service=WMS
- Cowardin codes and definitions: https://www.fws.gov/program/national-wetlands-inventory/classification-codes
- Project metadata: https://www.fws.gov/program/national-wetlands-inventory/metadata
- NWI publishes updates generally in **May and October**. State download page reports **October 2026** as latest state bundle update at review time; individual acquisition/publication dates MUST be read from downloaded metadata.
- Download **Indiana, Illinois, Kentucky** GeoPackage ZIP archives or narrower HUC8 packages. Source downloads use NAD83 Albers equal-area; read the exact source CRS/WKT from each asset rather than assuming EPSG:2966.
- State downloads intentionally overlap neighboring states; deduplicate by stable source identity/geometry with provenance before computing regional wetland areas. Do not double count boundary overlaps.
- ZIP contents: wetland polygons, project metadata, optional historic map information, optional riparian polygons and metadata. HUC8 modified WBD is **not** in state packages.

## TSM data plane proposal (not yet downloaded or verified)

Create an `ENVIRONMENTAL_CONTEXT` observation layer with stable source identifiers `USFWS-NWI-IN`, `USFWS-NWI-IL`, `USFWS-NWI-KY`. These identifiers are **proposed TSM identifiers**, not agency layer IDs.

1. Headless fetch of three agency ZIPs or selected HUC8 GeoPackages; record exact URL, retrieval UTC, bytes, SHA-256, publication date, license/access, source WKT and layer names. Reject unrecognized or malformed archives.
2. Headless ingest via GDAL/OGR; validate geometries, source classification codes, feature counts, null geometry and duplicate cross-state overlaps. Transform horizontal geometry explicitly to target map CRS; do not manufacture Z, NAVD88, flood depths or hydraulic boundaries.
3. Clip by the county/AOI with preserved original geometry/feature identity and source attribution. Compute parcel intersects and intersection area in a documented equal-area projection; treat as screening only.
4. Export offline GeoPackage/PMTiles or MVT snapshot with a source manifest and checksums. Web live WMS is optional and must be visibly marked **LIVE / NETWORK REQUIRED**; never silently substitute it when offline.
5. Publish provenance drawer: agency, wetland code/decoded Cowardin label, image/acquisition date when available, publication date, download timestamp, checksum, source map, metadata and `SCREENING ONLY`.
6. Regression gates: IN/IL/KY AOI coverage; seam deduplication; code lookup coverage; CRS roundtrip tolerance; absent source behavior; attribution; snapshot integrity.

## Interpretation and safeguards

NWI is photo-interpreted mapping of potential wetland and deepwater resources. It does **not** constitute a site-specific jurisdictional wetland delineation, Section 404 determination, FEMA NFHL hazard determination, BFE, groundwater measurement, or engineering certification. Lack of a mapped polygon does not establish absence of wetlands. Keep USACE and other relevant permitting authorities separate.

## Public map redesign

- Default to **map-first** layout: desktop navigation and engineering settings closed until requested; compact always-accessible navigation button.
- Collapsible hydraulic controls, with mobile responsive wrapping and no overlay obscuring the map.
- Progressive light theme: pale slate panels (`#f8fafc`), navy text (`#17324d`), clear borders (`#cbd5e1`). Migrate remaining dark tokens only after contrast and visual-regression checks.
- Organize layers in groups: Base & Terrain; Water & Flood; Wetlands & Habitat; Parcels & Infrastructure; Evidence & Provenance. Put visibility, legend, opacity, time and data status behind accessible disclosure controls.
- Keyboard-accessible `details/summary` and 44px targets, reduced-motion support, visible focus and consistent mobile navigation.
- Keep wetland overlays off by default until an actual validated WMS layer identifier or verified offline tileset exists. A REST service root is **not** a render-ready tile URL.

## Evidence state

This change documents official NWI discovery and proposes a safe adapter. No NWI state archives were downloaded, spatially joined or validated by this PR. No live NWI map layer, native UE renderer or offline Windows Shipping package is claimed verified.
