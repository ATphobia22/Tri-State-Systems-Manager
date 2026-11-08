# Cesium, Ditto, PyGMT, 3dfier, HydroPol2D, DTDL

| Component | Path | Status |
|-----------|------|--------|
| CesiumJS | `packages/geo/src/twin/CesiumIntegration.ts` | PARTIAL |
| Eclipse Ditto | `integrations/twin/ditto/ditto-adapter.mjs` | ADAPTER_READY |
| PyGMT | `integrations/twin/python/pygmt_bridge.py` | ADAPTER_READY |
| 3dfier | `threedfier_bridge.py` | ADAPTER_READY |
| HydroPol2D | `hydropol2d_bridge.py` | ADAPTER_READY |
| DTDL | `integrations/twin/dtdl/bonebank-site.dtdl.json` | ADAPTER_READY |

```bash
python integrations/twin/python/pygmt_bridge.py
python integrations/twin/python/threedfier_bridge.py
python integrations/twin/python/hydropol2d_bridge.py /path/to/HydroPol2D
```

Ditto: set `TSM_DITTO_BASE_URL` and use `getDittoThing`.
Cesium: `buildBonebankCesiumConfig` then construct `Cesium.Viewer` in the app shell.

Authority: PRESENTATION or MODEL_SIMULATION as labeled — not LOMA.
