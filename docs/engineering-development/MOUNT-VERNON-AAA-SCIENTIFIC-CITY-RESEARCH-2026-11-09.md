# Mount Vernon AAA Scientific City Twin — Source and Repository Audit

**Research snapshot:** 2026-11-09 · **Status:** source audit and implementation plan only; **no assertion of imported code, locally staged official datasets, solver calibration, or validated UE Shipping build**.

## Mission

Build an explorable, true-geography open-world representation of Mount Vernon, Indiana and the surrounding Ohio/Wabash river valley, with a playable SimCity-like city-planning interface and the presentation standards of an AAA game **without relaxing engineering proof**. Gameplay aesthetics do not establish truth. Human Authority Final. Free public anonymous viewing and an independently verified Windows 11 x64 native/offline path remain requirements.

### Three independent planes (never conflate)

1. **Experience:** UE5.8 World Partition, Cesium for Unreal/OGC 3D Tiles, cinematic lighting, day/night, weather visuals, traffic animation, camera tours, building inspection, construction alternatives, separate lower-fidelity browser MapLibre frontend.
2. **Physical evidence and simulation:** local government parcels and boundaries, Indiana LiDAR/orthophotos, roads, 3D footprint/building geometry, FEMA effective NFHL versus Indiana DNR BAFM, USGS/NOAA observations; HEC-RAS/HEC-HMS, MODFLOW 6, SWMM, SUMO each with separately evidenced/calibrated inputs and output manifests.
3. **Governance:** immutable original snapshots, captured/published dates, source licenses and attribution, geographic and vertical datums, checksums, peer/human review, reproducible solver versions, conservative uncertainty and human authorization gates. Render a verified historical snapshot when live data fails, but never silently promote it to live or regulatory truth.

## Evaluation of all ten user-supplied GitHub repositories

Licenses are the GitHub repository metadata observed 2026-11-09; **none** means GitHub did not expose a license, not permission to reuse. Star counts and features can change.

