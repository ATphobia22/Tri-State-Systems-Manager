# Geoscience authority, 2026 USGS FSP, GeMS, and 2025 LiDAR standards

**Source review:** November 16, 2026. **Purpose:** specify actual applicability and an offline evidence gate for the IN–IL–KY Tri-State Systems Manager. This is not survey, scientific, professional, legal, or regulatory certification.

## What is newly integrated

The existing [FGDC/ISO/OGC catalog](../../data/standards/fgdc-standards-profile-v1.json), [FGDC metadata gate](../../scripts/geospatial/fgdc_metadata_gate.py), [LiDAR QL utilities](../../packages/geo/src/lidar/QualityLevel.ts) and [government authority boundary](../governance/SCIENTIFIC-AUTHORITY-AND-AGENCY-DECISION-GATES.md) already existed. They are retained.

This integration adds the [edition-scoped authority registry](../../data/standards/geoscience-authority-profile-v1.json) and [headless independent-evidence inventory](../../scripts/geospatial/geoscience_authority_gate.py), models USGS LBS **class 21 identifiable snow** and **class 22 temporal exclusion**, preserves already assigned point classes in vegetation banding, and catalogs the [USGS 2026 GeMS SGMC dataset](../../data/fabrics/geological/geological-fabric-manifest-v1.json) as a *candidate not yet downloaded*. [Synthetic tests](../../tests/geospatial/test_geoscience_authority_gate.py), [LiDAR contract tests](../../tests/contracts/lidar-classification.test.ts), and [CI](../../.github/workflows/geoscience-authority.yml) cover these bounds.

## Exact official source and authority boundaries

| Authority | Source | TSM interpretation |
|---|---|---|
| USGS FSP SM 502.3 (issued July 24, 2026) | https://www.usgs.gov/survey-manual/5023-fundamental-science-practices-peer-review | USGS science information products requiring peer review generally require two qualified, conflict-free scientific reviewers. TSM may adopt comparable record completeness but cannot declare USGS-reviewed output. |
| USGS FSP SM 502.7 (June 1, 2026) | https://www.usgs.gov/survey-manual/5027-fundamental-science-practices-metadata-usgs-scientific-data | USGS data metadata, FGDC-endorsed CSDGM or ISO 191xx metadata and review; the agency's requirements do not automatically give a third-party TSM release USGS standing. |
| USGS FSP SM 502.8 (June 1, 2026) | https://www.usgs.gov/survey-manual/5028-fundamental-science-practices-review-approval-and-release-usgs-scientific-data | USGS data review + metadata review + designated Bureau approval, separately from interpretive-publication peer review; no code can impersonate USGS IPDS approval. |
| USGS 3DEP LBS **2025 rev. A** | https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-online | Collection/delivery requirements include QA, versioned mapping report, independent checkpoint survey, classified points, raster NoData, and topographic treatment; historical data retain acquisition-era edition. |
| **GeMS 2020** (USGS TM 11-B10) | https://pubs.usgs.gov/publication/tm11B10 | USGS NCGMP geologic-map **database schema**, not FGDC geologic symbols and not an elevation/parcel source. |
| FGDC Digital Cartographic Standard (2006) | https://ngmdb.usgs.gov/fgdc_gds/geolsymstd.php | Geologic map symbology; does not validate map database geometry or stratigraphic interpretation. |
| FGDC metadata guidance | https://www.fgdc.gov/metadata/us-national-profile-iso19115/geospatial-metadata-standards | Metadata conventions, including transition toward ISO; CSDGM still appears in actual 3DEP deliverable contracts. |
| NGAC | https://www.fgdc.gov/ngac | Advisory group under Geospatial Data Act; not a geologist licensing authority or software standards certifier. |
| Indiana LPG board | https://igws.iu.edu/services/lpg | **IC 25-17.6 / Title 305 IAC**. Indiana board issues geology licenses; IGWS operates the affiliated website but does not itself issue a license. |
| Illinois IDFPR | https://idfpr.illinois.gov/profs/geology.html | Geologist licensure under current Illinois rules; external state-board verification required. |
| Kentucky BPG | https://bpg.ky.gov/ ; https://apps.legislature.ky.gov/law/Statutes/chapter.aspx?id=38848 | Kentucky Board of Registration for Professional Geologists, KRS 322A; registration/seals require human official review. |
| ASBOG | https://www.asbog.org/governance/mission.php | Provides exams; **not** a professional license-granting board. |
| AIPG | https://aipg.org/page/FAQs | Certified Professional Geologist is a voluntary credential, independent of legal state licensure. |
| ASPRS Edition 2 Version 2 (2024) | https://www.usgs.gov/ngp-standards-and-specifications/adopt-updated-accuracy-standards | Modern survey checkpoint and RMSE method. A source file or 30 synthetic points do not prove survey accuracy. |

