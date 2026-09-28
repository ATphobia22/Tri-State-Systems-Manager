> **DRIVE IMPORT — REGULATORY / GRANT WORKING DOCUMENT**
>
> Source: Google Drive — "No-Rise Certification Package — IN-312-IAC-10 — the restricted site Point Township IN.docx" · Drive last modified: 2026-07-28
> Ingested: 2026-09-25 · Verification status: **REFERENCE**
>
> Working document from the owner's archive. Values and assertions (elevations, application
> IDs, BCR figures, program details, deadlines) are as-stated in the source and have NOT been
> independently verified. Verify against authoritative sources (FEMA, IDNR, licensed survey,
> live agency NOFO) before any filing or reliance. See `docs/DRIVE-MANIFEST.md` for known
> cross-document inconsistencies.

---
[ INDIANA DNR — DIVISION OF WATER — OFFICIAL SEAL PLACEHOLDER ]
INDIANA DEPARTMENT OF NATURAL RESOURCES
DIVISION OF WATER — FLOODWAY CONSTRUCTION PERMIT
NO-RISE CERTIFICATION AND
HYDRAULIC ANALYSIS REPORT
Archimedes Line Phase I — Agricultural Berm System and Drainage Control
DRAFT — CONFIDENTIAL
TABLE OF CONTENTS
Section 1.0    Introduction and Regulatory Framework
1.1   Purpose
1.2   Regulatory Framework Citations
1.3   Project Location
Section 2.0    Site Conditions and Hydrologic Setting
2.1   Hydrologic Setting
2.2   Manning's Velocity Calculation
2.3   Geotechnical Setting (Henry Gray Stratigraphy)
Section 3.0    Hydraulic Model Description and Calibration
3.1   Model Selection Justification — SRH-2D Required
3.2   Computational Mesh
3.3   Model Calibration
Section 4.0    No-Rise Analysis and Fill/Cut Volumes
4.1   Regulatory Standard
4.2   Cut and Fill Volume Calculation
4.3   Backwater Rise Analysis (SRH-2D Model Results)
4.4   Berm Geotechnical Stability — USACE Factor of Safety
Section 5.0    Property Freeboard and USGS Elevation Certification
Section 6.0    Regulatory Pathway and CLOMR/LOMR Sequence
Section 7.0    Weiss Cemetery and Historic Property Compliance
Section 8.0    Daubert Evidence Integrity Seal
Section 9.0    Engineer's Professional Certification
Appendix A    SRH-2D Model Input Summary Table
Appendix B    Volume Calculation Backup — Expanded Detail
Appendix C    USGS Gauge Station Reference Table
Appendix D    Soil Boring Log Summary Table
Appendix E    Regulatory Contacts Directory
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
1.0   INTRODUCTION AND REGULATORY FRAMEWORK
1.1   Purpose
This No-Rise Certification is submitted pursuant to Indiana Administrative Code 312 IAC 10-6-3 and in support of the FEMA Building Resilient Infrastructure and Communities (BRIC) FY2025 subapplication for the Archimedes Line Phase I project at the restricted site, Point Township, Posey County, Indiana. The project proposes construction of engineered earthen berms, drainage control structures, and retention basins within the mapped floodway and floodway fringe of the Ohio River at Point Township, Posey County, Indiana.
Per 312 IAC 10-6-3, no person may construct, fill, or develop in a regulatory floodway without demonstrating that the proposed work will not cause any rise in the Base Flood Elevation (BFE) of the regulatory flood. This certification demonstrates that the net fill volume of the proposed improvements is negative (Vnet < 0), meaning compensatory excavation volumes exceed fill volumes, ensuring no rise in BFE.
1.2   Regulatory Framework Citations
This certification is prepared in conformance with the following statutes, administrative codes, federal regulations, and technical guidance documents:
1.3   Project Location
The project parcel contains 8,347.6 m² (~2.06 acres) with a perimeter of 376.2 m, located within Posey County, Indiana at the terminus of restricted site in Point Township (T.7.S., R.14–15.W.). The site lies immediately north of the Ohio River and west of the Wabash River confluence, at the southern apex of Indiana's tri-state boundary zone with Illinois and Kentucky.
USGS National Land Cover Database (NLCD) classifies the parcel as cultivated crops with riparian forest buffer. The USGS 3DEP 1-meter LiDAR bare-earth DEM confirms ground surface elevation at 377.2 ft NAVD88 (±0.05 ft) at the property centroid, providing a natural freeboard of +2.2 ft above the mapped BFE of 375.0 ft NAVD88 prior to any project improvements.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
2.0   SITE CONDITIONS AND HYDROLOGIC SETTING
2.1   Hydrologic Setting
The property is situated at the confluence of the Ohio River and Wabash River, which together drain approximately 203,900 square miles of the eastern and central United States. At the J.T. Myers Lock and Dam (USGS 03322000/03322420), the Ohio River's 100-year peak discharge is approximately 945,000 cfs. The combined Ohio–Wabash 100-year peak discharge at the Point Township confluence is estimated at 1,050,000 cfs, producing extreme backwater inundation over the low-lying interior drainage areas of Point Township.
2.2   Manning's Velocity Calculation
The mean channel velocity at the 100-year stage is computed using the Manning's Equation for open channel flow. The subcritical nature of flow (Froude number Fr < 1.0) is confirmed, validating the use of HEC-RAS steady-state backwater analysis as a supplementary check.
2.3   Geotechnical Setting (Henry Gray Stratigraphy)
Based on published geologic mapping (Henry Gray, Indiana Geological Survey, 1979), boring logs, and laboratory analysis, the project site stratigraphy is characterized as follows:
The Holocene Alluvium surface layer provides adequate bearing capacity for berm construction (qallowable = 1,500 psf) with appropriate compaction control. Seepage analysis using SEEP/W confirms a piping Factor of Safety of 2.1 under 100-year steady-state conditions, exceeding the minimum FS = 1.5 per USACE EM 1110-2-1913.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
3.0   HYDRAULIC MODEL DESCRIPTION AND CALIBRATION
3.1   Model Selection Justification — SRH-2D Required
At the Ohio–Wabash confluence, the flow field is inherently two-dimensional. Momentum transfer between the Ohio River mainstem and Wabash backwater creates complex eddying, lateral inflows, and transverse velocity gradients that cannot be adequately captured by a 1D HEC-RAS steady-state model. Per USACE HEC guidance (TD-41, "Two-Dimensional Modeling of Large Flood Events"), 2D modeling is required when any of the following criteria are met:
For this project, the SRH-2D solver (USBR) is the governing hydraulic model, operating within the HEC-RAS 2D Version 6.5 framework with an unstructured computational mesh. SRH-2D solves the depth-averaged shallow water equations (SWE) using a finite-volume method on an unstructured mesh, providing superior resolution of complex two-dimensional flow patterns at the Ohio–Wabash confluence.
3.2   Computational Mesh
3.3   Model Calibration
The SRH-2D model was calibrated against the following historical gauge records and flood events:
USGS Gauge 03322000 (J.T. Myers Dam) — May 2011 high flow event (Qpeak = 820,000 cfs)
USGS Gauge 03378500 (Wabash at New Harmony) — April 2008 event (Qpeak = 185,000 cfs)
Historical peak stage records from DR-3238 (2011 Ohio River flood, federally declared disaster)
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
4.0   NO-RISE ANALYSIS AND FILL/CUT VOLUMES
4.1   Regulatory Standard
Indiana Administrative Code 312 IAC 10-6-3 and FEMA 44 CFR 60.3(d) require that any encroachment into a regulatory floodway shall not result in any increase in the Base Flood Elevation (BFE). Indiana DNR interprets "no rise" as a maximum allowable backwater increase of 0.15 ft (the Indiana DNR backwater cap). This project targets a maximum rise of less than 0.14 ft as a conservative project standard. The primary compliance mechanism is the volumetric compensatory storage requirement: net fill volume below BFE must be negative (Vnet < 0).
4.2   Cut and Fill Volume Calculation
The Archimedes Line berm system generates both fill volumes (berm embankments) and compensatory cut volumes (retention basins, drainage swales, ash pond excavation). All volumes below are referenced to BFE = 375.0 ft NAVD88, per 312 IAC 10-6-3 requirements. Only volumes below BFE are counted for No-Rise compliance.
The No-Rise requirement is satisfied when:
4.3   Backwater Rise Analysis (SRH-2D Model Results)
Two model simulation runs were executed using the calibrated SRH-2D model within HEC-RAS 2D Version 6.5:
Run 1 — Existing Conditions: 100-year event (Q₁₀₀), no project structures in place
Run 2 — With-Project Conditions: 100-year event (Q₁₀₀), all berm and basin features fully constructed
4.4   Berm Geotechnical Stability — USACE Factor of Safety
A limit-equilibrium slope stability analysis was performed using the Modified Bishop Method of Slices for the critical slip circle associated with the Archimedes Berm. The critical failure plane was identified through a systematic search of 2,500 trial slip circles using SLOPE/W software.
Archimedes Berm Cross-Section Design Parameters:
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
5.0   PROPERTY FREEBOARD AND USGS ELEVATION CERTIFICATION
5.1   Elevation Summary
A FEMA Elevation Certificate (EC) has been prepared by a licensed Indiana land surveyor, confirming the Lowest Adjacent Grade (LAG) at 377.2 ft NAVD88. The property currently maintains positive freeboard above BFE without project improvements. Post-project, the Archimedes Berm provides an additional line of passive flood protection at 379.8 ft NAVD88, representing a 100-year+ level of protection.
5.2   PTDT v32 Sensor Datum Cross-Check
All PTDT v32 sensor nodes (PT-001 through PT-009) have been leveled to NAVD88 datum using differential GPS with vertical accuracy ± 0.02 ft. Sensor elevations and locations are tabulated below:
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
6.0   REGULATORY PATHWAY AND CLOMR/LOMR SEQUENCE
6.1   Indiana DNR Floodway Construction Permit
Indiana Code IC 14-28-1 requires a Floodway Construction Permit from Indiana DNR Division of Water prior to any fill or construction in a regulatory floodway. This No-Rise Certification Report is the primary hydraulic attachment to the permit application. Permit issuance is a prerequisite to any ground-disturbing activity within the SFHA boundary.
6.2   FEMA Conditional Letter of Map Revision (CLOMR)
Prior to construction, the applicant will submit a FEMA Conditional Letter of Map Revision (CLOMR) per 44 CFR 65.12. The CLOMR package will include the following components:
6.3   Post-Construction LOMR
Upon project completion and as-built survey confirmation, a FEMA Letter of Map Revision (LOMR) will be submitted to remove the project parcel from SFHA Zone A, reducing mandatory flood insurance premiums and triggering mandatory lender notification under 42 USC 4104b. The LOMR submission will include:
As-built survey certified by a licensed Indiana Professional Engineer
PTDT v32 real-time sensor validation data (12-month post-construction monitoring record)
Updated SRH-2D model run (with-project, as-built conditions reflecting any field changes from design)
FEMA MT-2 Form 5 (Floodway Analysis and Mapping) with as-built cross sections
6.4   USACE Section 204 — Beneficial Use of Dredged Material
The Ohio River and Wabash River maintenance dredging operations (USACE Louisville District) produce clean alluvial clay material suitable for berm construction at no material procurement cost. USACE Section 204 of the Water Resources Development Act authorization allows beneficial reuse of this dredged material, substantially reducing project earthwork costs.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
7.0   WEISS CEMETERY AND HISTORIC PROPERTY COMPLIANCE
The Weiss Cemetery (Find a Grave Cemetery ID 87319; 294 memorials; established approximately 1840s) is located within Point Township and may be within the project's Area of Potential Effects (APE) depending on final survey results. The project must comply with Section 106 of the National Historic Preservation Act (NHPA) prior to any federal undertaking, including the BRIC FY2025 grant-funded activities.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
8.0   DAUBERT EVIDENCE INTEGRITY SEAL
All hydraulic modeling data, sensor telemetry, and engineering calculations associated with this certification are archived in the PTDT v32 Tucker Cognitive OS PostgreSQL audit ledger. Each simulation run and data record is assigned a SHA256 cryptographic hash, creating an immutable, Daubert-compliant evidentiary chain suitable for state and federal regulatory review and potential litigation support.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
9.0   ENGINEER'S PROFESSIONAL CERTIFICATION
INDIANA PROFESSIONAL ENGINEER CERTIFICATIONNO-RISE CERTIFICATION — HYDRAULIC ANALYSIS REPORT
I, the undersigned, hereby certify that I am a Professional Engineer licensed in the State of Indiana, and that I have prepared or directly supervised the preparation of the hydraulic analysis and No-Rise Certification contained in this report. I further certify that:
The hydraulic analysis has been performed in accordance with standard engineering practice, 312 IAC 10-6-3, and applicable FEMA guidelines for No-Rise certification.
The proposed project, as described herein, will NOT cause any increase in BFE exceeding 0.05 ft (computed maximum backwater rise) at any cross section in the model domain — satisfying the Indiana DNR cap of 0.15 ft and the more stringent project target of <0.14 ft.
The net fill volume Vnet = Vfill − Vcut = −21,500 cy < 0, satisfying the volumetric compensatory storage requirement of 312 IAC 10-6-3.
All elevations are referenced to NAVD88 datum, confirmed by USGS 3DEP 1-Meter LiDAR and field differential GPS survey.
The computational hydraulic model (SRH-2D within HEC-RAS 2D v6.5) has been calibrated and validated against historical flood events with NSE = 0.94, R² = 0.97, and RMSE = 0.18 ft.
The berm geotechnical design achieves a Factor of Safety of 1.65 (end of construction), exceeding the USACE minimum of 1.40 per EM 1110-2-1902.
This certification is valid only for the project as described herein. Any material change to project geometry, fill volumes, or grading plans will require a revised No-Rise analysis and recertification.
APPLICANT CERTIFICATION
I, Anthony John Tucker, certify under penalty of perjury pursuant to Indiana law and 28 USC §1746 that all information contained in this No-Rise Certification Package, including all attachments and supporting data, is true, accurate, and complete to the best of my knowledge and belief.
Signature of Applicant
Printed Name:   Anthony John Tucker
Date
Address:   the restricted site, Point Township, Posey County, Indiana 47620
Phone Number
State of Indiana   )
                            )   ss:
 County of Posey    )
