# Charter Removal — 2026-10-19

**User directive:** "Get rid of the Beverly Ann Tucker memorial charter as working architecture and governance... it's just a memorial to my mother and not to be implemented in code."

## What was done

The Beverly Ann Tucker Memorial Charter / Community Stewardship Charter has been removed as a functional authority source throughout the TSM codebase. The memorial dedication itself is preserved as a simple, non-functional dedication. The underlying engineering principles (human authority final, evidence over theater, technology informs rather than governs) are retained — they now cite their actual technical sources (ADR-004, ADR-005, ADR-006) instead of the charter.

## Files changed

### Core code — governance removal

| File | Change |
|------|--------|
| `tsm-console/src/routes/CharterView.tsx` | **Deleted.** Replaced by `MemorialView.tsx` (below). |
| `tsm-console/src/routes/MemorialView.tsx` | **Created.** Simple memorial dedication to Beverly Ann Tucker. No governance language, no policy content, does not drive any code behavior. |
| `tsm-console/src/lib/router.tsx` | `charterLoader` → `memorialLoader` (returns only memorial name + dedication text). Index and `/index.html` routes now render `MemorialView`. Import updated. |
| `tsm-console/src/types/loaders.ts` | `CharterLoaderData` → `MemorialLoaderData` (simplified to `{ memorialName, dedication }`). |
| `tsm-console/server/policy/jurisdiction-engine.mjs` | `TSM-HUMAN-AUTHORITY` policy citation changed from `'TSM Memorial Charter; ADR-004; ADR-005'` to `'ADR-004; ADR-005'`; `source_uri` changed from `'internal://tsm/charter'` to `'internal://tsm/adr-004-adr-005'`. Rule text unchanged. |

### UI labels

| File | Change |
|------|--------|
| `tsm-console/src/components/RouteTitle.tsx` | `/` route title: `'Charter'` → `'Memorial'` |
| `tsm-console/src/components/RootLayout.tsx` | Nav label: `'Charter'` → `'Memorial'` |
| `tsm-console/src/components/RouteErrorPage.tsx` | "Back to Charter" → "Back to Memorial" |
| `tsm-console/src/routes/NotFoundView.tsx` | "Back to Charter" → "Back to Memorial"; comment updated |

### Tests

| File | Change |
|------|--------|
| `tsm-console/src/lib/router-paths.test.ts` | Test descriptions updated ("charter" → "memorial page") |
| `tsm-console/tests/router-source.test.mjs` | `'CharterView'` → `'MemorialView'` in eager-import check |

### Schemas, skills, scripts

| File | Change |
|------|--------|
| `data/schemas/model-card.schema.json` | `human_oversight_required` description: "Per the stewardship charter" → "Per TSM engineering principle (ADR-004)" |
| `tsm-console/src/lib/local-ai/skills/regulatory.json` | Removed `"charter"` from keywords array |
| `scripts/geospatial/parcels/generate_fema_lomc_bundle.py` | Docstring: "Conventions mirror the TSM charter" → "Conventions follow TSM engineering principles (ADR-004)" |

### Documentation

| File | Change |
|------|--------|
| `README.md` | "**In memory of Beverly Ann Tucker.** This work is guided by the Beverly Ann Tucker Memorial Stewardship Charter and the God's Love Protocol." → "**In memory of Beverly Ann Tucker.**" (dedication kept, governance claim removed). "Memorial dedication and charter" → "Memorial dedication". |
| `tsm-console/server/FLOODWAY-FIS-FARA-ROLE.md` | Removed charter language from integration recommendations |
| `tsm-console/server/OMNI-ECOSYSTEM-CANVAS-RESYNC.md` | "Governance / Charter" → "Memorial"; route list updated |
| `docs/superpowers/plans/2026-09-02-repository-remediation.md` | "stewardship charter" → "engineering principles" |

## What was NOT changed

- **Historical archives** (`docs/archive/drive-import/*.md`): These are imported historical documents; left as-is.
- **The memorial itself**: "In memory of Beverly Ann Tucker" dedication is preserved in README.md and as the console's home page (MemorialView).
- **Engineering principles**: "Technology informs people; it does not silently govern people. Human authority remains final." — retained everywhere, now sourced to ADR-004/ADR-005/ADR-006 instead of the charter.
- **Build artifacts**: `dist/`, `ios/`, `desktop/release/`, `desktop/stage/` untouched per instructions.

## Verification

- `npx tsc --noEmit` in `tsm-console/`: exits 0 (clean)
- `node --test tsm-console/tests/router-source.test.mjs`: 7/7 pass
- Repo-wide grep for "charter" in code files (py/ts/tsx/mjs/js/json): zero hits outside `docs/archive/`
- Repo-wide grep for `CharterLoader`, `CharterView`, `charterLoader`: zero hits
