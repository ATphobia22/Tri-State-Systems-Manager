# Innovation Fabric: Prior Art, Headless Solvers, 3D Tiles and Virtual Production
Review date: 2026-11-14. **Status: preflight code + research only, not installed solver binaries or verified flood runs.**

## Main contract

Run this from the repository root:

```bash
node --test scripts/engineering/preflight-innovation-fabric.test.mjs
node scripts/engineering/preflight-innovation-fabric.mjs
node scripts/engineering/preflight-innovation-fabric.mjs --strict
```

The default report classifies the eight-stage fabric honestly as `NOT_EVIDENCED`: it does not fabricate files, download data, execute solvers, or infer an approved datum. `--strict` exits 2 while actual execution/verification receipts are absent. The report is always an inspection result, never an operating permit. To evaluate an actual local candidate, supply `--manifest path`, `--root path`, and optionally `--out path` with local, cryptographically pinned artifact inputs and executable paths. Even `READY_FOR_EXECUTION` **does not** imply a solver ran; use independently reviewed solver receipts and the existing acceptance stack.

The repo already has robust machinery: `scripts/hydrology/run-hec-coupled-workflow.mjs` runs an approved, SHA-pinned HEC-HMS→RAS workflow; `backend/solver_evidence_adapters.py` inspects real HEC-RAS, SWMM and MODFLOW outputs; `backend/hydrologic_coupling_acceptance.py` binds observed/predicted benchmarks, conservation, datum and exchanged flux into a Merkle evidence receipt. This PR does **not** replace or weaken these acceptance gates; it adds an upstream **catalog, execution preflight and patent-risk boundary** for their orchestration.

| Stage | Execution plane | Existing TSM implementation | Required real-world gate |
|---|---|---|---|
| Government snapshot | headless | source manifests / external official agency GIS | Authority, retrieval timestamp, license and source SHA |
| Terrain normalization | headless | geospatial/engineering acceptance tools | Horizontal CRS, vertical datum, units, transform grids, lidar lineage |
| HEC-RAS river hydraulics | headless on a provisioned Windows runner | approved `run-hec-coupled-workflow.mjs` | Actual project/mesh/boundaries, version, solver logs and HDF5, calibrated observed hydrographs |
| EPA SWMM municipal drainage | headless on installed SWMM runtime | `inspect_swmm_run` evidence adapter | Real municipal network, inputs, output/report, continuity error, hydrograph exchange and sampling |
| Multi-solver coupling | headless | `evaluate_coupling` | Correct CRS/NAVD88/units and matching time steps; mass/volume exchanges verified |
| Building HLOD/3D Tiles | headless | `scripts/3d-tiles/` | Authoritative building IDs, source heights, 23,082-footprint reconciliation, tileset validators |
| Houdini/USD bake | headless generation | native script scaffolding | Pinned Houdini build, matching UE5.8 plugin, reviewed asset licenses |
| Unreal Movie Render | **headed** | `scripts/cinema/validate_cinematic_production.py`, UE5.8 MRQ | Actual map, staged verified terrain/buildings, configured render preset, headed screenshots and packaged Windows Shipping proof |

