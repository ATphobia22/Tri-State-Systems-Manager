# HydroMT + SFINCS and NOAA-OWP Inundation Mapping — TSM Integration Guide

**Date:** 2026-10-18
**Purpose:** Honest capability assessment of two open-source flood-modeling stacks for the Tri-State Systems Manager (TSM) Ohio/Wabash confluence pipeline.
**TSM context:** Anchor site 37.845887, −88.005075; regulatory BFE 369.1 ft NAVD88 (FIS 18129CV000A Table 9 §A); HUC8 05120113; USGS gages 03381700 (Ohio at Old Shawneetown) and 03378500 (Wabash at New Harmony).

---

## 1. HydroMT + hydromt_sfincs + SFINCS

### What it is

Three separate pieces that are often confused:

| Component | Role | License | GPU needed? |
|-----------|------|---------|-------------|
| **HydroMT** (core) | Generic Python API for *building* model inputs from raw geospatial data | MIT | No |
| **hydromt_sfincs** (plugin) | HydroMT plugin that writes SFINCS input files | GPL-3.0 | No |
| **SFINCS** (solver) | The actual 2D hydrodynamic engine that runs the simulation | GPL-3.0 | No — CPU Docker exists (`deltares/sfincs-cpu`) |

**Critical distinction:** HydroMT does not simulate anything. It prepares reproducible, scripted model inputs. You still need the SFINCS binary to run. This is a feature (separation of concerns), not a limitation — but it means integration is a two-step job.

SFINCS ("Super-Fast INundation of CoastS") is Deltares' reduced-complexity 2D flood model (Leijnse et al., 2021, *Coastal Engineering*). It trades full shallow-water physics for speed: it solves a simplified momentum equation that runs orders of magnitude faster than HEC-RAS 2D, at the cost of accuracy in strongly dynamic flow (dam breaks, steep bores). For riverine overbank flooding at the Ohio/Wabash confluence — slow-rising, friction-dominated — it is well within its valid operating range.

### The other HydroMT plugin worth knowing

**hydromt_fiat** builds inputs for Delft-FIAT, Deltares' flood *impact* model (damage to buildings/infrastructure). Relevant later: once SFINCS produces depth grids, FIAT can estimate damage against TSM's 23,082 building features. Not needed for the hydraulic step itself.

### Installation

```bash
# HydroMT core (conda-forge recommended)
conda create -n hydromt python=3.11 -y
conda activate hydromt
conda install hydromt -c conda-forge

# SFINCS input builder plugin
pip install hydromt_sfincs

# Impact model plugin (optional, later phase)
pip install hydromt_fiat
```

The SFINCS solver itself (choose one):

```bash
# Option A: Docker CPU build (recommended for TSM — no GPU needed)
docker pull deltares/sfincs-cpu

# Option B: Windows executable
# Download from https://download.deltares.nl/sfincs/

# Option C: Build from source
# https://github.com/Deltares/SFINCS
```

### Minimal working example (TSM-flavored)

```python
"""Build SFINCS inputs for the Ohio/Wabash confluence with HydroMT."""
import hydromt
from hydromt_sfincs import SfincsModel

# 1. Define the model region around the anchor site
#    (lon/lat bbox covering the confluence + floodplain)
region = {
    "bbox": [-88.15, 37.75, -87.90, 37.95],  # ~25 x 22 km
}

# 2. Instantiate the SFINCS model in write mode
mod = SfincsModel(root="./sfincs_confluence", mode="w")

# 3. Build: grid, topography, roughness, boundary conditions
#    HydroMT pulls from its data catalog; point it at TSM data via
#    a data_catalog.yml that maps TSM paths to catalog entries.
mod.build(
    region=region,
    opt={
        "setup_config": {
            # Simulation window (example: April 2011 flood)
            "tref": "2011-04-20 00:00:00",
            "tstart": "2011-04-20 00:00:00",
            "tstop": "2011-05-10 00:00:00",
            "dtout": 3600,       # hourly output
            "dthis": 3600,
        },
        "setup_grid": {
            "x0": -88.15, "y0": 37.75,
            "dx": 0.0009, "dy": 0.0009,   # ~100 m grid
            "nmax": 280, "mmax": 250,
            "rotation": 0.0,
        },
        "setup_dep": {
            # TSM's 2.5-ft Posey County DEM, resampled to model grid.
            # Subgrid refinement lets SFINCS use the full-res DEM
            # for volume calculations even on a coarse grid.
            "datasets": [{"elevtn": "tsm_posey_dem"}],
        },
        "setup_mask": {
            # Active (floodable) vs inactive cells from BAFM polygons
            "active": "tsm_bafm_floodplain",
        },
        "setup_manning": {
            # Manning's n from landuse reclassification
            # (open water 0.025, forest 0.10, urban 0.06, ag 0.035)
            "datasets": [{"manning": "tsm_landuse_reclass"}],
        },
        "setup_bnd": {
            # Upstream: Ohio River inflow hydrograph (USGS 03381700)
            # Downstream: Wabash stage or normal-depth BC
            "bzs": "tsm_boundary_points",
        },
        "setup_obs": {
            # Observation points: anchor site + gage locations
            "obs": "tsm_observation_points",
        },
    },
)

# 4. Write all SFINCS input files (sfincs.inp, dep, bnd, obs, ...)
mod.write()

# 5. Run SFINCS (outside Python — the solver binary)
# docker run --rm -v $PWD/sfincs_confluence:/data deltares/sfincs-cpu
```

