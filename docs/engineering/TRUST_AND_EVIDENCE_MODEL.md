# TSM Trust and Evidence Model

## Purpose

This document defines how TSM engineering outputs are produced, verified,
hashed, and approved. It is the corrected record for the "Engineering Trust
& Evidence" material pasted from other-AI sources in October 2026: the
structure below is kept, but every value, policy, and file location is
corrected to the repo's verified state.

## Non-negotiable corrections

- **Regulatory BFE = 369.1 ft NAVD88** (FEMA FIS 18129CV000A Table 9 §A,
  Indiana DNR cross-sections, FIRMette). The pasted 375.0 ft figure is wrong
  and is never used. LAG 377.2 ft is owner-claimed, not certified survey.
  FFE 382.5 ft is unverified and is not used anywhere. Correct freeboard of
  claimed LAG above BFE: **+8.1 ft**, not +2.20 ft.
- **Fail-closed is banned** (user directives 2026-10-19, 2026-10-22,
  2026-10-23). Every pasted `NOT_EVALUATED` / `GATE_BLOCKED_BY_SOLVER_ERROR`
  / `COUPLED_SIMULATION_INVALID` behavior is implemented here as resilient
  behavior: an honest `UNAVAILABLE` (or failure) status, never blocking, exit
  0 where applicable, never interpolating or fabricating values.
- **HEC-RAS cannot execute on this VM** (Windows-only binary, no Docker
  image, kernel denies container namespaces). Solver adapters operate on
  existing outputs and labeled fixtures only. Nothing claims execution.

## Package mapping (pasted layout → existing repo layout)

The pasted material proposes a new `packages/` tree. That tree is NOT
created: the repo already has these packages, and a parallel tree would
duplicate them. Mapping:

| Pasted proposal | Existing repo location |
|---|---|
| `packages/contracts/` | `packages/contracts/` (capabilities, errors) |
| `packages/evidence-runtime/` (EvidenceCollector) | `packages/evidence/` (stableJson, hashEvidencePayload) + `backend/evidence/canonical_hash.py` (Python canonical stringifier — fixes the paste's `JSON.stringify` array-replacer bug, which drops nested keys) |
| `packages/verification/` | `packages/validation/` + `packages/gates/` (gage conversion, human-authority seal) + `backend/evidence/` (gage datum, replay) |
| `packages/engineering/solvers/` | `backend/engineering/` (Bishop, HEC-RAS HDF5) + `backend/evidence/solver_extractors.py` |
| `packages/openmi/` | `backend/openmi_contract.py` + `backend/openmi_service.py` (live gRPC profile) + `backend/openmi_exchange.py` (explicit exchange extension) |
| `packages/grpc-engineering/` | `tsm-console/proto/openmi.proto` (live) + `tsm-console/proto/engineering.proto` (contract only, no service claimed) |
| `packages/gates/` (governance gate) | `backend/governance/archimedes_engine.py` (already exists; screening only) |

## Principles

Repeatability, verifiability, traceability, transparency. Human authority
is final: no automated path approves a permit, waiver, or filing
(`canApprove` is always false; Archimedes returns a screening, never a
regulatory determination).

## Evidence requirements

Every run generates: input hash, model hash, config hash, output artifact
hashes, and an evidence bundle hash (SHA-256 over the canonical JSON body).
Sealing is idempotent; verification recomputes the hash and fails on any
tampering. See `backend/evidence/canonical_hash.py` and
`backend/evidence/solver_extractors.py`.

## Failure states

`FAILED`, `TIMEOUT`, `CANCELLED`, `NON_CONVERGENT`, `DATA_ERROR`,
`UNIT_MISMATCH`, `DATUM_MISMATCH`, `VERIFIED`, `UNAVAILABLE`. A failure
status is a sealed record, not a crash and not a block: the caller keeps
running and the failure is visible in the evidence.

## Execution lifecycle

DRAFT → GENERATED → VERIFIED → SIGNED → APPROVED → SUPERSEDED.
SIGNED requires a valid signature; APPROVED requires the human governance
workflow (reviewer identity + review reason). Nothing auto-advances.

## What is deliberately NOT implemented

- No new parallel `packages/` tree (see mapping above).
- No OpenMI runtime adoption: OGC 11-014r3 is dormant (~2010, Java/C#
  only, no maintained Python implementation). If coupling is ever needed,
  evaluate CSDMS BMI instead. See `OPENMI_SPEC.md`.
- No solver execution claims, no synthesized gauge data, no FFE 382.5 ft.
- No estate/will/trust/deed content, no agency submissions, no artifact
  publishing from this work.

## Related docs

`OPENMI_SPEC.md`, `GRPC_EXECUTION_SPEC.md`, `GAGE_DATUM_AND_STAGE.md`,
`REPLAY_VERIFICATION.md`, `SCIENTIFIC_VALIDATION.md`,
`../regulatory/312-IAC-10-VERIFIED-RULES.md`.
