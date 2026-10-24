# BMI / OpenMI Coupling Notes (v1.0)

**Status:** Interface guidance only — no automatic model coupling in production TSM.  
**Related:** ADR-005 four-plane architecture, HEC-RAS worker package hash, research model catalog.

## Intent

Use **CSDMS BMI** (Basic Model Interface) and historical **OpenMI** concepts so future research runners can exchange exchange items (stage, discharge, water-surface elevation) without embedding solvers in the public SPA.

## Rules

1. Models run **out of process** under an operator-supplied executable or container.
2. Inputs and outputs are **content-addressed** (SHA-256 tree / file hashes).
3. Exchange items that influence flood presentation remain **informational** until a human decision record exists.
4. BMI `initialize` / `update` / `finalize` are never invoked from the browser.

## Suggested exchange items (names only)

| Name | Unit | Notes |
|------|------|--------|
| `channel_stage` | ft | Requires explicit vertical datum metadata |
| `discharge` | cfs | USGS parameter 00060 style |
| `water_surface_elevation` | ft NAVD88 preferred | Never silent NGVD29 conversion |
| `precip_rate` | in/hr | From QPE products when available |

## Python sketch (research only)

```python
# Not executed by TSM production paths.
# from bmipy import Bmi
# class ResearchCoupler: ...
```

## References

- https://github.com/csdms/bmi-python  
- HEC-RAS documentation: https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx  
- TSM `contracts/registries/tsm-research-model-catalog-v1.json`
