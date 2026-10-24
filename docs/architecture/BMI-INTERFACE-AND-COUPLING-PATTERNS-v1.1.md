# BMI Interface & Coupling Patterns (v1.1)

**Policy:** Technology informs people; it does not silently govern people.  
**Production rule:** No BMI from the browser. Solvers out-of-process; success never inferred from process handshake alone.

**References:** https://github.com/csdms/bmi · https://bmi.csdms.io · https://github.com/csdms/pymt · https://github.com/csdms/bmi-example-python

## Interface patterns

Lifecycle: `initialize(config) → [set_value → update → get_value]* → finalize`

| Pattern | BMI role | TSM adds |
|---------|----------|----------|
| Lifecycle | start/step/stop | config hash, deadline, cancel |
| Variables | names, units, types | CRS, vertical datum, time origin |
| Grid | shape/connectivity | never assume DEM raster |
| Time | model t, dt, units | wall-clock timeout on worker |
| Failure | (not standardized) | COMPLETED_WITH_EVIDENCE, NON_CONVERGED, TIMEOUT, CANCELLED, CRASHED, SCHEMA_MISMATCH, HASH_MISMATCH |

## Coupling patterns

- **A One-way** forcing → model → evidence  
- **B Chain** A→unit/CRS check→B  
- **C Synced time** common t (PyMT-style)  
- **D File-mediated** hashed trees (HEC-RAS/MODFLOW preferred)  
- **E gRPC wrapper** deadlines/cancel/failure stream around A–D  

## Examples

1. Python BMI lifecycle (research) — bmi-example-python  
2. Precip mm/h → discharge m³/s with sidecar  
3. Stage ft + vertical_datum GAGE_DATUM sidecar  
4. File-mediated solver + human signature before approved  
5. **Forbidden:** returncode==0 ⇒ ledger write  

## OpenMI

BMI first; production OpenMI runtime **not** established for TSM.

## Gage-zero gap

Station altitude ≠ published 00065→NAVD88 gage-zero. Keep GAGE_DATUM until conversionPublished.

Human authority remains final.
