# 4D Scenario Examples - PROVENANCE WARNING

**Uploaded:** 2026-10-08
**Reviewed against AMBER gates:** 2026-10-08
**Classification:** *** SIMULATED / SCENARIO *** — NOT historical truth

## Files

- `tristate_4d_model.gocad` — GOCAD TSurf example (uploaded as `tristate_4d_model.ts`)
- `tristate_posey_buildings_4d.gocad` — GOCAD multi-object example

## Why These Are Synthetic

These files demonstrate GOCAD 4D format structure but contain **entirely synthetic data**:

1. **Terrain**: Regular 12×12 grid with `z = base + i*0.8 + sin(j*0.5)*2.5` — NOT 3DEP LiDAR
2. **Buildings**: 7 hardcoded synthetic buildings (IDs 18129001–18129007), NOT IGIO footprints
3. **Flood surfaces**: The following are *** SCENARIO *** values, NOT observed events:
   - 372.5 ft (labeled "2020")
   - 376.8 ft (labeled "2023")
   - 378.2 ft (labeled "2026")
4. **Berm elevation drift**: 368.5 → 371.2 ft trajectory is *** SIMULATED ***

## Standing Rules Applied

Per TSM-BRANCH-ISOLATION.md and the 2026-10-07 eight-requirement implementation:

- These flood surfaces are **generated scenarios, not verified historical events**
- They must **never** be presented as observed historical flood data
- The 2020→372.5 / 2023→376.8 / 2026→378.2 values require explicit `SCENARIO` provenance typing
- See `scripts/geospatial/export_gocad_4d.py` for the exporter (format converter is legitimate; example data is synthetic)

## Legitimate Use

- GOCAD TSurf format reference
- 4D PointTube trajectory structure example
- Testing GOCAD parsers/exporters

## Prohibited Use

- Presenting as historical flood observations
- Using synthetic buildings as real IGIO data
- Citing elevations as surveyed measurements
