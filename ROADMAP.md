# TSM / UACF Roadmap

Honest status as of 2026-10-09. "Built" means verified in CI or against real
data; "skeletal" means the structure exists but the behavior is not wired.

## Built and verified

- **3D building pipeline:** 23,082 Posey County footprints with LiDAR-derived
  heights (OBSERVED from 3DEP EPT + DERIVED from Indiana 2020 COPC, explicit
  provenance per building), deterministic LOD1/LOD2 GLBs, HLOD, Draco, and
  strict 3D Tiles 1.1 validation. Fail-closed acceptance: 23,082 source ==
  23,082 height-linked.
- **GEOID18 integration (AMBER Gate 3):** official NGS `g2018u0.bin` grid with
  a real binary sampler and bilinear interpolation; the approximate regional
  constant is removed. Missing grid or out-of-coverage coordinates fail
  closed.
- **UACF core:** capability router with `requestId` trace correlation,
  policy engine, provider registry, provenance envelopes, contract tests.
- **8-county offline bundle:** ~11 GB covering IN/IL/KY tri-state counties
  with SHA-256 manifests and a read-only catalog API.
- **CI:** 14 workflows covering build, parse gates, CodeQL, E2E/Cypress,
  Pages deploy, and offline runtimes.

## Skeletal (structure exists, behavior not wired)

- `apps/admin`, `apps/docs`, `apps/playground` — reserved surfaces.
- `providers/` (openai, anthropic, google, openrouter, maps, geo, postgis,
  mcp, openapi) — fail-closed stubs; `local` is the only wired provider.
- `plugins/` (10 domain plugins) — manifests only.
- `runtime/rust`, `runtime/qsharp` — reserved worker boundaries.
- Database `090_*` TSM migrations — schema only, no seed data.

## In progress

- **4D temporal engine:** integrated with SIMULATED/SCENARIO provenance
  typing; flood surfaces are scenario-only, never authoritative.
- **23,082 end-to-end acceptance:** OBSERVED+DERIVED pipeline is wired in
  CI; the full chain (validated features == height-linked == derived
  identities == mesh identities == HLOD mappings) is being verified.
- **Pages deployment:** static console deploys via GitHub Actions; live
  runtime verification ongoing.

## Explicitly out of scope

- LOD4 interiors, UE5 Pixel Streaming, OpenMI WSE auto-feed.
- Live river values except via user-initiated "Fetch live snapshot".
- Any external FEMA/agency/grant submission without explicit authorization.

## Standing constraints

Local-first, air-gapped, USB-deployable. Free/open-source, zero lock-in, no
token-gated paths, no PAYG resources. Missing stays unavailable; nothing is
fabricated. Human authority is final.
