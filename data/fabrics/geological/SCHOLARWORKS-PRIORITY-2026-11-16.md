# IU ScholarWorks / Indiana Geological Survey: historical source integration

**Reviewed:** 2026-11-16. **Provided community:** [Indiana Geological Survey](https://scholarworks.iu.edu/dspace/communities/762d9abf-72d7-4962-818e-b1c0baf1defa), hosted by Indiana University ScholarWorks.

The registry [igws-scholarworks-priority-v1.json](igws-scholarworks-priority-v1.json) records **nine individually inspected publication records**, with original item UUIDs, persistent handles, authors, year, series, scale when explicitly stated, reuse terms, publication download URLs and geographic applicability. **This is metadata and citation data, not an imported PDF, vector/raster dataset, surveyed borehole log or hydraulic input**. The supplied community page exposes annual reports, regional maps, bulletins and coal maps, but this list is not an exhaustive archive harvest.

## Directly relevant to Posey and Lower Wabash

| Source | Record / use | Limit |
|---|---|---|
| [Shaver (1979), Lower Wabash / New Harmony](https://scholarworks.iu.edu/dspace/items/7641f608-c277-451b-8cf7-ae263ede37ec) | Occasional Paper 27, historical fluvial geomorphology and terrace/abandoned-meander context | Not current riverbed bathymetry or flood-elevation observation |
| [Gray, Wayne, Wier (1970), Vincennes 1°×2°](https://scholarworks.iu.edu/dspace/items/2d98d5c9-cea9-4eaf-a78f-ef3600812d10) | Regional Geologic Map 03, **1:250,000**, bedrock/unconsolidated deposits | Verify actual map footprint before claiming parcel or Posey intersection |
| [Ault (1997), Posey coal structure](https://scholarworks.iu.edu/dspace/items/de056a47-99fe-4b41-82a9-4533125d8611) | Miscellaneous Map 60; Springfield Coal Member structure | Does not certify mine voids or foundations at specific sites |
| [Mackey, Tanner, Stellavato (1981), northern Posey coal structure](https://scholarworks.iu.edu/dspace/items/5e96c4c6-b0a6-4ae0-a527-506708ae15c3) | Miscellaneous Map 33, historical northern-Posey stratigraphy | No site measurements; map scale not confirmed |
| [Collett (1884), Geology of Posey County](https://scholarworks.iu.edu/dspace/items/41c4ec6c-dd64-47ae-99d4-8a73126bd150) | Historical geological and drainage narrative | Not contemporary terrain, soils or engineering design data |
| [Marean (1916), Soil Survey of Posey County](https://scholarworks.iu.edu/dspace/items/40f8aeb8-eef7-4442-81cc-2c963367207f) | Historic soil and land-use reference | Modern soil screening requires current USDA NRCS SSURGO and site review |

## Henry H. Gray context

- [Gray, Ault, Keller (1987), *Bedrock geologic map of Indiana*, MM48](https://scholarworks.iu.edu/dspace/items/398b76a6-593f-4604-8e77-001c17022bf8) — **1:500,000**, statewide regional context only.
- [Gray (1989), *Quaternary Geologic Map of Indiana*, MM49](https://scholarworks.iu.edu/dspace/items/b5e7e16d-e590-4f8f-8379-1688b99ed722) — **1:500,000**, statewide surface/depositional context only.
- [Owen and Gray (1987), Bulletin 61](https://scholarworks.iu.edu/dspace/items/e343aca5-df8c-49b7-8cbe-4853376d9e8e) — historical 1837–1838 reconnaissance republication, not current subsurface control.

**Separate source / spatial coverage warning.** The [2023 *Bedrock Geologic Database of the Vincennes 30′×60′ Quadrangle (GeMS Level 3)*](https://doi.org/10.14434/ijes.v5i1.36420) covers **Daviess, Knox, Sullivan and Greene counties**, according to its abstract. Do not assume it includes Posey simply because the **1970 Vincennes 1°×2°** regional sheet has a similar name. The 2023 GeMS geodatabase and metadata attachments are outside the provided DSpace community. [USGS GeMS](https://ngmdb.usgs.gov/Info/standards/GeMS/) specifies geological database structure and differs from the FGDC map symbolization standard.

## Rights and scientific boundaries

- The linked publications carry **Creative Commons noncommercial notices**. **Five** inspected entries display contradictory rights text and link metadata, including a noncommercial-sharealike description paired with a different Creative Commons URL. Do **not** interpret ambiguous rights as permission to bundle their PDFs, map imagery or extracted tiles into an Apache-licensed executable or a free public site.
- The source PDFs **have not been downloaded into this repository**. Their byte checksums, original CRS, vertical datum, georeferencing accuracy and survey control are **unknown**, not zero. An official bibliographic record is only proof that a publication exists.
- Recorded evidence is HISTORICAL_PUBLISHED_CONTEXT and NOT_GEOREFERENCED_OR_VALIDATED. No boreholes, mine void locations, parcel elevations, present flood boundaries, or professional geology certification are inferred.
- For actual geology/hydrology model forcing, acquire modern licensed, georeferenced and validated data from the relevant official service, with measurement uncertainty, acquisition date, spatial extent and reviewed coordinate operations. Refer to [geological source fabric](README.md).

## Reproducible headless metadata pipeline

Default run is **offline** with no downloads:

    python3 scripts/geospatial/igws_scholarworks_catalog.py
    python3 -m unittest discover -s tests/geospatial -p test_igws_scholarworks_catalog.py -v

Optional actual online download of the original **DSpace item JSON metadata**, never publication PDFs:

    python3 scripts/geospatial/igws_scholarworks_catalog.py \
      --fetch-metadata \
      --save-metadata-dir /tmp/igws-dspace-20261116 \
      --output /tmp/igws-dspace-audit.json

This command only calls pinned IU HTTPS metadata API URLs. It enforces bounded size, original-host URL and ID/handle/title/year integrity, source-rights-URI matching and refusal of withdrawn records. Captured exact metadata JSON gets **its own SHA-256**; the digest does not apply to linked PDFs. Existing captures are not overwritten. The [CI gate](../../../.github/workflows/igws-scholarworks-evidence.yml) runs offline and does not need external availability.

**Downstream integration:** show the records in a history / bibliography drawer and link to the source pages, with visible HISTORICAL, REFERENCE_ONLY and RIGHTS_REVIEW_REQUIRED states. Do **not** overlay the source map images on terrain until legal reuse, digitization/georeferencing, layer extent and uncertainty are independently established.
