# CFD stack: SDF, FEniCSx, OpenFOAM, SimScale

| Tool | Path | Status |
|------|------|--------|
| SDF helpers | `packages/geo/src/cfd/SdfGeometry.ts` | INTEGRATED |
| FEniCSx | `integrations/cfd/python/fenicsx_bridge.py` | ADAPTER_READY |
| OpenFOAM | `openfoam_bridge.py` | ADAPTER_READY |
| SimScale | `simscale_bridge.py` | ADAPTER_READY |

```bash
python integrations/cfd/python/fenicsx_bridge.py
python integrations/cfd/python/openfoam_bridge.py
python integrations/cfd/python/simscale_bridge.py
```

Registry: `integrations/cfd/tsm-cfd-toolchain-registry-v1.json`  
Authority: **MODEL_SIMULATION** — not FIRM/LOMA.
