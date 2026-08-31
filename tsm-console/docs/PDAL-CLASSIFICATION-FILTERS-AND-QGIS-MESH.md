# PDAL classification filters & QGIS mesh visualization — TSM

---

## 1. PDAL filters for classification

### Ground / non-ground

| Filter | Method | Notes |
|--------|--------|-------|
| **filters.smrf** | Simple Morphological (Pingel 2013) | Preferred default in modern PDAL |
| **filters.pmf** | Progressive Morphological (Zhang 2003) | Alternative; more degenerate cases |
| **filters.csf** | Cloth Simulation (Zhang 2016) | Another ground/non-ground option |
| **filters.skewnessbalancing** | Bartels 2010 | Less common |
| **filters.sparsesurface** | Sparsify ground; low noise neighbors | Post-ground cleanup |

**SMRF key options:** `slope`, `window`, `threshold`, `scalar`, `returns` (e.g. `last,only`), `ignore` / `where` (skip Class 7), `ground_class` (default 2), `other_class` (default 1).

**PMF key options:** `cell_size`, `slope`, `initial_distance`, `max_window_size`, `max_distance`, `returns`.

### Noise

| Filter | Role |
|--------|------|
| **filters.elm** | Extended Local Minimum — low pits |
| **filters.outlier** | Statistical or radius isolation → Class 7 |

### Assignment & selection

| Filter | Role |
|--------|------|
| **filters.assign** | Force dimensions (e.g. `Classification = 0` before reclass) |
| **filters.expression** | Keep points matching expression (`Classification == 2`) |
| **filters.range** | Legacy range syntax; prefer expression for new work |
| **filters.returns** | Split/filter by return type |

### Recommended chains

**A. Vendor Class 2 is good (Indiana 3DEP):**

```text
readers.las → crop(buffer) → expression(Classification == 2) → stats/writer
```

**B. Reclassify from scratch:**

```text
assign(Class=0) → elm → outlier → smrf(ignore 7, last/only) → expression(Class==2)
```

See `pipelines/pdal/ground_reclassify_smrf.json` and `lag_extract_optimized.json`.

### Streamability

- **expression / crop / assign** — typically streamable  
- **smrf / pmf / csf / outlier / elm** — neighborhood; usually **standard mode**

---

## 2. QGIS for mesh visualization

### Why QGIS in the TSM stack

Open-source review client for HEC-RAS geometry and results **before** twin ingest. Complements RAS Mapper; does not replace USACE peer review.

### Mesh layers (MDAL)

QGIS loads meshes via **MDAL** drivers. Supported hydraulic-related formats include variants used by HEC-RAS, TUFLOW, TELEMAC/SELAFIN, UGRID, XMDF, NetCDF, GRIB, and others (availability depends on QGIS/MDAL build).

**Load:** Data Source Manager → **Mesh** tab → select file → Add.

**Symbology:**

- Scalar contours (depth, WSE) with color ramps / breaks  
- Vector arrows (velocity)  
- Native mesh vs triangular rendering  
- 3D view + print layouts  

### HEC-RAS practical paths

| Path | What you see |
|------|----------------|
| RAS Mapper export **GeoTIFF** depth/WSE | Raster in QGIS (simplest QA) |
| Mesh / HDF via MDAL or community plugins | Cells, faces, time series where supported |
| **ras-commander-qgis** (community) | Processing tools for RAS 6.x geometry/results (mesh cells, breaklines, max WSE points, etc.) |

Always confirm driver support for your exact HEC-RAS version and file type.

### Recommended QA workflow (Posey)

1. Open hydro-conditioned DEM + NFHL/BAFM overlays (EPSG:2966 or on-the-fly transform).  
2. Load max depth / WSE GeoTIFF from RAS Mapper.  
3. Optionally load mesh perimeter, breaklines, 2D cells.  
4. Compare wet edge vs FEMA Zone AE / BFE **375.0** context at Bonebank.  
5. Export screenshots only as **VISUALIZATION**; sealed evidence remains GeoTIFF + plan hash via `ras-geotiff-ingest.mjs`.

### CRS discipline

- Analysis: **EPSG:2966** (NAD83 / Indiana West ftUS) + **NAVD88**  
- Web maps may show **3857** — do not paste web meters into LAG math  
- QGIS: set project CRS deliberately; check layer CRS before measuring feet  

---

## 3. Authority boundary

| Activity | Class |
|----------|--------|
| PDAL class filters | DERIVATION tooling |
| QGIS mesh/raster view | VISUALIZATION / QA |
| Ingested RAS cells | DERIVATION / MODEL |
| Regulatory map change | Human + FEMA/IDNR |

Technology informs; it does not silently govern.
