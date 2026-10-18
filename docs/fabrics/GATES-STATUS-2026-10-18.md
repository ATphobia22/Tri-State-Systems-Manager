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
| Live MapServer drift | `npm run nfhl:validate` (root) |
| Geospatial CI | both steps in `geospatial-ci.yml` |

## Production evidence gates

`npm run test:production-gates` — human authority, Merkle, schema scripts, three pin (7 tests).

## Operator note

Do **not** bump `three` past 0.178 until `@dvt3d/maplibre-three-plugin` widens its peer range.
