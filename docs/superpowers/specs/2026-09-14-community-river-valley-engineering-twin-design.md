# Community River Valley Engineering Twin — Design Specification

**Date:** 2026-09-14  
**System:** Tri-State Systems Manager (TSM) / Open World Tri-State River Valley Engineering Simulation  
**Status:** Design for review  
**Primary scope:** Point Township / lower Wabash–Ohio confluence community resilience, expandable across the Tri-State River Valley

## 1. Purpose

Build a public-understandable, engineering-grade digital-twin architecture that can evaluate flood-resilience concepts from subsurface conditions through finished road/berm elevations, while preserving authoritative source provenance, real-time hydrologic observations, historical community observations, uncertainty, model limitations, permitting gates, and independent human engineering authority.

The system will investigate beneficial use of navigation dredged material—including the USACE Continuing Authorities Program Section 204 context—as a potential material stream for roads, access corridors, berms, habitat restoration, and related flood-resilience works. The system must not assume that Section 204 alone authorizes or funds a proposed road or berm. Section 204 applicability, dredged-material suitability, environmental compliance, real-estate interests, cost sharing, and all other authorities must be evaluated project-by-project.

The system is a decision-support and engineering-evidence platform. It cannot mathematically guarantee that a real structure will never fail and must never represent simulation output as an engineering certification, permit, flood-insurance determination, levee accreditation, or agency approval.

## 2. Public-interest design principles

1. Remove the specific private residence/address previously used as the system's engineering anchor from public architecture, map labels, source identifiers, and public documentation.
2. Preserve historical observations as community/family historical evidence with privacy-aware provenance rather than tying future engineering decisions to one household.
3. Model connected families, farms, roads, bridges, utilities, drainage networks, emergency routes, habitat, and community assets as a network rather than as a single-property defense.
4. Make every engineering conclusion traceable to source data, equations, assumptions, model version, numerical tolerances, uncertainty, and human review.
5. Provide layered visual explanations so elders, children, residents, elected officials, reviewers, and engineers can inspect the same proposed project at different levels of technical depth.
6. Fail closed when material properties, datum transformations, survey control, boundary conditions, or regulatory inputs are missing or unverified.

## 3. Authoritative evidence hierarchy

### Federal and state sources

- USACE Louisville District: Ohio River navigation, locks/dams, dredging, water management, levee/flood-risk information, Section 204 and related beneficial-use authorities.
- USACE EM 1110-2-5025: current engineering guidance for dredging and dredged-material management.
- USACE Beneficial Use Program and Section 204 resources.
- EPA Clean Water Act Section 404 and beneficial-use guidance.
- Indiana DNR Division of Water: Flood Control Act, floodway jurisdiction, construction permits, floodplain technical requirements, exemptions/general licenses.
- FEMA NFHL: effective federal flood-hazard/insurance reference plane.
- Indiana BAFM: separate planning/Indiana Flood Control Act context plane.
- USGS Water Data: real-time and historical stage/discharge and site metadata.
- NOAA National Water Prediction Service: observed and forecast hydrology.
- USGS 3DEP / The National Map: terrain and elevation provenance.
- USDA NRCS SSURGO/Web Soil Survey: soil mapping and soil-property context.
- NARA/NIST/Section508.gov as applicable to records, security, and accessibility governance.

### Historical community evidence

The uploaded `Tucker Family Flood History and Heritage — Point Township Indiana.xlsx` is treated as historical evidence, not as an authoritative replacement for agency gauge records. Relevant workbook evidence includes:

- historical flood crest observations from 1949–1983;
- documented 1961, 1962, 1963, and 1964 periods of community/family isolation;
- 2011 daily readings from J.T. Myers, Shawneetown, and New Harmony;
- 2018 cross-location flood observations;
- historical descriptions of roads, bridges, and agricultural access impacts;
- Point Township and community historical context.

The workbook's private-property reference sheet must not be propagated into public map labels or a property-specific engineering target. Historical records may be generalized to community thresholds, tagged with `HISTORICAL_COMMUNITY_EVIDENCE`, and retained in a restricted provenance layer where appropriate.

## 4. Dredged-material engineering workstream

### 4.1 Section 204 distinction

USACE Section 204 is a beneficial-use authority associated with dredging for construction or operation/maintenance of an existing authorized federal navigation project. Current USACE descriptions emphasize protection/restoration/creation of aquatic and ecologically related habitats and reduction of storm damage to property. USACE beneficial-use guidance recognizes broad uses including fill, dikes, levees, parking lots, and roads, but a specific proposed project still requires the correct authorization, environmental review, sponsor participation, cost sharing, and engineering determination.