**Research-informed combination:** a calibrated stormwater network can generate node overflow hydrographs for a river floodplain simulator; align timestamp, discharge units, hydrological boundaries, inflow sign convention and control volumes before injecting. Do *not* assume simple one-way coupling is physically valid everywhere: a backwater-dominated Wabash/Ohio confluence may require bidirectional feedback. Peer-reviewed coupled SWMM–HEC-RAS 2D work demonstrates feasibility, not calibration of Mount Vernon (Khatooni et al., 2025, DOI [10.1016/j.jenvman.2024.123849](https://doi.org/10.1016/j.jenvman.2024.123849)). USACE confirms that RAS outputs depth, water-surface elevation and velocities in HDF5; EPA SWMM reports runoff and flow-routing continuity. Source references: [USACE 2D HDF5](https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/6.6/viewing-2d-or-1d-2d-output-using-hec-ras-mapper/2d-output-file-hdf5-binary-file); [EPA SWMM](https://www.epa.gov/water-research/storm-water-management-model-swmm).

## Patent prior art — NOT A PATENT LICENSE

Machine-readable preliminary screen: `integrations/patent-prior-art-screen-2026-11-14.json`.

| U.S. patent | Research topic | Reuse direction | Legal status boundary |
|---|---|---|---|
| [US5611064A](https://patents.google.com/patent/US5611064A/en) | Demand-paged virtual memory for multi-dimensional data | Inspire independent spatial-patch cache and hierarchical tile streaming | Secondary database says expired; **FTO NOT ASSESSED** |
| [US5745121A](https://patents.google.com/patent/US5745121A/en) | Compositing and expression-tree optimization | Independent alpha/matte comp over non-regulatory visuals | Secondary database says expired; **FTO NOT ASSESSED** |
| [US5768297A](https://patents.google.com/patent/US5768297A/en) | Shor quantum-memory decoherence/error correction | Research fault-tolerance ideas, not deploy a quantum processor | Secondary database says expired; **FTO NOT ASSESSED** |
| [US6128764A](https://patents.google.com/patent/US6128764A/en) | Stabilizer quantum error-correcting codes | Research error-syndrome analogy and validation invariants | Secondary database says expired/fee-related; **FTO NOT ASSESSED** |

The USPTO Patent Public Search bibliographic records for all four were independently retrieved as of November 14, 2026, including titles and U.S. application filing dates. No current official **claim-by-claim freedom-to-operate opinion** has been obtained. Google Patents status is expressly not a legal conclusion. The [USPTO management guidance](https://www.uspto.gov/patents/basics/manage) says utility patent terms generally run 20 years from qualifying filing, but adjustments, extensions, disclaimers, maintenance, reinstatement and other live claims can change the answer. US legal expiry does not automatically settle foreign rights. **A patent publication describes concepts; it does not provide a copyrighted source-code license.** Do not copy claims diagrams or proprietary implementation text into software or ship code until reviewed.

Potential new ideas:
- **Virtual-memory-inspired geospatial streaming**: shape-aware working-set cache, priority-by-visibility and risk, explicit LRU budget and hash-verified tile pages. Benchmark vs existing Cesium 3D Tiles HLOD and memory consumption; avoid implementing another renderer until it outperforms the incumbent.
- **Cinematic data-isolated compositing**: filmed mist/rain/alpha layers use their own output class `PRESENTATION`. Never change HEC-RAS water-surface raster values or stamp fake rainfall as observations. Accessible reduced-motion option remains required.
- **Quantum-inspired consistency checking**: classical SHA-256 Merkle roots, parity/invariant rechecks and redundant data-source reconciliation. The quantum patents do *not* demonstrate an actual quantum speedup for TSM; this is an engineering metaphor to be tested against simple baselines.
- **Movie virtual production**: Houdini Engine editor-only procedural asset creation; USD export with full scene units/material licensing; offline UE5.8 World Partition tiles and Niagara presentation effects. The native screen/render is headed; import/bake/checksums are headless.

## Runtime and licensing governance

Use actual runner capabilities before scheduling work. The generic GitHub-hosted Ubuntu worker is appropriate for manifest/schema/logic/CRS tests and HLOD build tools, **not** as proof of native UE5.8 Win64 Shipping or installed HEC-RAS. A self-hosted, documented Windows runner with licensed UE, C++ tools, Houdini and configured HEC-RAS may perform those tasks after immutable project inputs and executable SHA pins are recorded. Never install or silently download unrelated fork packages from a patent description. License and upstream version gates are independent of patent expiry and government-data acquisition.

The fabric's checked `mode` boundary refuses to treat a headless solver as a headed movie render, and its proposed stage graph cannot produce a `verified_execution` or `public_model_outputs` count from a plan alone. The main branch's next genuine release gates remain native offline evidence, completeness of source-backed buildings, calibrated solver runs, and browser-headed smoke checks.
