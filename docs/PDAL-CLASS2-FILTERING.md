# PDAL Class 2 filtering (LAG path)

ASPRS **Classification == 2** = ground. Indiana 3DEP QL2 tiles are pre-classified; TSM prefers vendor Class 2 over re-running SMRF when QA passes.

## Minimal LAG extract

```text
readers.las (EPSG:2966)
  → filters.crop (foundation ±50–100 ft polygon)
  → filters.expression (Classification == 2)
  → filters.stats / writers.text (min Z = candidate LAG)
```

Pipeline: `tsm-console/pipelines/pdal/lag_class2_foundation_buffer.json`

Override polygon (EPSG:2966 ftUS) from survey/CAD footprint expanded by buffer:

```bash
pdal pipeline pipelines/pdal/lag_class2_foundation_buffer.json \
  --stage.src.filename=data/lidar/posey/las/IN2020_26800970_12.las \
  --stage.buffer.polygon="POLYGON((...))" \
  --stage.out.filename=data/lidar/posey/lag_z.csv
```

## When Class 2 is missing or bad

1. ELM + outlier  
2. SMRF (see `ground_reclassify_smrf.json` + SMRF tuning doc)  
3. expression Class 2  

## Authority

| Product | Class |
|---------|--------|
| Source LAS hash | OBSERVATION |
| min Class 2 in buffer | DERIVATION |
| Certified survey LAG 377.2 | OBSERVATION (sealed survey) |
| LOMA decision | Human + FEMA **26-05-2022A** |

Primary tile max ground ~366.5 ft cannot corroborate LAG 377.2 — **must** use adjacent higher tiles after download + SHA-256.
