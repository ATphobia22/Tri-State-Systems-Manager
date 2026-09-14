# Community River Valley Engineering Twin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend TSM from a site-centered flood decision-support console into a privacy-safe, community-scale river-valley engineering evidence platform with authoritative real-time gauges, dam influence modeling, dredged-material qualification and routing, subsurface-to-finished-grade engineering evidence, historical replay, cryptographic publication, grant evidence, and public/engineer visualization modes.

**Architecture:** Keep TSM modular and fail-closed. The authoritative data plane remains source-driven (USGS, NOAA, USACE, FEMA, Indiana DNR/BAFM, USGS 3DEP, USDA NRCS and other verified government services), while derived hydraulic/geotechnical/transportation calculations are explicitly typed as derived/model evidence. Replace the private-property anchor with a community-region identifier and capability-driven project geometry; preserve family/workbook history only as privacy-aware historical community evidence. Build the engineering evidence plane independently of the visualization plane so every map, cross-section, calculation and publication can point to the same immutable scenario inputs and provenance manifest.

**Tech Stack:** Python 3/Pydantic v2 backend contracts; TypeScript/React 19/Vite 8/MapLibre/React Three Fiber/Three.js; Node test runner and Vitest; JSON Schema; HEC-RAS interchange metadata; GeoTIFF/3DEP service references; GitHub Actions CI; LaTeX source plus deterministic SHA-256 evidence manifests; authoritative HTTPS government APIs/services.

**Spec:** `docs/superpowers/specs/2026-09-14-community-river-valley-engineering-twin-design.md`

## Global Constraints

- The specific private residence/address previously used as the engineering anchor must not appear in public architecture, public map labels, public source identifiers, or public documentation.
- The uploaded family workbook is historical/community evidence only; it does not replace USGS, NOAA, USACE, FEMA, Indiana DNR, survey, laboratory, or engineering records.
- Section 204 is a conditional authority/project pathway, never generic road funding or automatic entitlement to dredged material.
- Dredged sediment is not structural fill until the material qualification gate passes for the proposed use.
- Real-time claims require a fresh retrieval with source timestamp, retrieval timestamp, units, datum, quality qualifier and failure/freshness state.
- USGS/NOAA observations are observations; dam influence and engineering outputs are derived evidence.
- FEMA NFHL and Indiana BAFM remain separate semantic layers.
- No software result may self-promote to engineering certification, permit approval, flood-insurance determination, levee accreditation, or agency acceptance.
- Missing datum, survey control, boundary conditions, material properties, regulatory evidence or required review must fail closed.
- The strongest engineering result state is `ENGINEERING_REVIEW_READY`; the system must never emit `FAILURE_IMPOSSIBLE` or equivalent.
- Public simulation is educational/decision-support content, not an instruction to enter floodwater or construct a physical work.
- Medical/clinical functionality remains outside TSM and belongs in TMRDS.
- No bulk-copy of restricted or oversized government datasets; retain service references, compact metadata and reproducibility manifests.

---

### Task 1: Establish current repository baseline and privacy-removal contract

**Files:**
- Read: repository tree, `COMPLIANCE.md`, `README.md`, `GOVERNMENT_QUICKSTART.md`, current `backend/api/v1/schemas.py`, current TSM console map/data files, CI workflows.
- Modify: all current public/runtime files found by exact-address search.
- Create: `tests/privacy-community-scope.test.mjs` and/or the repository's established equivalent contract-test file.

**Interfaces:**
- Consumes: current `main` at commit `c4d0ec765dce879b1f14c288ce5dc86a58ba6d7e` and the existing address/site-constant search results.
- Produces: a repository-wide public-scope invariant and a list of legacy site-anchor modules that must be generalized, removed, or quarantined.

- [ ] **Step 1: Write failing tests** that assert public/runtime source files contain no literal private address, no `BONEBANK_SITE`/`BONEBANK_LOOKUP` public anchor, and no public map/project identifier derived from the private residence.
- [ ] **Step 2: Run the repository's applicable privacy/parse tests in GitHub Actions after the test commit; expected initial failure against existing legacy references.** Do not claim local execution because this environment does not provide the repository checkout/runtime.
- [ ] **Step 3: Replace site-specific public constants with a community-region contract such as `lower-wabash-ohio-confluence-community`, with explicit geometry provenance rather than a private residence.
- [ ] **Step 4: Move any retained private historical material into a non-public provenance category only if repository policy permits; otherwise remove the private reference from source and retain only generalized historical evidence.
- [ ] **Step 5: Update privacy tests to prove generalized historical observations remain allowed while identifying information is rejected.
- [ ] **Step 6: Commit the privacy-boundary changes separately from engineering features.

