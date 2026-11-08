# Geospatial evidence catalog

All records include service/layer ID, geographic coverage, acquisition date,
publication date, retrieval time, CRS, vertical datum, units, access requirements,
checksum and verification status. Every fact has a value, status and source.
Missing facts remain null/UNKNOWN, rather than inferred from the name or location.

```powershell
python tools/evidence_catalog/catalog.py --output evidence/catalog-20261108
python -m unittest discover -s tests/evidence_catalog -v
```

Python 3.10+; standard library only. The output directory must be new. Raw metadata
responses and `catalog.json` are saved together; `catalog.schema.json` describes
the structure. Add verified endpoints to `sources.json` and approved hosts to
`HOSTS` explicitly. Redirects must also remain on approved HTTPS hosts. No tokens,
provider passwords, or private records belong in the registry.

Eight starter records cover Indiana buildings/parcels, FEMA NFHL and its viewer,
IndianaMap, NGS event imagery, LANCE Flood and HLS. Page records are captured but
not interpreted as machine-readable dataset metadata. They need separately sourced
collection metadata before their acquisition dates or coverage can be filled.
An ArcGIS service record has a null layer ID; only a specific layer gets a layer ID.
Viewer/dashboard IDs identify applications, not the underlying datasets.

Acquisition/publication dates are intentionally not taken from ArcGIS created,
modified or lastEditDate timestamps. Those original values remain in sourceMetadata.
CRS and extents are preserved as reported, without silent reprojection. A vertical
coordinate-system code is recorded only if explicitly present; hasZ does not prove
NAVD88, and horizontal service units do not establish vertical units.

A checksum covers the exact retrieved metadata response, **not** all data behind
the service. Retrieval without credentials establishes public metadata access for
that request, not anonymous access or redistribution rights for every asset.
METADATA_PARSED means only metadata parsing/identity checks succeeded. It is not
survey certification, legal acceptance, source completeness or live-data freshness.
FETCH_FAILED, SERVICE_ERROR and IDENTITY_MISMATCH remain visible as separate states.
A successful script exit means a catalog was generated, not that every source worked.

Preserve acquisition time, publication time, retrieval time and source edit time
separately when later adding asset-level ingestion. Historical imagery, forecasts,
observed inundation and regulatory flood mapping retain separate category labels.
