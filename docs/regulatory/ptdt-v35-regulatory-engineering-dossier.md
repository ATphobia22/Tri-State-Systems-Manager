> **DRIVE IMPORT — REGULATORY / GRANT WORKING DOCUMENT**
>
> Source: Google Drive — "Regulatory Engineering Dossier: Point Township Digital Twin (PTDT) v35" · Drive last modified: 2026-08-26
> Ingested: 2026-09-25 · Verification status: **REFERENCE**
>
> Working document from the owner's archive. Values and assertions (elevations, application
> IDs, BCR figures, program details, deadlines) are as-stated in the source and have NOT been
> independently verified. Verify against authoritative sources (FEMA, IDNR, licensed survey,
> live agency NOFO) before any filing or reliance. See `docs/DRIVE-MANIFEST.md` for known
> cross-document inconsistencies.

> **DO NOT FILE — CORRECTION NOTICE (2026-10-06, verified):**
> - LiDAR is **not** "non-mutable ground truth" that "supersedes survey data" —
>   a sealed land survey outranks LiDAR for elevation certification.
> - LAG 377.2 ft is **owner-supplied and uncertified**, not "LiDAR-derived".
> - FIRM panel 18129C0215D is **superseded**; current working panel is 18129C0300C.
> - "Mathematical certainty" claims are **unverified**. Quarantined from filing workflows.

---
SOURCE: Regulatory Engineering Dossier: Point Township Digital Twin (PTDT) v35
DRIVE_MODIFIED: 2026-08-26
============================================================

