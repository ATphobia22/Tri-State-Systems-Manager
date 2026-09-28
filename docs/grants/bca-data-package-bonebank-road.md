> **DRIVE IMPORT — REGULATORY / GRANT WORKING DOCUMENT**
>
> Source: Google Drive — "FEMA Benefit-Cost Analysis (BCA) Data Package: 13101 Bonebank Road" · Drive last modified: 2026-08-18
> Ingested: 2026-09-25 · Verification status: **REFERENCE**
>
> Working document from the owner's archive. Values and assertions (elevations, application
> IDs, BCR figures, program details, deadlines) are as-stated in the source and have NOT been
> independently verified. Verify against authoritative sources (FEMA, IDNR, licensed survey,
> live agency NOFO) before any filing or reliance. See `docs/DRIVE-MANIFEST.md` for known
> cross-document inconsistencies.

---
SOURCE: FEMA Benefit-Cost Analysis (BCA) Data Package: 13101 Bonebank Road
DRIVE_MODIFIED: 2026-08-18
============================================================

FEMA Benefit-Cost Analysis (BCA) Data Package: 13101 Bonebank Road
1. Site Identification and Geodetic Control
|  Site Address  | 13101 Bonebank Road, Point Township, Indiana (Section 35) | |  Vertical Datum  | NAVD88 | |  Horizontal CRS  | EPSG:2966 (Indiana West) [editorial correction 2026-09-25: EPSG:2967 is Indiana East] |
2. Authoritative Elevation Invariants
Measurement Point,Elevation (ft NAVD88),Regulatory Significance
Base Flood Elevation (BFE),375.0,Primary hydraulic risk baseline
Lowest Adjacent Grade (LAG),377.2,Regulatory trigger for LOMA eligibility
First Floor Elevation (FFE),382.5,Critical protection level for habitable space
Deterministic LOMA Clearance,377.2 - 375.0 = 2.2 ft,Natural high ground clearance relative to BFE
3. Benefit-Cost Ratio (BCR) Certified Results
Engineering-Sealed BCR: 1.41  (PE-validated FEMA Toolkit export).
Legal BCR: 2.45  (Legal PDF version).
Authority Note: PE FEMA Toolkit only seals the final value.
4. Regulatory Compliance and Design Standards
Locked Engineering Constant: Compensatory Storage  – 1.20x volume factor required per IDNR 312 IAC 10-5 to maintain flood storage neutrality.
Locked Engineering Constant: Berm Design  – Berm Crest design elevation of 379.8 ft, maintaining a +4.8 ft freeboard vector relative to the BFE.
Sovereign Rule (Authority Rule):  Presentation layers, including Box3D and TurboVec, are strictly prohibited from mutating or altering any hydraulic or regulatory evidence.
5. Hydraulic Modeling and Stage Triggers
Modeling Engine:  Archimedes Engine (PTDT v32/v33) utilizing Manning's formula for open-channel velocity calculations.
Myers Stage Impact Ladder:  Property impact mapping based on J.T. Myers gage-datum triggers:| Gage-Datum Elevation (ft) | Property Impact || ------ | ------ || 54.93 | Dock Trigger || 58.45 – 58.75 | House Trigger |
6. Evidence Provenance and Software Architecture
The following authoritative pipeline is utilized to satisfy Daubert standards and regulatory audit requirements:
Canonical Source:  HEC-RAS / MODFLOW / USGS / NOAA / Tucker Heritage Data.
Processing Spine:  PTDT Sovereign API (Enforcement of datum, spatial references, and engineering invariants).
Artifact Generation:  Archimedes Engine (Generation of PE Transmittal, No-Rise Certification, and BCA Data Package).