The `tsm_*` entries above refer to a HydroMT data catalog YAML you write once, mapping TSM's data paths to named datasets:

```yaml
# data_catalog_tsm.yml
meta:
  root: /path/to/tri-state-review/repo
tsm_posey_dem:
  data_type: RasterDataset
  path: data/posey-county/elevation/in2020-26850945-12-dem-2.5ft.tif
  crs: 2968          # Indiana State Plane West, feet — reproject to model CRS
  unit: ft
tsm_bafm_floodplain:
  data_type: GeoDataFrame
  path: data/fabrics/government-downloads/  # BAFM polygons (reassemble chunks first)
```

### Data requirements (honest list)

| Input | TSM status |
|-------|------------|
| DEM (bare-earth, hydro-conditioned) | ✅ Have: 2.5-ft Posey County DEM, 3DEP 1m tiles |
| Landuse → Manning's n map | ⚠️ Partial: need reclass table (USDA CDL ingestion is open work) |
| Upstream inflow hydrograph | ✅ Have: USGS 03381700 / 03378500 via `scripts/flood-forecasting/` |
| Downstream boundary condition | ⚠️ Needs decision: stage hydrograph or normal-depth |
| Computational grid definition | ✅ Trivial: defined in `setup_grid` |
| Levee/berm representation | ⚠️ TSM berm designs are conceptual (PE review required) — use with caveats |

### GPU requirements

**None for the standard workflow.** SFINCS runs on CPU (`deltares/sfincs-cpu` Docker). There is no required CUDA path for riverine SFINCS runs. (SynxFlow, mentioned in the original evaluation request, is the CUDA-accelerated alternative — but it is a separate, less mature codebase; SFINCS is the Deltares-supported choice.)

### Integration effort: MEDIUM-HIGH

- HydroMT install + data catalog YAML: 1–2 days
- First working SFINCS build for the confluence: 1–2 weeks (grid tuning, boundary conditions, spin-up)
- Calibration against 2011/1937 events: 2–4 weeks (needs someone who understands the knobs)
- **This is real hydraulic modeling work, not a pip install.** Budget accordingly.

---

## 2. NOAA-OWP Inundation Mapping (HAND)

### What it is

The operational flood-mapping stack behind NOAA's National Water Center FIM services. Apache-2.0, ~667 commits, actively maintained (default branch `dev`).

**HAND methodology in one paragraph:** Take a DEM. For every cell, compute its height above the nearest hydrologically connected drainage channel — this converts the DEM into a Relative Elevation Model (REM). Separately, build synthetic rating curves (SRCs) per stream reach using reach-averaged channel geometry from the DEM + Manning's equation + an assumed roughness. Then: given a discharge (from the National Water Model or a gage), look up water depth on the SRC, subtract the REM, and every cell where depth > REM height is inundated. The only runtime input is a discharge number. Everything else is preprocessed.

### Why it fits TSM — and where it doesn't

