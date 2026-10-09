# Repo finish checklist — 2026-10-09

## Done on main

- [x] UACF migrations 090–095 (hydrology, simulation, evidence, render, FEMA, grants)
- [x] Gates: gage conversion fail-closed, LAG≥BFE helper, human authority seal
- [x] ADR-006 Autonomy Ladder (S1/S2/S3) in agent-runtime + UniversalAgent
- [x] Billing disabled; local-first research scaffold
- [x] providers/local hydrology + gates capabilities
- [x] packages/geo + hydraulics authority classifier
- [x] plugins: hydrology, grants, evidence-ledger (+ package-lock workspace links)
- [x] verify:uacf includes gates/autonomy/local-hydrology tests
- [x] CapabilityId extended for `gates.*` / `hydrology.*` / `evidence.*`
- [x] provider-runtime duplicate export TS2300 fixed
- [x] Float-safe gage/LOMA contract asserts
- [x] Self-hosted Cesium `/terrain-3d` + `/globe` + `/platform` on main
- [x] Local: `tsc -p tsconfig.uacf.json --noEmit` clean
- [x] Local: 47/47 `tests/contracts/*.test.ts` pass
- [x] Local: `validate-self-hosted-cesium.mjs` pass
- [x] **UACF Kernel CI green** on `f4dbf4fe` (run 157) and prior `191ff432` (run 155)
- [x] No open pull requests

## Operator (GitHub UI — optional cleanup)

Integrated branches point at the same SHA as `main` and are safe to delete:

- [ ] Delete `feat/self-hosted-cesium-3dtiles`
- [ ] Delete `fix/uacf-provider-runtime-duplicate-exports`

(Connector cannot delete branches; use GitHub → Branches → delete.)

## Explicit non-goals (do not invent)

- Auto LOMA / grant submission
- Publishing gage `conversionPublished=true` without human verification
- Commercial billing / cloud LLM as default
- Treating 3DEP terrain as survey-grade or FEMA authority

Human authority remains final.