---

### Task 2: Build authoritative government source registry and real-time station catalog

**Files:**
- Modify: `artifacts/tsm-indiana-data-catalog-v1.1.json` into the next backward-compatible catalog version.
- Create: `artifacts/tsm-river-valley-realtime-stations-v1.json`.
- Create: `backend/api/v1/river_data.py`.
- Modify: `backend/api/v1/server.py` to register the river-data routes using existing patterns.
- Create: `tests/river-realtime-contract.test.mjs`.
- Create: `docs/engineering/REALTIME-RIVER-DATA.md`.

**Interfaces:**
- Consumes: verified USGS Water Data, NOAA NWPS, USACE Louisville District water/navigation/locks-dams resources and existing TSM stage/datum contracts.
- Produces: `RiverObservation`, `StationMetadata`, `DamStructure`, `TelemetryHealth`, and `RiverInfluenceNode` JSON contracts with source identity and freshness metadata.

- [ ] **Step 1: Define station metadata fields:** provider, station/project ID, name, river, river mile when authoritative, latitude/longitude, observation variables, units, horizontal CRS, vertical datum, observed timestamp, retrieved timestamp, quality/qualification, provisional flag, source URI, upstream/downstream relation, freshness threshold and failure state.
- [ ] **Step 2: Add the complete candidate Louisville District Ohio River structure catalog: Markland, McAlpine, Cannelton, Newburgh, John T. Myers, Smithland and Olmsted. Store these as candidate structures, not proven hydraulic causes.
- [ ] **Step 3: Add surrounding USGS/NOAA gauge discovery records for the lower Wabash/Ohio system and nearby tributary controls that can materially affect the modeled community. Include New Harmony and Evansville and expand only where an authoritative station relationship is documented.
- [ ] **Step 4: Implement fetch/normalize functions that preserve source timestamps and quality flags instead of converting observations into anonymous numbers.
- [ ] **Step 5: Add fail-closed handling for timeout, HTTP failure, malformed payload, stale observation, missing datum or unit metadata.
- [ ] **Step 6: Add tests for provenance preservation, freshness, datum/unit requirements, provisional status, duplicate station IDs and failed-source states.
- [ ] **Step 7: Document that current-status display is only populated after live retrieval and that historical indexed values cannot be labeled current.

---

### Task 3: Implement watershed/dam influence graph

**Files:**
- Create: `data/schemas/river-influence-graph.schema.json`.
- Create: `backend/api/v1/river_influence.py`.
- Create: `tsm-console/src/lib/riverInfluence.ts`.
- Create: `tests/river-influence-contract.test.mjs`.
- Modify: `artifacts/tsm-river-valley-realtime-stations-v1.json`.

**Interfaces:**
- Consumes: station/structure catalog from Task 2, river connectivity, coordinates, river-mile metadata where authoritative, observed stages/discharges and model sensitivity results.
- Produces: influence edges with `confidence`, `evidence_ids`, `relationship_type`, `lag_or_response_metadata` when known, and `derived_at` timestamps.

- [ ] **Step 1: Write failing tests requiring every influence edge to identify its evidence and distinguish `OBSERVED_RELATIONSHIP`, `GEOGRAPHIC_PROXIMITY`, `MODEL_DERIVED`, and `UNVERIFIED`.
- [ ] **Step 2: Implement the graph schema with explicit node and edge types and no implicit causal inference.
- [ ] **Step 3: Add deterministic graph construction from documented river connectivity and station metadata.
- [ ] **Step 4: Add sensitivity hooks so a hydraulic scenario can increase/decrease influence confidence only from model evidence, never from UI proximity.
- [ ] **Step 5: Add tests proving a geographically nearby dam is not labeled causally influential without evidence.
- [ ] **Step 6: Expose the graph to the UI as a typed dataset.

---

### Task 4: Replace fixed hydraulic/site constants with evidence-driven project geometry

