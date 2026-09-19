# TSM Data-Fabric Completion — 2026-09-19

The repository now has a single registry covering the operational open-world fabrics: USGS/NOAA hydrology, NOAA/NWS weather, USGS 3DEP and Indiana elevation, Indiana current imagery, current Indiana roads, parcels/address context, LiDAR-derived buildings, FEMA/Indiana flood layers, PostGIS/Martin/PMTiles/3D Tiles, H3, OSM context, Mapillary, Apple Maps/Look Around context, HEC-RAS simulation, and geodetic/datum transformations.

The registry is tsm-console/src/lib/data-fabric-registry.ts.

Authority remains separated as AUTHORITATIVE -> DERIVED -> OBSERVATIONAL -> PRESENTATION.

Apple Maps is presentation-only. Look Around is not a street-survey replacement. Mapillary is observational reference. Photogrammetry/Gaussian splats remain presentation/derived products. H3 is indexing. 3D Tiles are transport/presentation. Weather drives visualization but does not establish hydraulic conclusions.

A fabric is considered implemented when a source/authority contract exists, an ingestion/resolver path exists, provenance/freshness metadata is retained, the normalized product can be consumed where appropriate, and a contract test protects the boundary.

This registry is not a claim that every source is continuously harvested in production; live acquisition remains subject to source availability, rate limits, credentials, and deployment configuration.
