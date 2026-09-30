"""Posey County parcel -> floodplain -> terrain spatial join chain.

Public-data chain only. Every step is fail-closed: a source observation is
recorded as OBSERVED, UNAVAILABLE, or NOT_CONFIGURED, and no observation is
ever promoted to a regulatory or engineering conclusion by this module.

Verified live 2026-09-30:
  - XSoft Engage Posey parcel backend:
      https://services6.arcgis.com/y6TIO0vqbm8Ixd4w/ArcGIS/rest/services/Posey_Parcels_(Public)/FeatureServer/0
    identifier field: StateCombi (query path confirmed in XSoft's map JS)
  - Indiana DNR flood hazard (Best Available, NFHL-sourced features):
      https://gisdata.in.gov/server/rest/services/Hosted/FLOODHAZARD_DNR_WATER_PROD/FeatureServer/0
  - USGS 3DEP elevation point query:
      https://epqs.nationalmap.gov/v1/json  (NAVD88, interpolated)
"""
