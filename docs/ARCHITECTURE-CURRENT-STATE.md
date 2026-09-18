# Tri-State Systems Manager — Current-State Engineering Architecture

**Status:** Implemented current-state architecture  
**Evidence policy:** Only capabilities and external-source claims represented by code, manifests, or current official-source verification are treated as implemented.

## 1. System topology

TSM is organized as six cooperating engineering responsibility planes implemented across the repository:

1. **Experience plane** — React/Vite, MapLibre, Three.js/R3F, 3D Tiles, PMTiles, H3.
2. **Operations/API plane** — hydrology, datum middleware, river-network APIs, telemetry, ingestion and engineering endpoints.
3. **Authoritative data-fabric plane** — USGS, NOAA/NWPS, FEMA, Indiana DNR/GIO, USACE and jurisdictional regulatory sources.
4. **Model boundary plane** — real HEC-RAS HDF5 outputs and deterministic engineering primitives; synthetic hydraulic values are rejected.
5. **Evidence/provenance plane** — source identity, retrieval time, CRS, vertical datum, hashes, model identity, review state and artifact manifests.
6. **Human-review plane** — model outputs and engineering calculations remain reviewable artifacts rather than automatic regulatory determinations.

The planes are logical responsibilities, not a claim that they are six independently deployed services.

## 2. Verified geospatial and hydrologic fabric

### Elevation

USGS 3DEP is the federal elevation fabric. TSM preserves service metadata including acquisition and vertical-datum fields instead of inferring a universal vertical datum. USGS publishes QL2 requirements of 10 cm RMSEz, nominal pulse spacing <=0.71 m, and >=2 points/m²; these are product quality-level requirements, not a guarantee that every derived surface has identical local accuracy.

Indiana's 2016–2020 DEM is retained as a separate state product. Its source metadata identifies a hydro-flattened bare-earth DEM derived from statewide QL2 lidar, while TSM keeps its vertical datum source-dependent.

### Hydrology

NOAA/NWS NWPS supplies official gauge metadata, observations, forecasts, National Water Model output, crest history and flood-impact information. Observation and forecast records remain separate in TSM.

USGS gage records remain source-gage measurements unless a separately verified datum conversion is available.

### Flood hazard and infrastructure

FEMA effective flood-hazard mapping remains a separate regulatory-reference authority from Indiana Best Available Floodplain Mapping.

USACE National Levee Database services are treated as federal infrastructure inventory/reference data and are not substituted for site-specific engineering records.

### Spatial delivery

PMTiles and H3 provide scalable spatial indexing/distribution; 3D Tiles Renderer provides client-side 3D Tiles visualization. These are presentation/data-delivery components, not authoritative survey or regulatory sources.

## 3. Regulatory rule fabric

Jurisdictional rules are represented as versioned source-bound records rather than global constants.

The initial verified rule set includes:

- **Indiana:** IC 14-28-1 / 312 IAC 10 floodway framework. Indiana DNR states that project evaluation includes floodway capacity, life/property hazard and environmental criteria; its published definition of adversely affecting floodway efficiency/capacity uses a 0.15 ft regulatory-flood elevation increase, subject to stated exceptions. FEMA floodway no-rise requirements and Indiana DNR's separate 0.14 ft cumulative-surcharge administration are represented as distinct rules, not one universal threshold.
- **Illinois:** 17 Ill. Adm. Code Part 3700, Construction in Floodways of Rivers, Lakes and Streams.
- **Kentucky:** 401 KAR 4:060, Stream construction criteria. The regulation includes a technical-data certification requirement for floodway encroachments and defines its regulatory-floodway standard in the regulation itself.

The rule registry records authority, citation, applicability, effective/retrieval metadata, source URL and calculation semantics. A rule may only be used for a regulatory comparison when the requested jurisdiction and applicability conditions match the rule record.

## 4. Engineering computation boundary

backend/engineering/no_rise.py compares paired real HEC-RAS Water Surface outputs and hashes both model artifacts. It intentionally accepts the governing criterion as an explicit input rather than embedding a universal legal threshold.

The production-safe pattern is:

**source rule → applicability resolution → model conditions → paired model outputs → calculation → evidence artifact → human review**

A raw numerical comparison is never sufficient by itself to establish a permit or regulatory determination.

backend/engineering/bishop.py remains a deterministic computational primitive. Its output is an engineering-analysis artifact and is not an automatic design acceptance decision.

## 5. Datum integrity

TSM does not equate a horizontal projected CRS with a vertical datum. CRS, vertical datum, units, source epoch/acquisition metadata and transformation provenance are independent fields.

A source lacking an explicitly verified vertical datum remains UNVERIFIED/source-dependent. No statewide product name is allowed to manufacture a NAVD88 assertion.

## 6. Evidence model

Every authoritative-source ingestion should preserve:

- source identifier and authority;
- exact endpoint/document;
- retrieval timestamp;
- source-native identifiers;
- CRS and units;
- vertical datum when explicitly supplied;
- observation/forecast/model/derivative authority class;
- source payload or artifact hash where available;
- transformation/toolchain metadata;
- review status.

Hashes and manifests establish integrity/tamper evidence. They do not, by themselves, establish legal admissibility or engineering certification.

## 7. AI risk controls

Where AI is used, TSM's governance vocabulary is aligned to NIST AI RMF 1.0's Govern, Map, Measure and Manage functions. NIST describes AI RMF 1.0 as voluntary and is currently revising it; the Trustworthy AI in Critical Infrastructure Profile remains an ongoing NIST development project. TSM therefore treats these controls as engineering governance guidance rather than a regulatory certification.

The current control pattern is:

**Govern → Map context/risk → Measure performance/uncertainty → Manage risk → preserve evidence → require human review for consequential engineering conclusions.**

## 8. Non-claims

The current repository does **not** claim:

- a universal 120 Hz hydraulic solver;
- a production MODFLOW 6/EnKF coupled kernel unless a corresponding executable integration and test contract is present;
- automatic FEMA, Indiana, Illinois or Kentucky permitting/certification;
- a universal compensatory-storage ratio;
- a universal vertical datum;
- legal admissibility from hashing;
- production ML-KEM/ML-DSA cryptographic deployment without corresponding implementation, key management and test evidence;
- WebGPU ray tracing as a required rendering path.

These exclusions are deliberate fail-closed engineering controls.
