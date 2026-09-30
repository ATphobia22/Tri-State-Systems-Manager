# TSM Engineering Evidence Gate

The UACF engineering gate is intentionally fail-closed.

## Seven required modules

1. Controlled survey
2. Geotechnical investigation
3. Groundwater evidence
4. Qualified fill
5. Laboratory results
6. Hydraulic boundary conditions
7. Approved project geometry

A structurally complete JSON object is not equivalent to engineering approval.

## Gate states

`INPUT_INCOMPLETE` → required object or collection is absent.

`EVIDENCE_REQUIRED` → structure exists but no evidence reference is attached.

`PROVENANCE_INVALID` → evidence is unverified, discovery-only, synthetic, or contradictory.

`ENGINEERING_REVIEW_REQUIRED` → the deterministic input contract is complete, but human engineering acceptance is still required.

The current implementation intentionally does not return `READY_FOR_DETERMINISTIC_COMPUTATION`; that state is reserved for a future controlled approval workflow.

## Synthetic fixtures

Tests may use synthetic values, but every such fixture must remain marked `SYNTHETIC_TEST_ONLY`. Synthetic values never satisfy a production evidence gate.

## UACF capability

`tsm.engineering.evidence-gate.evaluate`

Permission:

`tsm:engineering`

The capability returns the gate state, validation diagnostics, payload hash, and readiness flags. It does not mutate engineering state and cannot approve a design.
