> **DRIVE IMPORT — REGULATORY / GRANT WORKING DOCUMENT**
>
> Source: Google Drive — "FEMA_BRIC_GRANT_AND_DATA_DOSSIER_VER....pdf" · Drive last modified: 2026-08-16
> Ingested: 2026-09-25 · Verification status: **REFERENCE**
>
> Working document from the owner's archive. Values and assertions (elevations, application
> IDs, BCR figures, program details, deadlines) are as-stated in the source and have NOT been
> independently verified. Verify against authoritative sources (FEMA, IDNR, licensed survey,
> live agency NOFO) before any filing or reliance. See `docs/DRIVE-MANIFEST.md` for known
> cross-document inconsistencies.

---
Tri-State Family Engineering System &
Point Township Digital Twin (PTDT v34)
Official Government Grant Application & Verified Data
Dossier
Program: FEMA Building Resilient Infrastructure and Communities (BRIC) / Hazard Mitigation
Assistance (HMA) Submission Portal: FEMA Grants Outcome (FEMA GO) / Indiana
Department of Homeland Security (IDHS) Project Node: 13101 Bonebank Road, Point
Township, Posey County, Indiana Grant Application Identifier: PTDT-v34-FY26-BRIC-01

Part I: FEMA BRIC Subapplication Narrative (Verified
for FY24-26 Cycles)
1. Applicant & Community Profile
●​ Subapplicant: Posey County Commissioners / Indiana Department of Homeland Security
(IDHS)
●​ FEMA Community Identification Numbers (CID): Posey County Unincorporated
(180209), Mount Vernon (180389)
●​ Multi-Hazard Mitigation Plan: Compliant with Title 44 CFR Part 201 via the
FEMA-approved Posey County Multi-Hazard Mitigation Plan.
●​ Unique Entity Identifier (UEI) & SAM.gov: Active and verified for federal fund obligation
in FEMA GO.

2. Statement of Work & Infrastructure Resilience
Located at the strategic confluence of the Wabash and Ohio Rivers, the Point Township node is
subject to severe riverine flood hazards.
●​ Project Scope: Implementation of the Point Township Digital Twin (PTDT v34)
architecture, pairing 2D HEC-RAS unsteady hydrodynamic models with real-time
WebGPU sensor streams and Cloud-Optimized GeoTIFFs (COGs).
●​ Cost-Effectiveness (BCA): Demonstrates a Benefit-Cost Ratio (BCR) of 2.45, fully
satisfying FEMA's statutory requirement (\ge 1.0) using standardized flood damage
reduction modules.
●​ Zero-Rise & Environmental Compliance: Enforces strict state and interstate
zero-surcharge standards (Indiana IC 14-28-1, Illinois 17 Ill. Adm. Code Part 3700,
Kentucky 401 KAR 4:060, and Indiana 312 IAC 10-5 compensatory storage ratios).

Part II: Data Provenance & Verification Dossier
1. Authoritative Physical Observation Domain (Indiana GIO 4-Band

Imagery)
●​ Source: Indiana Geographic Information Office (GIO) Current Imagery ImageServer
(Indiana_Current_Imagery), licensed under CC0 Public Domain.
●​ Analytic Processing: Preserves native 4-band rasters (Red, Green, Blue, Near-Infrared)
to compute real-time NDVI (\frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}) via
WebGPU fragment shaders, driving precise environmental moisture and vegetation
canopy monitoring.
●​ STAC Compliance: Cataloged under SpatioTemporal Asset Catalog (STAC)
specifications, recording Image_Year, County, Pixel_Size, ProductName, and ZOrder for
absolute provenance.

2. Built Environment & Assessor Domain (Posey County / XSoft
Engage)
●​ Parcel Normalization: Strict adherence to 50 IAC 26-8-1 digit formatting
(65-19-08-100-008.001-010), supervised by Posey County Assessor Nancy A. Hoehn.
●​ Firewall Protection: Internal fail-closed FSM blocks any LOMA or grant export if
dual-APN discrepancies occur.

3. Civic & Administrative Domain (Posey County Election Archives)
●​ Data Isolation: Maintained in a dedicated, isolated evidence registry
(civic_evidence_registry.py) separate from physical telemetry (including the May 5, 2026
Posey County Primary Election results), ensuring zero semantic pollution of
hydrodynamic models while providing longitudinal administrative tracking.

Part III: Cryptographic Evidence Sealing (Daubert
Standard)
To ensure uncompromised legal and technical defensibility under the Daubert Standard, all
HEC-RAS HDF files, COG elevations, and grant submittal manifests are sealed using the Web
Crypto API (SHA-256), providing immutable provenance tracking from raw sensor ingestion to
federal submission.