**Fits:**
- The Ohio River at the confluence is a high-order reach. The validation literature (Cohen et al., 2019, *Nat. Hazards Earth Syst. Sci.*) shows HAND performs best on 4th-order and higher streams — exactly our case.
- TSM already has the key static inputs: DEMs, and the NHDPlus hydrography is public.
- Pre-computed national HAND/REM/SRC products may already exist for HUC 05120113 on the ESIP S3 bucket — potentially no pipeline run needed at all.

**Doesn't fit:**
- HAND assumes a uniform, level water surface per reach segment. It cannot represent backwater effects at the confluence, levee overtopping dynamics, or the drawdown near J.T. Myers dam. For the *confluence specifically*, this is a real limitation.
- Published validation is blunt: HAND "does not accurately capture inundated cells" at cell level but "is quite capable of highlighting regions likely to be at risk." It is a screening tool, not a design tool. **Do not use HAND output for anything resembling a regulatory determination.**
- The full pipeline is heavy: ~400 GB of inputs, Docker-based, multi-day for a full domain. Single-HUC8 runs are feasible but still nontrivial.

### Installation

```bash
git clone https://github.com/NOAA-OWP/inundation-mapping.git
cd inundation-mapping

# Docker (all dependencies managed in-container)
docker build -f Dockerfile.dev -t fim_4:dev .

# Inputs live on the ESIP S3 bucket (public dataset, ~400 GB full domain)
# s3://noaa-nws-owp-fim  (us-east-1)
# ESIP credentials: contact Carson Pruitt (carson.pruitt@noaa.gov)
# or Fernando Salas (fernando.salas@noaa.gov) — no personal AWS account needed.

# Download just our HUC8 (05120113) inputs:
aws s3 sync s3://noaa-nws-owp-fim/hand_fim/inputs/05120113 \
    /data/inputs/05120113 --profile esip
```

### Minimal run (single HUC8)

```bash
# Inside the Docker container:
#   -v /path/to/inundation-mapping:/foss_fim
#   -v /data/inputs:/data
#   -v /data/outputs:/outputs

# Full pipeline for HUC 05120113:
fim_pipeline.sh -u 05120113 -n tsm_confluence_v1 -o

# Or stage by stage:
fim_pre_processing.sh -u 05120113 -n tsm_confluence_v1   # REM, SRCs, catchments
fim_process_unit_wb.sh -u 05120113 -n tsm_confluence_v1  # FIM for a flow
fim_post_processing.sh -n tsm_confluence_v1             # aggregate + QA
```

### TSM-specific shortcut: check for pre-computed products first

Before running anything, check whether FIM v4 outputs already cover HUC 05120113:

```bash
aws s3 ls s3://noaa-nws-owp-fim/hand_fim/ --profile esip | grep 05120113
```

If present, download the REM + SRCs directly and skip the 400 GB input sync. The inundation step then reduces to: pick a discharge (e.g., from USGS 03381700 during the 2011 event), look up depth on the SRC, subtract from REM. That is a ~50-line Python script, not a pipeline run.

### Minimal Python: HAND inundation from pre-computed REM + SRC

```python
"""HAND inundation for HUC 05120113 from pre-computed OWP products."""
import numpy as np
import rasterio

# 1. Load the Relative Elevation Model for our HUC
with rasterio.open("hand_4_x/rem_05120113.tif") as src:
    rem = src.read(1)          # meters above nearest drainage
    profile = src.profile

# 2. Synthetic rating curve for the Ohio River reach at the confluence.
#    (from OWP SRC CSV: discharge_cms -> stage_m)
#    Example row for illustration — use the actual SRC for the reach.
src_table = np.array([
    # Q_cms,  depth_m
    [  5000,   1.2],
    [ 15000,   3.8],
    [ 30000,   6.5],
    [ 45000,   9.1],
])

def depth_from_discharge(q_cms: float) -> float:
    return float(np.interp(q_cms, src_table[:, 0], src_table[:, 1]))

# 3. April 2011 peak at Old Shawneetown ≈ 1,100,000 cfs ≈ 31,150 cms
depth_m = depth_from_discharge(31150)

# 4. Inundation: cells where water depth exceeds height above drainage
inundated = rem < depth_m
flood_depth = np.where(inundated, depth_m - rem, 0.0)

# 5. Write depth grid (compare against BFE 369.1 ft NAVD88 at anchor)
with rasterio.open("tsm_hand_2011_depth.tif", "w", **profile) as dst:
    dst.write(flood_depth.astype(np.float32), 1)

print(f"Depth at channel: {depth_m:.2f} m; "
      f"inundated cells: {inundated.sum()} / {inundated.size}")
```

