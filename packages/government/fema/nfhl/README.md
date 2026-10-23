# NFHL capability

Capability ID: `geo.nfhl.query`. FEMA ArcGIS REST queries are read-only and constrained to the registered NFHL service. Always preserve layer ID/name, query parameters, source timestamp, effective-map context, and raw/result hashes. The service's 32-layer inventory is pinned and checked by `npm run nfhl:validate`; changes require source verification and reviewed registry updates.