| Repository | Observed license | Reusable ideas and engineering boundary | Disposition |
| --- | --- | --- | --- |
| [RoadwayVR/SimJamComputerVision](https://github.com/RoadwayVR/SimJamComputerVision) | MIT, but its README identifies **Ultralytics YOLO AGPL-3.0** dependency | Camera/video tracking, counts, trajectories, traffic-volume calibration. Privacy and redistribution/model licenses must be independently vetted; no speed estimate without camera calibration. | **Evaluate interface first**; no video/PII ingestion by default. |
| [Faezeh-Rezaei/City-Simulator](https://github.com/Faezeh-Rezaei/City-Simulator) | Not declared | Unity city scene and urban navigation concept; README is one-line description; game-asset rights not established. | Inspiration only. |
| [RaminM/City-Simulator](https://github.com/RaminM/City-Simulator) | Not declared | Similar Unity demonstration; no demonstrated engineering georeferencing. | Inspiration only. |
| [EdwinMichaelLab/EDEN-ABM-Simulator](https://github.com/EdwinMichaelLab/EDEN-ABM-Simulator) | Not declared | City-scale agent-based methodology for scenario sensitivity; population/health models are not civil-engineering design verification. | Methodology evaluation; no copied implementation absent license. |
| [aravikishan/digital-twin-simulator-for-smart-cities](https://github.com/aravikishan/digital-twin-simulator-for-smart-cities) | Not declared | FastAPI/Jinja/SQLite city dashboard, demo data. Not a native 3D engine or verified scientific solver. | Reference only; avoid parallel application stack. |
| [xaitoshi/Agent-City-Simulator](https://github.com/xaitoshi/Agent-City-Simulator) | Not declared | Generative NPC-style behaviors and scenario UI; README requires a cloud API key, incompatible with strictly offline core. Simulated agent narratives must not become factual municipal data. | Optional non-authoritative behavior inspiration only. |
| [aravikishan/digital-twin-simulation-for-smart-cities](https://github.com/aravikishan/digital-twin-simulation-for-smart-cities) | Not declared | Similar FastAPI/SQLAlchemy/SQLite dashboard/demo. | Reference only. |
| [Chandujhm/Smart-City-Digital-Twin-Simulator](https://github.com/Chandujhm/Smart-City-Digital-Twin-Simulator) | MIT declared | Flood impact, traffic network and critical-infrastructure cascading effects. Its README links to **uihilab/CityDigitalTwin**; check attribution and exact upstream diff rather than assuming independent provenance. | **High-priority architecture/algorithm audit**, especially graph propagation; reuse only under applicable licenses. |
| [newuserunseen/Smart-City-3D-Simulation-Digital-Twin](https://github.com/newuserunseen/Smart-City-3D-Simulation-Digital-Twin) | GitHub SPDX NOASSERTION: inspect actual LICENSE | UE5 C++ waypoint cars, traffic lights, interaction HUD, emergency alerts and day/night manager. README targets UE5.4+, not proof of UE5.8 compatibility or calibrated physics. | **Prototype C++ components in isolated branch** after code/license review. |
| [Magicmonsterx0/Project-Simulacra](https://github.com/Magicmonsterx0/Project-Simulacra) | Not declared | Unity city-planning gameplay idea; little proof of engineering or licensing in repository metadata. | Inspiration only. |

Stronger related open-source references:
- [uihilab/CityDigitalTwin](https://github.com/uihilab/CityDigitalTwin) — upstream city flood/network/infrastructure framework; MIT indicated by repository README. Audit graph algorithms, database and original research; do not assume upstream models are calibrated for Posey County.
- [CesiumGS/cesium-unreal](https://github.com/CesiumGS/cesium-unreal) — Apache-2.0 3D Tiles geospatial streaming; **pin a UE5.8-compatible revision** and test Win64 Shipping independently.
- [Eclipse SUMO](https://eclipse.dev/sumo/) — multi-modal microscopic traffic simulation; run scenario/network/flow calibration and deterministic headless exports independent of rendering.
- [MobilityTwin-PT](https://mobilityinformaticslab.github.io/opdtwin/introduction/tutorial_overview.html) — documented OSM/GTFS/SUMO/Cesium integration pattern.
- [DTCC procedural city/terrain research](https://www.sciencedirect.com/science/article/pii/S2405896322011600) — automated mesh construction from real geometry, for architecture inspiration; check licenses for specific tools.

## Authoritative Mount Vernon source inventory / acquisition priority

| Scene plane | Primary source and URL | Engineering and data-use cautions | Gate |
| --- | --- | --- | --- |
| Posey local parcels/roads/address context | [Posey County GIS ThinkGIS](https://poseyin.wthgis.com/) and [Posey County government](https://www.poseycountyin.gov/county-offices/assessors-office/) | County viewer existence does **not** imply unrestricted bulk-export API or survey-grade boundary. Seek published GIS download/permissions; no scraping of owner PII. | Determine allowed export and exact dataset vintage. |
| 2025 Indiana parcels and boundaries | [IGIO 2025 Data Harvest release](https://www.in.gov/gis/geoinsights/posts/data-releases-data-harvest-2025-and-imagery/) and [IndianaMap](https://www.indianamap.org/) | Parcel linework reference only. Keep county and state versions separate. | Exact dataset item IDs, acquisition and validation. |
| Indiana LiDAR source / terrain | [Indiana Elevation AWS Open Data registry](https://registry.opendata.aws/in-elevation/) and [Indiana Spatial Data Portal](https://gis.iu.edu/) | Tile footprint and acquisition vintage, ASPRS classification, horizontal CRS and vertical datum **must be read from each deliverable**. Never implicitly convert orthometric NAVD88 to ellipsoidal. | Download selected AOI LAS; checksum, PDAL classify and DEM accuracy report. |
| Building footprints | [Indiana LiDAR Derived Building Footprints metadata](https://www.arcgis.com/sharing/rest/content/items/384f2d5041a14c34bd9e807c568784da/info/metadata/metadata.xml?format=default&output=html) | Published 2022 from 2016–2020 LiDAR; metadata explicitly disclaims legal/survey use. 2026 IGIO imagery-based automated footprints are **not** a drop-in authoritative replacement without validation. | Complete 23,082 Posey footprint reconciliation; heights and geometry confidence. |
| New building candidates | [IGIO August 2026 ML footprint research](https://www.in.gov/gis/geoinsights/posts/breakthrough-in-automated-building-footprints/) | Pilot/research capability; must establish actual published dataset and coverage before ingestion. | Candidate data discovery only. |
| Orthophotography | [Indiana statewide imagery archives](https://gis.iu.edu/s/isdp/page/statewide) | Display imagery dates explicitly; no free implication of latest capture for Posey. | AOI mosaics with provenance and offline packaging rights. |
| Effective flood insurance zones | [FEMA NFHL REST service](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer) | Regulatory map plane only to source's stated effective date/panel, not an engineered BFE at an arbitrary parcel. | Posey DFIRM panel intersection + current effective/version check. |
| Elevation/hillshade | [USGS 3DEP ImageServer](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer) | Region-scale visualization reference, not substitute for appropriately resolved, checked hydraulic terrain. | Explicit resolution and vertical reference. |
| River observations | [USGS Water Data](https://waterdata.usgs.gov/) and [NOAA Water Prediction Service](https://water.noaa.gov/) | Time-stamped stage and station gage datum; no WSE_NAVD88 without verified gage zero; stale readings do not halt city rendering. | Station ID, source freshness, gage-datum gate. |
| Riverport and infrastructure context | [Ports of Indiana–Mount Vernon](https://www.portsofindiana.com/2023/09/26/u-s-dot-awards-2-25-million-marine-highway-grant-to-ports-of-indiana-mount-vernon/) | Public imagery/industrial descriptions are not engineering drawings or permission to infer hidden critical infrastructure. | Geospatial footprint and published asset scope. |
| Zoning, utility lines, underground networks, traffic counts | Local government or responsible utility **only when publicly released** | Treat missing attributes, precise underground assets, water/sewer capacity and zoning version as NOT_EVIDENCED; obtain authorization where needed. | Source permissions and metadata before display or design. |

## Google Drive discoveries (metadata, not imported data)

- [TSM Tri-State map pack ZIP](https://drive.google.com/file/d/1---ubYMZRNKZaejEBIH6g7zmVQbSBuXd/view) — Oct 1 2026, 158,513,385 bytes. **Not extracted or independently hashed** during this research.
- [TSM data-fabric ZIP](https://drive.google.com/file/d/1Bu3I_hAY_LLUcQP4cXje-R_KzW6VuJU9/view) — Oct 1 2026, 7,635,210 bytes; not verified against current source releases.
- [Unified Digital Twin Architecture](https://docs.google.com/document/d/1QX_weE0o179tyHL5H5Q0nbFUxu9JRdhB4Bx4CmARWXw/edit) — describes semantic CityGML-style mapping planes, LOD0–LOD3, independently addressable geometry/texture/semantic tiles, and hierarchical streaming; **design proposal, not deployed proof**.
- [Digital Twin Research Plan Compilation](https://docs.google.com/document/d/1tekfmvp5F_qN2vcsQkr9zV-3pFGgNzDjfVi1jQSXq9Y/edit) — proposed multi-physics and evidence architecture. Treat claimed runtimes, physical results and performance numbers as **unverified proposals**.
- [Master Blueprint and Registry: Mount Vernon 47620 Eco-Valley](https://docs.google.com/document/d/1nh2E4jnBHGMyRvpzZxr46MdXZxQ7LxnT2gzyRBZSUGg/edit) — regional planning ideas and candidate industrial assets; not a survey, funding award, or validated facility database.
- [Tri-State Twin all code](https://docs.google.com/document/d/18ZsXI3S5er2BNocZeLFgL6h-HIqeCtSI4JFnVD0MhCs/edit) and [Tri-State Twin code raw](https://docs.google.com/document/d/1FX5MRwQu6kA_7ULta25A1GBAwtoFdi87nj1KWo9_8dk/edit) — prior code documents; diff and test before selective reuse, avoid duplicate subsystem forks.
- [Systems Manager Dashboard iOS Application](https://docs.google.com/document/d/1Iw3_t7ihxvyEoFiTz0VGnJIrEPRWOWakyku054w9q-g/edit) — separate iOS companion, not evidence that UE native Win64 app exists.
- [Next Step: Digital Twin Graph Schema](https://drive.google.com/file/d/1RZppp07BhiDvPS6xtD1MThp_XnUq--2P/view) — source document identified; not fully parsed here.

Drive search is metadata discovery over accessible results, **not an exhaustive all-folder recursive census**.

## Product gameplay → independently measurable engineering workflow

- **Walk or fly:** stream true georeferenced DEM + orthophotography + staged 3D buildings; prefer historical verified snapshot over blank screen; use camera/lighting/weather for presentation only.
- **Click a building or parcel:** stable government ID → CRS/geometry version → linked surveys/plans (when authorized) → current/historical/evidence state. Do not present a LiDAR-derived roof extrusion as surveyed structural geometry.
- **Draw a proposed road or levee:** proposal is a **SCENARIO**, save geometry and input assumptions immutably; project into solver-native mesh with explicit unit/datum checks; request actual calibrated HEC-RAS, SWMM and/or SUMO run; show before/after independently reproduced, accompanied by uncertainty, nonconvergence and downstream consequences.
- **Traffic engineering:** official/locally permitted road network → SUMO netconvert/netgenerate → vehicle demand with provenance → replicate runs and validate against measured traffic counts → present congestion/travel-time differences as **scenario outputs**, not measured facts.
- **Flood engineering:** NAVD88/US survey feet conversions and GEOID18 handled explicitly, calibrated boundary conditions → HEC-RAS terrain and HDF output checks → water-surface/depth maps; no water-depth claims from decorative river shaders.
- **City infrastructure graph:** model roads, facilities, port and public asset dependencies; a hazard impact can propagate only through an explicitly sourced topology and quantitatively justified thresholds; depict unknown connectivity as unknown.
- **Blueprint export:** geometry, bill of quantities, solver inputs, versioned assumptions, provenance SHA-256, CRS and vertical datum, constraints, reviewer signoff and reproducibility envelope. Label not-for-construction until proper engineering and regulatory review.

## Implementation sequence and independent release gates

| Phase | Deliverable | Evidence needed to pass |
| --- | --- | --- |
| P0 | Canonical mount-vernon AOI dataset registry (no private anchors) | Official URL, layer/item ID, AOI, captured/published dates, CRS/vertical datum/units, license, checksum, verification state for each selected dataset. |
| P1 | Reconcile terrain and 3D buildings | Posey 23,082 expected footprint identities versus 22,815 staged-height subset; exact missing identity report and valid 3D Tiles/HLOD geometry, no false “complete”. |
| P2 | Native playable city | Immutable UE5.8 revision/plugins, World Partition georeferencing, headed Win64 Shipping build/screenshots on Windows 11 offline hardware, non-WebView/non-localhost process proof, FPS/VRAM with scene density. |
| P3 | Traffic agent/physics adapter | SUMO network/demand assumptions, calibration data, deterministic multi-seed runs, unit and topology checks, independent CI synthetic fixtures distinguished from actual Mount Vernon calibration. |
| P4 | Flood/utility engineering scenarios | HEC-RAS/MODFLOW/SWMM bounded adapters; vertical datum and mass-balance/convergence checks; source-only safety floors; documented model version and uncertainty. |
| P5 | Engineer-grade authoring | Plan/draw/edit alternatives with preview snapshots, version diff and review/signoff; certified output only with required professional approval. |
| P6 | Public distribution | One offline Windows x64 installer and anonymous/free public viewer; optional separately verified data update pull; robust stale/missing-layer behavior; no automatic privileged actions. |

### Mandatory trust and runtime invariants

- Source acquisition is never equivalent to dataset QA, scientific calibration, or regulatory approval.
- Snapshot hashes, versioned manifests, pinned trust anchors and archive-byte checks are mandatory for the labels **verified historical government snapshot**. Failed verification isolates the data layer and **never** stops the cinematic city.
- If metadata or the appropriate validation trail is absent, the layer is NOT_EVIDENCED. It may not make a quantitative public-safety, parcel, hydraulic or surveyed claim.
- FEMA NFHL, Indiana BAFM, observed gage stages and simulation water levels remain four distinct data planes.
- Untrusted repo code and large third-party assets must pass license review, dependency/SBOM/security audit, deterministic tests and exact compatibility checks before copying/building.
- Rendering quality can improve independently of scientific solver readiness. Formal design calculations cannot pass merely because the scene appears correct.
