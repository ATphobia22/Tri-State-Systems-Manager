# Scientific Execution Foundation

## Implemented contract layer

TSM keeps geospatial, government-source, execution, and evidence contracts in the packages already present in the repository. This change extends the existing geospatial package rather than creating a second, conflicting packages/geodesy package.

The geodesy contracts provide explicit horizontal and vertical datum types, a bounded EPSG fixture registry, unit conversion that distinguishes international feet from U.S. survey feet, GEOID18 compatibility checks, datum-transformation provenance validation, elevation validation, and surveyed gage-zero conversion validation.

## Safety invariants

- Position coordinates do not imply elevation semantics.
- Horizontal datum and vertical datum are separate metadata.
- NAD83 and NAVD88 represent different dimensions of the reference system and are not interchangeable.
- GNSS ellipsoidal height is not NAVD88 orthometric height without a documented and compatible transformation.
- A gage stage is not water-surface elevation until a station-matched, surveyed gage-zero relationship is verified.
- A supported EPSG contract fixture is not a complete EPSG database; unknown codes are reported as unsupported instead of guessed.
- GEOID18 compatibility is specific to NAD83(2011), epoch 2010.0 and the model's area of use. A named geoid model alone does not establish compatibility.

## Government evidence roadmap

The existing government source registries already contain FEMA NFHL, USGS 3DEP, USGS 3DHP/NHD, USGS NWIS, NOAA and other agency sources. Additional records should distinguish discovery catalogs from acquired and hash-verified data. topoView and US Topo are cartographic/map products, not terrain DEMs; DEM use requires an actual elevation raster with source metadata, acquisition vintage, horizontal CRS, vertical datum, units, nodata and checksum.

The attached FEMA USA Structures reference describes annual updates, national building-footprint coverage and feature-service/state-download access. TSM should register it as a discovery source until a specific service item, version, terms, coverage and byte-level evidence are captured.

## Execution and evidence status

Existing code already provides canonical evidence hashing and integrity checks, replay comparison, government source hashing/provenance envelopes, HEC-RAS evidence helpers, and a TSM exchange profile. This document does not claim a new production OpenMI standard runtime, deployed engineering gRPC server, HEC-RAS HDF5 extractor certification, MODFLOW budget parser, or physical validation against independent observations. Those are separate implementation and test gates.
