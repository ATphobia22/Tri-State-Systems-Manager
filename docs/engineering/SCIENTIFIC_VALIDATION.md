# Scientific Validation

## Three levels (all required before production approval)

1. **Software verification** — does the code run correctly? (Contract
   tests: solver crash → `FAILED`, timeout → `TIMEOUT`, non-convergence →
   `NON_CONVERGENT`, hash tampering detected, stale telemetry rejected,
   unit mismatch rejected, datum mismatch rejected, replay equivalence.)
2. **Numerical verification** — does the solver converge correctly?
   (Convergence recorded per run; mass-balance error within threshold for
   MODFLOW 6 — 1.0%; Bishop iteration count and tolerance recorded.)
3. **Physical validation** — does the output match reality? (Comparison
   against authoritative observations — gage records, surveyed sections,
   published FIS values — with provenance. A model that converges but
   contradicts observation is not validated.)

## Regulatory audit trail

Every run carries: input hash, model hash, config hash, output hashes,
evidence bundle hash, CRS, vertical datum, units, solver name/version,
status, and reviewer status (`human_authorized` vs
`human_review_required`). Nothing is auto-approved: the Archimedes engine
is advisory (S1) and human authority remains final.

## Verified regulatory rules used by the gate

- Indiana: 312 IAC 10-2-3 adverse-effect criterion, **0.15 ft** cumulative
  rise. Source: `docs/regulatory/312-IAC-10-VERIFIED-RULES.md` (extracted
  rule text). The pasted claims of a 1.20x compensatory-storage mandate
  and a 2.0-ft freeboard mandate under 312 IAC 10 were searched in the
  full rule text and NOT FOUND — they are not implemented.
- Illinois: 17 Ill. Adm. Code Part 3700 floodway screen, 0.1 ft maximum
  stage increase (as encoded in `backend/governance/archimedes_engine.py`;
  re-verification against the current ILGA text is tracked in the
  verification table for this work).
- Kentucky: 401 KAR 4:060 no-impact screen for floodway encroachments,
  with a separate 1.0 ft floodway-boundary criterion (same note as above).

## Definition of scientific readiness

The platform is scientifically ready only when: evidence is recorded for
every solver run; success is verified by outputs, not exit codes; units,
CRS, and vertical datums are validated; OpenMI exchanges are explicit;
gRPC contracts support deadlines and cancellation; signatures are
verified; replay validation succeeds; failure states are tested; hash
tampering is detectable; and HEC-RAS, MODFLOW 6, and slope-stability
adapters provide auditable evidence. HEC-RAS and MODFLOW 6 adapters here
operate on existing outputs and labeled fixtures — neither claims live
execution on this VM.