**Files:**
- Modify: `backend/api/v1/schemas.py`.
- Modify/remove generalized equivalents of `backend/gov/site_constants.py`.
- Modify: `tsm-console/src/types/site.ts`, `tsm-console/src/lib/siteConstants.ts`, `tsm-console/src/lib/firm-panel-ssot.ts`, `tsm-console/src/lib/viewport-config.ts` and dependent imports.
- Create: `data/schemas/community-project.schema.json`.
- Create: `tests/community-project-contract.test.mjs`.

**Interfaces:**
- Consumes: authoritative project geometry, survey/elevation evidence, FEMA/BAFM context and scenario metadata.
- Produces: `CommunityProject`, `EngineeringSection`, `ElevationReference`, and explicit evidence-backed design inputs.

- [ ] **Step 1: Write failing tests proving arbitrary scenario elevations cannot silently inherit the old private-site constants.
- [ ] **Step 2: Replace hard-coded BFE/LAG/berm/FFE invariants with project-specific values that require source/evidence IDs and vertical datum.
- [ ] **Step 3: Retain existing values only where they are independently documented as a current authoritative project input; otherwise convert them to historical/example evidence with explicit status.
- [ ] **Step 4: Require all elevation comparisons to declare NAVD88 or another verified datum and transformation evidence.
- [ ] **Step 5: Update existing hydraulic request/response models so no-rise and floodway logic consumes explicit scenario inputs.
- [ ] **Step 6: Run existing HEC-RAS/geodetic/data-fabric contracts in CI and correct regressions.

---

### Task 5: Implement dredged-material qualification and Section 204 authority model

**Files:**
- Create: `data/schemas/dredged-material.schema.json`.
- Create: `data/schemas/authority-pathway.schema.json`.
- Create: `backend/api/v1/dredged_material.py`.
- Create: `tests/dredged-material-contract.test.mjs`.
- Create: `docs/engineering/DREDGED-MATERIAL-ENGINEERING-BASIS.md`.
- Create: `docs/engineering/SECTION-204-AUTHORITY-MATRIX.md`.

**Interfaces:**
- Consumes: dredging project/channel metadata, laboratory qualification records, environmental testing and proposed placement use.
- Produces: `MaterialQualification`, `AuthorityPathway`, `PlacementEligibility`, and rejection reasons.

- [ ] **Step 1: Write failing tests that reject structural placement when gradation/moisture/compaction/shear/consolidation/environmental evidence is absent.
- [ ] **Step 2: Define the material qualification schema containing source dredging reach/campaign, sample location, chain of custody, grain size, moisture, Atterberg limits, organic content, density/specific gravity, compaction, shear strength, conductivity, compressibility/consolidation, settlement, contaminant/leachability results, dewatering/processing, blending, laboratory method/version, reviewer and acceptance state.
- [ ] **Step 3: Define Section 204 as an authority candidate with explicit conditions for navigation-project relationship, project purpose, sponsor, cost share, environmental review and other required approvals.
- [ ] **Step 4: Implement a gate that returns `NOT_ELIGIBLE_YET` when authority or material evidence is incomplete.
- [ ] **Step 5: Add tests proving Section 204 never becomes a generic road-funding flag.
- [ ] **Step 6: Document current official USACE/EPA/Indiana requirements and preserve source dates/URLs in the evidence registry.

---

### Task 6: Implement dredged-material mass/volume routing and placement cells

**Files:**
- Create: `data/schemas/material-routing.schema.json`.
- Create: `backend/api/v1/material_routing.py`.
- Create: `tsm-console/src/lib/materialRouting.ts`.
- Create: `tests/material-routing-contract.test.mjs`.

**Interfaces:**
- Consumes: qualified material from Task 5 and proposed logistics/placement geometry.
- Produces: material lots, routing legs, inventory balances, placement lifts and final placement records.

- [ ] **Step 1: Write failing conservation tests for negative inventory, impossible volume conversion, double allocation and unqualified placement.
- [ ] **Step 2: Implement the routing chain `dredging reach -> characterization -> temporary storage/dewatering -> processing -> haul/barge/truck -> placement cell -> compacted lift -> final geometry -> monitoring`.
- [ ] **Step 3: Require consistent units and material-density assumptions for every conversion between mass and volume.
- [ ] **Step 4: Implement conservation checks across source, losses, processing, placed and remaining inventory.
- [ ] **Step 5: Expose provenance IDs on every material movement and placement lift.
- [ ] **Step 6: Add regression tests for mixed material lots and rejected lots.

