# Artifact Update Scan — 2026-10-19

**Scope:** Search for repo content not yet reflected in the public artifacts (dashboard + console).
**Already covered (excluded):** BFE 369.1 correction, Unified Digital Twin Blueprint, Flood Forecasting Stack (3 forks/10 steps), Repository Health & Data Strategy, Fork Integrations in console Tools tab.

---

## 🔴 FINDING 1: Six user-facing console files still show stale BFE 375.0 ft

The 2026-10-18 BFE correction (369.1 ft NAVD88) was applied to `scientific-analytics.ts`, `site.ts` (packages/geo), `LomaLagBfeChecklist.tsx`, and `floodScenario.ts` — but **six user-facing console files were missed** and still display or compute from the old 375.0 ft value. These ship in the published console artifact.

| File | Line(s) | What's stale | User impact |
|------|---------|--------------|-------------|
| `tsm-console/src/components/FloodScenarioAnimation.tsx` | 96, 99 | `targetM: 375.0 * FT_TO_M` + label "Target 375.0 ft NAVD88 — working BFE (FIRM 18129C0265C); UNVERIFIED" | Animation targets wrong elevation; label contradicts the corrected BFE card |
| `tsm-console/src/components/CinematicTwinHud.tsx` | 127 | HUD text "BFE 375.0 ft" | Heads-up display shows wrong BFE to every viewer |
| `tsm-console/src/routes/CinematicView.tsx` | 38 | BFE layer: `topFt: 375.0`, "BFE 375.0 ft NAVD88 from the FEMA case record" | 3D BFE plane renders 5.9 ft too high |
| `tsm-console/src/lib/flood-sim/workbench.ts` | 62 | Note: "BFE 375.0 / LAG 377.2 / FFE 382.5 / BERM 379.8 ft NAVD88" | Flood workbench disclaimer cites wrong BFE |
| `tsm-console/src/types/site.ts` | 77, 88 | `bfe_ft: 375.0`, `clearanceAboveBfe_ft: 2.2`, provenance "checklist BFE 375.0" | Site type defaults wrong; clearance should be 8.1 ft (377.2 − 369.1), not 2.2 ft |

**Artifact-worthy:** YES — all five are user-facing. The clearance value (2.2 → 8.1 ft) is the most visible error since it changes the flood-safety narrative.

**Recommended update:** Change all `375.0` → `369.1` with FIS 18129CV000A Table 9 citation; change `clearanceAboveBfe_ft: 2.2` → `8.1` and its derivation string. Rebuild + republish console.

**Intentionally NOT flagged (internal/historical):**
- `*.test.ts` files, Storybook stories (`LomaLagBfeChecklist.stories.tsx`) — test fixtures
- `tsm-console/src/data/poseyEvidence.ts:189` — documents the historical 375.0 claim as evidence (correct to keep)
- `tsm-console/src/data/posey408Review.ts:11` — review record of the 375.0 claim (correct to keep)
- `scripts/verify-backend-invariants.py` — explicit test fixture ("not application/site defaults")
- restricted historical case packet evidence (retained outside the public/runtime plane)
- `scripts/flood-forecasting/bfe_ingestion.py` — documents 375.0 as the superseded working target

---

## 🟡 FINDING 2: FFE 382.5 ft still presented without verification flag in console

**Files:** `tsm-console/src/lib/scientific-analytics.ts:49`, `tsm-console/src/types/site.ts:79`, `tsm-console/src/routes/CinematicView.tsx:41`, `tsm-console/src/lib/flood-sim/workbench.ts:62`

**Status:** Currently labeled as "case record" / "owner-supplied" / "FFE 382.5 ft from the case record" — honest provenance labeling, but the value is **unverified** (traced to the Archemidese gdoc, same risk pattern as the corrected 375.0 BFE). The parent agent asked the user whether to flag it; no answer yet.

**Artifact-worthy:** YES (conditionally). If the user confirms flagging, the console should show "FFE 382.5 ft (unverified — confirm against LOMA 26-05-2022A documents)" instead of presenting it as a case-record value.

**Recommended update:** Await user decision; then update the four files + rebuild console.

---

## 🟢 FINDING 3: uv adoption recommended but not implemented

**Source:** `docs/reference/local-ai-devtools-guide.md` (committed 2026-10-18)

**Status:** The guide recommends adopting `uv` for CI (Phase 1: drop-in `uv pip install` swap in workflows). Checked `.github/workflows/*.yml` — **no workflow uses `setup-uv` yet**. Migration not started.

**Artifact-worthy:** NO — internal CI/dev tooling. Not user-facing. (Mention in repo health section only if desired.)

---

## 🟢 FINDING 4: New reference docs not surfaced in artifacts

**New since 2026-10-18:**
- `docs/reference/hydromt-noaa-inundation-integration.md` — HydroMT/SFINCS + NOAA HAND guide
- `docs/reference/local-ai-devtools-guide.md` — uv/ollama/hindsight evaluation
- `docs/reference/turbovec-compression-guide.md` — vector quantization guide
- `docs/reference/cityengine-pbr-cga-guide.md` — CityEngine PBR guide

**Artifact-worthy:** PARTIAL. The dashboard's "Repository Health & Data Strategy" section could link the turbovec/compression findings (user-facing data strategy). The HydroMT guide is developer-facing. Recommend adding one line to the dashboard data-strategy section referencing the compression guide.

---

## 🟢 FINDING 5: Unpushed commits — artifacts built from local, remote is behind

**Status:** Local HEAD (`7002ac0d`) is significantly ahead of `origin/main`. The PAT expired; pushes are failing. The published artifacts were built from local sources, so they include the local BFE fixes — but **anyone cloning from GitHub gets stale code**.

**Artifact-worthy:** NO (infrastructure). But the parent agent needs a fresh PAT to push.

---

## Summary of recommended artifact updates

| Priority | Action | Files to change | Artifact |
|----------|--------|-----------------|----------|
| **P0** | Fix 5 stale 375.0 → 369.1 in console UI + clearance 2.2 → 8.1 | FloodScenarioAnimation.tsx, CinematicTwinHud.tsx, CinematicView.tsx, workbench.ts, site.ts | Console (rebuild + republish) |
| P1 | Flag FFE 382.5 as unverified (pending user OK) | scientific-analytics.ts, site.ts, CinematicView.tsx, workbench.ts | Console (rebuild + republish) |
| P2 | Add compression-guide mention to data strategy | Dashboard source | Dashboard (rebuild + republish) |
