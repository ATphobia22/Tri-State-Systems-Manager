# Indiana Data Harvest 2025 and imagery: reproducible ingestion policy

**Reviewed:** 2026-10-26. **Source:** Indiana Geographic Information Office (IGIO). **Authority:** informational GIS framework; not a survey, FEMA ruling, engineering-grade LAG/FFE or countywide building acceptance.

## Release chronology matters

The [IGIO release announcement](https://www.in.gov/gis/geoinsights/posts/data-releases-data-harvest-2025-and-imagery/) dated **2025-12-18** states the 2025 parcel and administrative-boundary releases were available, while other layers would follow. The [2026-03-20 IGIO Data Harvest article](https://www.in.gov/gis/geoinsights/posts/data-harvest/) confirms the broader 2025 dataset release and recommends year-refreshing web services. The [2026-01-23 naming change](https://www.in.gov/gis/geoinsights/posts/data-harvest-naming-convention-update/) explains why services ending in `_Current` are mutable and past years are archived.

**Important:** `_Current` does **not** prove a particular edition year. Service descriptions sometimes describe older publication histories. TSM must pin the actual source product/edition year using authoritative product metadata or archival services, not infer it from a URL or download date.

## Authoritative service discovery (metadata only)

The governed registry is `data/registries/indiana-gio-harvest-2025-v1.json`. Four source keys are supported by `scripts/geospatial/acquire-public-source-snapshot.mjs`:

| Source key | Service | Semantics |
| --- | --- | --- |
| `igio-parcels-current` | `Parcel_Boundaries_of_Indiana_Current/FeatureServer` | Parcel framework, not surveyed ownership determination |
| `igio-administrative-current` | `Administrative_Boundaries_of_Indiana_Current/FeatureServer` | Multiple county-maintained government boundary layers |
| `igio-roads-current` | `Road_Centerlines_of_Indiana_Current/FeatureServer` | County road context; address ranges need independent QA |
| `igio-addresses-current` | `Address_Points_of_Indiana_Current/FeatureServer` | Address framework; **never publish private address lists** |

To acquire a small **service metadata snapshot only**, execute from the repository root:

```sh
node scripts/geospatial/validate-igio-harvest-contract.mjs
node scripts/geospatial/acquire-public-source-snapshot.mjs --source igio-parcels-current --out ./artifacts/igio-service-metadata
```

Each metadata snapshot writes a SHA-256, ETag (when present), retrieval timestamp and a manifest explicitly labeled `UNVERIFIED_MUTABLE_CURRENT_SERVICE`. It **does not download every feature or certify county coverage**. No live-host fallback is permitted in the packaged Windows runtime; download/source-admission occurs in a controlled build environment before freeze.

For data ingestion, query authoritative service `OBJECTID`s with pagination or download a complete official snapshot; explicitly filter to Posey County using verified county geometry. Freeze source URLs, exact source edition, source record IDs, native spatial reference, transformation pipeline/PROJ grids, retrieval date, checksums, feature counts and exception ledger. Never infer county completeness merely from a statewide FeatureServer extent.

## Imagery geography and date gate

The **2025 orthoimagery collection was in Indiana's central tier**, while Posey County is in the western tier. The announcement does not establish a **2025 Posey County** orthophoto. The current imagery ImageServer can mix acquisition vintages.

Use the [Indiana imagery AWS open data registry](https://registry.opendata.aws/in-imagery/) and the [2026-09-28 leaf-off update](https://www.in.gov/gis/geoinsights/posts/indiana-leafoff-and-leaf-on-imagery-updates/) for discovery, but accept a Posey county tile only after checking its tile-level acquisition timestamp, QA/QC status, native CRS, actual coverage and SHA-256. COG and LAZ/COPC compression are valid transport formats; they are not evidence of a newer image acquisition or more accurate survey.

The [August 2026 IGIO building-extraction research announcement](https://www.in.gov/gis/geoinsights/posts/breakthrough-in-automated-building-footprints/) does not prove a complete replacement Posey source building layer. **The 267-building delta remains an independent reconciliation task.** TSM should not generate fictitious features or silently change the target.

## Scientific and privacy controls

- EPSG:4326 statewide framework geometries are not engineering EPSG:2966. Apply checked transforms with explicit units and geodetic realization.
- These planar framework datasets do not establish NAVD88, orthometric heights or ground survey benchmarks.
- Keep public read anonymous but avoid exposing a private parcel centroid, household address, or other sensitive feature attributes in public demos and artifact manifests.
- Preserve `INFORMATIONAL_ONLY` and `HUMAN_REVIEW_REQUIRED` until a licensed surveyor/engineer or competent agency supplies and verifies the needed site-specific evidence.

## Tests

```sh
node --test scripts/geospatial/validate-igio-harvest-contract.test.mjs scripts/geospatial/acquire-public-source-snapshot.test.mjs
node scripts/geospatial/validate-tri-state-data-sources.mjs
```
