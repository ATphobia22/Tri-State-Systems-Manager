# TSM USACE public-data integration: Posey County, Indiana

**Research and validation date:** 2026-10-26. **Purpose:** non-regulatory,
non-survey-grade source comparison for Tri-State Systems Manager (TSM).

## Priority A: NSI 2026 cross-source geometry and elevation QA

- **API guide:** https://www.hec.usace.army.mil/confluence/nsi/technicalreferences/2026/api-reference-guide
- **Technical fields:** https://www.hec.usace.army.mil/confluence/nsi/technicalreferences/2026/technical-documentation
- **Release notes:** https://www.hec.usace.army.mil/confluence/nsi/technicalreferences/2026/release-notes
- **Posey FIPS:** `18129`.
- **Documented public endpoint:** `https://nsi.sec.usace.army.mil/nsiapi/structures?fips=18129&fmt=fc`
- **2026-specific fields:** `fd_id` (NSI record identity), `bid` (NSI bounding-box descriptor, **not** IGIO ID), `ftprntid`, `ftprntsrc`, `bldheight` (reported footprint-source building height **meters**), `ground_elv` (ground elevation **ft NAVD88**), `grnd_elv_m` (**m NAVD88**), `found_ht` (foundation height **feet**, **not** a roof measurement), `num_story`, `occtype`, `cbfips`.
- **Known provenance caveat:** NSI 2026 combines national footprint, parcel, census, NGA/USA Structures and modeled attributes. USACE itself calls NSI a **modeled exposure inventory**, not individually verified geometry. Its ground surface uses a 10 m USGS elevation source, not the user's high-resolution COPC LiDAR. Neither matched NSI points nor `bldheight` are replacements for LiDAR acceptance.
- **Availability caveat:** On 2026-10-26, the documentation was verified but the live Posey API response could not be downloaded from this execution environment. Download it from an authorized local/GitHub runner and hash-pin it. The download page is under development; county API is preferred.
- **Use:** Run `reconcile_usace_nsi_2026.py` against verified IGIO polygon input and the downloaded NSI snapshot. Retain local snapshots, receipt hashes, result vintage, and route all discrepancies to human review. Geometry must not be auto-repaired, nor should modeled NSI fields populate production `lidarHeightFt`.
- **Coordinate input assumption:** local IGIO upload WGS84 longitude/latitude is assumed by containment QA but its original coordinate metadata must be independently confirmed. NSI geometry is WGS84 point data.

### Local execution

```sh
python -m pip install 'shapely>=2.0,<3'
python scripts/geospatial/reconcile_usace_nsi_2026.py \
  --igio /secure/igio-source.geojson \
  --nsi /secure/usace-nsi-2026-posey.geojson \
  --receipt /secure/usace-nsi-igio-qa-receipt.json
python scripts/geospatial/test_reconcile_usace_nsi_2026.py -v
```

**QA status meanings:** `UNIQUE_CONTAINMENT_CANDIDATE_ONLY`,
`NO_UNAMBIGUOUS_NSI_MATCH`, `MULTIPLE_NSI_POINTS_INSIDE_FOOTPRINT`,
`INVALID_IGIO_GEOMETRY`. Neither process exit 0 nor QA counts
satisfy TSM's *23,082 actual source-linked LiDAR-derived GLB* release gate.

## Priority B: National Levee Database (NLD)

- https://levees.sec.usace.army.mil/data-services/services/
- https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer
- Feature layers include **Embankments (11)**, **Floodwalls (12)**, **FRM Lines (13)**, **Leveed Areas (16)**, **Berms (17)**, **Cross Sections (9)** and **System Routes (15)**.
- Service horizontal SRS `EPSG:4269` (NAD83), NOT the canonical `EPSG:2966`. The service also advertises vertical WKIDs; verify actual layer/feature vertical units and vertical datum before any `NAVD88` numeric comparison.
- Use NLD for **infrastructure context**, levee-segment identity and qualitative exposure. Do not infer FEMA accreditation or engineering crest guarantees from visualization. NLD data quality and recency vary by contributing owner/operator.

## Priority C: CWMS Data API / A2W

- API: https://cwms-data.usace.army.mil/cwms-data/
- Public portal: https://water.sec.usace.army.mil/
- Public water-project stage, flow, precipitation, elevation and storage observations. Must resolve station identity, agency/district, time zone, freshness, quality flags, and water-surface datum/zero **per series** before translating stage into NAVD88 WSE. *Never add a guessed gage datum to a stage value.*
- USACE explicitly says this public data is **preliminary and for general information only**, not technical study/design or critical decision support. Keep `INFORMATIONAL_ONLY` and `SOURCE_UNAVAILABLE`/`STALE` classifications.

## Priority D: National Inventory of Dams (NID)

- Public API: https://nid.sec.usace.army.mil/api/developer
- Public FeatureServer: https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer
- Use for nearby dam inventories and contextual hazard screens, not for roof geometry. Inundation maps, when available, are information and preparedness aids, not emergency forecasts.

## Priority E: HEC-RAS, HEC-FIA and HEC-FDA

- HEC-RAS terrain and 2D model guidance: https://www.hec.usace.army.mil/confluence/rasdocs/hgt/latest/guides/creating-an-combined-1d-2d-model
- HEC-RAS documentation: https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx
- HEC-FDA: https://www.hec.usace.army.mil/software/hec-fda/
- HEC-FDA release/certification info: https://www.hec.usace.army.mil/software/hec-fda/documentation.aspx
- HEC-FIA documentation: https://www.hec.usace.army.mil/software/hec-fia/documentation.aspx
- RAS Mapper creates terrain from georeferenced elevation rasters; validate CRS, units and vertical datum before conversion. NSI attributes can inform *screening-level consequences* only; publish hydraulic/risk conclusions separately with human review and source/model provenance.

## Outstanding release gate

TSM's last verified published tileset described **22,815/23,082** buildings. The local user-upload audit found **12 invalid source polygons** and **no height/elevation attributes** in that candidate. The production GH Actions run must separately prove full identity coverage, source-certified geometry, LiDAR/DEM measurement provenance, geometric validity, standards-compliant 3D Tiles, artifact round-trip SHA and actual native offline release completeness.

Keep a functioning partial visualization with explicit completeness warnings, but never label a partial or hypothetical model as accepted engineering data.
