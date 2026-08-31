# OpenUSD stage caching — TSM notes

## Why cache

Stages may resolve hundreds–thousands of asset paths. Repeated resolution is expensive; caches keep results consistent within a scope.

## Mechanisms

| Mechanism | Role |
|-----------|------|
| **ArResolverScopedCache** | Cache resolution results for a code block; same path → same result |
| **Asset Resolver (Ar)** | Maps asset paths → resolved paths (filesystem or custom) |
| **Payloads / references** | Defer heavy layers until needed (vs greedy sublayers) |
| **Crate (.usdc)** | Binary USD; reads composition metadata without full payload |

## Practices for TSM cinematic / twin export

1. Prefer **payloads/references** for heavy mesh/terrain layers so inactive prims are not fully loaded (especially with mirroring resolvers that download entire layers).
2. Wrap bulk opens in **ArResolverScopedCache** when resolving many frame variants.
3. Stamp root prim customs: `tsm:contentHashSha256`, `tsm:authorityClass`, CRS/vertical.
4. Browser EOC stays Three.js/MapLibre; USD/Hydra is desktop/offline virtual production.
5. Never treat cached visual stage as regulatory evidence without EvidenceArtifact seal.

## Related

- Hydra delegates: `OPENUSD-HYDRA-DELEGATES.md`  
- Coupler: `tools/ptdt_archimedes_usd_coupler.py`  

