# Inter-Agency Data Governance Memorandum

**Status:** working reference, not a legal instrument. This memo describes how
the Tri-State Systems Manager handles multi-agency data; it creates no legal
obligation, asserts no regulatory standing, and certifies no compliance
outcome. Anything submitted to an agency is a *draft supporting artifact*
requiring licensed professional review (`governance_status:
human_review_required`).

**Maintained:** 2026-09-25. Companion code: `tools/evidence/`,
`tools/validation/`, `data/schemas/`, `db/migrations/010_panel_verification_log.sql`.

---

## 1. Purpose

Independent developers and community members routinely work with the same
public datasets agencies use (USGS 3DEP elevation, FEMA NFHL panels, USGS/NWS
gage telemetry, IndianaMap imagery and parcels, USACE structure records).
The recurring failure mode is not data access — it is *provenance*: when a
number moves from a federal dataset into a local filing, nobody can answer
"which file, which version, hashed when, and who reviewed it."

This memo defines the repository's answer: every dataset crossing an agency
boundary is identified, hashed, logged, and gated for human review. The goal
is to remove "administrative ignorance" as an excuse for inaction while never
letting software silently stand in for a licensed professional.

## 2. Data sources and their roles

| Source | Role in TSM | What it is NOT |
|---|---|---|
| USGS 3DEP / Indiana GIO DEMs | Terrain evidence for LAG analysis | Not a substitute for a field survey of a foundation |
| FEMA NFHL / FIRM panels | Regulatory reference geometry | Not a determination of any parcel's flood status |
| USGS / NWS gage telemetry | Observed river stages | Not valid in NAVD88 without a published gage-zero |
| IndianaMap / county parcels | Parcel geometry, assessment context | Not a legal boundary survey |
| USACE structure records | Dam/pool operational context | Not an engineering analysis of dam effects |

Raw gage heights stay in their source datum. Conversion to NAVD88 is blocked
unless a station-specific, validated gage-zero exists (see the hydrologic
datum rule in `tsm-console/src/lib/`). Missing values are reported as
`STALE` / `SOURCE UNAVAILABLE` — never interpolated.

## 3. Provenance controls

1. **Content hashing.** Panel files and evidence payloads are SHA-256 hashed at
   ingest. `tools/validation/verify_panel_hashes.py` re-hashes a file on disk
   and compares it to the latest row in `firm_panel_verification_log`; any
   mismatch or missing row is a hard failure, never a warning.
2. **Append-only audit log.** `db/migrations/010_panel_verification_log.sql`
   creates an insert-only table (UPDATE/DELETE are blocked by trigger) recording
   panel id, file hash, source dataset, LAG/BFE assertions, verifier identity,
   and timestamp. Corrections are new rows.
3. **Evidence packets.** `tools/evidence/generate_evidence_packet.py` emits a
   deterministic, hash-locked JSON artifact conforming to
   `data/schemas/tsm-evidence-artifact-schema-v1.0.0.json`, always marked
   `validation_status: provisional` and `governance_status:
   human_review_required`.
4. **Provenance labels.** Every model output carries a taxonomy label
   (FEMA-effective, State-best, observed, modeled, forecast, unavailable) via
   `tsm-console/src/lib/provenance-labels.ts`.

## 4. Human gates

Software in this repository **informs; it does not decide.** The following are
always true and are encoded, not just documented:

- FIRMette and evidence-packet outputs are drafts (`regulatory_determination:
  false`).
- LOMA/LOMR filings require a licensed professional's signature; the
  repository generates *pre-checked supporting material*, not filings.
- No module asserts legal compliance, BCA validity, or map correctness. The
  Daubert/FRE 702 fields in schemas are descriptive framework metadata, not a
  self-certification.
- Disputed facts (site coordinates, FEMA Community ID, FIRM panel, gage
  datums) are recorded as *disputed* in `docs/OWNER-ACTION-REQUIRED.md` rather
  than resolved by code.

## 5. What this memo does not do

- It does not interpret the Administrative Procedure Act, the National Flood
  Insurance Act, or any regulation, and it offers no legal strategy.
- It does not claim that submitting a well-formed evidence packet obligates
  any agency to act within any timeframe.
- It does not substitute for the free official channels it references (INFIP
  FARA review, FEMA Online LOMC, the local floodplain administrator).

## 6. Suggested handling by recipients

A local floodplain administrator or state reviewer receiving a TSM evidence
packet should treat it as an organized, hash-verifiable *starting point*:
confirm the panel hash against FEMA's published panel, confirm elevations
against a licensed survey or Elevation Certificate, and apply the community's
normal review process. The packet's value is that every number in it can be
traced to a named file and a recorded hash — nothing arrives as an
unattributed assertion.