---

### Task 7: Build subsurface-to-finished-grade engineering section model

**Files:**
- Create: `data/schemas/engineering-section.schema.json`.
- Create: `backend/api/v1/engineering_section.py`.
- Create: `tsm-console/src/lib/engineeringSection.ts`.
- Create: `tsm-console/src/components/EngineeringSectionCutaway.tsx`.
- Create: `tests/engineering-section-contract.test.mjs`.
- Create: `docs/engineering/SUBSURFACE-TO-FINISHED-GRADE.md`.

**Interfaces:**
- Consumes: terrain/survey, SSURGO context, investigation points, groundwater/pore pressure, qualified materials and design geometry.
- Produces: a vertically explicit section with layer provenance, design parameters, construction sequence and instrumentation requirements.

- [ ] **Step 1: Write failing tests requiring each section layer to declare source/provenance and units.
- [ ] **Step 2: Implement layers for existing ground/survey, mapped soils, groundwater/pore pressure, investigation points, weak/organic/alluvial strata, foundation preparation, geotextile/geogrid/drainage where designed, approved fill, compaction lifts, pavement/aggregate, drainage/culverts/underdrains, design crest/grade, freeboard, erosion/scour protection and monitoring instrumentation.
- [ ] **Step 3: Explicitly mark SSURGO/Web Soil Survey as context evidence and reject its use as a substitute for site-specific borings/CPT/laboratory testing.
- [ ] **Step 4: Build a cross-section renderer that uses the same geometry/data contract consumed by calculations; do not maintain separate visual-only geometry.
- [ ] **Step 5: Add accessible labels and a simplified public explanation layer for each engineering stratum.
- [ ] **Step 6: Add tests for missing site investigation, mismatched vertical datum and unqualified fill.

---

### Task 8: Implement transparent hydrology/hydraulics verification primitives

**Files:**
- Modify: `backend/api/v1/hecras_solver.py` only where needed to integrate evidence contracts.
- Create: `backend/api/v1/hydraulic_evidence.py`.
- Create: `data/schemas/hydraulic-evidence.schema.json`.
- Create: `tests/hydraulic-evidence-contract.test.mjs`.
- Create: `docs/engineering/HYDRAULIC-VERIFICATION.md`.

**Interfaces:**
- Consumes: terrain/breaklines/mesh metadata, boundary conditions, stage/discharge observations, Manning zones, structures, berm stationing and scenario inputs.
- Produces: equation/input/output records, uncertainty/sensitivity summaries and review state.

- [ ] **Step 1: Write failing tests requiring units, datum, equation-set ID, model version, numerical tolerance and source IDs for every hydraulic result.
- [ ] **Step 2: Implement transparent primitives for stage-discharge, hydrograph/routing metadata, confluence/backwater inputs, Manning relationship, terrain conditioning, breaklines, mesh bands, bridges/culverts, WSE, depth, velocity, shear and no-rise evidence.
- [ ] **Step 3: Keep HEC-RAS execution and pure-Python analytical checks clearly separated; never label a fallback calculation as a HEC-RAS result.
- [ ] **Step 4: Add uncertainty and sensitivity records instead of collapsing results to a single deterministic number.
- [ ] **Step 5: Ensure no-rise claims require the exact geometry and boundary-condition evidence expected by the adopted review path.
- [ ] **Step 6: Add tests for unit mismatch, stale telemetry, missing boundary conditions and self-promotion of model output.

---

### Task 9: Implement geotechnical limit-state/evidence framework

**Files:**
- Create: `data/schemas/geotechnical-evidence.schema.json`.
- Create: `backend/api/v1/geotechnical_evidence.py`.
- Create: `tests/geotechnical-evidence-contract.test.mjs`.
- Create: `docs/engineering/GEOTECHNICAL-VERIFICATION.md`.

**Interfaces:**
- Consumes: qualified material properties, stratigraphy, groundwater/pore pressure, geometry and loads.
- Produces: limit-state checks and evidence packages for bearing, slope/global stability, sliding, overturning where applicable, settlement/differential settlement, consolidation, seepage/pore pressure, piping/internal erosion, uplift/underseepage, erosion/scour, rapid drawdown, seismic considerations and traffic/construction loading.

