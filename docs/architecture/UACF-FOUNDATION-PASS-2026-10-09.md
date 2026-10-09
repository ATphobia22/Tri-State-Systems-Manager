# UACF Foundation Pass — 2026-10-09

Executed in order **A → B → C → D** on `main`.

## A — Migrations

| File | Purpose |
|------|---------|
| `090_tsm_hydrology.sql` | Gage stations/observations; conversionPublished fail-closed |
| `091_tsm_simulation.sql` | Simulation runs + mesh centroids; human auth required for seal |
| `092_tsm_evidence.sql` | Evidence artifacts + Merkle fields |
| `093_tsm_render.sql` | Render/tiles provenance; non-authoritative by default |
| `094_tsm_fema.sql` | FIRM panel SSOT + LOMC cases; `auto_file=false` |
| `095_tsm_grants.sql` | Grant tracking only; human action required |

## B — Gates

`packages/gates`: gage→NAVD88 conversion, LOMA LAG≥BFE helper, human authority seal, engineering gate still **canApprove: false** always.

## C — Agent / Core (ADR-006)

`AutonomyLadder`: S1 default allow-list, S2 human-gated, S3 denied. Wired into `AgentRuntime` and `UniversalAgent`.

## D — Prune / disable non-helping

`packages/billing`: commercial ledger **disabled** (throws `BILLING_DISABLED`). Research package given local-first scaffold with regulatory-claim filter.

## Non-goals

- No auto LOMA or grant submission
- No cloud LLM provider enablement
- Human authority remains final
