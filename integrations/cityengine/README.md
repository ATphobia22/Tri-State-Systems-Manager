# CityEngine / Unreal Capability Boundary

This integration is an **offline asset-build boundary**. It is not a runtime dependency of the TSM console and does not replace authoritative geospatial processing.

## Requirements

- Dedicated Windows 11 runner for current CityEngine SDK requirements.
- Unreal Engine 5 for the CityEngine for Unreal plugin.
- Visual Studio 2022 for development/build integration.
- Appropriate Esri licensing for commercial use and distribution.

## Artifact contract

Every generated asset must have a manifest conforming to `asset-manifest.schema.json` and include:

- stable asset ID;
- exact CityEngine source commit;
- output format;
- source/target CRS;
- vertical datum;
- source reference;
- SHA-256 content digest.

The geospatial contract remains fail-closed: an asset without explicit coordinate-reference and vertical-datum metadata is not promoted to an authoritative or public delivery artifact.
