# Hydrology Data-Fabric and Model-Readiness Architecture

**Status:** Design baseline; implementation must be validated by CI and qualified engineering review.  
**Scope:** Tri-State Systems Manager (TSM), candidate site AOIs, Indiana DNR hydraulic-model archives, USGS terrain/hydrography, FEMA flood products, and regional USACE studies.  
**Safety boundary:** This workflow is evidence management and decision support. It does not independently authorize engineering design, flood certification, permitting, or regulatory determinations.

## 1. Required separation of concerns

TSM must represent these as separate entities and never infer one from another:

1. **Candidate site AOI** — a user-proposed point, parcel, structure footprint, or study polygon.
2. **Hydrologic catchment** — a drainage area derived from a documented outlet and flow-direction/terrain product.
3. **Hydraulic model domain** — the spatial extent of a named, versioned model and its reach/network.
4. **Evidence package** — immutable source files, source metadata, checksums, acquisition timestamps, licenses/terms, and validation reports.
5. **Engineering decision** — an explicit, human-authored determination tied to evidence versions and a stated intended use.

A street address alone must never transition an AOI to approved, and a model archive's valid ZIP checksum must never transition a model to execution-ready.

## 2. Readiness state machine

Use a monotonic, resilient state progression:

- DISCOVERED: source or AOI is known but not validated.
- INGESTED: bytes and source metadata are captured with immutable identifiers.
- ARCHIVE_VALIDATED: archive integrity, path safety, file inventory, and SHA-256 pass.
- METADATA_VALIDATED: horizontal CRS, units, vertical datum, software/version, model references, and lineage have authoritative evidence.
- SPATIAL_COMPATIBILITY_REVIEWED: model domain, candidate AOI, outlet, catchment, terrain, and relevant reaches have been transformed to a common CRS using a documented operation and reviewed for overlap.
- HYDRAULIC_REVIEW_REQUIRED: inputs and compatibility evidence are assembled; boundary conditions, roughness, structures, calibration, and intended use still require review.
- HUMAN_APPROVED_FOR_DECLARED_USE: a qualified reviewer has recorded identity/role, date, scope, evidence hashes, limitations, and intended use.
- EXECUTION_ELIGIBLE: only when all policy gates pass and an explicit execution adapter is installed, version-pinned, tested, and enabled.
- EXECUTED: an actual solver run produced a run manifest, logs, solver version, inputs, output checksums, and exit status.
- RESULTS_REVIEWED: outputs pass format/physical plausibility checks and human review for the declared use.

Any missing, stale, contradictory, or unparseable evidence leaves the item in its prior state or moves it to BLOCKED. Do not allow a free-form string or a single boolean to bypass prerequisites.

## 3. Source-specific handling

### Indiana DNR HEC-RAS Model Library

Record the DNR model ID, catalog title, basin/county, study purpose, effective date where supplied, HEC-RAS version, source URL or documented retrieval path, original archive checksum, and retrieval timestamp. If a catalog row exposes an internal UNC path rather than a publicly retrievable URL, record download_status: unavailable_from_public_endpoint; do not manufacture a public URL.

Archive QA may verify ZIP CRCs, member path traversal, full SHA-256, and presence of expected files. It must explicitly report that those checks do not establish CRS, datum, spatial coverage, hydraulic correctness, solver compatibility, or engineering approval.

### USACE ERDC/CHL TR-22-4

Treat Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation (February 2022; DOI 10.21079/11681/43441) as a separate, regional Adaptive Hydraulics (AdH) study focused on confluence flow and sediment/navigation-channel alternatives. Do not label it a DNR HEC-RAS project or assume it can be imported into HEC-RAS. Its coordinate and vertical-datum statements apply to that study and are not an automatic transformation recipe for another model or a property elevation.

### Terrain, hydrography, and flood products

For each raster/vector layer, capture provider, product/version, retrieval date, spatial resolution/scale, horizontal CRS, vertical datum and units where applicable, nodata policy, and lineage. Distinguish terrain elevations from bathymetry and hydraulic structures. Record FEMA effective products separately from screening layers and model-derived scenarios. Never silently substitute HAND screening results, regional maps, or a neighboring reach for a regulatory determination.

## 4. CRS and vertical datum controls

