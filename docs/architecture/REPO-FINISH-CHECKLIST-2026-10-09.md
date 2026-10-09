# Repo finish checklist — 2026-10-09

## Done on main

- [x] UACF migrations 090–095 (hydrology, simulation, evidence, render, FEMA, grants)
- [x] Gates: gage conversion fail-closed, LAG≥BFE helper, human authority seal
- [x] ADR-006 Autonomy Ladder (S1/S2/S3) in agent-runtime + UniversalAgent
- [x] Billing disabled; local-first research scaffold
- [x] providers/local hydrology + gates capabilities
- [x] packages/geo + hydraulics authority classifier
- [x] plugins: hydrology, grants, evidence-ledger
- [x] verify:uacf includes gates/autonomy/local-hydrology tests
- [x] Self-hosted Cesium `/terrain-3d` + `/globe` + `/platform` on main
- [x] CapabilityId extended for `gates.*` / `hydrology.*` / `evidence.*` (this commit)
- [x] No open pull requests

## Operator (GitHub UI)

- [ ] Delete branch `feat/self-hosted-cesium-3dtiles` (SHA matches main; fully integrated)
- [ ] Confirm UACF Kernel CI green after this commit
- [ ] Confirm Tri-State CI Pipeline green on latest main

## Explicit non-goals (do not “finish” by inventing)

- Auto LOMA / grant submission
- Publishing gage `conversionPublished=true` without human verification
- Commercial billing / cloud LLM as default
- Treating 3DEP terrain as survey-grade or FEMA authority

Human authority remains final.
