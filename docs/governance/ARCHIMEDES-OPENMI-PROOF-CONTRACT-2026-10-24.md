# Archimedes / OpenMI governance integration research

**Research snapshot:** 2026-10-24  
**Status:** Design and implementation contract; not a legal opinion or a certified engineering method.

## 1. Existing repository artifacts inspected

- `backend/governance/archimedes_engine.py`: existing read-only screening engine, state rule source map, stage/BFE and surcharge screening, proof manifest SHA-256.
- `backend/tests/test_archimedes_engine.py`: existing state screening and unsigned-manifest tests.
- `scripts/verify-backend-invariants.py`: backend smoke test and CRS/HEC-RAS boundary checks.
- `data/schemas/tsm-four-plane-architecture-v1.json` and `docs/FOUR-PLANE-ARCHITECTURE.md`: canonical ADR-005 plane map. Plane 1 owns authoritative evidence; Plane 2 is non-authoritative simulation; Plane 3 owns jurisdiction profiles and human approval; Plane 4 is non-authoritative visualization.
- `docs/ADR-006-Agentic-Autonomy-Ladder-and-Tool-Scope-Policy.md`: S1 deterministic services as production default; human approval for consequential outputs.
- `backend/api/v1/hecras_solver.py`: rejects synthetic hydraulic fallback and inspects real HEC-RAS result artifacts.

No repository evidence was found for a production OpenMI 2.0 runtime or an existing `solver_link.proto`. Treat gRPC as a proposed transport adapter, not as proof of OpenMI conformance.

## 2. Regulatory source register — use as screening inputs only

### Indiana

