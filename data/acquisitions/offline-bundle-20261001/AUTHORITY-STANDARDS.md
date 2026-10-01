# Authority standards for TSM provenance (user direction 2026-10-01)

Every dataset in the bundle carries an explicit authority class. Never conflate
or silently promote one authority to another.

## FEMA NFHL
- Source: FEMA's current effective NFHL GIS services (REST / WMS / WFS).
- Effective NFHL is distinct from preliminary, pending, and draft products.
  Label which one a file came from; never present preliminary/pending/draft as effective.

## Indiana DNR BAFM
- Indiana's Best Available Floodplain Mapping is a SEPARATE state mapping product
  with its own ArcGIS services and downloads.
- It must NOT be silently promoted to FEMA NFHL authority. Label BAFM as BAFM.

## USACE NLD
- The National Levee Database exposes FeatureServer, MapServer, OGC, and JSON
  interfaces, with source update / assessment metadata. Retain that metadata.

## USGS 3DEP
- Public AWS distribution includes streamable EPT point clouds and a STAC catalog.
  Suitable for the terrain / offline-reference architecture.

## USGS Water Data
- The modern API provides machine-readable continuous measurements, daily values,
  site metadata, and OGC APIs. (Static/historical pulls allowed; live values only
  through the user-initiated snapshot button — no polling.)

## NOAA NWM
- The National Water Model provides observed/forecast hydrologic guidance and
  integrates multiple meteorological/hydrologic inputs. Label vintage clearly:
  analysis vs forecast, and the model cycle.

## HEC-RAS
- Current USACE documentation covers the user manual, hydraulic reference,
  Mapper, and 2D manuals. Model/software VERSION is retained as explicit
  provenance on every HEC-RAS artifact (e.g. "computed with HEC-RAS 6.x").

## General rules
- Record for every artifact: acquisition metadata, product vintage, authority
  class, CRS, vertical datum, provenance chain, SHA-256.
- Missing values are reported as unavailable — never zero, never invented.
- Provisional / draft / preliminary data is labeled as such, never laundered
  into an authoritative class.
