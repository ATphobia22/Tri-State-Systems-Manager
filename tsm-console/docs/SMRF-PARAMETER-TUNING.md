# SMRF parameter tuning — TSM / PDAL

Simple Morphological Filter (Pingel et al. 2013), exposed as `filters.smrf`.

Prefer vendor **Class 2** on Indiana 3DEP QL2 when QA passes. Tune SMRF only when reclassifying or when ground leakage is visible in QGIS/PDAL previews.

---

## 1. Parameters (PDAL)

| Option | Default (PDAL) | Role |
|--------|----------------|------|
| **cell** | 1.0 | Grid cell size for the morphological surface (map units) |
| **slope** | 0.15 | Rise/run slope tolerance; opens height threshold as windows grow |
| **window** | 18.0 | Max window radius (map units) — largest feature you intend to *remove* as non-ground |
| **threshold** | 0.5 | Base elevation threshold (map units) vs progressive surface |
| **scalar** | 1.25 | Scales threshold on steeper progressive slopes |
| **returns** | (impl-dependent) | Often `last,only` for ground |
| **where** / **ignore** | — | Skip noise (Class 7) during segmentation |
| **ground_class** | 2 | ASPRS ground |
| **other_class** | 1 | Non-ground label |
| **cut** | 0.0 | Net cutting; 0 skips |
| **classbits** | empty | Optionally ignore synthetic/keypoint/withheld |

Units follow the point cloud CRS. For **EPSG:2966** (US survey feet), thresholds and windows are in **feet**, not meters — convert literature meter values (× ~3.28084) when porting Pingel table values.

---

## 2. Literature anchors (Pingel 2013)

General starting set (paper, meter-based terrain):

- slope tolerance ≈ **15%** (0.15)  
- max window ≈ **18 m**  
- elevation threshold ≈ **0.5 m**  
- elevation scaling factor ≈ **1.25**

**Sample 1 optimized** (Table 3; also PDAL docs example):

| Param | Value |
|-------|--------|
| slope | 0.20 |
| window | 16 |
| threshold | 0.45 |
| scalar | 1.2 |

Sensitivity (paper): performance drops hard if slope ≲ 0.10 or max window ≲ 10 m; window typically **> 10 m** and slope **> ~10%** for good mean Kappa on their samples.

---

## 3. What each knob does in practice

| If you see… | Try… |
|-------------|------|
| Buildings/veg left in “ground” | Larger **window** (span the object); slightly lower **threshold** |
| Ground eroded on gentle rises | Higher **threshold** or **scalar**; slightly higher **slope** |
| Hills chopped / terrace artifacts | Higher **slope** (allow steeper progressive surface) |
| Low pits still seed the surface | Run **filters.elm** + **outlier** *before* SMRF; `where`/`ignore` Class 7 |
| Bridges/overpasses as ground | Larger window; post-filter Class 17 if present; breaklines in DEM |
| Too few ground points on flat fields | Lower threshold slightly; ensure `returns` includes only/last as appropriate |

**window** ≈ size of largest non-ground feature to strip (building width, dense tree clump).  
**slope** ≈ how aggressively height thresholds grow — not identical to terrain slope in degrees, but correlated with “how steep can progressive ground be.”

---

## 4. Posey / Point Township starting presets

Alluvial floodplain, farm fields, sparse structures, levee/berm features. Clouds in **ftUS (2966)**.

### Preset A — Pingel Sample 1 (convert m → ft)

| Param | meters (paper) | feet (≈) |
|-------|----------------|----------|
| slope | 0.20 | 0.20 (dimensionless) |
| window | 16 m | **52.5** |
| threshold | 0.45 m | **1.48** |
| scalar | 1.2 | 1.2 |

### Preset B — flat floodplain conservative (ft)

```json
{
  "type": "filters.smrf",
  "returns": "last,only",
  "ignore": "Classification[7:7]",
  "cell": 3.0,
  "slope": 0.15,
  "window": 60.0,
  "threshold": 1.5,
  "scalar": 1.2
}
```

- **window 60 ft** — strip small outbuildings / equipment while keeping field ground  
- **threshold ~1.5 ft** — order of QL2 vertical noise + margin  
- **cell 3 ft** — denser progressive grid than 1 m default when working in feet  

### Preset C — near structures / berm (ft)

```json
{
  "type": "filters.smrf",
  "returns": "last,only",
  "ignore": "Classification[7:7]",
  "cell": 2.0,
  "slope": 0.20,
  "window": 100.0,
  "threshold": 1.2,
  "scalar": 1.25
}
```

Larger window to clear buildings; verify berm toes are not classified away — LOMA LAG uses **min Class 2 in foundation buffer**, so over-stripping ground near the structure is worse than leaving a few veg points outside the buffer.

---

## 5. Tuning workflow

1. **ELM + outlier** first; never let Class 7 seed SMRF.  
2. Start Preset B (floodplain) or Sample-1-in-feet.  
3. Visualize ground-only vs residual in QGIS (or PDAL → LAS → hillshade).  
4. Adjust **one** family at a time: window (object size) → threshold (z tightness) → slope/scalar (relief).  
5. Compare against **surveyed** marks / known road elevations when available.  
6. Freeze pipeline JSON + PDAL version + source LAS hash in Evidence Ledger.  
7. For Bonebank LOMA: still require adjacent tiles if structure grade sits above low-ground tile max; SMRF does not invent points outside the tile.

---

## 6. Pipeline reference

Updated: `pipelines/pdal/ground_reclassify_smrf.json` (floodplain-ft preset + comments in README).

```bash
pdal pipeline pipelines/pdal/ground_reclassify_smrf.json \
  --readers.las.filename=/data/tile.laz \
  --writers.las.filename=/data/ground_only.laz
```

---

## 7. Authority

SMRF output is **DERIVATION**. Vendor 3DEP Class 2 is preferred **OBSERVATION** snapshot when sealed. Human review of LAG vs BFE **375.0** remains mandatory before any map amendment package.
