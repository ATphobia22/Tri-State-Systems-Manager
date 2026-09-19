# TSM Geospatial Data Fabrics

## Production flow

**Authoritative government source → source manifest → validated acquisition → immutable artifact → derived analysis → signed evidence → presentation.**

### Indiana

The IndianaMap adapter is the entry point for IGIO/IndianaMap FeatureServer, ImageServer, MapServer and approved download/COG products. Every source record carries:

- dataset/service identity;
- HTTPS source URL and metadata URL;
- service type and source agency;
- authority classification;
- horizontal CRS;
- vertical datum when actually documented by the source;
- resolution/acquisition metadata when supplied;
- temporal provenance.

A missing vertical datum is represented as unknown rather than guessed.

### OSM

Use a reproducible PBF snapshot plus stateful changes where current OSM-derived context is required. Load into PostGIS/Baremaps or generate PMTiles, then serve through the TSM Martin tile plane. OSM attribution/licensing remains attached to the derivative manifest.

### 3D

LiDAR/building/photogrammetry outputs use the existing 3D asset contract and may be packaged as GLB/glTF or OGC 3D Tiles. Cesium/Three.js/MapLibre are presentation consumers; they do not confer engineering authority.

### Hydraulic models

HEC-RAS/HEC-HMS execution belongs in an isolated worker. The scenario input manifest and model package are hashed before execution; results are hashed afterward; validation and human review are separate states.

### Historical evidence

Indiana State Library map material and IDOA State Land Office records are reference/historical evidence. They can support change detection and provenance but must not silently replace current survey, parcel, regulatory, or engineering source data.

## Explicit non-goals

- No hard-coded project BFE.
- No conversion of gage height into NAVD88 elevation without a documented datum relationship.
- No regulatory verdict from visualization code.
- No synthetic terrain, Gaussian splat, photogrammetry, or AI reconstruction promoted to measured geometry.