- Primary text: [Indiana Administrative Code, Title 312, Article 10](https://iar.iga.in.gov/code/current/312/10).
- Specific provision: **312 IAC 10-2-3** defines “adversely affect the efficiency of, or unduly restrict the capacity of, the floodway” by an increase of at least **0.15 ft** between project and base condition, with exceptions listed in the rule.
- The engine must not interpret this definition as a universal project permission threshold. FEMA floodway no-rise certification/CLOMR, local ordinances, permit type, flood easements, and other exceptions are separate review pathways.
- Related statute: [IC 14-28-1](https://iga.in.gov/laws/2025/ic/titles/14#14-28-1) (confirm current code revision before operational legal reliance).

### Illinois

- Primary text: [17 Ill. Adm. Code Part 3700, Construction in Floodways](https://www.ilga.gov/agencies/JCAR/EntirePart?titlepart=01703700).
- Section **3700.20** defines floodway using a **0.1 ft** stage-increase criterion for loss of conveyance/storage in delineation.
- Section **3700.60** is context-dependent: absent contrary evidence, profile increase may be contained within channel banks/flood easements; in urban areas the cited criterion is **0.1 ft**; in rural areas **0.5 ft**, alongside velocity/scour controls. Do not encode a universal 0.1 ft cap for every project.
- Applicability and exemptions must be checked against the actual section and project.

### Kentucky

- Primary text: [401 KAR 4:060, Stream Construction Criteria](https://apps.legislature.ky.gov/law/kar/titles/401/004/060/).
- The definition of **“no impact”** requires a licensed-engineer certification that an encroachment does not increase base flood elevation, floodwater elevations, or floodway width during base flood discharge.
- The separate regulatory-floodway boundary definition uses up to a **1.0 ft** rise criterion. This is not permission for an individual encroachment to create a one-foot rise where a no-impact certification is required.
- Verify current local/FEMA mapping, the regulator's jurisdiction, and the exact permit pathway.

### Legal data policy

- Store every rule as a versioned policy record with: jurisdiction, citation/section, official URI, source retrieval timestamp, effective/revision metadata when available, source-content hash, applicability conditions, exception notes, review status, and reviewer identity.
- A source URI is not itself a captured citation. Preserve the exact source text or stable official snapshot and hash it.
- Rule edits require human legal/regulatory review and tests. A threshold pass is never represented as permit approval or legal compliance.

## 3. OpenMI, gRPC, provenance, and digital twin standards

- [OGC OpenMI 2.0 (OGC 11-014r3)](https://docs.ogc.org/is/11-014r3/11-014r3.html) defines an interface for runtime data exchange between independently developed models. It uses exchange items and GetValues/SetValues; adaptors can handle units, temporal/spatial transformations, and representations. **OpenMI is a modelling interface standard, not a synonym for gRPC.** A gRPC bridge must map to explicit OpenMI concepts and document unsupported semantics.
- [gRPC deadlines](https://grpc.io/docs/guides/deadlines/) should bound each remote call. Set explicit per-call deadlines, propagate cancellation, and distinguish transport failure from solver non-convergence. Never convert timeout/missing response into a numeric value.
- [Protocol Buffers compatibility guidance](https://protobuf.dev/programming-guides/proto3/) favors additive field evolution; reserve deleted field numbers/names and version contracts intentionally.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) supplies useful entity/activity/agent concepts for input datasets, solver runs, transformations, evidence artifacts, and reviewers.
- [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html) describes cross-implementation canonical JSON for cryptographic operations. The current Python engine uses a narrower, documented Python serialization profile; do not claim RFC 8785 interoperability until a conforming JCS implementation and test vectors are adopted.
- [IDTA AAS specifications](https://industrialdigitaltwin.io/aas-specifications/) define the Asset Administration Shell metamodel and interoperable submodel concepts. AAS should be an optional asset/lifecycle interoperability layer; it does not replace TSM's source provenance, solver contract, or governance gate.
- [FRE 702 (Cornell LII)](https://www.law.cornell.edu/rules/fre/rule_702) concerns expert testimony. Hashing is integrity evidence only; it does not itself establish admissibility, expert qualification, scientific validity, or chain of custody.

## 4. Archimedes contract

### Plane boundaries

1. **Plane 1 — Evidence & Data Governance:** captures authoritative source/model artifacts, source URI and revision, solver executable/version, input/output hashes, CRS and vertical datum, units, timestamps, freshness, and lineage.
2. **Plane 2 — Scientific & Simulation:** runs physics solvers and emits explicit success/failure/non-convergence states plus validated output artifacts. It never makes a legal decision.
3. **Plane 3 — Governance & Decision:** reads immutable Plane 1/2 evidence; performs versioned deterministic screening; emits triggers, missing-input reasons, and a proof manifest. It is read-only with respect to raw physics fields.
4. **Plane 4 — Visualization:** displays the screen and evidence links; cannot mutate rule outcomes or authorize decisions.

### Fail-closed states

- `NOT_EVALUATED`: missing model identity, source evidence digest, required elevations, applicable floodway context, or known freshness.
- `GATE_BLOCKED_BY_SOLVER_ERROR`: reserved for orchestration/API surfaces when the solver reports failure, missing executable, timeout, or non-convergence. The current Python screening contract emits `NOT_EVALUATED` with an explicit solver-status reason rather than claiming a completed screen.
- `EVALUATED`: inputs are explicitly supplied, model status is SUCCESS, input freshness is FRESH, and relevant floodway context is known.
- `SCREENED_NO_TRIGGER` / `SCREENED_WITH_TRIGGERS`: screening result only; `regulatory_determination` remains null and `human_review_required` remains true.

Never silently interpolate stale telemetry. If interpolation is scientifically authorized in a future workflow, it must be a named Plane 2 transformation with a method/version, uncertainty, input lineage, and explicit opt-in; it must not occur inside Archimedes.

## 5. Deterministic proof manifest

1. Validate schema and finite numeric values; reject NaN, infinities, booleans-as-numbers, malformed digests, unknown rule contexts, and unsupported engine versions.
2. Freeze an evaluation body containing input values/units, horizontal CRS and vertical datum separately, jurisdiction context, source citations/revisions, model and solver versions/status, input/output evidence hashes, freshness, rule-set version, and the screen result.
3. Canonicalize the complete manifest payload excluding the hash field. Current profile: sorted JSON keys, compact separators, UTF-8, Unicode preserved, non-finite JSON values rejected. Profile name is included in the manifest.
4. Compute `proof_hash_sha256 = SHA256(canonical_payload_bytes)`.
5. Verification removes only `proof_hash_sha256`, repeats canonicalization and digest calculation, and uses constant-time digest comparison.
6. Human identity/reason are metadata, **not a cryptographic signature**. Governance stays `human_review_required`. A later approval feature must verify a detached digital signature against a trust policy and preserve key ID, algorithm, signed digest, certificate/revocation status, and signature timestamp.
7. Store the manifest in the durable evidence ledger as an immutable artifact; hash chaining/Merkle inclusion may prove ordering/inclusion only when the tree root, inclusion proof, and external anchoring are also retained.
8. Keep the execution timestamp in the evaluation input record. Repeated manifest generation for the same frozen evaluation must produce the same hash; separate executions with different timestamps may legitimately have different hashes.

## 6. OpenMI/gRPC solver-link ICD — proposed, not deployed

Every exchange item should include:
- stable `element_id`, `quantity_id`, provider/consumer component IDs, model-run ID, contract version;
- typed values and unit identifier; no unitless numeric quantities;
- time instant/interval and calendar/time-zone convention;
- spatial support/element reference and CRS; vertical datum for elevations/head;
- quality/status enum, freshness/validity interval, and uncertainty where defined;
- source/input digest and output digest;
- explicit failure status (timeout, missing binary, solver error, non-convergence, invalid units/CRS).

Transport requirements:
- explicit deadlines and cancellation; bounded message sizes; authentication/mTLS where deployed; no credentials in protobuf payloads;
- no silent unit conversion or CRS/datum substitution; conversions are named, versioned transformations;
- no synthetic fallback. A failed dependency or invalid exchange prevents downstream evaluation;
- backward-compatible protobuf evolution; never reuse deleted field numbers;
- conformance tests for unit conversion, time-step ordering, missing data, stale data, duplicate/reordered messages, solver crash, timeout, non-convergence, and deterministic replay.

## 7. Implementation backlog and release gates

### P0 — governance correctness
- [x] Keep regulatory determination null and human review mandatory.
- [x] Require model ID, evidence SHA-256, solver success, fresh inputs, and known floodway context before numeric screening.
- [x] Fail closed on missing/stale/unknown inputs and solver failure states.
- [x] Distinguish Illinois urban/rural/delineation criteria.
- [x] Use finite-number validation and reject bool/NaN/infinity.
- [x] Make proof-manifest generation deterministic for a frozen evaluation.
- [x] Add integrity verification and tests for tampering.
- [ ] Legal reviewer verifies each rule profile against the current official text and applicable local/FEMA requirements.

### P1 — Plane 1/2 evidence contract
- [ ] Add versioned solver-run and telemetry schemas with explicit CRS, vertical datum, units, freshness, solver status, uncertainty, and hashes.
- [ ] Connect actual HEC-RAS HDF5, MODFLOW 6/FloPy, and slope-stability artifacts; no generated/synthetic substitute.
- [ ] Capture executable/container versions, input manifest, convergence diagnostics, and output hashes.
- [ ] Add durable evidence ledger storage and retention/immutability controls.

### P2 — OpenMI/gRPC adapter
- [ ] Publish a versioned protobuf contract and generated-code workflow after owner review.
- [ ] Implement OpenMI exchange-item mapping in an adapter layer; do not claim conformance from protobuf alone.
- [ ] Add deadline/cancellation, status mapping, unit/datum validation, and bounded payloads.
- [ ] Add integration tests using deterministic fake solvers and at least one approved real solver fixture.

### P3 — AAS interoperability
- [ ] Define an AAS Submodel Template for model-run provenance and infrastructure asset identity only after choosing a specific lifecycle aspect.
- [ ] Preserve template semantic IDs and cardinality; include links to TSM evidence artifacts rather than copying mutable evidence into an AAS payload.
- [ ] Validate sample AAS instances against the selected metamodel/schema version.

### CI release gates
- [ ] Unit tests for all three jurisdiction contexts and boundary values.
- [ ] Fail-closed tests for solver error, stale/missing inputs, missing evidence, unknown context, malformed hash, and absent elevations.
- [ ] Golden vectors for canonicalization/hash verification and tamper detection.
- [ ] Verify proof manifest is unsigned unless a future signature verifier actually validates a signature.
- [ ] Contract tests for OpenMI/gRPC statuses, deadlines, unit/CRS/datum mismatch, and schema compatibility.
- [ ] CI fails if a rule citation URI, verified date, policy version, or legal-review state is missing.
- [ ] Human legal/engineering sign-off remains a release artifact, not an automated CI assertion.

## 8. References

- Indiana Administrative Code: https://iar.iga.in.gov/code/current/312/10
- Illinois Administrative Code: https://www.ilga.gov/agencies/JCAR/EntirePart?titlepart=01703700
- Kentucky Administrative Regulations: https://apps.legislature.ky.gov/law/kar/titles/401/004/060/
- OGC OpenMI 2.0: https://docs.ogc.org/is/11-014r3/11-014r3.html
- gRPC deadlines: https://grpc.io/docs/guides/deadlines/
- Protocol Buffers proto3 guide: https://protobuf.dev/programming-guides/proto3/
- W3C PROV-O: https://www.w3.org/TR/prov-o/
- RFC 8785 JCS: https://www.rfc-editor.org/rfc/rfc8785.html
- IDTA AAS specifications: https://industrialdigitaltwin.io/aas-specifications/
- Federal Rule of Evidence 702: https://www.law.cornell.edu/rules/fre/rule_702
