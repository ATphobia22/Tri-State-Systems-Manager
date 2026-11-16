# Posey County LOMA research and evidence reconciliation (2026-11-16)

**Status:** SCREENING ONLY; NOT A FEMA APPLICATION; NOT A CERTIFIED ELIGIBILITY REGISTER.

## Executive finding

No source reviewed establishes that 4,391 structures are LOMA-eligible. A previous screening run reported 22,815 building footprints, 1,743 footprints overlapping a pinned DNR flood-hazard extract, 1,422 uniquely parcel-matched, and 321 unmatched. These figures are **prior-run reported counts**, not independently recomputed by this document; preserve the original CSV, input checksums, code revision, GIS joins, and query date before treating them as audited counts. They do not prove that any structure meets LOMA requirements. The number of certified eligible structures remains unknown.

## Governing sources

1. FEMA, MT-EZ instructions: https://www.fema.gov/sites/default/files/documents/fema_mt-ez-instructions_english.pdf — MT-EZ is for a single residential structure or lot; not for multiple structures/lots, developers, fill, floodway or conditional requests.
2. FEMA, MT-1 Technical Guidance (November 2024): https://www.fema.gov/sites/default/files/documents/fema_guidance_mt-1_technical_guidance_nov_2024.pdf — natural ground LOMA versus fill-based LOMR-F, parcel grouping, elevation and map evidence.
3. FEMA, LOMA information sheet: https://www.fema.gov/sites/default/files/documents/fema_request-loma-lomrf.pdf — LAG at or above BFE for structure removal; out-as-shown route if map placement is demonstrably wrong.
4. Indiana DNR, Best Available Floodplain Mapping: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping/ — county BAFL polygons and flood-elevation points, NAVD88 elevations.
5. Indiana DNR BAFL MapServer: https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer — BAFL is **not** usable by itself for flood insurance determinations; effective FEMA NFHL/FIRM/FIS must be checked.
6. Indiana DNR, Floodplain Information Portal: https://secure.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal — FARA is required for LOMA applications in A zones.
7. Indiana DNR FAQ: https://secure.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-mapping-faqs/ — surveyor or PE registered in Indiana for certified elevation evidence.
8. USGS 3DEP Lidar Base Specification 2025 rev. A Table 4: https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables — QL1 nonvegetated vertical RMSEv <= 0.100 m; QL1 aggregate pulse density >= 8/m2; DEM minimum cell size 0.5 m.
9. Indiana Board of Licensure for Professional Geologists: https://igws.iu.edu/services/lpg — IC 25-17.6 and 305 IAC apply to geological practice; a geologist seal is not a substitute for the surveyor/PE elevation certification required for a LOMA.

## Reproducible evaluation

For each unique, currently existing structure with confirmed effective FEMA SFHA overlap, collect:
- immutable footprint ID, source, vintage, parcel ID, township, geometry, parcel-join method and ambiguity flags;
- FEMA effective FIRM panel, effective date, flood zone, floodway, FIS profile or official BFE determination and its vertical datum;
- Indiana DNR INFIP/FARA report where applicable, distinguished from FEMA-effective evidence;
- certified lowest adjacent grade (LAG), measurement date, vertical datum, survey method, responsible Indiana-registered surveyor/PE, and natural-grade/fill history;
- exact datum transformation and units; no unverified constant offset;
- property-owner authorization and applicable MT-EZ or MT-1 supporting documents.

Define the elevation margin in consistent feet:
`margin_ft = LAG_NAVD88_ft - BFE_NAVD88_ft`.
For example only: `377.2 - 375.0 = +2.2 ft`; these are unverified repository working values for an anchor and **not a certified Posey County determination**.
If either elevation, datum, FEMA-effective source, or fill history is missing, classify `INSUFFICIENT_EVIDENCE`, not eligible or ineligible.
For structure LOMA, the elevation test is `LAG >= BFE`; meeting it is necessary but not a FEMA determination. For entire-lot requests evaluate the lowest lot elevation instead.

**Uncertainty:** 0.100 m QL1 RMSEv = 0.328084 ft, an aggregate product quality specification, not a per-structure bound or legal substitute for certified LAG. A DEM cell or roof height is not LAG.

## Screening count reconciliation (previous reported run; pending independent rerun)

| Quantity | Count |
| --- | ---: |
| Building footprints screened | 22,815 |
| BAFL-overlapping footprints | 1,743 |
| Unique parcel/township matches within overlaps | 1,422 |
| Overlap footprints with ambiguous/unassigned township | 321 |
| Certified eligible structures verified from available evidence | **0 verified; true count unknown** |

Checks: `1,422 + 321 = 1,743`; overlap fraction `1,743 / 22,815 = 7.6397%`; unique-match fraction of overlap `1,422 / 1,743 = 81.5835%`. These fractions measure **screening and matching**, not eligibility. Recompute from pinned input datasets before relying on them.

## Data and submission controls

Repository `data/posey-county/README.md` warns that its BAFL file contains 4-county geometry despite the Posey filename and that county DEM is downsampled 30 m; neither is certified survey evidence. Filter by authoritative Posey county boundary, not filename alone; retain effective NFHL as a separate authority. An MT-EZ cannot be used as a countywide batch application. Do not represent a CSV as directly submittable to FEMA Region V absent written agency instructions. A manifest may be used as an **internal case-preparation index**, not a FEMA-approved import schema.

## Minimum manifest schema

`footprint_id,parcel_id,township,source_date,screening_zone,ba_fl_overlap,effective_firm_panel,effective_firm_date,effective_sfha,effective_floodway,bfe_ft,bfe_datum,lag_ft,lag_datum,datum_conversion_source,margin_ft,natural_grade_verified,licensed_surveyor_pe,certification_date,fara_report_id,evidence_links,review_status,application_route`

Use `review_status=INSUFFICIENT_EVIDENCE` unless verified. Do not fabricate rows or infer certification from lidar.

## Repository integration status

On 2026-11-16, PRs #614, #615, #616, and #618 were open and GitHub reported `mergeable=false` for each. Latest-head PR workflow lists showed successful completed runs, but overlapping files and non-mergeable states require conflict resolution and review; success of CI alone does not authorize merging. Other diverged branches include Dependabot actions, GeoBIM evaluation and Mount Vernon runtime. Do not force-merge or force-update main.

This document does not claim FEMA, Indiana DNR, USGS or professional licensure approval.