### GPU requirements

**None.** HAND is a GIS raster workflow (GDAL/whitebox-style terrain analysis + arithmetic). It runs on CPU. The heavy part is I/O and preprocessing, not compute.

### Integration effort: LOW (if pre-computed products exist) to MEDIUM (full pipeline)

- Check S3 for existing HUC 05120113 products: 1 hour
- Download + screening script: 1 day
- Full `fim_pipeline.sh` run for the HUC: 2–5 days including Docker setup and input sync
- Calibration of Manning's n in the SRCs (the literature's #1 accuracy lever): 1–2 weeks

---

## 3. Recommendation: which to prioritize

| Criterion | SFINCS (via HydroMT) | NOAA HAND |
|-----------|---------------------|-----------|
| Physics fidelity at confluence | ✅ Dynamic 2D, handles backwater | ❌ Uniform water surface per reach |
| Setup effort | HIGH (weeks) | LOW–MEDIUM (days) |
| Regulatory defensibility | Higher (real hydrodynamic model) | Low (screening only) |
| GPU needed | No | No |
| TSM data readiness | Mostly ready (DEM, gages; Manning map TBD) | Ready (DEM exists; check S3 first) |
| Best use in TSM | **Design/analysis:** berm placement, scenario modeling | **Screening/triage:** rapid "what-if" extents |

**Prioritize HAND first** — it can produce a first inundation screening for the confluence within days using data TSM already holds, and it validates the DEM/hydrography plumbing that SFINCS will also need. **Then invest in SFINCS** for the dynamic modeling the confluence actually requires (backwater, dam operations, berm scenarios). The two are complementary, not competing: HAND screens, SFINCS analyzes.

**Do not prioritize SynxFlow** (CUDA solver from the original list) for TSM now: it is less mature, GPU-gated, and SFINCS covers the same use case on CPU with Deltares support.

### Suggested sequencing

1. **Week 1:** Check ESIP S3 for HUC 05120113 HAND products; run the screening script above against the 2011 event; compare inundation edge against BFE 369.1 ft contour and FIS cross-sections.
2. **Weeks 2–3:** Install HydroMT + hydromt_sfincs; write `data_catalog_tsm.yml`; build first SFINCS grid for the confluence.
3. **Weeks 4–6:** Calibrate SFINCS against 2011 (and 1937 if data allows); validate against USGS high-water marks.
4. **Later:** hydromt_fiat for damage estimation against the 23,082 building features.

### Standing caveats (non-negotiable)

- Neither tool's output is a regulatory flood determination. The regulatory BFE remains **369.1 ft NAVD88** per FIS 18129CV000A Table 9.
- TSM's berm/road designs are **conceptual / NOT FOR CONSTRUCTION / PE REVIEW REQUIRED** — do not feed them into SFINCS as if they were as-built.
- SFINCS is GPL-3.0; hydromt core is MIT. If TSM distributes a combined work with SFINCS-linked code, GPL obligations apply. Keep the solver behind a clean interface (Docker boundary counts).

---

## References

- Eilander et al. (2023). HydroMT: Automated and reproducible model building and analysis. *J. Open Source Software*, 8(83), 4897. https://doi.org/10.21105/joss.04897
- Leijnse et al. (2021). SFINCS paper. *Coastal Engineering*. https://doi.org/10.1016/j.coastaleng.2020.103796
- Cohen et al. (2019). NWM–HAND evaluation. *Nat. Hazards Earth Syst. Sci.*, 19, 2405–2420. https://doi.org/10.5194/nhess-19-2405-2019
- HydroMT docs: https://deltares.github.io/hydromt/
- SFINCS manual: https://sfincs.readthedocs.io/en/latest/
- SFINCS source: https://github.com/Deltares/SFINCS
- SFINCS CPU Docker: https://hub.docker.com/r/deltares/sfincs-cpu
- NOAA-OWP inundation-mapping: https://github.com/NOAA-OWP/inundation-mapping
- NOAA-OWP FIM data: `s3://noaa-nws-owp-fim` (us-east-1, ESIP credentials via carson.pruitt@noaa.gov)
