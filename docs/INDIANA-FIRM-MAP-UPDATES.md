# Indiana FIRM map updates (Posey / Tri-State)

## Authority and data hierarchy

1. **FEMA effective FIRM + FIS** are the federal NFIP products used for FEMA flood-hazard/rating purposes. Confirm the effective product in the FEMA Map Service Center (MSC).
2. **NFHL** is FEMA's digital National Flood Hazard Layer representation and is useful for GIS identification; a digital identify result does not replace review of the effective FIRM/FIS and any LOMC.
3. **FEMA Community Status Book (CSB)** records the community's initial and current effective map dates and program history.
4. **LOMC** products (LOMA, LOMR-F, LOMR, etc.) can modify or remove mapped conditions for the affected property or mapped area without necessarily reissuing an entire FIRM panel.
5. **Indiana DNR Best Available Floodplain Data / Layer** combines FEMA FIRM information with DNR studies and provides additional floodplain/floodway information used for Indiana floodplain administration. It is a separate state/local regulatory data product and must not be silently substituted for the federal NFIP product.

TSM stores these layers separately and never converts a mapping observation into an automatic regulatory determination.

## Posey County working TSM locks

| Item | Value |
|------|-------|
| Unincorporated CID | **180209** |
| County FIPS | **18129** |
| Bonebank NFHL FIRM panel identify | **18129C0300C** |
| NFHL panel EFF_DATE recorded by TSM | **2014-11-05** |
| FEMA Community Status Book current effective map date | **11/05/2014** |
| Regular Program entry | **01/01/1987** |

The FEMA CSB report currently published for Indiana confirms the unincorporated Posey County CID **180209** and current effective map date **11/05/2014**.

The TSM repository's NFHL identify record reports panel **18129C0300C** at the Bonebank coordinate and an EFF_DATE corresponding to 2014-11-05. Treat that panel identity as the **TSM digital SSOT**, not as a substitute for downloading the effective FIRM/FIS from MSC before a regulatory filing.

## What has changed in Indiana mapping practice

Indiana DNR's current floodplain program maintains and updates the Indiana Best Available Floodplain Layer and incorporates FEMA updates. INFIP displays both FEMA and DNR floodplain information and can generate a Floodplain Analysis and Regulatory Assessment (FARA).

DNR describes Best Available Data as including the FEMA FIRM plus DNR studies. DNR also provides mechanisms to request review or submit technical information when the mapped information needs correction or refinement.

For TSM, this means **FIRM/NFHL and DNR Best Available mapping are parallel evidence layers with explicit provenance**, not competing versions that should be merged into one polygon. A parcel can require both federal NFIP review and Indiana floodway/state-permitting analysis.

## FIRM update lifecycle

1. FEMA study / restudy, Risk MAP project, Physical Map Revision (PMR), or countywide mapping update.
2. Preliminary mapping and community review/appeal/protest processes.
3. Letter of Final Determination (LFD), when applicable.
4. Community adoption/maintenance of required floodplain-management provisions for NFIP participation.
5. Effective FIRM/FIS date becomes the controlling federal map date for the affected community/product set.
6. LOMC products can later modify mapped conditions for a property or area.

## TSM operator checklist when maps change

1. Check the **FEMA Map Service Center** for the current effective FIRM/FIS and LOMC history.
2. Check the **FEMA Community Status Book** for the community's current effective map date.
3. Run an NFHL identify at the structure coordinates and record the panel/product metadata.
4. Check **Indiana INFIP / Best Available Floodplain Data** for the state/local floodway and floodplain context.
5. Re-inventory LOMA/LOMR/LOMR-F records affecting the parcel.
6. Store downloaded source artifacts and hashes in the Evidence Ledger with authority/derivation metadata.
7. Require floodplain-administrator / engineering review before promoting an observation to a regulatory conclusion.

## Official resources

- FEMA Map Service Center: https://msc.fema.gov/portal/home
- FEMA Community Status Book — Indiana: https://www.fema.gov/cis/IN.pdf
- Indiana Floodplain Information Portal (INFIP): https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/
- Indiana Best Available Floodplain Mapping: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping/
- Indiana DNR LOMR/CLOMR Review Partner: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/fema-lomr-review-partner
