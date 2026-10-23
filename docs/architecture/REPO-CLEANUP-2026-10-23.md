# Repo cleanup — 2026-10-23

## CI blockers closed

| Issue | Fix | Commit |
|-------|-----|--------|
| TS18047 `createFloodRenderer` null | Null-guard + WebGL error UI | `d551352` / Level-5 on main |
| Missing `MapLibreThreeLayer.getDiagnostics` | Implemented + degraded load tracking | `2c9c7fd` |
| NGVD29→NAVD88 constant offset | Identity-only `tryDatumConversion` | `dfaa366` |
| Bad flood grid still painted | Empty mask when length ≠ rows×cols or water non-finite | `dfaa366` |
| Unused `FloodSimulator.full.tsx` stub | **Deleted** | `021c9ef` |

## Human authority

Vertical datum conversion never invents a regional offset without published evidence. Flood visualization degrades to an empty mask on invalid inputs.

## Branches

Many `feat/meshlet-*` and `feat/supabase-postgis-*` branches remain from 2026-10-19 integration work. Delete locally/remote after confirming merge if they clutter the UI:

```bash
git fetch --prune
git branch -r | grep -E 'feat/meshlet|feat/supabase|fix/restore-flood|fix/flood-'
# review then: git push origin --delete <branch>
```

## Local artifact

`artifacts/FloodSimulator.tsx.fixed` is a local backup of the Level-5 module already on `main`.
