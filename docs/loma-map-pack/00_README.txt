# FEMA Online LOMC Map Pack structure — Case 26-05-2022A

**Pure LOMA (natural high ground)** — human assembly and upload only.  
Portal: hazards.fema.gov (Online LOMC). TSM does **not** submit.

## Folder layout (recommended)

```text
LOMA_26-05-2022A_Bonebank/
  00_README.txt
  01_Cover_Transmittal_FEMA.md
  02_Cover_Transmittal_IDNR.md
  03_Community_Ack_Request_Cotner.md
  04_Property_Description.txt
  05_Elevation_Source_Narrative.txt
  06_Survey/                    # sealed survey PDF + CAD if available (owner-supplied)
  07_FIRMette/                  # from FEMA MSC
  08_FARA/                      # from INFIP (infip.dnr.in.gov)
  09_LiDAR_Evidence/
       SHA256SUMS-las.txt
       tile_list.txt
       lag_class2_summary.json  # DERIVATION only
  10_Photos/                    # structure + grades (optional)
  11_Parcel/
       bonebank_parcel_bounds.geojson
  evidence_manifest.json
```

## Portal field snippets (copy carefully)

**Property description:** structure on PT NE NE 8-8-14, APN 65-19-08-100-008.001-010, centroid 37.84589 N, 088.00510 W; natural high ground; no structural fill claimed for elevation.

**Elevation source:** LAG 377.2 ft NAVD88 from sealed survey (5 cm vertical); BFE 375.0 ft NAVD88 per effective study/panel cited in package; QL2 LiDAR corroboration only; reconcile INFIP nearby 368.7 ft note in cover letter.

## Required human signatures

| Form / item | Who |
|-------------|-----|
| Elevation form / sealed survey | Indiana LS or PE |
| Community Acknowledgment | Local floodplain administrator (verify current name/office) |
| Online LOMC attestation | Applicant / owner representative |

## CRS discipline

Analysis CRS for TSM: **EPSG:2966** (NAD83 / Indiana West, US survey feet) + **NAVD88**.  
Do **not** mix EPSG:2968 or web mercator into LAG math without explicit transform evidence.

## Dual BFE note

Map Pack regulatory plane: **375.0 ft**. INFIP nearby reach note: **368.7 ft**. Flag for professional reconcile — do not silently overwrite.
