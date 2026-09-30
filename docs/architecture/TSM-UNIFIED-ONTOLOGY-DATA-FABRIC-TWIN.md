# Unified Ontology + Data Fabric + Level-5 Twin Architecture

## Implemented contract

TSM now has a model-neutral semantic spine for heterogeneous engineering, infrastructure, environmental, institutional, and scenario data.

### 1. Unified ontology

The ontology package defines physical entities, social/institutional entities, process entities, typed relationships, temporal validity, spatial CRS metadata, and source dataset references. Engineering modules remain responsible for domain-specific calculations and evidence gates.

### 2. Data fabric

The fabric uses three logical zones: RAW (immutable source representation), CURATED (validated/conformed data), and SEMANTIC (ontology/twin-ready data). Promotion requires quality PASS, lineage content hash, and retrieval timestamp. DISCOVERY_ONLY sources cannot be promoted to authoritative data.

Every dataset records owner, steward, authority class, access class, schema version, CRS/datum where applicable, update cadence, maximum age, lineage, retrieval time, source observation time, quality checks, and content hash.

### 3. 4D twin

A twin state is a time-indexed graph: Entity + Relationship + Observation + effectiveAt. A scenario references a specific parent state and carries explicit assumptions and interventions. Scenario creation cannot mutate the parent state or bypass engineering evidence gates.

This supports historical snapshots, current observations, deterministic scenario branches, and reproducible state lineage.

### 4. Engineering and evidence boundary

The twin is a representation/orchestration layer, not a substitute for survey, geotechnical investigation, laboratory testing, hydraulic boundary conditions, approved project geometry, or engineering review. The existing seven-module evidence gate remains authoritative for deterministic engineering readiness.

No renderer, AI model, sensor stream, or scenario writer may silently convert derived or synthetic data into authoritative evidence.

### 5. 3D/4D presentation boundary

Visual assets reference ontology entity IDs. Rendering may consume twin state but cannot mutate engineering state. CityGML/CityJSON remain semantic 3D city context formats; glTF is a runtime visualization delivery format; USD/OpenUSD is the richer scene/cinematic interchange boundary. CRS and datum transformations remain explicit ingestion operations.

### 6. Governance

Governance is machine-readable metadata plus the existing UACF policy/evidence gates: owner, steward, authority classification, access classification, quality status, lineage/content hashes, freshness limits, and human engineering review. Hashes provide integrity evidence; they do not by themselves establish scientific validity or engineering approval.

### 7. Offline/static-data mode

The architecture does not require a live river-gauge login to remain coherent. Live telemetry is optional; cached versioned observations are represented with provenance and age. A missing live source remains missing; the system does not manufacture an observation to make a scenario appear complete.

### CI gate

verify:uacf now includes UACF TypeScript compilation, UACF contract tests, seven-module evidence tests, unified ontology/data-fabric/twin tests, and UACF gateway smoke. Broader repository CI remains authoritative for application, geospatial, Python, security, container, and native/Unreal validation.