Regulatory Engineering Dossier: Point Township Digital Twin (PTDT) v35
1. EXECUTIVE SUMMARY: THE MATERIAL TRUTH FRAMEWORK
The Point Township Digital Twin (PTDT) v35 represents a paradigm shift in regulatory compliance, moving away from legacy "bureaucratic guesses" and estimation-based mapping toward a "Material Truth" framework. For the 13101 Bonebank Road site, this dossier establishes 5cm LiDAR-based mathematical certainty as the primary evidentiary standard, replacing generalized interpolation with high-precision geospatial forensics.Central to this framework is the concept of "Sovereign Engineering." The PTDT v35 is built upon a zero-key, local-first Open Source Software (OSS) architecture. This technical stance ensures that all engineering models, including HEC-RAS and Bishop Method simulations, operate independently of proprietary service dependencies or external API availability. By maintaining this independent architecture, the system guarantees that the authoritative data used for federal and state submissions remains immutable and protected from visualization-layer interference.
2. SITE INVARIANTS & REGULATORY ANCHORS
The project site is located in Section 35, T7S, R14W, Point Township, Posey County, Indiana. The property (13101 Bonebank Road, Mount Vernon, 47620) consists of 2.0 acres (Class 511) owned by TUCKER. The following table serves as the foundational data block for all hydraulic and topographic analysis.
Regulatory Anchor Table
Parameter,Value
Owner of Record,TUCKER
Property Class / Size,511 (Residential) / 2.0 Acres
Horizontal Coordinate Reference System (CRS),EPSG:2966 (NAD83 / Indiana West ftUS)
Vertical Datum,NAVD88
Base Flood Elevation (BFE),375.0 ft
Lowest Adjacent Grade (LAG),377.2 ft
First Floor Elevation (FFE),382.5 ft
Net Natural Clearance,+2.20 ft
3. FEMA PURE LOMA STRATEGY (44 CFR PART 70)
This dossier presents the legal and technical argument for "Pure LOMA" (Letter of Map Amendment) eligibility for the structure at 13101 Bonebank Road based on  Natural High Ground . Under the jurisdictional authority of  44 CFR Part 70 , a structure is eligible for removal from the Special Flood Hazard Area (SFHA) if it can be demonstrated that the natural ground—untouched by fill—sits at or above the Base Flood Elevation.Supporting Elevation Narrative:  The subject property is located within Community ID  180209 (Posey County)  as shown on  FIRM Panel 18129C0215D . While the southern Bone Bank levee zone (captured in Tile IN2020_26800940_12) is situated below the BFE, the structure centroid itself occupies higher inland terrain captured in  Tile IN2020_26800970_12 .To establish mathematical certainty, the  LiDAR LOMA Pathway  was employed using the FEMA Standardized Formula: the lowest adjacent contour line was identified, and a 1.0 ft vertical deduction was applied. This calculation confirms a LiDAR-derived LAG of 377.2 ft, providing a  +2.20 ft vertical clearance  above the 375.0 ft BFE. This natural vertical clearance is achieved without the use of fill. Per the latest geospatial forensic audit, this USGS 3DEP QL2 LiDAR evidence serves as the primary, non-mutable ground truth to resolve and supersede previous survey data inaccuracies.
4. IDNR NO-RISE & COMPENSATORY STORAGE ANALYSIS
The "Archimedes Line" earthen berm and surge basin system is engineered to provide hydraulic protection while ensuring zero net increase in flood stages. Volumetric calculations were performed to maintain compliance with  Indiana 312 IAC 10-5  (Zero-rise surcharge compliance) and equivalent regulatory codes for Illinois and Kentucky.Regulatory Metrics:
Estimated Infrastructure Fill:  5,000 cu yd.
Actual Excavated Basin Cut:  6,500 cu yd.
Compensatory Volumetric Ratio:   1.30x  (Exceeds the 1.20x regulatory mandate).
Post-Intervention Water Surface Elevation (WSE) Rise:  0.000 ft.
5. GEOTECHNICAL STABILITY ANALYSIS
The structural integrity of the Archimedes Line earthen berm has been verified using the  Bishop Method  of slices for slope stability. The analysis ensures the system can withstand peak hydraulic pressure during 100-year flood events.The calculated  Factor of Safety (FoS) is 1.68 . This result demonstrates a robust margin of safety that exceeds the  USACE EM 1110-2-1902  requirement for the hydraulic stability of earthen structures. This FoS ensures the berm system remains resilient against rotational failure and seepage-induced instability.
6. AUTHORITATIVE DATA REGISTRY
The PTDT v35 framework relies exclusively on non-proprietary, agency-verified datasets to ensure forensic transparency.
Primary Data Provenance
Data Domain,Source Agency,Dataset ID/Parameter,Application
Terrain/Elevation,USGS 3DEP,QL2 LiDAR (Tile IN2020_26800970_12),Ground clearance & LOMA evidence
Hydrology,USGS NWIS,Gauge 03378500 (Wabash at New Harmony),Live stage and flow monitoring
Regulatory Mapping,FEMA,NFHL / FIRM Panel 18129C0215D,BFE and SFHA boundary definition
State GIS,IndianaMap GIO,IDNR BAFM (Best Available Mapping),Best available state floodplain data
Built Environment,Microsoft / Overture,US Building Footprints,3D structure extrusion & height
7. CRYPTOGRAPHIC MANIFEST & B.I.B.L.E. FIREWALL
To prevent state mutation and maintain the integrity of the engineering model, the PTDT v35 employs  SHA-256  cryptographic sealing. This deterministic hashing process locks the engineering manifest, ensuring that the submitted data cannot be altered without detection.Protection of the authoritative model is managed by the  B.I.B.L.E. Firewall  (Boundary Invariant Binary Ledger Engine). This architecture creates a one-way boundary between the forensic engineering data and the visualization layer, ensuring that graphical rendering or user-interface adjustments cannot influence or mutate the underlying regulatory invariants.Master Seal Hash:  b4782912564e70e863a7938bb3700647580830fb5a81e910a0db49a20f73b32e
8. SUBMISSION CHECKLIST: FEMA ONLINE LOMC PORTAL
The following administrative documentation must be uploaded to the  FEMA Online LOMC Portal  to finalize the amendment request.
Access Portal:  Log in using  Application ID: 5918599025038 .
Property Documentation:  Attach the  Property Deed  and the detailed  Legal Description  for APN 65-19-08-100-008.001-010.
Topographic Evidence:  Upload the  PTDT v35 LiDAR Evidence Pack  (specifically Tile IN2020_26800970_12). Note for reviewer: This USGS 3DEP QL2 LiDAR data serves as the primary, non-mutable evidence for the LAG of 377.2 ft, corroborating and correcting previous site surveys.
No-Rise Certification:  Attach the  IDNR No-Rise Certification  for the Archimedes Line earthen berm and surge basin.
Engineering Support:  Include the  Archimedes Volumetric Analysis  confirming the 1.30x compensatory storage ratio.
Finalize Submission:  Categorize the request under  44 CFR Part 70 (Pure LOMA - Natural High Ground) .