- [ ] **Step 1: Write failing tests requiring every geotechnical check to identify adopted method, input provenance, units, assumptions and review state.
- [ ] **Step 2: Implement auditable calculation primitives with explicit result statuses and utilization/factor-of-safety fields where the adopted method supports them.
- [ ] **Step 3: Reject calculations when required site-specific parameters are missing rather than substituting generic soil values.
- [ ] **Step 4: Attach sensitivity ranges for uncertain strength, groundwater and loading inputs.
- [ ] **Step 5: Ensure public UI receives explanations while engineer UI can expose calculation metadata.
- [ ] **Step 6: Add regression tests for incomplete material qualification, missing groundwater, negative/invalid parameters and impossible geometry.

---

### Task 10: Implement transportation cutoff graph and community connectivity scenarios

**Files:**
- Create: `data/schemas/community-transport-graph.schema.json`.
- Create: `backend/api/v1/community_transport.py`.
- Create: `tsm-console/src/lib/communityTransport.ts`.
- Create: `tests/community-transport-contract.test.mjs`.
- Create: `docs/engineering/COMMUNITY-ACCESS-ENGINEERING.md`.

**Interfaces:**
- Consumes: roads, farm access corridors, bridges, culverts, public facilities, utilities, terrain, hydraulic scenarios and environmental/parcel constraints.
- Produces: connectivity states and candidate corridor evidence.

- [ ] **Step 1: Write failing graph tests for passable/flood-affected/disconnected/emergency-only/unavailable edge states.
- [ ] **Step 2: Implement nodes for farms/community assets/bridges/intersections/utility crossings/public facilities without private address labels.
- [ ] **Step 3: Implement edges for roads, farm roads, bridges, culverts, elevated corridors and alternate access where authoritative data supports them.
- [ ] **Step 4: Attach trigger conditions to observed/modelled WSE, depth, velocity or other documented criteria.
- [ ] **Step 5: Implement candidate alignment scoring using terrain, access constraints, existing corridors, environmental constraints, hydraulic performance, material logistics and constructability evidence.
- [ ] **Step 6: Add tests proving the algorithm cannot choose an alignment solely because it serves the former private anchor.

---

### Task 11: Build Open World engineering visualization with public and engineer modes

**Files:**
- Modify: existing `tsm-console` map/twin components after reading their current interfaces.
- Create: `tsm-console/src/components/RiverRealtimePanel.tsx`.
- Create: `tsm-console/src/components/DamInfluencePanel.tsx`.
- Create: `tsm-console/src/components/EngineeringEvidencePanel.tsx`.
- Create: `tsm-console/src/components/EngineeringSectionCutaway.tsx` if not created in Task 7.
- Create: `tsm-console/src/lib/engineeringVisualization.ts`.
- Create: `tests/open-world-engineering-contract.test.mjs`.

**Interfaces:**
- Consumes: Tasks 2–10 typed data contracts.
- Produces: synchronized 2D/3D map, river telemetry, dam influence network, construction sequence, cross-section and evidence UI.

- [ ] **Step 1: Write failing tests requiring FEMA NFHL and Indiana BAFM to remain separately labeled and styled semantically.
- [ ] **Step 2: Add current imagery and 3DEP terrain through existing service contracts; do not pretend remote tiles are bulk local data.
- [ ] **Step 3: Add live river-gauge panel with observation/forecast/model badges, last observation time, retrieval time, datum/units and stale/failure status.
- [ ] **Step 4: Add all relevant candidate dam/structure nodes and only draw influence edges supported by Task 3 evidence.
- [ ] **Step 5: Add engineering cross-section cutaway from subsurface through finished road/berm, using the same geometry used by calculations.
- [ ] **Step 6: Add construction sequencing and material logistics visualization with simulation-only labels.
- [ ] **Step 7: Add public education mode with plain-language explanations and engineer mode with equations/units/model metadata.
- [ ] **Step 8: Add accessibility semantics, keyboard navigation, readable status text and non-color-only distinctions.

---

### Task 12: Implement historical replay and workbook evidence ingestion

**Files:**
- Create: `data/schemas/historical-event.schema.json`.
- Create: `backend/api/v1/historical_replay.py`.
- Create: `tests/historical-replay-contract.test.mjs`.
- Create: `docs/engineering/HISTORICAL-REPLAY.md`.
- Create: `artifacts/historical/` compact provenance/index artifacts derived from the uploaded workbook only where privacy-safe and legally appropriate.