- Never apply a blanket elevation offset (including a fixed NGVD 29/NAVD 88 delta) without an authoritative, location-appropriate transformation and recorded operation metadata.
- Store horizontal CRS as an EPSG/WKT identifier where available; store coordinate units and transformation pipeline separately.
- Store vertical datum, units, and transformation provenance explicitly. Unknown datum means BLOCKED.
- Spatial overlays must use a documented common CRS; report transformation software/version and any grid files.
- Validate transformed geometries for plausible extent, units, invalid geometry, empty geometry, and expected AOI/model reach intersection.
- A river-mile interval or county name is not evidence that a parcel is covered by a model.

## 5. Evidence manifest and provenance

Every ingest and run manifest should include:

- stable evidence ID and schema version;
- provider, product/model ID, source URL or retrieval record;
- acquisition timestamp (UTC), published/effective date if known;
- original filename, byte length, SHA-256, media type;
- license/access constraints and retrieval status;
- CRS/datum/units and the source document supporting each;
- validation tool name/version, checks performed, result, and limitations;
- parent evidence IDs and transformation history;
- explicit unknown values rather than inferred defaults.

Never overwrite source bytes in place. Derived products must point to source hashes and transformation parameters.

## 6. Execution adapter contract

Until an authentic, supported adapter is implemented and tested, the pipeline is a preflight/validation workflow only. A production adapter must:

1. identify the exact supported solver executable and version;
2. validate project, plan, geometry, flow, terrain, boundary, and referenced-file closure;
3. reject unrecognized CLI flags and undocumented file-format assumptions;
4. run in an isolated, resource-limited workspace with timeouts and captured stdout/stderr;
5. emit deterministic input manifests and output checksums;
6. fail on nonzero exit, missing outputs, malformed logs, or convergence/volume-balance criteria not met;
7. never synthesize HEC-RAS HDF5 groups, compile undocumented .u01 syntax, or claim convergence from mock log parsers;
8. distinguish adapter smoke test from a scientifically meaningful model run.

No production run may be authorized solely by unit tests, an archive-integrity check, or generated documentation.

## 7. Release gates and test matrix

CI should independently gate:

- schema validation and backward compatibility;
- archive traversal/ZIP-bomb safeguards and reproducible SHA-256 reports;
- CRS and vertical-datum unknowns remaining blocked;
- AOI, catchment, and model domain kept as distinct geometry types;
- stale source, failed fetch, rate limit, and internal-only URL behavior;
- state-machine transition rules, including negative tests for bypass attempts;
- output manifests bound to exact commit, input hashes, tool versions, and run IDs;
- absence of secrets and unsafe external side effects;
- offline runtime build and packaging;
- end-to-end execution tests only where a real, licensed, versioned solver adapter and representative test model are available.

The release summary must enumerate each workflow's latest conclusion for the same main SHA. Empty combined-status results must be reported as no status entries returned, not as green.

## 8. Candidate AOI acceptance checklist

The AOI remains UNAPPROVED until all applicable items are evidenced:

- [ ] Parcel or site boundary from an authoritative source, or a clearly labeled provisional geometry.
- [ ] Geocode/coordinates independently checked against the intended property.
- [ ] Intended question and use declared (screening, planning, design, or regulatory).
- [ ] Receiving outlet and catchment delineation checked against terrain and hydrography.
- [ ] Relevant DNR/FEMA model and effective map products identified.
- [ ] Model domain/reach overlap tested geometrically, not inferred from county, river-mile, or title.
- [ ] Terrain, bathymetry, structures, and model vertical datum reconciled.
- [ ] Boundary conditions, calibration/validation evidence, model version, and scenario suitability reviewed.
- [ ] Qualified human hydraulic reviewer signs a dated, scoped decision.
- [ ] Execution adapter and all CI release gates pass before a solver run.

## 9. Known limits and next implementation order

1. Audit existing readiness enums/schemas and remove any path where READY_FOR_EXECUTION can coexist with execution_blocked: true or missing evidence.
2. Add table-driven tests for the state machine and explicit negative bypass tests.
3. Revalidate all committed ZIP archives from the actual bytes; publish byte length, SHA-256, member inventory, and bounded metadata findings.
4. Implement CRS-aware extent/overlay only after source CRS metadata is resolved; fail closed otherwise.
5. Replace prototype/guessed solver integration with a versioned adapter contract and a real, repeatable test fixture.
6. Reconcile the AOI and catchment using authoritative parcel/site, outlet, terrain, and hydrography inputs.
7. Require a human review record before engineering or regulatory use.

**Release decision:** Archive validation and evidence cataloguing may proceed independently. Site-specific execution, flood-depth claims, design conclusions, and regulatory claims remain blocked until their separate evidence and review gates pass.
