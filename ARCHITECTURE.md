# TSM / UACF Architecture

Tri-State Systems Manager is a provenance-first, evidence-gated geospatial
and engineering platform. The Universal Agent Capability Fabric (UACF) is its
agent/capability layer: deterministic computation plus controlled external
capabilities behind explicit contracts.

## Planes

| Plane | Locations | Responsibility |
|---|---|---|
| Web / 3D console | `tsm-console/` | React/TypeScript UI, MapLibre, Three.js, flood visualization, client contracts. |
| Apps | `apps/` | `uacf-gateway`, `dashboard`, `docs`, `playground`, `admin` — operator and developer surfaces. |
| Packages | `packages/` | Shared contracts: `contracts`, `router`, `policy`, `registry`, `provenance`, `evidence`, `geo`, `hydraulics`, `twin`, `mcp`, `openapi`, and more. |
| Providers | `providers/` | Capability providers behind the provider interface (`local` is wired; the rest are fail-closed stubs until configured). |
| Plugins | `plugins/` | Domain plugins (hydrology, fema, grants, engineering, …) — manifest-only scaffolds. |
| Runtime | `runtime/` | Worker boundaries: `unreal` (native 3D), `python` (engineering workers), `rust` / `qsharp` (reserved), `docker` (containers). |
| Database | `database/` | Migrations (`000_*` core UACF, `090_*` TSM domain tables), seeds, schemas. |
| Evidence | `evidence/` | Hash-chained records, snapshots, attestations, citations. |
| Native / desktop | `tsm-native/`, `native/` | Windows x64 offline runtime packaging. |
| CI/CD | `.github/workflows/` | Build, parse, security, Pages, and runtime verification gates. |
| Docs / governance | `docs/`, `COMPLIANCE.md` | Architecture, deployment, regulatory boundaries. |

## Core data flow

```text
government / authoritative source
  -> source adapter + acquisition contract
  -> validation + CRS/datum checks + freshness checks
  -> provenance record + SHA-256 integrity evidence
  -> normalized data / tiles / model inputs
  -> geospatial + hydrologic + engineering services
  -> visualization / simulation / evidence packet
  -> human engineering / agency review
  -> controlled publication
```

## UACF capability flow

```text
capability request
  -> router (capability -> provider selection)
  -> policy engine (authorization)
  -> provider execution (allowlisted, hashed I/O envelope)
  -> provenance envelope (input/output hashes, traceId)
  -> result with citations and usage
```

Workers cannot mutate native engineering state directly. Cinematic
presentation cannot mutate engineering state. External providers are
fail-closed: unconfigured providers throw, never fabricate.

## Authority doctrine

Three separate truths: **authoritative** (government source), **computational**
(derived/model output), **visual** (presentation). A visualization is never
evidence. FEMA NFHL and Indiana DNR BAFM are separate authority planes.
