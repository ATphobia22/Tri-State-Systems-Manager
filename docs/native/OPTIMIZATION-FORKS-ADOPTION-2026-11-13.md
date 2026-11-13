# Native optimization forks and offline 3D Tiles audit (2026-11-13)

These five source repositories were inspected for the TSM Windows 11 UE5.8 **offline native** release. The SHA pins record *reviewed source revisions only*. None is presumed installed, benchmarked, compiled, licensed for redistribution, or included in the Shipping binary.

| Library | Reviewed fork commit | License noted in fork | Candidate use | Acceptance |
|---|---|---|---|---|
| [simdjson](https://github.com/ATphobia22/simdjson) | `449f38e6377992798220c513f58740632355de52` | Apache-2.0 | Faster offline JSON/tileset parsing | Pin release, benchmark against Unreal JSON, preserve strict schema validation and no-network URI handling |
| [Highway](https://github.com/ATphobia22/highway) | `0e0a01dac5321dafec478d781487d1323492359e` | Apache-2.0 or BSD-3-Clause | SIMD geometry preprocessing | Validate scalar fallback, CPU dispatch, deterministic results, representative benchmarks |
| [ncnn](https://github.com/ATphobia22/ncnn) | `24ea07e87f544a3fbc59980b57885a92c75f2d24` | BSD-3-Clause core, third-party license exceptions | Optional offline roof/facade inference | Separate model-weight license, recorded residual/confidence, human-reviewed evidence, reproducible outputs |
| [turbovec](https://github.com/ATphobia22/turbovec) | `1e7200cfd8f26c92ce2855652db64bc7f85bc039` | MIT | Optional semantic search over an immutable evidence snapshot | Source-ID mapping, ACL/tenancy checks and persisted-index SHA-256; no Python/Rust service dependency in UE Shipping |
| [OodleUE](https://github.com/ATphobia22/OodleUE) | `5e38cb6c99c588b51cde0cae4a6420d6bc865605` | UE EULA notice, not general-purpose OSS | None: prefer UE5.8's Epic-supplied Oodle | Do not vendor, download or redistribute fork-provided proprietary binaries without legal review |

## Code actually implemented

`scripts/native/audit_local_3d_tiles.py` statically verifies reachable 3D Tiles `content.uri` / `contents[].uri` references against an already-staged local data root. It rejects remote URLs, query strings, path traversal, symlinks, absent assets, invalid nested tileset JSON and a manifest stored inside immutable data. It writes a SHA-256 file inventory. `tests/native/test_audit_local_3d_tiles.py` provides local regression cases and `.github/workflows/local-3dtiles-audit.yml` runs them in CI.

Run **separately for each actual manifest-grounded terrain and building tileset** after staging:

```powershell
python scripts/native/audit_local_3d_tiles.py --root tsm-native/Content/TSMData --tileset tsm-native/Content/TSMData/terrain/tileset.json --output dist/evidence/terrain-inventory.json
python scripts/native/audit_local_3d_tiles.py --root tsm-native/Content/TSMData --tileset tsm-native/Content/TSMData/buildings/tileset.json --output dist/evidence/buildings-inventory.json
```

The example paths are not evidence that either dataset exists. The audit is **static reference integrity** only. The current implementation traverses bounded OGC 3D Tiles 1.1 implicit QUADTREE/OCTREE trees, reads JSON and binary `.subtree` files, checks little-endian Morton availability, external subtree buffers, reachable local GLBs and their standard glTF image/buffer URIs, and inventories referenced assets by SHA-256. It rejects unsupported legacy implicit extensions, external tilesets as implicit content, noncanonical URI templates, symlinks, missing content and audit-budget overruns rather than silently passing.

**Limits and release meaning:** maximum 10,000 subtrees and 250,000 enumerated tiles *per implicit root*, maximum 7 subtree levels and 64 MiB per subtree/buffer. Datasets exceeding those bounds are **not audited**, not verified. Unparsed legacy tile payloads (such as B3DM/I3DM/PNTS/CMPT) and plain glTF are rejected instead of reported as verified; conversion to audited GLB or an independently tested parser is required. Unknown glTF extension-specific resource references, full GLB semantics, Draco/KTX2 decoding, content geometry and geospatial alignment are not independently validated. This is **not** proof of a packaged Win11 launch, regulatory datum accuracy, 23,082 complete building geometries, or any Shipping binary. A complete offline-release gate still needs actual UE Shipping BuildCookRun, staged data checksums, headed launch with network disabled, signing verification and GPU metrics.

Technical basis: [OGC 3D Tiles 1.1](https://docs.ogc.org/cs/22-025r4/22-025r4.html), [Implicit Tiling](https://github.com/CesiumGS/3d-tiles/blob/main/specification/ImplicitTiling/README.adoc), and [Availability Indexing](https://github.com/CesiumGS/3d-tiles/blob/main/specification/ImplicitTiling/AVAILABILITY.adoc).

See Epic's [official Oodle documentation](https://dev.epicgames.com/documentation/unreal-engine/using-oodle-in-unreal-engine) before making any compression integration decision.
