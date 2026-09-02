# Indiana FIRM map updates (Posey / Tri-State)

## Authority hierarchy

1. **Effective FIRM + FIS** (hardcopy / MSC products) control NFIP rating and many statutory references.  
2. **NFHL** is the digital representation used for GIS identify (TSM SSOT assist).  
3. **Community Status Book (CSB)** records Init FHBM, Init FIRM, **Current Effective Map Date**, and Regular Program entry.  
4. **LOMC** (LOMA/LOMR) may supersede the map at a structure or polygon.

TSM **does not** adopt maps for the community; only the local floodplain administrator / governing body does under 44 CFR and Indiana statute.

## Posey County (working TSM locks)

| Item | Value |
|------|--------|
| Unincorporated CID | **180209** |
| County FIPS | **18129** |
| NFHL FIRM panel (Bonebank identify) | **18129C0300C** |
| Panel EFF_DATE (NFHL) | **2014-11-05** |
| Ordinance alignment | Posey maps/ordinance cite **2014-11-05** |
| Regular Program history | FHBM 1977-06-24 → initial FIRM ~1987-01-01 (historical) |

Other Posey CIDs (Mount Vernon, New Harmony, Cynthiana, etc.) have **separate** community status rows—do not apply unincorporated panel logic to incorporated places without checking CSB.

## How Indiana communities receive map updates

1. FEMA study / restudy or Physical Map Revision (PMR) / Countywide update  
2. Preliminary maps → appeal/protest period  
3. Letter of Final Determination (LFD)  
4. Community **adopts** floodplain management regulations consistent with new maps by effective date or risks **NFIP suspension**  
5. Effective date appears on FIRM panel title block, FIS, CSB “Curr Eff Map Date”, and NFHL `EFF_DATE`

Watch: [FEMA communities eligible for suspension](https://www.fema.gov/flood-insurance/work-with-nfip/community-status-book/public-notification/communities-list) and Indiana CSB extracts.

As of 2026-09-02 research, **no evidence** of a newer countywide Posey effective FIRM superseding the 2014-11-05 panel set for Bonebank; always re-check MSC + CSB before regulatory filings.

## TSM operator checklist when maps change

1. Download new panel from **msc.fema.gov**  
2. Update `data/schemas/tsm-site-constants-13101-bonebank.json` and `firm-panel-ssot.ts`  
3. Re-run NFHL layer 3 identify at structure coordinates  
4. Re-inventory LOMC (LOMA/LOMR) affecting the parcel  
5. Stamp EvidenceArtifacts as OBSERVATION until PE / floodplain admin accepts  
6. Never auto-file LOMA from map change alone

## Related Indiana geospatial

- Indiana GIO / IndianaMap for parcels, ortho, LiDAR (not NFIP effective maps)  
- IDNR Best Available Floodplain data may **inform** but does not replace the effective FIRM unless adopted under state/local process
