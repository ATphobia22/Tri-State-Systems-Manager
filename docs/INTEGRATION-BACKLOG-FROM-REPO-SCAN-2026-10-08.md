# Integration backlog (repo scan 2026-10-08)

Senior-engineer filter: integrate **patterns**, not entire unrelated monorepos. Authority plane stays closed.

## Done / documented this pass

| Item | Location |
|------|----------|
| LOMA / LOMR process guide | `docs/regulatory/loma/LOMA-LOMR-PROCESS-GUIDE-v1.0.md` |
| Flood map authority analysis | `docs/FLOOD-MAP-AUTHORITY-AND-DATA-ANALYSIS-v1.0.md` |
| This backlog | `docs/INTEGRATION-BACKLOG-FROM-REPO-SCAN-2026-10-08.md` |
| shadcn + Storybook + OpenManus bridge | `tsm-console/` (commit series on main) |

## Adopt (P1)

| Source | Action | TSM target |
|--------|--------|------------|
| shadcn/ui | Selective form primitives | LOMA checklist UI, admin panels |
| Storybook | Critical widget stories | AuthorityBadge, StageAuthorityBanner, MapTwin layer toggles |
| full-stack-fastapi-template | Compose/test/HTTPS patterns | `backend/` + `deploy/` hardening — do not dual SPA |
| ADR-006 + OpenManus patterns | Gated agent tool allow-list | S1 default / S2 human-gated only |

## Optional (P2)

| Source | Action |
|--------|--------|
| 4DGaussians | Offline flood replay **SIMULATION_DEMO** worker only |
| abstreet | Evacuation / access scenario research (OSM), not core merge |
| supermemory | Local operator RAG memory — no secrets, no LOMA assertions |

## Reject for authority plane

| Source | Reason |
|--------|--------|
| manuscript-core | Blockchain streaming — wrong domain |
| genpark / Grover skill | Research only |
| countries-states-cities-database | Not US cadastral; use IGIO/TIGER |
| vite fork | Stay on tracked Vite 8 upstream |
| raytracing.github.io | Education / cinematic materials only |

## Flood / LOMA engineering (P0)

1. Lock FIRM panel **18129C0300C** (or document PE override) across LOMA packet generators  
2. Resolve CID citations  
3. Complete Layer-2 response for case **26-05-2022A** before letter deadline  
4. Keep NFHL and BAFL on **separate** map wires with labels  

## Hydrology (P0)

1. Maintain USGS OGC-first + reject bad sentinels  
2. Keep gage-zero `conversionPublished = false` until SIR/NWPS conflict resolved  
3. Never use live stage as LOMA LAG  

## Agent / skills

- **senior-programmer-master:** defensive gates, no invented elevations  
- **claude-skills-navigator:** tooling discovery only — not a runtime authority