**Interfaces:**
- Consumes: uploaded workbook historical records and verified agency historical observations.
- Produces: replayable event records with `HISTORICAL_RECORDED`, `AGENCY_OBSERVED`, `DERIVED`, `MODEL_INPUT`, `MODEL_OUTPUT`, `SIMULATION_DEMO`, `ENGINEERING_REVIEW_READY`, `ENGINEER_ACCEPTED`, `AGENCY_ACCEPTED` states.

- [ ] **Step 1: Write failing tests requiring every workbook-derived record to carry `HISTORICAL_COMMUNITY_EVIDENCE` and source-file identity.
- [ ] **Step 2: Extract privacy-safe event evidence from the workbook: 1949–1983 flood-crest history, 1961–1964 isolation observations, 2011 daily cross-location readings, 2018 flood observations and community access impacts.
- [ ] **Step 3: Explicitly exclude the workbook's property-specific address/APN/house trigger data from public engineering identifiers.
- [ ] **Step 4: Cross-reference historical events against agency station records where dates/stations can be verified, retaining both evidence types rather than silently replacing one with the other.
- [ ] **Step 5: Implement replay scenarios that never relabel family observations as agency observations.
- [ ] **Step 6: Add tests for provenance, privacy and status transitions.

---

### Task 13: Build cryptographic evidence manifest and PDF/LaTeX publication package

**Files:**
- Create: `data/schemas/evidence-manifest.schema.json`.
- Create: `backend/api/v1/evidence_manifest.py`.
- Create: `scripts/evidence/generate_manifest.mjs`.
- Create: `docs/engineering/templates/engineering-evidence-package.tex`.
- Create: `docs/engineering/EVIDENCE-PUBLICATION.md`.
- Create: `tests/evidence-publication-contract.test.mjs`.

**Interfaces:**
- Consumes: scenario inputs/outputs and source metadata from all engineering tasks.
- Produces: deterministic JSON manifest, SHA-256 hashes, LaTeX source bundle, PDF build metadata and optional detached-signature metadata.

- [ ] **Step 1: Write failing tests requiring artifact ID, scenario ID, source IDs/timestamps, CRS/vertical datum, model/software versions, input/output hashes, equation-set ID, tolerance, runtime/compiler metadata, reviewer role, review state and generated timestamp.
- [ ] **Step 2: Implement canonical serialization before hashing so identical evidence inputs generate identical manifest digests.
- [ ] **Step 3: Implement SHA-256 for every input/output artifact and the manifest itself.
- [ ] **Step 4: Generate LaTeX sections for project scope, source register, assumptions, equations, units, model metadata, uncertainty, calculations, cross-sections, review gates and outstanding approvals.
- [ ] **Step 5: Generate machine-readable JSON and tabular CSV outputs where appropriate.
- [ ] **Step 6: Make detached signing optional and policy-driven; never imply a hash proves physical correctness.
- [ ] **Step 7: Add CI verification that regenerated manifests match committed expected digests when source inputs are unchanged.

---

### Task 14: Build grant-stacking and authorization evidence plane

**Files:**
- Create: `data/schemas/grant-program.schema.json`.
- Create: `artifacts/grants/tri-state-flood-resilience-program-registry-v1.json`.
- Create: `backend/api/v1/grants.py`.
- Create: `tests/grant-evidence-contract.test.mjs`.
- Create: `docs/grants/README.md`.
- Create: `docs/grants/ENGINEERING-EVIDENCE-MAPPING.md`.

**Interfaces:**
- Consumes: current official program notices/authorities and project component evidence.
- Produces: candidate funding/authorization matches with explicit eligibility status and source dates.

