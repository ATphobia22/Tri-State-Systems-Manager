# TSM Merkle evidence standard and outstanding acceptance gates

**Effective for new TSM evidence bundles beginning 2026-11-09.** This is an engineering implementation policy, **not** professional accreditation or agency approval.

## Required content-addressed chain

All new evidence in the government data fabric, surveying, building reconciliation, hydrologic coupling, model-output publication, review packets and release claims must be committed through a versioned Merkle dossier.

Each raw artifact has a SHA-256 digest and byte length. The leaf is compact, UTF-8, sorted-key JSON with exactly:

```json
{"byteLength":123,"path":"path/in/dossier.ext","role":"source","sha256":"<64 lowercase hexadecimal chars>"}
```

**Algorithm**: RFC 9162 SHA-256 binary hash tree, `leaf=SHA256(0x00 || leaf_bytes)`, `parent=SHA256(0x01 || left || right)`; for an uneven tree split at the largest power of two strictly smaller than the leaf count. Leaf ordering is **(role, relative path)** ascending. Empty tree hash is `SHA256("")`, but **empty dossiers are rejected**. Avoid self-referential manifests: the manifest commits raw artifacts, not its own serialization. Validate all original bytes and reject path traversal, symlinks and duplicated entries before claiming an artifact has been verified.

The Python core is `backend/merkle_evidence.py`; it supports `build`, `verify` and `prove` CLI modes. The browser/offline console verifies file hashes and inclusion proofs via `tsm-console/src/lib/merkle-evidence-verifier.ts`. Hydrologic run checks bind the immutable input/output bytes, solver versions and validation/exchange declarations; the official Posey retrieval receipt binds the archived delta, exact query and returned GeoJSON. The survey checkpoint gate requires Merkle-verified observations, independent reference, and acceptance specification. Regulatory packet intake requires matching Merkle-bound raw source documents, technical input/output/report and decision document if supplied.

### Example

```bash
python -m backend.merkle_evidence build --root . \
  --artifact source docs/evidence/POSEY-LIVE-CANDIDATE-RETRIEVAL-2026-11-09.json \
  --artifact governance docs/governance/SCIENTIFIC-AUTHORITY-AND-AGENCY-DECISION-GATES.md \
  --output /tmp/tsm-evidence-merkle.json

python -m backend.merkle_evidence verify --root . \
  --manifest /tmp/tsm-evidence-merkle.json

python -m backend.merkle_evidence prove \
  --manifest /tmp/tsm-evidence-merkle.json \
  --role source \
  --path docs/evidence/POSEY-LIVE-CANDIDATE-RETRIEVAL-2026-11-09.json \
  --output /tmp/posey-source-proof.json
```

The output Merkle root and any proof must be independently checked against a **trusted signed tree head**. `backend/merkle_transparency_log.py` is a local append-only SQLite log of full-dossier roots with prefix-root and inclusion verification; database triggers reject ordinary rewrites. A privileged database administrator can still replace the database/triggers. Production use requires independently authenticated, retained, publicly auditable signed checkpoints, key rotation and revocation policy, external log witnesses and RFC 9162 consistency-proof auditing. **Those external trust anchors are NOT implemented.** No root by itself proves source origin, scientific correctness, a license or a government decision.

## Independent reproducibility requirements

- **Sources**: original agency bytes, product/service version, retrieval/effective time, published hash, coverage, CRS, vertical datum, geoid, units, restrictions, uncertainty, acquisition epoch.
- **Survey control**: actual independent original observation files, control-point documentation, least-squares residuals and covariance, instrument calibration, specified accuracy/coverage, vertical benchmark and appropriate professional supervision. `backend/survey/independent_control_gate.py` computes transparent RMSE and a deliberately conservative *project-specified screening* uncertainty; it does not claim an ASPRS quality class.
- **Hydrology**: verified executable/version/license, HEC-RAS HDF + logs, MODFLOW 6 heads/budget/listing, SWMM INP/RPT/OUT, model geometry, full boundary/forcing and parameter files, mass-conservation diagnostics, numerical stability, time coupling and unit/datum agreement. Use independently acquired stage/discharge observations, separate calibration and verification periods, sensitivity and mesh/time-step convergence studies. Synthetic known-answer tests do **not** establish Posey flood-depth accuracy.
- **Buildings**: archived source of 23,082 IGIO footprints; 22,815 published features; 267 live source ID candidates already retrieved. `scripts/geospatial/verify_posey_candidate_reconciliation.py` requires exact hashes and full archived source to compare source IDs, geometries and vintage. It never fabricates building heights or promotes live 2D candidates into the 3D engineering inventory. Release validation additionally requires all heights/geodetic and 3D Tiles/HLOD checks.
- **Licensed review**: signed professional documents, discipline and state-specific active license evidence, scope, conflicts and reviewer identity, independent authenticity of seal/signature. No automated attestation can substitute for a PE/PLS legal review.
- **Agency decisions**: exact FEMA/FIS/NFHL effective scope, LOMA/LOMR/CLOMR case or applicable state/local permit, official issuer and signed instrument, effective conditions, registry lookup, geospatial applicability and expiry. A CLOMR is conditional, not a final map revision. No software-only "approval" status.

## Status classes

| Class | Meaning |
|---|---|
| `EVIDENCE_HASHED` | Original bytes have been hashed and entered in a Merkle dossier; authenticity is not asserted |
| `PROOF_VERIFIED` | Inclusion and raw file digest were recomputed against a given root |
| `BENCHMARK_CHECK_PASSED` | Bounded numerical tests passed against explicitly identified reference; not a calibrated field model |
| `SURVEY_NOT_EVIDENCED` | Independent measured control and/or registered surveyor sign-off is absent |
| `PROFESSIONAL_REVIEW_PENDING` | External licensed reviewer record has not been independently authenticated |
| `AGENCY_DECISION_NOT_EVIDENCED` | No case-scoped signed agency instrument was authenticated |
| `REGULATORY_APPROVED` | Reserved for independently verified operative agency decision for named property/project and scope, never auto-set |

## CI and release discipline

1. `.github/workflows/merkle-evidence.yml` verifies Python RFC tree vectors, tampering, SQLite append-only log, survey checkpoint claims, official source record commitment, and browser WebCrypto proof parity.
2. `.github/workflows/hydrologic-coupling-evidence.yml` tests solver evidence and declared mass-balance/convergence/benchmark rules using **synthetic fixtures**.
3. `.github/workflows/posey-official-building-candidates.yml` tests recovery and archived reconciliation. The prior archived asset download received HTTP 504 even though the GitHub release exists; an authenticated `gh release download` fallback is configured. A failed external download must remain explicit; it is not evidence that the full inventory has been verified.
4. Main CI, Windows UE Shipping packaging, complete 23,082-building 3D inventory, authoritative cross-section/field observations, professional certification and agency approvals are independent gates. Do not infer release readiness from the Merkle, synthetic solver or database contract checks.

### Primary technical authorities

- RFC 9162: https://www.rfc-editor.org/rfc/rfc9162.html
- FEMA mapping process: https://www.ecfr.gov/current/title-44/part-65
- USACE HEC-RAS verification: https://www.hec.usace.army.mil/software/hec-ras/documentation/RD-52_HEC-RAS%20Verification%20and%20Validation.pdf
- USGS 3DEP: https://www.usgs.gov/ngp-standards-and-specifications/3d-elevation-program-standards-and-specifications
- NIST metrological traceability: https://www.nist.gov/metrology/metrological-traceability
