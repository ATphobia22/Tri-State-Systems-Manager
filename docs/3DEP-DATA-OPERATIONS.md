# 3DEP / National Map Data Operations

## Purpose

TSM treats USGS National Map and 3DEP as authoritative discovery/acquisition sources for terrain evidence. The repository stores product manifests and provenance, not operational LAS/LAZ/DEM binaries.

## Acquisition contract

1. Query the USGS National Map Access API for the target bounding box.
2. Filter to requested 3DEP product families and supported formats.
3. Preserve product title, dataset, bounds, CRS, download URL, acquisition/publication dates, resolution, quality-level metadata, and vertical reference when supplied.
4. Download large products to controlled object storage or operator workspace; do not commit binary terrain data to Git.
5. Verify downloaded artifact hashes and retain the source product metadata alongside the evidence artifact.
6. QL2 is a product quality descriptor, not a blanket guarantee that every derived engineering elevation meets a site-specific survey requirement. Confirm vertical accuracy, datum, epoch, classification, acquisition conditions, and intended use before engineering adoption.

## Engineering boundary

3DEP terrain supports visualization, screening, terrain analysis, and evidence preparation. A licensed survey/engineering review remains required where a regulatory or design decision depends on site-specific vertical accuracy.

## CRS / datum rule

Never silently transform a National Map product. Record the native horizontal CRS and vertical reference first, then record any transformation as an explicit derivation step with method, software version, and uncertainty.
