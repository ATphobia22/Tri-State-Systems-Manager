# HEC-RAS hydrodynamics & LiDAR classification — TSM

Engineering reference for the Scientific & Simulation plane and Evidence plane.  
Human authority remains final; model outputs are DERIVATION / MODEL, not silent regulatory truth.

---

## 1. HEC-RAS hydrodynamic modeling

### Equation sets (2D)

| Method | Use when | Courant guidance |
|--------|----------|------------------|
| **Diffusion Wave (DW)** | Gravity + friction dominate; milder transients | More forgiving |
| **Full Shallow Water (SWE)** | Momentum / rapid change, hydraulic jumps, tidal, dam breach | Tighter Δt |

Courant number:

\[
C = \frac{V\,\Delta t}{\Delta x}
\]

USACE guidance (RAS 2D):

- **SWE-EM** (explicit): target \(C \le 1.0\) (harder limit)
- **SWE-ELM** / implicit FV: often stable with \(C\) up to ~2–3 if results still accurate
- Prefer **Adjust Time Step Based on Courant** under Unsteady Computation Options when fixed Δt fails
- Plot Courant in RAS Mapper to find hot cells

### Mesh practices (Posey / Point Township)

1. Cell faces must resolve **terrain controls** (levees, SR 62, rail, ring berms) — not only cell centers.
2. Align **breaklines** along structure centerlines / bank lines; avoid faces parked on steep embankment slopes when using 2D flow over structures.
3. Gradual refinement regions when stepping cell size (e.g. 50 ft → 10 ft).
4. For free-flowing weirs: 1D weir equation often more accurate than pure 2D faces; for heavily submerged, 2D equations can be more stable.
5. Combined 1D/2D: use **time slicing** if 2D needs smaller Δt than 1D.

### Manning \(n\) (illustrative starting values)

| Cover | Typical \(n\) |
|-------|----------------|
| Open channel (Wabash/Ohio) | ~0.030 |
| Cultivated | ~0.040 |
| Urban | ~0.080 |
| Dense timber / wetland | ~0.100–0.120 |

Calibrate to gauges (e.g. USGS **03378500** Wabash at New Harmony) — do not hard-code as truth.

### Boundary conditions

- Upstream: design hydrograph (e.g. 1% annual chance) or observed storm  
- Downstream: stage hydrograph (USACE / Ohio) or normal depth with estimated slope  
- Backwater from Ohio into Lower Wabash is a primary Posey risk mode

### Results → TSM

RAS Mapper exports **Depth / Velocity / WSE** as GeoTIFF (Export Layer → Raster).

TSM path:

```bash
node scripts/ras-geotiff-ingest.mjs ./depth_max.tif --plan=posey-q100 --maxDim=128
```

- Bulk raster read + spatial stride for twin viewport  
- SHA-256 of source GeoTIFF  
- Stamp BFE **375.0** / LAG **377.2** NAVD88 as **site constants**, not inferred from raster  
- `authority_class: DERIVATION`, `derivation_class: HEC_RAS_DEPTH_DOWNSAMPLE`  
- Record **native CRS** of export (often project CRS, not assumed EPSG:4326)

OpenMI 2.0 remains the coupling contract concept for multi-physics (HEC-RAS ↔ MODFLOW/SWMM) in later phases.

---

## 2. LiDAR point cloud classification

### ASPRS standard classes (core)

| Code | Class | TSM use |
|------|-------|---------|
| 0 | Never classified | Reject for products unless withheld |
| 1 | Unassigned | Not ground |
| **2** | **Ground** | **LAG / DEM / hydro terrain** |
| 3–5 | Low / med / high vegetation | Canopy metrics; exclude from bare earth |
| 6 | Building | Footprints / 3D context |
| 7 | Low noise | Exclude |
| 9 | Water | Hydro-flattening context |
| 17 | Bridge deck | Exclude from bare-earth DEM |
| 18 | High noise | Exclude |

LAS 1.4 extended formats allow class 0–255; USGS 3DEP minimum scheme still centers on ground/veg/building/water/noise.

**Flags** (separate from class): Synthetic, Key-point, Withheld, Overlap (bit flags). USGS 3DEP: do not use class codes as a substitute for the overlap flag; model key-points via key-point flag (class 8 discretionary).

### Indiana 3DEP QL2 (reminder)

- ≥ 2 pulses/m²  
- RMSE_z non-veg ≤ **0.328 ft**; NVA 95% ≤ **0.643 ft**  
- Products: LAS 1.4, hydro-flattened DEM, breaklines, intensity  
- AOI NSSDA still required before LOMA-grade claims  

### PDAL extraction for LAG (TSM)

1. Crop to foundation **± 50 ft** buffer **first** (stream-friendly)  
2. Keep **Classification == 2** (`filters.expression`)  
3. \( \mathrm{LAG} = \min(Z_{\mathrm{Class2} \cap \mathrm{buffer}}) \)  
4. \( \Delta_z = \mathrm{LAG} - \mathrm{BFE} \); FEMA LOMA context when \(\Delta_z \ge 0\); Indiana freeboard for new floors often BFE+2.0 ft  

Pipelines: `pipelines/pdal/lag_extract_optimized.json`, `STREAM-MODE.md`.

Bonebank tile `IN2020_26800940_12`: structure LAG **377.2 ft** is **outside** low-ground tile max (~366.5 ft) — pull adjacent higher tiles + sealed survey.

### Classification → digital twin

| Product | Classes |
|---------|---------|
| Bare-earth DEM / LAG | 2 only |
| Hydro breakline QA | 9 + breakline vectors |
| Building extrusions context | 6 (not regulatory BFE) |
| Noise rejection | 7, 18, withheld |

---

## 3. Authority boundary

| Artifact | Class |
|----------|--------|
| USGS/NOAA stage observation | OBSERVATION |
| Classified LAS tile from GIO/3DEP | OBSERVATION (source snapshot + hash) |
| PDAL LAG min in buffer | DERIVATION |
| HEC-RAS depth GeoTIFF | MODEL |
| Downsampled twin cells | DERIVATION / VISUALIZATION |
| LOMA determination | Human + FEMA/IDNR process only |

Technology informs; it does not silently govern.

See also: [1D-2D-COUPLING-AND-LIDAR-FILTERING.md](./1D-2D-COUPLING-AND-LIDAR-FILTERING.md).
