# Government & Engineering Peer-Review Readiness — TSM / Open World Tri-State River Valley Engineering Sim

**Status:** engineering evidence package / showcase readiness; not agency certification.

## 1. System identity

Tri-State Systems Manager (TSM) is an evidence-first systems-management, geospatial visualization, telemetry, and engineering-simulation presentation platform. The Open World Tri-State River Valley Engineering Sim is a real-source visualization/model context, not a replacement for licensed engineering judgment or agency authority.

Medical/clinical functionality is intentionally outside TSM and belongs in TMRDS.

## 2. Authoritative real-time fabric

### Hydrology

Primary runtime chain:

`NOAA NWPS observed NHRI3 → TSM normalized telemetry → USGS Water Data fallback → Trust Fabric / StageAuthorityBanner`

Reference station: USGS `03378500`, Wabash River at New Harmony; NOAA/NWPS identifier `NHRI3`.

The normalized record preserves:

- source;
- gauge identifier;
- observed timestamp;
- retrieval timestamp;
- stage value;
- qualifier/status;
- discharge and discharge timestamp/status when available;
- source URI; and
- vertical conversion metadata.

USGS provisional (`P`) data remains visibly provisional.

### Current imagery

The runtime consumes Indiana Geographic Information Office's `DynamicWebMercator/Indiana_Current_Imagery` ImageServer through its supported `exportImage` operation and Web Mercator bounding-box requests. The official service describes 2022–2025 current orthophotography, a three-year acquisition cycle, 4-band 6-inch imagery with some 3-inch areas, and CC0 access.

### Flood hazard authorities

Two independent overlay planes are mandatory:

| Plane | Authority | Runtime purpose | Insurance determination |
|---|---|---|---|
| FEMA NFHL | FEMA | effective federal flood-hazard context | NFHL is the applicable federal reference; local/agency process still governs |
| Indiana BAFM | Indiana DNR Division of Water | planning / Indiana Flood Control Act context | **Not a substitute for FEMA NFHL insurance determination** |

Current verified layer IDs include FEMA flood hazard zones `28`, BFEs `16`, FIRM panels `3`, LOMRs `1`, LOMAs `34`, and levees `23`; Indiana BAFM exposes Updates `104` and FloodHazard_BestAvai_DNR_Water `438`.

The BAFM service explicitly states that it contains Division-of-Water-reviewed additional studies, is generally more recent than FEMA effective data, has not gone through FEMA NFHL due-process publication, and that approximate floodways should be used with caution.

## 3. Terrain and open-world rendering

Terrain architecture:

`USGS 3DEP/TNM → selected DEM/lidar → CRS/vertical validation → GDAL/rio-rgbify → Terrain-RGB → XYZ/PMTiles/Martin → MapLibre raster-dem → setTerrain`

No synthetic production terrain is permitted. When `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` is absent, the UI explicitly reports terrain as not configured and does not fabricate a substitute.

The open-world architecture streams real imagery and terrain tiles; it does not claim that a complete planet-scale mesh is stored in the repository.

## 4. HEC-RAS 2D engineering contract

Nominal computational mesh targets:

- channel: **25–50 ft**;
- near berm / structures / LAG: **25–40 ft**;
- active floodplain: **50–100 ft**;
- overbank/agricultural: **100–200 ft**.

Required terrain/modeling controls:

- best available 3DEP/lidar terrain, hydro-enforced where justified;
- breaklines for centerline, banks, and berm crest;
- berm crest reference: **379.8 ft**;
- sub-grid/high-resolution terrain property tables where computational-cell scale would otherwise lose terrain detail;
- boundary conditions from the project profile with explicit provenance;
- engineering constants: LAG **377.2 ft**, BFE **375.0 ft**, berm crest **379.8 ft**, FFE **382.5 ft**.

These are project modeling requirements/targets, not universally applicable regulatory mesh standards. The project engineer/model owner remains responsible for selecting and documenting final discretization, stability criteria, roughness, calibration, boundary conditions, and validation.

## 5. EvidenceArtifact governance

HEC-RAS and derived geospatial artifacts must carry:

- source URI;
- retrieval timestamp;
- SHA-256 content hash;
- horizontal CRS;
- vertical datum;
- transformation chain;
- validation status;
- human review status;
- authority class; and
- governance status.

Permitted HEC-RAS authority classes are `SIMULATION_DEMO` and `MODEL_OUTPUT`. The evidence schema requires `human_review_required` and prevents self-promotion to regulatory authority.

## 6. Government-oriented control mapping

This repository should be evaluated by the responsible deployment authority against the actual environment and mission. The following references are engineering review anchors, not blanket certifications:

- FEMA/NFIP requirements and applicable 44 CFR provisions for floodplain management and mapping;
- Indiana Flood Control Act and current Indiana DNR Division of Water procedures;
- NIST SP 800-53 Rev. 5 current release family, SP 800-53A assessment procedures, and SP 800-53B baselines for federal security/privacy control selection and assessment;
- Section 508 Revised Standards when federal ICT applicability is established;
- NARA electronic-records requirements where the deployment creates or manages federal records.

The agency/deployment authority must determine applicability, categorize the system, select/tailor controls, perform assessment and authorization where required, and establish records/accessibility procedures.

## 7. Peer-review package

A reviewer should be able to trace:

`source → retrieval → normalization → transformation → artifact hash → visualization/model → validation → human review → published decision`

A reviewer must be able to distinguish:

- observed versus forecast;
- current versus stale;
- authoritative source versus derived product;
- FEMA effective versus Indiana best-available planning data;
- model evidence versus regulatory determination; and
- automated proposal versus human decision.

## 8. Known external acceptance gates

The repository cannot independently complete:

1. professional engineer/surveyor certification;
2. FEMA/IDNR/local floodplain ordinance adoption or permit approval;
3. FEMA map revision/LOMA/LOMR acceptance;
4. USACE/agency engineering review acceptance;
5. agency Authority to Operate or equivalent security authorization;
6. formal Section 508 agency determination;
7. official records schedule/legal-hold designation;
8. procurement/vendor authorization; or
9. project-specific environmental/permitting decisions.

Those controls are intentionally surfaced as human/agency acceptance gates rather than hidden behind software status.

## 9. Release acceptance

A release intended for government peer review should have:

- green repository CI;
- documented live-source checks;
- reproducible dependency installation;
- no committed secrets;
- current data catalog;
- current source provenance;
- model/evidence hashes;
- explicit limitations and uncertainty;
- accessible UI review;
- security review appropriate to deployment;
- named technical/model owner; and
- named human/agency authority for operational use.
