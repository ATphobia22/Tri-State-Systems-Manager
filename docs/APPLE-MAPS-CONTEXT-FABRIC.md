# Apple Maps Context Fabric

TSM may use Apple Maps as a live presentation and user-initiated spatial-context surface. Apple Map Data is not an input to the TSM evidence plane, authoritative geometry store, analytical models, training corpus, or mapping database.

## Verified Apple capabilities

Apple currently documents MapKit capabilities including realistic 3D elevation, Look Around, annotations, overlays, search, geocoding, places, directions, and camera/pitch controls.

Official references:
- https://developer.apple.com/maps/
- https://developer.apple.com/documentation/mapkit
- https://developer.apple.com/documentation/mapkit/mapstyle/elevation/realistic
- https://developer.apple.com/documentation/mapkit/mkmapview

## Integration boundary

Use Apple only through Apple's documented interfaces for:
- interactive map presentation;
- realistic 3D map presentation where supported;
- Look Around street-level exploration where available;
- user-initiated place/search/geocoding;
- directions/travel-time context where appropriate;
- Apple map annotations/overlays required to present TSM-owned context on the Apple map;
- camera/pitch navigation owned by the TSM user experience.

Continue to source and store TSM evidence independently from USGS, NOAA, FEMA/NFHL, IndianaMap/IGIO, Indiana DNR, authoritative LiDAR/DEM, survey and engineering datasets, and permitted TSM-derived products.

## Prohibited patterns

Do not scrape Apple Maps, bulk-download Apple Map Data, extract Apple buildings/roads/terrain/imagery/POIs, persist Apple Map Data in PostGIS/PMTiles/3D Tiles/object storage/vector databases/evidence ledgers, construct a secondary Apple-data database, train TSM models on extracted Apple Map Data, use Apple Map Data to improve TSM's mapping service, or create a substitute mapping service from Apple access.

Do not cache Apple Map Data beyond the limited temporary use permitted by Apple's current terms/documentation.

These restrictions follow Apple's current Apple Developer Program License Agreement, Attachment 6. Re-check the current agreement before each production release.

## Accuracy rule

Apple is a presentation context, not a source used to increase TSM geometric accuracy.

Use this relationship:

Apple visual scene -> user orientation

not:

Apple visual scene -> TSM geometry correction

Building footprints, roads, terrain, flood elevations, parcels, and engineering alignments remain sourced from authoritative or explicitly classified TSM datasets.

## Open-world presentation

The TSM renderer remains responsible for authoritative terrain meshes, LiDAR-derived building products, engineering roads/infrastructure, water surfaces, flood visualization, weather effects, 3D Tiles, PMTiles, WebGPU/Three.js presentation, H3 visualization, and engineering annotations.

When an Apple surface is shown, it is a separate provider surface. TSM-owned overlays may be presented on the Apple map where Apple's APIs permit them.

## Camera contract

Camera state belongs to TSM:
- WGS84 latitude/longitude;
- heading;
- pitch;
- distance;
- selected feature;
- presentation/evidence mode.

A native Apple host may translate this TSM-owned state into MapKit camera controls. Apple Map Data must never become a camera-derived geometry source.

Suggested modes:
1. TSM Twin
2. Apple Context
3. Apple Street
4. TSM with Apple Context
5. Evidence

## Weather

Weather remains a TSM data fabric backed by authoritative meteorological sources. Apple map presentation is not the weather authority for TSM flood or hydrologic decisions.

Use TSM weather observations/forecasts for precipitation, cloud state, visibility, fog, wet surfaces, water appearance, and storm-state visualization.

## Failure behavior

If Apple is unavailable, TSM authoritative maps, evidence, and the TSM 3D twin continue operating. Look Around simply becomes unavailable.

If TSM authoritative data is unavailable, do not promote Apple presentation into evidence. Display the appropriate unavailable/provisional state.

## Safety invariant

The Apple boundary remains:

LIVE + PRESENTATION + USER INITIATED + NON-PERSISTENT

and never becomes:

INGESTION + STORAGE + DERIVATION + TRAINING + EVIDENCE
