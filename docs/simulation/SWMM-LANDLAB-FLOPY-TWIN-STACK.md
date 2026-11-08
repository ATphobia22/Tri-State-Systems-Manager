# SWMM, Landlab, FloPy, and digital twin stack

## Water-resources bridges

| Tool | Bridge | Install |
|------|--------|--------|
| EPA SWMM / pyswmm | `integrations/hydro/python/swmm_bridge.py` | `pip install pyswmm` |
| Landlab | `landlab_bridge.py` | `pip install landlab` |
| FloPy / MODFLOW | `flopy_bridge.py` | `pip install flopy` (+ MODFLOW binary) |

```bash
python integrations/hydro/python/swmm_bridge.py
python integrations/hydro/python/landlab_bridge.py demo
python integrations/hydro/python/flopy_bridge.py
```

All model outputs: **MODEL_SIMULATION** — not FIRM/LOMA.

## Twin stack

`packages/geo/src/twin/DigitalTwinStackRegistry.ts`

| Component | Status in TSM |
|-----------|----------------|
| MapLibre GL JS | INTEGRATED |
| Three / R3F TwinCanvas | INTEGRATED |
| 3DEP Terrain-RGB | INTEGRATED (screening) |
| AoiCoveragePanel | INTEGRATED |
| CesiumJS | PARTIAL |
| Eclipse Ditto | ADAPTER_READY (operator deploy) |
| PyGMT / 3dfier / HydroPol2D | REFERENCE_ONLY |
| DTDL | REFERENCE_ONLY |

Human authority remains final.