- [ ] **Step 1: Search current official USACE, FEMA, USDA NRCS, FHWA/INDOT, EPA, Indiana DNR, HUD and applicable local/state program sources immediately before populating current-year records.
- [ ] **Step 2: Define each record with program year/notice, eligible applicant, eligible activity, match/cost share, environmental review, deadline, required engineering evidence, authoritative URL and verification timestamp.
- [ ] **Step 3: Separate `POTENTIAL_MATCH`, `REQUIRES_ELIGIBILITY_REVIEW`, `INELIGIBLE_BASED_ON_PUBLISHED_RULE`, and `VERIFIED_BY_PROGRAM_SOURCE`.
- [ ] **Step 4: Map project components such as dredged-material beneficial use, road/access restoration, flood-control work, habitat restoration, drainage and monitoring to candidate programs without asserting award eligibility.
- [ ] **Step 5: Add stale-program detection so expired notices cannot appear as current funding opportunities.
- [ ] **Step 6: Add tests for source freshness and non-inference of eligibility.

---

### Task 15: Implement regulatory/review gate registry

**Files:**
- Create: `data/schemas/regulatory-gate.schema.json`.
- Create: `artifacts/tsm-regulatory-gates-v1.json`.
- Create: `backend/api/v1/regulatory_gates.py`.
- Create: `tests/regulatory-gate-contract.test.mjs`.
- Modify: `COMPLIANCE.md` and `GOVERNMENT_QUICKSTART.md`.

**Interfaces:**
- Consumes: project scope and evidence from Tasks 4–14.
- Produces: explicit gates for Indiana Flood Control Act/floodway, Indiana DNR hydraulic requirements, FEMA no-rise/effective floodway requirements where applicable, CWA 404/401, dredged-material placement, wetlands/waters determinations, species/cultural review, ROW, navigation compatibility, local permits, stormwater, environmental justice/community participation, PE/PLS review and records/accessibility/cybersecurity requirements.

- [ ] **Step 1: Write failing tests requiring every gate to identify authority, applicability evidence, responsible human/agency role, status and source.
- [ ] **Step 2: Implement gate states `NOT_ASSESSED`, `IN_REVIEW`, `EVIDENCE_REQUIRED`, `HUMAN_REVIEW_REQUIRED`, `SATISFIED_BY_EVIDENCE`, and `AGENCY_ACCEPTED`.
- [ ] **Step 3: Ensure no UI or API status can infer `AGENCY_ACCEPTED` from a software calculation.
- [ ] **Step 4: Link each engineering evidence artifact to applicable gates.
- [ ] **Step 5: Update compliance documentation to describe the community-scale system and strict non-certification boundary.

---

### Task 16: Integrate reliability, observability, security and provenance CI gates

**Files:**
- Modify: `.github/workflows/ci.yml`, `.github/workflows/open-world-twin.yml` and relevant existing CI only after inspecting their exact current contracts.
- Create: `scripts/ci/validate-community-engineering-boundaries.mjs`.
- Create: `tests/community-engineering-boundary.test.mjs`.
- Modify: existing artifact/parse/mock/site consistency checks as needed.

**Interfaces:**
- Consumes: all schemas, manifests and public/runtime source files.
- Produces: CI rejection on privacy leakage, mock production data, provenance gaps, stale live-data claims, unit/datum errors, unsupported authority claims or self-promoting acceptance states.

- [ ] **Step 1: Write failing CI-boundary tests for address leakage, unsupported current-data claims, Section 204 overstatement, material qualification bypass, and model-to-agency status promotion.
- [ ] **Step 2: Implement static repository checks for private anchor strings and legacy identifiers.
- [ ] **Step 3: Implement manifest/schema validation and deterministic-hash checks.
- [ ] **Step 4: Integrate existing parse/type/build/data-fabric/twin/evidence/reliability tests without weakening existing gates.
- [ ] **Step 5: Add explicit CI reporting for unavailable external government sources rather than silently falling back to stale or synthetic production telemetry.
- [ ] **Step 6: Verify all relevant GitHub Actions runs before any completion claim.

---

### Task 17: Generate government-review engineering package and public education package

**Files:**
- Create: `docs/engineering/COMMUNITY-RIVER-VALLEY-DESIGN-BASIS.md`.
- Create: `docs/engineering/ENGINEERING-REVIEW-CHECKLIST.md`.
- Create: `docs/engineering/PUBLIC-EDUCATION-GUIDE.md`.
- Create: `docs/engineering/ELDER-HISTORICAL-REPLAY-GUIDE.md`.
- Create: `docs/engineering/REALTIME-GAUGE-DATA-DICTIONARY.md`.

**Interfaces:**
- Consumes: completed evidence schemas, live-data contracts, historical replay and visualization modules.
- Produces: human-reviewable documentation for engineers, government reviewers, residents, elders, families and children.

