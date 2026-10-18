# Gates status — 2026-10-18

## Cascade root cause (fixed)

`npm ci` ERESOLVE: `three@0.186` vs `@dvt3d/maplibre-three-plugin@1.7.1` peer `three@^0.178.0`.

**Lock:**

- `tsm-console/package.json` → `"three": "0.178.0"`
- `overrides.three`: `"0.178.0"`
- `production-gates.test.mjs` asserts pin + override
- `nfhl-registry-contract.test.mjs` asserts pin offline

## NFHL fabric gates

| Gate | Command |
|------|---------|
| Registry offline | `npm run test:nfhl` |
| Export / map wiring | `node --test tests/nfhl-export-contract.test.mjs` |
| Live MapServer drift | `npm run nfhl:validate` (root) |
| Geospatial CI | registry + live validate |

**Priority stack (locked):** `28,27,16,23,34,3,22,32`

**Live smoke (2026-10-18):** MapServer 32 layers (12/12/8); `/export` priority show → HTTP 200 `image/png`.

## Map catalog

- `fema-nfhl` → full priority stack via `NFHL_PRIORITY_IDS`
- Sublayers: zones(28), boundaries(27), bfe(16), levees(23), lomas(34), firm-panels(3)
- Helpers: `lib/nfhl/nfhl-export.ts`

## Production evidence gates

`npm run test:production-gates` — human authority, Merkle, schema scripts, three pin, `test:nfhl` script.

## Operator note

Do **not** bump `three` past 0.178 until `@dvt3d/maplibre-three-plugin` widens its peer range.

Prefer fewer sequential pushes on `main` so concurrency groups can finish (Parse/CI/Pages).
