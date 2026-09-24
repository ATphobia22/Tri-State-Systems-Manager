# TSM Project Status — 2026-09-24

## Honest completion boundary

Tri-State Systems Manager is a **working public-interest engineering platform** for Posey County / Tri-State River Valley decision support. It is **not** a claim that flooding is solved, that FEMA rates are proven wrong, or that USACE navigation policy has been replaced.

What “finished enough to stand behind” means here:

- Fail-closed evidence controls (human authority, simulation labels, claim controls)
- Live hydrologic paths (USGS-first, sentinel rejection)
- LOMA Case 26-05-2022A evidence package structure
- CI action-pin gate green (18 workflows checked)
- Multi-installer matrix documented; desktop release gated on green CI
- Open-source stack preference retained

## On `main` (evidence / LOMA track)

- Layer 2 case record, register, NFIP intake, USACE FOIA draft
- Inter-agency data governance memorandum
- Section 205 brief; Wabash–Ohio backwater modeling frame
- Indiana floodplain law brief (312 IAC 10 / IC 14-28 / INFIP-FARA)
- USACE hydrologic node data contract v1.0.0
- Evidence lock API (`POST /evidence/lock-packet`)
- Panel provenance SQL + evidence lock packet hash
- PTDT engineering letter + Section 204 conditional pathway notes

## Operator still owns

| Item | Why |
|------|-----|
| Push binary LOMA PDFs | Connector text-only; local `git push` with credentials |
| `npm install` / full Vite build | Sandbox node_modules incomplete |
| Wire `evidence_lock.router` into main FastAPI app if not auto-imported | One-line include in app factory |
| Harden-Runner audit → block | After egress review |
| Desktop release tag | After CI green |
| PE / surveyor certification | Required for MT-1 reliance on LAG 377.2 |
| County sponsor for Section 205 | Individual cannot self-sponsor |

## Gates known healthy in this environment

- `scripts/ci/validate-action-pins.mjs` → `ok: true`, 18 workflows

## Do not claim

- LOMA approved or denied  
- Historical NFIP overcharge without policy evidence  
- Navigation dam = intentional flood control for Point Township without primary records  
- “Better than the entire world’s solutions” as a legal or scientific verdict — only as personal mission commitment
