# Historical Topographic Map Fabric

USGS Historical Topographic Map Collection (HTMC) GeoTIFFs for the Tri-State
Systems Manager anchor area — Point Township, Posey County, Indiana, and
neighboring quads. Acquired 2026-11-05. Public domain (U.S. federal).

## Evidence class: cartographic reference only

These are scanned historical map images with embedded georeferencing. They are
**cartographic reference only: NOT a DEM, NOT bare-earth LiDAR terrain, NOT
surveyed bathymetry, NOT flood-zone or gauge data**, and NOT a substitute for
current bare-earth DEM, lidar-derived terrain, surveyed bathymetry, or
authoritative vertical-control data. They support historical landscape/context
review (river-channel, road, rail, and place-name change) and source discovery
only. They must not be promoted to an engineering input without separate
artifact, datum, coverage, resolution, and accuracy checks.

## Acquisition route

Discovered in the USGS TopoView viewer
(https://ngmdb.usgs.gov/topoview/viewer/) and downloaded through the USGS
National Map TNM Access API v1
(`https://tnmaccess.nationalmap.gov/api/v1/products?datasets=Historical
Topographic Maps&bbox=...&prodFormats=GeoTIFF`); the API `downloadURL`
fields point at the USGS `prd-tnm` S3 staged products that TopoView links to.
No sign-in required. No AWS use by TSM — these are public USGS files fetched
over HTTPS.

## Acquired files (8, 56,090,450 bytes total)

| File | Quad | Year | Scale | Size | SHA-256 (first 12) |
|------|------|------|-------|------|--------------------|
| IL_Wabash_Island_308958_1953_24000_geo.tif | Wabash Island, IL | 1953 | 1:24,000 | 4,291,190 | `646f6b9bcccf` |
| IL_Wabash_Island_308959_1958_24000_geo.tif | Wabash Island, IL | 1958 | 1:24,000 | 7,621,925 | `02628351d79c` |
| KY_Wabash_Island_709947_1981_24000_geo.tif | Wabash Island, KY | 1981 | 1:24,000 | 8,578,049 | `3e3af0b6614e` |
| IN_Mount_Vernon_160066_1952_24000_geo.tif | Mount Vernon, IN | 1952 | 1:24,000 | 4,321,712 | `e851a165619f` |
| IN_Mount_Vernon_160070_1981_24000_geo.tif | Mount Vernon, IN | 1981 | 1:24,000 | 9,967,172 | `dcf78d2df24f` |
| IL_New_Haven_309807_1906_62500_geo.tif | New Haven, IL | 1906 | 1:62,500 | 5,378,398 | `27b561b4dfde` |
| IN_New_Harmony_160087_1903_62500_geo.tif | New Harmony, IN | 1903 | 1:62,500 | 7,004,104 | `a9a71e485c78` |
| IN_New_Harmony_159317_1959_24000_geo.tif | New Harmony, IN | 1959 | 1:24,000 | 8,927,900 | `b7f15a2a53c9` |

Full provenance per file — source URL, TNM title and publication date,
embedded CRS, lon/lat bounds, dimensions, full SHA-256, and duplicate-record
notes — is in `MANIFEST.json` in this directory. The manifest was generated
from the committed files (sizes and hashes computed from the bytes on disk).

Verification performed on each file before commit: `file` reports TIFF image
data (little-endian, JPEG-compressed, 3-band RGB); `rasterio` opens each file
and reads its embedded CRS — all eight embed NAD27 (Clarke 1866), Polyconic,
with a per-quad central meridian — plus pixel dimensions and lon/lat bounds.
Downloaded sizes match the TNM `sizeInBytes` values exactly.

Datum/projection as stated by TopoView: the New Harmony 1903 sheet is listed
in TopoView as Datum "Unstated", Projection "Unstated", survey year 1901; the
GeoTIFF file itself embeds NAD27/Polyconic georeferencing as applied by USGS
when the scan was staged. Both facts are recorded in `MANIFEST.json` — the
embedded CRS is a property of the staged file, not a claim about the original
1903 survey datum. TopoView datum/projection metadata was not recorded for
the other seven sheets during the 2026-11-05 analysis and is recorded as not
stated, not invented.

Edition notes: TopoView showed the Wabash Island 1958 sheet as "1958 (1959
ed.)" and the Mount Vernon 1952 sheet as "1952 (1953 ed.)" and the New
Harmony 1959 1:24,000 sheet as "1959/1961"; TNM publication dates are 1958,
1952, and 1959 respectively. Both labels are recorded in `MANIFEST.json`.
TNM catalogs the 1981 Wabash Island edition under the KY state label while
the 1953/1958 editions are cataloged under IL; it is the same 7.5-minute
Wabash Island quad.

Selection rule: one variant acquired per quad/year — the earliest-cataloged
(2018-02-18) TNM scan, lowest file ID among that batch. TNM returns multiple
records for the same quad/year (duplicate scans of the same map, identical
titles and publication dates); unacquired duplicates are listed per file in
`MANIFEST.json`.

## Not acquired

- **New Haven 1966 (15-minute, 1:62,500)** — no TNM GeoTIFF product found
  for a 1966 edition. TNM lists only 1905 and 1906 at 1:62,500 for this area.
- **New Harmony 1925 (1:62,500)** — no TNM GeoTIFF product found. TNM lists
  New Harmony only as 1903, 1938, and 1959.
- **New Harmony 1981 (1:24,000)** — no TNM GeoTIFF product found; the
  1:24,000 series in TNM ends at 1959 for this quad.
- **New Harmony 1938 (1:62,500)** — a TNM GeoTIFF exists but 1938 was not in
  the bounded target set; not acquired rather than substituted for the
  unavailable 1925 edition.
- **Evansville quads and all US Topo editions 2010–2022** — outside the
  bounded anchor-area set; not acquired, still discovery-only.

## Registry status

The TopoView source (`usgs.topoview` in
`packages/government/src/GovernmentSourceRegistry.ts`,
`data/posey-county/government-evidence-boundaries-v1.json` entry
`usgs-topoview`) remains discovery-only at source level: its
`evidenceStatus` stays `AVAILABLE_FOR_DISCOVERY_NOT_ACQUIRED`, as the
contract tests require. The eight files above are the only quads acquired
with provenance; they are recorded in the registry entry's `acquiredFiles`
list and in `MANIFEST.json`. The US Topo series (`usgs.us-topo`) is
untouched — no US Topo edition was acquired.