TSM therefore models Section 204 as an **authority candidate and project pathway**, not an automatic right to obtain dredged material or construct roads.

### 4.2 Sediment acceptance gate

No dredged sediment is accepted as structural fill until a material qualification record exists containing, at minimum:

- source dredging project and channel reach;
- dredging date/campaign;
- grain-size distribution;
- moisture content;
- Atterberg limits where applicable;
- organic content;
- specific gravity/bulk density;
- compaction characteristics;
- shear strength parameters appropriate to the analysis;
- hydraulic conductivity where seepage matters;
- compressibility/consolidation parameters;
- settlement characteristics;
- contaminant screening and required chemical testing;
- leachability/environmental suitability where applicable;
- dewatering/handling requirements;
- segregation/blending requirements;
- geotechnical laboratory provenance;
- sample locations and chain of custody;
- laboratory method/version;
- acceptance/rejection status; and
- responsible qualified reviewer.

The simulator must support multiple material classes because dredged sediment can be heterogeneous and may be unsuitable for structural fill without treatment, blending, drying, stabilization, confinement, or alternative placement.

### 4.3 Material-routing model

The digital twin will represent:

`dredging reach → characterization → temporary storage/dewatering → processing → haul/barge/truck route → placement cell → compacted lift → final road/berm geometry → monitoring`

Each material movement receives a provenance identifier and mass/volume balance. Conservation checks must reject impossible inventories or negative balances.

## 5. Community transportation and cutoff restoration

The system will identify disconnected land and farm access using a graph model:

- nodes: farms/community assets/bridges/intersections/utility crossings/public facilities;
- edges: roads, farm roads, bridges, culverts, elevated access corridors, ferry/alternate access where applicable;
- state: passable, flood-affected, disconnected, emergency-only, or unavailable;
- trigger: observed or modeled water-surface elevation/depth/velocity;
- dependency: upstream/downstream hydraulic and transportation conditions.

Candidate road alignments are generated from terrain, parcel/access constraints, existing transportation corridors, environmental constraints, hydraulic performance, material logistics, and constructability—not from one property.

## 6. Subsurface-to-finished-grade engineering model

Every proposed road/berm corridor must support a vertically explicit engineering section:

1. existing ground / DEM / survey control;
2. mapped soil horizons;
3. groundwater and pore-pressure assumptions where available;
4. geotechnical investigation points;
5. weak/organic/alluvial layers;
6. foundation preparation;
7. geotextile/geogrid/drainage layers where designed;
8. approved fill/material layers;
9. lift thickness and compaction targets;
10. pavement/aggregate structure where applicable;
11. drainage/culvert/underdrain systems;
12. design crest/road grade;
13. required freeboard;
14. erosion/scour protection;
15. monitoring instrumentation.

The model must distinguish mapped soil data from site-specific investigation. SSURGO is reconnaissance/context evidence, not a substitute for borings, CPT, laboratory testing, survey, or construction QA/QC.

## 7. Mathematical verification framework

The engineering evidence layer must expose equations, inputs, units, assumptions, numerical methods, and acceptance criteria.

### Hydrology/hydraulics

Support:

- stage-discharge relationships;
- hydrograph routing;
- tributary/confluence interactions;
- backwater effects;
- HEC-RAS 1D/2D model inputs/outputs;
- Manning roughness zones;
- terrain conditioning;
- breaklines;
- mesh refinement;
- bridge/culvert structures;
- levee/berm stationing;
- water-surface profiles;
- depth/velocity/shear maps;
- floodway/no-rise analysis where applicable;
- uncertainty and sensitivity analysis.

### Geotechnical

Support limit-state/evidence checks for:

- bearing capacity;
- slope stability;
- global stability;
- sliding;
- overturning where applicable;
- settlement and differential settlement;
- consolidation;
- seepage and pore pressure;
- piping/internal erosion;
- uplift;
- underseepage;
- erosion/scour;
- rapid drawdown where applicable;
- seismic considerations where applicable;
- traffic surcharge and construction loading.

### Transportation

Support:

- roadway grade and vertical clearance;
- flood depth over road;
- overtopping criteria;
- hydraulic openings;
- pavement/fill section;
- axle/loading assumptions;
- emergency access thresholds;
- maintenance and inspection state.

### Verification policy

A result is never labeled `SAFE` merely because one deterministic calculation passes. The evidence engine must expose utilization ratios, factors of safety or reliability metrics appropriate to the adopted design standard, uncertainty ranges, sensitivity results, and unresolved assumptions.