- [ ] **Step 1: Document the full evidence chain from river observation through hydraulic scenario, geotechnical section, transportation connectivity, regulatory gates and publication hash.
- [ ] **Step 2: Provide a plain-language explanation of stage, discharge, datum, forecast, backwater, berm, freeboard, seepage, settlement and uncertainty.
- [ ] **Step 3: Document historical replay so elders can see agency and community records side by side without changing provenance.
- [ ] **Step 4: Document emergency/public-safety messaging separation from simulation content.
- [ ] **Step 5: Document exactly which human professional/agency decisions remain outside software authority.

---

### Task 18: Full-system verification, review, and merge to main

**Files:**
- Modify: any files required by CI failures discovered during verification.
- Create: `docs/superpowers/verification/2026-09-14-community-river-valley-engineering-twin-verification.md`.

**Interfaces:**
- Consumes: all implementation artifacts and GitHub Actions evidence.
- Produces: verified `main` state with documented residual human/agency gates.

- [ ] **Step 1: Run the repository's complete CI command set through GitHub Actions; do not substitute a local result.
- [ ] **Step 2: Inspect all failed jobs and fix root causes using the systematic-debugging workflow before rerunning them.
- [ ] **Step 3: Verify privacy search returns no public/private-anchor leakage.
- [ ] **Step 4: Verify real-time contracts retain authoritative source, timestamp, datum, units, quality and freshness state for every configured station.
- [ ] **Step 5: Verify all seven Louisville District candidate Ohio River structures are represented and influence is evidence-scored rather than assumed.
- [ ] **Step 6: Verify dredged-material qualification and mass-balance gates reject incomplete/invalid material paths.
- [ ] **Step 7: Verify hydraulic/geotechnical/transport evidence carries units, assumptions, source IDs, uncertainty and human review state.
- [ ] **Step 8: Verify public mode does not expose private property identifiers and engineer mode exposes evidence without granting regulatory authority.
- [ ] **Step 9: Verify reproducible evidence manifests and LaTeX bundles hash consistently.
- [ ] **Step 10: Verify current grant records have current official source evidence and expiration/deadline handling.
- [ ] **Step 11: Create/update PRs as appropriate, review the final diff, merge only verified changes to `main`, and record the resulting commit SHA.
- [ ] **Step 12: Re-check the post-merge `main` CI state and write the verification report with explicit pass/fail/blocked results.

---

## Definition of Done

The implementation is complete only when all of the following are evidenced in the repository and GitHub Actions:

1. No private residence/address is used as the public system anchor.
2. Community/family historical evidence remains traceable and privacy-aware.
3. Real-time USGS/NOAA observations and the documented USACE dam/lock network are represented with source, timestamp, datum, units, quality and freshness metadata.
4. Dam influence is evidence-scored and never inferred from proximity alone.
5. Section 204 is modeled as a conditional authority pathway.
6. Dredged material cannot become structural fill without qualification and environmental evidence.
7. Material routing conserves mass/volume and preserves provenance.
8. Engineering sections expose the subsurface-to-finished-grade structure and use shared geometry for calculations and visualization.
9. Hydraulic, geotechnical and transportation evidence is unit-aware, provenance-aware, uncertainty-aware and review-gated.
10. Historical replay distinguishes community records from agency observations and model outputs.
11. Public and engineer visualization modes are synchronized to the same evidence model.
12. FEMA NFHL and Indiana BAFM remain semantically distinct.
13. Engineering packages can be published as JSON manifest + SHA-256 evidence + LaTeX source + PDF build metadata.
14. Grant-stacking records are current-source verified and never assert eligibility without published support.
15. Regulatory gates are explicit and human/agency authority remains outside software.
16. Existing CI/build/test/security/geospatial/quantum-boundary contracts remain passing.
17. GitHub Actions provides the verification evidence; no unsupported local-test claim is made.

## Explicit Engineering Boundary

This system is intended to make high-quality engineering work more reproducible, understandable and affordable. It is not a substitute for site investigation, survey control, laboratory testing, hydraulic model calibration, geotechnical analysis, licensed engineering judgment, environmental review, construction QA/QC, inspection, emergency management, or agency approval. The objective is to help families, communities, engineers and public agencies work from the same evidence and make better decisions—not to conceal uncertainty or manufacture certification.
