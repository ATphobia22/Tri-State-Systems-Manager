# TSM Simulation (Scaffold)

Simulation adapters (HEC-RAS, MODFLOW, SWMM), scenario manager, snapshot manager. Adapters are integration targets, not bundled engines.

**Status: scaffold.** This plugin ships a descriptor and pure-C++
interface headers only. It requires Unreal Engine 5.8+ on Windows to compile
and has not been built or tested in this environment. See
`docs/architecture/v45-offline-build-pipeline.md` for the target topology.

Interfaces live in `Source/TSMSimulation/Public/` and are intentionally free of UE
headers so the contracts stay reviewable outside the engine.