The strongest status is `ENGINEERING_REVIEW_READY`, not `FAILURE_IMPOSSIBLE`.

## 8. Real-time river/dam network

TSM will create a watershed influence graph rather than a static list of gauges.

Initial candidate federal navigation structures to investigate and map include the Louisville District Ohio River system identified by USACE: Markland, McAlpine, Cannelton, Newburgh, John T. Myers, Smithland, and Olmsted. The graph will determine actual hydraulic relevance to each modeled location using river connectivity, pool structure, distance, stage relationships, tributary inflow, and model sensitivity. A dam is not assumed to have a causal impact merely because it is geographically nearby.

For each relevant station/structure, retain:

- authoritative source;
- station/project identifier;
- river mile or coordinates;
- observed stage;
- discharge where available;
- gate/operational information where publicly available;
- forecast stage;
- timestamp and time zone;
- datum/unit metadata;
- provisional/quality status;
- upstream/downstream relationship;
- latency/freshness;
- API/source URI;
- last successful retrieval;
- failure state;
- effect-confidence classification.

USGS and NOAA observations remain authoritative observations; modeled influence remains a derived analysis. Real-time refresh is mandatory before current-status claims.

## 9. Open-world visualization

The Open World Engineering Sim will display:

- photorealistic current Indiana imagery;
- real 3DEP terrain;
- soil horizons and investigation points;
- river channels and floodplain geometry;
- FEMA NFHL separately from Indiana BAFM;
- levees and flood-control assets;
- roads/bridges/culverts/utilities;
- candidate dredged-material logistics routes;
- dredged-material stockpiles/placement cells;
- proposed roads/berms;
- cross-section cutaways from subsurface through finished grade;
- live river gauges and forecast states;
- dam influence network;
- modeled depth/velocity/erosion maps;
- construction sequencing;
- monitoring instrumentation;
- uncertainty/confidence overlays.

A public education mode will provide simplified explanations, while engineer mode exposes full units, equations, mesh/model metadata, and evidence artifacts.

## 10. Historical replay

Historical flood events will be replayable as time-series scenarios. The simulator will distinguish:

- `HISTORICAL_RECORDED` — directly preserved historical observation;
- `AGENCY_OBSERVED` — authoritative agency observation;
- `DERIVED` — deterministic transformation;
- `MODEL_INPUT` — engineered input;
- `MODEL_OUTPUT` — numerical result;
- `SIMULATION_DEMO` — public visualization;
- `ENGINEERING_REVIEW_READY` — complete evidence package awaiting human review;
- `ENGINEER_ACCEPTED` — qualified engineer review recorded;
- `AGENCY_ACCEPTED` — official acceptance recorded externally and represented as evidence, not inferred by software.

## 11. Cryptographic evidence and PDF/LaTeX package

Each engineering package will have a machine-readable evidence manifest containing:

- artifact identifier;
- project/scenario identifier;
- source identifiers;
- source timestamps;
- CRS/vertical datum;
- model/software versions;
- input hashes;
- output hashes;
- equation set identifier;
- numerical tolerance;
- compiler/interpreter/runtime versions where material;
- reviewer identity/role;
- review state;
- generated timestamp;
- SHA-256 digest;
- optional detached digital signature/public-key metadata where deployment policy permits.

The publication pipeline will produce:

- human-readable PDF;
- source LaTeX bundle;
- machine-readable JSON evidence manifest;
- CSV/tabular calculation exports where useful;
- rendered engineering cross-sections;
- model metadata;
- provenance manifest.

Cryptographic hashes establish integrity and provenance; they do not prove physical correctness by themselves.

## 12. Grant-stacking evidence plane

The system will map each candidate project component to potentially relevant funding/authorization programs without asserting eligibility until program requirements are verified. Candidate categories include:

- USACE Civil Works/beneficial-use authorities;
- FEMA hazard-mitigation programs;
- FEMA BRIC or successor/current mitigation programs as applicable;
- USDA NRCS conservation/infrastructure programs;
- HUD/community-development programs where eligible;
- FHWA/INDOT transportation resilience programs where eligible;
- EPA water/environmental programs where applicable;
- Indiana DNR and state flood-control programs;
- local drainage/flood-control/public-works authorities;
- agricultural conservation and watershed programs.

Each grant record must include current notice/program year, eligible applicant, eligible activity, match/cost-share rules, environmental review requirements, deadlines, required engineering evidence, and authoritative source URL. No grant eligibility is inferred solely from project similarity.

## 13. Regulatory and review gates

The implementation must explicitly track, rather than silently assume:

- Indiana Flood Control Act / floodway authorization;
- Indiana DNR technical hydraulic requirements;
- FEMA no-rise/effective floodway requirements where applicable;
- Clean Water Act Section 404/401 requirements where applicable;
- dredged-material testing and placement requirements;
- wetlands/waters of the U.S./state waters determinations;
- endangered species/cultural-resource coordination where triggered;
- real-estate/right-of-way interests;
- navigation project compatibility;
- local road/utility permits;
- construction stormwater requirements;
- environmental justice/community participation requirements where applicable;
- professional engineer/surveyor review and sealing;
- agency-specific records/accessibility/cybersecurity requirements.

Indiana DNR currently identifies fills, excavations, roads, levees, flood-control projects, outfalls, and certain utilities as activities that may require Flood Control Act review when within jurisdictional floodway. Its current minimum-plan guidance calls for site maps, aerial plans, cross sections, photographs, resource-impact information, and applicable hydraulic/no-rise documentation.

## 14. Safety and public communication

The public UI must never display a simulation as an instruction to enter floodwater or perform construction. It must clearly distinguish:

- observed conditions;
- forecast conditions;
- modeled scenarios;
- recommended engineering actions;
- emergency/public-safety instructions from official authorities.

Construction sequencing is educational/simulation content until authorized construction documents are supplied by the responsible project team.

## 15. Repository architecture

The implementation will add focused modules rather than a monolithic engineering engine. Expected areas include:

- `data/schemas/` — authoritative data contracts;
- `artifacts/` — versioned evidence catalogs/manifests;
- `backend/api/v1/` — engineering/evidence APIs;
- `tsm-console/src/lib/` — typed client-side data/model adapters;
- `tsm-console/src/components/` or existing map/view structure — educational and engineering visualization layers;
- `docs/engineering/` — design basis, equations, review procedures, and source register;
- `docs/grants/` — grant/authorization evidence registry;
- `docs/superpowers/` — design and implementation records;
- `tests/` and existing TSM contract-test locations — regression and provenance tests.

No source dataset that is too large or license-restricted should be bulk-committed merely to make the visualization work. The architecture should reference authoritative services and retain compact provenance/evidence artifacts.

## 16. Verification strategy

Implementation must use TDD for new behavior. Required automated contracts include:

1. private-address redaction from public/system identifiers;
2. historical workbook records retain `HISTORICAL_COMMUNITY_EVIDENCE` provenance;
3. Section 204 is represented as conditional authority, not generic road-funding authorization;
4. dredged-material placement is blocked until material qualification passes;
5. mass/volume conservation checks reject invalid material routing;
6. engineering calculations carry units and datum metadata;
7. model output cannot self-promote to regulatory acceptance;
8. real-time telemetry preserves timestamps, qualifiers, source identity, and freshness;
9. dam influence is confidence-scored rather than assumed;
10. FEMA NFHL and Indiana BAFM remain distinct;
11. cross-section visualization is generated from the same engineering geometry used by calculations;
12. evidence manifests hash all required inputs/outputs;
13. PDF/LaTeX packages reproduce the declared calculation set;
14. public mode never exposes restricted property-level identifiers;
15. CI parse/type/test/build/integrity gates remain green.

Where local execution is unavailable, GitHub Actions remains the verification authority and the system must not claim tests were run locally.

## 17. Explicit non-guarantees

This design deliberately rejects the following claims:

- that a numerical model can prove absolute physical failure impossibility;
- that a flood-control structure can be certified by software alone;
- that dredged sediment is automatically suitable for structural fill;
- that Section 204 automatically funds any desired road or berm;
- that a USGS/NOAA stage observation is a regulatory determination;
- that FEMA NFHL and Indiana BAFM are interchangeable;
- that a digital twin substitutes for site investigation, survey, laboratory testing, HEC-RAS review, geotechnical design, environmental permitting, or a licensed professional engineer;
- that a grant program remains eligible without current program verification.

The goal is instead to make the evidence chain sufficiently rigorous that qualified engineers and agencies can efficiently inspect, challenge, revise, and approve or reject proposed designs.

## 18. Acceptance target

The completed system is accepted for this project phase when a qualified reviewer can select a proposed community road/berm, inspect the complete vertical section from existing ground through finished grade, inspect material provenance and geotechnical properties, replay historical and current hydrologic conditions, inspect the hydraulic model and uncertainty, view connected transportation impacts, inspect regulatory gates, reproduce the calculation package, verify cryptographic hashes, and identify exactly which human/agency approvals remain outstanding.
