# Immutable federal and state government source-harvest receipts

## Scope and evidence distinctions

`scripts/geospatial/tsm_manifest_builder.py` is an **offline-by-default, bounded JSON
metadata harvester** and append-only source receipt builder. It complements
`integrations/registry/tsm-immutable-source-manifest-v1.json` and the existing
`acquire-public-source-snapshot.mjs` adapter; it does not replace them.

**Do not mistake these independently different claims:**

| Claim | What the program actually demonstrates |
| --- | --- |
| Source listed in registry | An operator knows the URL, not that it worked |
| pyproj accepts declared EPSG | The EPSG code is recognized, not that response data uses it |
| Source metadata reports EPSG | A service self-reports a spatial reference, not independently surveyed coordinates |
| Response SHA-256 recorded | TSM captured those exact bytes, not that the government issued a matching hash |
| Publisher checksum matches | Captured bytes match the separately supplied publisher digest; trust the publisher identity separately |
| NAVD88 / GEOID18 declared | Metadata annotation only; not a verified vertical transformation |
| JSON snapshot captured | API or service metadata only, NOT a complete agency dataset or flood determination |

Reproducible command-line usage (Python 3.12):

```bash
python -m pip install -r scripts/geospatial/requirements-source-manifest.txt

# Safe planning mode: no network requests, no downloaded data
python scripts/geospatial/tsm_manifest_builder.py \
  --registry data/registries/tsm-government-harvest-candidates-2026-11-11.json \
  --out /tmp/tsm-manifest-plan-20261111.json

# Explicitly harvest bounded public JSON metadata into content-addressed files
python scripts/geospatial/tsm_manifest_builder.py \
  --mode fetch \
  --registry data/registries/tsm-government-harvest-candidates-2026-11-11.json \
  --out /tmp/tsm-manifest-captured-20261111.json \
  --snapshot-dir /tmp/tsm-government-snapshots

# Regression tests, never contact external government services
python -m unittest scripts.geospatial.test_tsm_manifest_builder -v
```

The output path must not already exist. Use one new path for each harvest.
Government endpoints are mutable, so the publication date, acquisition date and
retrieval time are separate fields. The manifest carries a SHA-256 digest of its
sorted-key JSON payload; this is *not* RFC 8785 JSON Canonicalization Scheme.
Content-addressed snapshots use exact captured bytes. Compare them with
`sha256sum` or an equivalent verifier before import into the evidence ledger.

## Source review and corrections

The three originally proposed targets were **unverified candidate URLs**, not
defensible imported assets:

1. The Mount Vernon NWS gauge is **MTVI3**, not MTTV2. Product stage must remain
   in gauge datum until station/product-specific zero and units are verified.
2. USGS `IN_Southwest_2024_A2.xml` is an XML metadata candidate, **not a DEM**.
   Its asserted EPSG:6933, NAVD88/GEOID18, exact county coverage, and product
   year should not be promoted into verified facts. Discover actual downloadable
   products through USGS TNMAccess or LidarExplorer and read each native header.
3. FEMA's `femaportal/NFHL/searchResult` is a portal, not a batch data export.
   The official public NFHL MapServer service metadata can identify layers and
   service CRS. Effective FIRM/FIS, LOMR and FARA evidence remain distinct
   regulatory/human-review work.

Official service references:
- USGS TNMAccess API: https://tnmaccess.nationalmap.gov/api/v1/docs
- NOAA NWPS API: https://api.water.noaa.gov/nwps/v1/docs/
- FEMA NFHL: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
- Indiana GIO datasets: https://gisdata.in.gov/

## Acceptance boundaries and next implementation gates

- The default command must not issue a network request. Only explicit
  `--mode fetch` or a manually dispatched opt-in workflow may access upstream.
- HTTPS hostname allowlisting, no redirects, maximum response bytes, JSON
  validation, bounded timeout, exclusive manifest creation and
  content-addressed immutable snapshots protect the acquisition surface.
- Unavailable upstreams are recorded as negative evidence with **no invented
  successful hash**. Preserve them as `SOURCE_UNAVAILABLE_OR_INVALID`.
- The initial registry is deliberately **metadata-only** and includes no
  arbitrary user-supplied URLs, credentials, or requests for large rasters.
- For production raster/vector data add a separately reviewed
  **product-download adapter** with native GDAL/rasterio/PDAL header inspection,
  data-layer identity, vertical geoid grid checks, source age and coverage
  verification. Do not derive those facts from declared metadata.
- For offline Windows 11, stage only hash-verified, reviewed assets in
  `TSMData`; no application runtime requests to government endpoints.
- Each survey/geotechnical/hydraulic/regulatory conclusion must maintain its
  own evidence gate. This is a harvesting tool, not a regulatory certification.
- Large snapshots stay outside ordinary Git; publish in an explicitly
  permissioned artifact store with checksums and retention policy.