## Specific 2025 LiDAR changes reflected in code

The official [USGS LBS classification table](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables) lists **20 ignored ground**, **21 snow (if present and identifiable)**, and **22 temporal exclusion**. The [USGS deliverables requirements](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-deliverables) require a bare-earth GeoTIFF with documented CRS and geoid reference, precise NoData convention (**-999999**), seamless hydroflattening, withheld flag handling, version-specific Lidar Mapping Report, FGDC metadata, and a separate independent survey/checkpoint deliverable. Identifiable **perennial** snowpack (class 21) is included in the DEM when actually present; it is not assumed for Posey County. A matching NoData convention is required for the associated maximum surface-height raster.

Code now treats 21/22 as distinct recognized classes, and the optional DEM candidate predicate includes class 21 *only upon explicitly supplied perennial-snow evidence*. The [headless PDAL pipeline builders](../../scripts/geospatial/pdal_pipelines.py) now expose an explicit `lbs_2025_nodata=True` option (required NoData **-999999**) while retaining the generic historical default `-9999`. With `include_verified_perennial_snow=True`, class 21 is included without promoting class 20 or 22; the SMRF input and candidate-building assignment preserve already classified special returns. The building-height rule is **only a class candidate**, not a roof-plane, architectural classification, or independently tested PDAL execution. Already classified water, buildings, excluded and snow points are no longer silently relabeled as vegetation. **The code does not claim a full LAZ/LAS/GeoTIFF 3DEP conformance audit.**

## New 2026 national geology dataset — source reference only

[USGS GeMS version of State Geologic Map Compilation](https://www.usgs.gov/data/geologic-map-schema-gems-version-state-geologic-map-compilation-sgmc-geodatabase-conterminous), June 8, 2026; DOI [10.5066/P1A3DQZK](https://doi.org/10.5066/P1A3DQZK); CC0 according to the USGS record. Includes 48 state source maps at approximately 1:50,000–1:1,000,000. **Critical caveat:** state geologic units are not reconciled at state borders; for states with separate bedrock/surficial maps, only bedrock is represented. Some legacy fields remain as non-required GeMS elements. This is regional context, not a verified subsurface model or site-specific borehole dataset.

TSM registers the public DOI and the limitations; **no geodatabase file bytes, checksum, map-layer fetch, GeMS feature validation, or site study have been produced by this change**. Do not claim regional geologic continuity from overlapping colored polygons.

## Reproducible offline gate

From the repository root:

~~~bash
python3 scripts/geospatial/geoscience_authority_gate.py
python3 -m unittest discover -s tests/geospatial -p test_geoscience_authority_gate.py -v
npm run test:lidar
~~~

For a real source package (not a synthetic fixture):

~~~bash
python3 scripts/geospatial/geoscience_authority_gate.py --manifest /path/to/source-evidence.json
~~~

The evidence JSON schema name is **tsm-geoscience-evidence-v1**. It requires subject type, jurisdiction, explicitly false automated approval, whether interpretive, and an agency source entry with ID, source URL, applicable edition, CRS, vertical datum, units and limitations. Three stages are available:

- **CATALOG_ONLY** — discovered source; no file bytes, survey, or certification.
- **SOURCE_BYTES_HASHED** — require a genuine inside-repository source file with recorded UTC retrieval and verified SHA-256; byte identity only.
- **REVIEW_DOCUMENTS_PRESENT** — additionally require independently recorded data and metadata review files, and for an interpretive output, two distinct scientific peer reviewer records with separately hashed artifacts. A hash does *not* authenticate the reviewers or make their assessment correct.

Every assessment returns **no** scientific certification, state license verification, Bureau approval or regulatory determination, including at the highest review-document stage. Historical editions stay recorded; an edition mismatch is explicitly flagged, not silently changed to the most recent USGS specification.

## Remaining external acceptance work

Actual LAS 1.4/LAZ, survey GeoPackages, QL, geoid, LMR, NoData and tileset boundary tests require the underlying binary data. Real GeMS schema/topology checks require the complete original geodatabase and the official USGS GeMS validation tools. Actual independent geodetic checkpoints, subsurface strata, licensed geological review, agency map approvals and offline UE5.8 Shipping acceptance are separate evidence gates.

**Human authority final.**
