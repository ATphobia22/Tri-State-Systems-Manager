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
- Illinois: 17 Ill. Adm. Code Part 3700, §3700.20 "Floodway" — the
  floodplain portion needed to store and convey the 1% annual-chance flood
  "with no more than a 0.1 foot increase in stage". Verified 2026-10-24
  against the ILGA text. Context exceptions (do not collapse into the
  screen): mapped floodway lines govern where delineated; bridge/culvert
  rules in §3700.70 allow larger at-structure rises (urban: 0.5 ft at
  structure, 0.1 ft 1,000 ft upstream; rural: 1.0 ft / 0.5 ft).
- Kentucky: 401 KAR 4:060, §4(1) — encroachments prohibited unless
  certification demonstrates "no impact" (no increase in base flood
  elevation, floodwater elevations, or floodway width). Verified 2026-10-24.
  The §1/§5 "regulatory floodway" definition is a SEPARATE 1.0 ft boundary
  criterion (the area required to pass the base flood without raising the
  crest more than 1 foot); it does not override the §4 no-impact rule for
  an actual encroachment. §4(2) exceptions exist (open-space uses, certain
  crossings, ≤180-day RVs, 4:020/4:050 exemptions).

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
