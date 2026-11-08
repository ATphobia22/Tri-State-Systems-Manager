# Hydro + digital twin toolchain (TSM)

**Registry:** `integrations/hydro/tsm-hydro-digital-twin-toolchain-registry-v1.json`  
**TS index:** `packages/geo/src/hydraulics/HydroToolchainRegistry.ts`

## HEC-RAS automation (operator-installed)

| Tool | Bridge |
|------|--------|
| [ras-commander](https://github.com/gpt-cmdr/ras-commander) | `integrations/hydro/python/ras_commander_bridge.py` |
| [rascontrol](https://github.com/mikebannis/rascontrol) | `rascontrol_bridge.py` (Windows COM) |
| [parserasgeo](https://github.com/mikebannis/parserasgeo) | `parserasgeo_bridge.py` |
| [ras2fim](https://github.com/NOAA-OWP/ras2fim) | `ras2fim_bridge.py` |
| hecrasio / pyHMT2D / RiverGIS | Reference — operator clone |

```bash
pip install ras-commander
python integrations/hydro/python/ras_commander_bridge.py probe
```

## Also catalogued

OpenFOAM, USACE HEC-HMS/ResSim/SSP, OpenMI/BMI, SWMM, Landlab, FloPy, pygeoapi, HydroPol2D, MapLibre (in-tree), Cesium, Ditto, DTDL.

## Authority

Model runs and inundation grids = **MODEL_SIMULATION**.  
LOMA / SFHA determinations remain human + FEMA process.
