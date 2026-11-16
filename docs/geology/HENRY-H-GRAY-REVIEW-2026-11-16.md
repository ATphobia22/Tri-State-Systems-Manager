# Henry H. Gray historical geological mapping: TSM source and suitability review

**Reviewed:** 2026-11-16 | **Scope:** bibliographic reference and scientific provenance, not acquisition of original map pixels, feature geometries, licensed map data, georeferenced footprints or site-survey results.

## Official Indiana / USGS catalog crosswalk

| Publication | Catalog | Date and stated scale | Applicability |
| --- | --- | --- | --- |
| Owen survey with Gray's 1987 introduction/commentary, Bulletin 61 | [IGWS/IU original record](https://scholarworks.iu.edu/dspace/items/e343aca5-df8c-49b7-8cbe-4853376d9e8e) | Original survey 1837–1838; republication 1987; report, not a uniform GIS map scale | Historical provenance only |
| Gray, Ault and Keller, Bedrock Geologic Map of Indiana, Miscellaneous Map 48 | [IGWS/IU record](https://scholarworks.iu.edu/dspace/items/398b76a6-593f-4604-8e77-001c17022bf8) | 1987, 1:500,000 | Statewide bedrock context, not parcel geology |
| Gray, Jenkins and Weidman, Geology of the Huron Area, Bulletin 20 | [IGWS/IU record](https://scholarworks.iu.edu/dspace/items/ece2b4ea-bf61-427b-b637-b7146a5da67e) / [USGS NGMDB](https://ngmdb.usgs.gov/Prodesc/proddesc_81988.htm) | 1960, 1:48,000 | South-central Indiana study; outside core Posey AOI |
| Wier and Gray, Indianapolis regional map | [IGWS/IU record](https://scholarworks.iu.edu/dspace/items/96bb20d2-a954-42c4-a1a0-a51551736eb4) / [USGS NGMDB](https://ngmdb.usgs.gov/Prodesc/proddesc_81961.htm) | 1961, 1:250,000 | Indianapolis region; not a Posey site layer |
| Gray, Quaternary Geologic Map of Indiana, Miscellaneous Map 49 | [IGWS/IU record](https://scholarworks.iu.edu/dspace/items/b5e7e16d-e590-4f8f-8379-1688b99ed722) | 1989, 1:500,000 | Statewide surficial Quaternary context |
| Gray, Wayne and Wier, Vincennes regional map, RGM 03 | [IGWS/IU record](https://scholarworks.iu.edu/dspace/items/2d98d5c9-cea9-4eaf-a78f-ef3600812d10) | 1970, 1:250,000 | Lower-Wabash regional candidate; **actual Posey overlap not yet proven by a georeferenced polygon** |

The Vincennes record has a discrepancy: the IU contributor metadata spells the last author's name **Weir**, while the published citation spells it **Wier**. The machine-readable catalog uses the published citation and records the discrepancy instead of silently treating both entries as two authors.

**Copyright and reuse:** The IGWS/IU catalog reports noncommercial-license terms for some of these records, and some rights fields conflict internally (e.g. narrative text versus rights URL). Free download does **not** mean unconstrained map redistribution or derivative-layer publishing. TSM stores only source citations and descriptions and sets redistribution approval to false. Obtain asset-level permission/license clarification before mirroring originals, deriving rendered geological assets, or packaging originals offline.

## Use in the Tri-State digital twin

1. Link the six exact source records as historical bibliography; display author, publication year, mapping scale and collection period separately.
2. Treat the 1987 bedrock map and the 1989 Quaternary map as **regional conceptual geology**. Their published 1:500,000 scale does not justify identifying groundwater/aquifer boundaries, bearing capacity, site strata or parcel excavation quantities.
3. Inspect the Vincennes map footprint geospatially before attaching it to any Posey parcel; do not infer overlap from the name of the quadrangle.
4. Before introducing real geologic features, obtain an explicitly licensed data release, source acquisition time, bytes/SHA-256, geospatial reference, original scale, map-unit lexicon, unit dating/interpretation, uncertainty and independent scientific QA.
5. [USGS GeMS 2020](https://ngmdb.usgs.gov/Info/standards/GeMS/) is the database schema for published geology. [FGDC geologic symbolization](https://www.fgdc.gov/standards/projects/geo-symbol/) is a **different** standard for rendering geology. Neither a title match nor a styled legend demonstrates actual GeMS conformance.
6. Independently measured site-specific borehole logs, ground truth, geotechnical tests and reviewer qualifications are needed for professional/site engineering; no such evidence is created by these bibliography records.

## Scientific review and authoritative boundaries

[USGS Survey Manual 502.7 (June 1, 2026)](https://www.usgs.gov/survey-manual/5027-fundamental-science-practices-metadata-usgs-scientific-data) requires appropriate metadata, including scientific quality, provenance and review evidence for USGS data releases. [SM 502.8 (June 1, 2026)](https://www.usgs.gov/survey-manual/5028-fundamental-science-practices-review-approval-and-release-usgs-scientific-data) establishes USGS data review/approval/release controls. These USGS personnel rules are references for designing independent project QA—not a claim of a USGS review, DOI, USGS release, government adoption or agency endorsement of TSM.

**Professional practice:** Geology, engineering and surveying licensure is controlled by the applicable state and discipline. Historical survey maps cannot substitute for licensure or a site-appropriate professional determination. An ASBOG exam or an AIPG credential is not the state-issued geologist practice license. Each relevant Indiana/Illinois/Kentucky license and scope must be separately verified with its state board.

## Reproduce machine-readable metadata gates

- Catalog: data/fabrics/geological/gray-historical-publications-2026-11-16.json
- Validate: python scripts/geospatial/historical_geology_gate.py
- Use boundary: python scripts/geospatial/historical_geology_gate.py --publication-id IGWS-MM48-1987 --use SITE_ENGINEERING
- Test: python -m unittest discover -s tests/geospatial -p test_historical_geology_gate.py -v
- LBS raster pair: python scripts/geospatial/lbs_raster_pair_gate.py --dem /path/to/original-dem.tif --mshr /path/to/original-mshr.tif

The raster-pair command requires local GDAL gdalinfo and genuine GeoTIFF files. It compares grid, CRS, NoData and AREA_OR_POINT metadata and hashes input bytes. It does **not** inspect original GeoKey bytes, test mapping-report content or independently measure vertical accuracy. It returns an explicitly limited consistency status, not full [2025 LBS rev. A](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-revision-history) compliance.

**Not evidenced:** Downloaded original Gray publication assets; redistribution rights clearance; pixel-aligned or vectorized historic maps; source coordinate operation and datum; geological unit schema validation; boreholes, soil assays, scientific peer acceptance; unfilled terrain/model/geodetic release gates.

## Official state professional-geologist authority references

The [state board registry](../../data/standards/tsm-professional-geologist-authorities-2026-11-16.json) records three official issuing authorities and their cited legal sources: [Indiana Board of Licensure for Professional Geologists](https://igws.iu.edu/services/lpg) (IC 25-17.6; 305 IAC), [Illinois IDFPR Geology](https://idfpr.illinois.gov/profs/geology.html) ([225 ILCS 745/25](https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022507450K25)), and [Kentucky Board of Registration for Professional Geologists](https://bpg.ky.gov/) ([KRS 322A](https://apps.legislature.ky.gov/law/Statutes/chapter.aspx?id=38848)). [ASBOG](https://www.asbog.org/licensure.php) explicitly states that it supplies exams, not licenses. The registry remains a directory: current personal credentials, exemptions, responsible charge and professional scope have not been checked.