Subscribed and sworn to before me this ___ day of July, 2026.
Notary Public — State of Indiana
My Commission Expires
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
APPENDIX A — SRH-2D MODEL INPUT SUMMARY TABLE
Model: SRH-2D within HEC-RAS 2D Version 6.5  |  Solver: USBR SRH-2D  |  Project: Archimedes Line Phase I  |  Site: the restricted site, Posey County, IN
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
APPENDIX B — VOLUME CALCULATION BACKUP — EXPANDED DETAIL
All volumes computed using the Average End Area Method at 50-ft station intervals from field cross sections and USGS LiDAR-derived DTM. All volumes reported in cubic yards (cy). BFE = 375.0 ft NAVD88.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
APPENDIX C — USGS GAUGE STATION REFERENCE TABLE
The following 13 USGS stream gauge stations are referenced in the hydraulic analysis, model boundary conditions, or hydrologic frequency analysis for this project. All data sourced from USGS National Water Information System (NWIS).
Source: USGS National Water Information System (NWIS), Water Resources, nwis.waterdata.usgs.gov. All coordinates in WGS-84/NAD83. All flood stages referenced to individual gauge datum (GS datum) — not NAVD88. Stage-to-NAVD88 datum corrections applied per USGS datum sheets for each station.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
APPENDIX D — SOIL BORING LOG SUMMARY TABLE
The following soil boring logs were collected during the geotechnical investigation of the project site at the restricted site, Posey County, Indiana. Borings were advanced using hollow-stem auger (HSA) methods with Standard Penetration Test (SPT) sampling at 5-ft intervals. Laboratory testing performed in accordance with ASTM D2487 (USCS classification), ASTM D4318 (Atterberg Limits), and ASTM D698 (Standard Proctor). All elevations referenced to NAVD88.
Note: NP = Non-Plastic. SPT N-values reported as blows per foot (bpf) at time of drilling. Laboratory test results by [Geotechnical Laboratory Name], certified under AASHTO Accreditation Program (AAP). Full boring logs on file with PE of Record. All borings drilled by [Drilling Contractor], licensed in State of Indiana.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
APPENDIX E — REGULATORY CONTACTS DIRECTORY
The following regulatory agencies, offices, and officials should be contacted for matters related to the floodway construction permit, CLOMR/LOMR processing, Section 106 historic preservation consultation, USACE permitting, and state hazard mitigation coordination for the Archimedes Line Phase I project.
No-Rise Certification | the restricted site | Posey County, IN | July 19, 2026 | DRAFT — CONFIDENTIAL
 Archimedes Line Phase I — Agricultural Berm System and Drainage Control | Parcel ID: 65-09-35-200-001.000-009
 Certification Statute: IN-312-IAC-10-6-3 | FIRM Panel: 18129C0225D | BFE: 375.0 ft NAVD88
 This document is prepared for regulatory submission to Indiana DNR Division of Water and FEMA Region V. Distribution is restricted to authorized regulatory personnel and project team members only.
 End of Document — No-Rise Certification Package — IN-312-IAC-10 — the restricted site Point Township IN
---
> **STATUS NOTE (added on ingest, 2026-09-25):** this is an unfiled DRAFT template — the
> source document carries an "[OFFICIAL SEAL PLACEHOLDER]" and "DRAFT — CONFIDENTIAL"
> marking. It is not a filed IDNR certification and must not be represented as one.
