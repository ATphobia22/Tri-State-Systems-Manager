# TSM AI Worker Pipeline — Preflight / Evidence Boundary

**Status:** candidate-plan generator only; no AI model, GPU job, subprocess,
dependency install, network fetch, ledger update or publishing is performed.
**Scope:** Posey County first, reusable for the Ohio–Wabash tri-state region.
**Policy:** ADR-004 (Human Authority Final), ADR-005 provenance,
ADR-006 S1 default, S2 only after explicit human authorization.

## Shipped preflight (this change)

`integrations/ai-workers/plan.mjs` is a dependency-free Node 22 CLI and
importable function. It:

1. Accepts one named pipeline and 1–32 actual local source files.
2. Resolves source paths with realpath; rejects traversal and symlinks escaping
   an explicitly supplied source root.
3. Streams and hashes the **actual source bytes** as SHA-256. This checks
   integrity, not scientific accuracy, acquisition rights, metadata truth, or
   whether the claimed source authority is legitimate.
4. Produces a deterministic, content-addressed proposal manifest. The proposal
   is `DERIVED`, `human_review_required`, `publishable=false`,
   `engineeringUseAllowed=false`, and `executed=false` even when the
   supplied metadata looks plausible.
5. Lists model/tool revisions, license admission, checkpoint validation, capture
   rights and human publication as outstanding gates.
6. Never calls `spawn`, an LLM API, a geospatial solver, GPU runtime or a
   publication endpoint.

### Available worker designs

| Worker ID | Planned tool chain | Allowed output classification |
| --- | --- | --- |
| `photogrammetry-mesh` | COLMAP camera recovery → OpenMVS dense mesh → registration/checkpoints → glTF → 3D Tiles 1.1 | **Geometry candidate**, not surveyed/authoritative |
| `gaussian-appearance` | COLMAP → Nerfstudio / gsplat → visual and alignment reviews | **Visual context only**, not physical geometry |
| `synthetic-pbr-prop` | TRELLIS.2 locally → PBR/mesh review → glTF validation | **Synthetic visual asset** only |

Do not promote generative meshes, splats, photos, or visually attractive
outputs into flood hydraulic/terrain geometry, parcel boundaries or regulatory
layers. A source's file hash does not establish its engineering suitability.
For photogrammetry, require independent surveyed ground-control/check points,
calibrated camera solutions, explicit metric units and CRS/vertical-datum
reconciliation. NAVD88 and GEOID18 must not be interchanged with ellipsoidal
heights silently. Never invent a building count, roof elevation or position.

## Use (preflight only)

Prepare `request.json` (example; `photo.jpg` must actually exist under
the chosen local capture root):

```json
{
  "workerId": "photogrammetry-mesh",
  "autonomy": "S1",
  "rightsCleared": false,
  "sources": [
    {
      "sourceId": "capture-001",
      "path": "photo.jpg",
      "declaredSourceClass": "LOCAL_CAPTURE",
      "captureTime": "2026-11-20T15:00:00Z"
    }
  ],
  "spatialReference": {"crs": "EPSG:2966", "verticalDatum": "NAVD88"},
  "independentCheckpointsAvailable": false
}
```

```bash
node integrations/ai-workers/plan.mjs --request request.json --source-root ./capture
node --test integrations/ai-workers/plan.test.mjs
```

The result is a JSON plan written to stdout; redirect to a file if a human
wants to review it. **No model is trained or executed.** Set
`rightsCleared=true` only when the operator has confirmed reuse and training
rights. Neither that declaration nor presence of an EPSG label constitutes
independent verification. A production worker execution must use the existing
`integrations/runtime/worker-execution.contract.json` and
`integrations/engineering-fabric/worker-contract.json` with sandbox,
timeout, input-output hashes, allow-listed commands, a reviewable evidence
packet and an explicit S2 approval transition.

## Upstream research / license admission

- [COLMAP](https://github.com/colmap/colmap): SfM/camera registration; new
  BSD license for the library, but dependency license review is required.
- [OpenMVS](https://github.com/cdcseacave/openMVS): dense point cloud,
  meshing, refinement and texturing; review **AGPL** and all distributed
  dependencies with counsel before bundling or offering a network service.
  Process separation alone does not prove license compliance.
- [Nerfstudio](https://github.com/nerfstudio-project/nerfstudio) and
  [gsplat](https://github.com/nerfstudio-project/gsplat): appearance
  reconstruction / Gaussian splatting, not a hydraulic mesh or source survey.
- [Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2):
  image-to-3D PBR candidates; code's top-level license does not automatically
  cover weights, image rights or all model dependencies. Verify hardware,
  redistribution and license terms before downloading anything.
- [OGC 3D Tiles 1.1](https://docs.ogc.org/cs/22-025r4/22-025r4.html):
  glTF-centered distribution plus structural metadata, not a guarantee of
  correct georeferencing or geometry.
- [LangGraph](https://github.com/langchain-ai/langgraph) and
  [Microsoft Agent Framework](https://github.com/microsoft/agent-framework):
  optional orchestration candidates, NOT installed and not required for this
  preflight. Evaluate durable task state, approval interrupts, retries and
  offline execution separately.

All imported code, model weights, original photographs, aerial/street imagery
and generated assets require a recorded rights/licensing check. Do not scrape
proprietary street-view content or train on assets lacking applicable rights.

## Next implementation gates

1. **Provisioning adapter (future):** pin exact tool/container digest and
   external model/checkpoint weights; capture SBOM and license record. Install
   only after explicit review. Run GPU-intensive jobs separately from the
   free public Atlas and offline native viewer.
2. **Controlled execution (future):** restricted processes/containers with
   no network by default, bounded CPU/GPU/disk/runtime, allow-listed tools,
   source-asset read-only mounts, user-approved S2 state transitions and
   stable input/output receipts.
3. **Validation (future):** independent geodetic checkpoints and vertical
   residuals, capture coverage, holdout photometric metrics, glTF/3D Tiles
   schema validators, cross-tile seams, mesh topology, reference provenance,
   licensing attestation and reviewer signature.
4. **Human publication (future):** only independently validated data can
   enter the reviewed digital-twin layer. Synthetic appearance stays visibly
   labeled and segregated. The engineering evidence ledger is never mutated
   by a worker proposal.
5. **Acceptance (independent):** local Node tests do not establish that
   COLMAP, OpenMVS, Unreal Shipping, Cesium's headful renderer or a clean
   offline Windows 11 installation ran successfully. Each requires its own
   exact-commit runtime evidence.

## Architecture

```text
Local source assets + consent + metadata
        |
Read-only SHA-256 preflight planner (S1) -- candidate plan / blockers
        |
Explicit human gate + license/rights/toolchain admission (S2, NOT implemented)
        |
Isolated COLMAP / OpenMVS / gsplat / TRELLIS.2 adapters (NOT installed)
        |
Independent geometry / imagery / datum / 3D Tiles tests
        |
Human-reviewed DERIVED candidate assets
        |                          \
Engineering evidence (if validated)   Context/synthetic visual layers
        |                                   |
Temporal twin state / read models         Cesium/Unreal scene renderer
```

No browser service worker is required, and the public web console must not
register one. TSM's native Windows offline runtime uses local signed/checksummed
asset snapshots instead of browser CacheStorage.
