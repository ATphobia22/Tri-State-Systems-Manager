# PDAL pipeline configuration & HEC-RAS mesh generation — TSM

---

## 1. PDAL pipeline configuration

### Shape

A pipeline is a JSON **array of stages** (modern form). Older docs wrap the array in `{ "pipeline": [ ... ] }` — both are common; CLI accepts either depending on version.

Stages are:

| Kind | Role | Example `type` |
|------|------|----------------|
| **Reader** | Ingest | `readers.las` |
| **Filter** | Transform / cull / classify | `filters.crop`, `filters.expression`, `filters.smrf` |
| **Writer** | Emit | `writers.las`, `writers.gdal`, `writers.text` |

### Stage object fields

```json
{
  "type": "filters.crop",
  "tag": "aoi",
  "inputs": ["upstream_tag"],
  "polygon": "POLYGON((...))"
}
```

- **`type`** — required for filters; readers/writers may be inferred from filename strings  
- **`tag`** — unique name for graph edges  
- **`inputs`** — explicit predecessors (multi-reader merge graphs)  
- Stage-specific options (`limits`, `expression`, `filename`, `default_srs`, …)

Linear pipelines omit `inputs` (implicit previous stage).

### CLI overrides

```bash
pdal pipeline lag.json \
  --readers.las.filename=/data/IN2020_26800940_12.las \
  --filters.crop.polygon="POLYGON((...))" \
  --writers.text.filename=out/lag_stats.csv

# By tag when multiple stages share a type:
pdal pipeline multi.json --stage.las1.filename=a.las --stage.las2.filename=b.las
```

### Configuration patterns for TSM

| Goal | Pattern |
|------|---------|
| LAG on classified 3DEP | crop → expression Class 2 → stats/text (streamable) |
| Reclassify bad tiles | assign 0 → elm → outlier → smrf → Class 2 → las |
| County ground extract | merge tiles → Class 2 → laszip |
| DEM product | Class 2 → `writers.gdal` (resolution, output_type min) |

**Always set SRS explicitly** for Indiana West work: `default_srs` / `override_srs`: **EPSG:2966**.

### Stream vs standard

- Stream if **every** stage is streamable (crop, expression, many writers).  
- SMRF / PMF / outlier neighborhoods → standard mode.  
- Force standard: `pdal pipeline file.json --nostream`.

### Evidence hygiene

Hash: source LAS + pipeline JSON + PDAL version. Store as EvidenceArtifact parents before LAG number enters a LOMA packet.

Existing files:

- `pipelines/pdal/lag_extract_optimized.json`  
- `pipelines/pdal/ground_extract_stream.json`  
- `pipelines/pdal/ground_reclassify_smrf.json`  
- `pipelines/pdal/STREAM-MODE.md`

---

## 2. HEC-RAS 2D mesh generation

### Build sequence

1. Define **2D Flow Area** perimeter  
2. Set **nominal cell spacing** (computation points)  
3. Add **breaklines** on flow controls  
4. Add **refinement regions** where resolution must change  
5. Generate / regenerate mesh; inspect cell quality  
6. Link 1D laterals if combined model  

### Nominal spacing (order-of-magnitude)

| Context | Typical starting spacing |
|---------||---------------------------|
| Broad floodplain | 100–200 ft |
| Urban / structures | 50 ft refinement |
| Tight channels / levees | 10–50 ft along breaklines |

Posey prior notes used ~10 ft in critical corridors — valid only if Courant/runtime allow.

### Breaklines

Force **cell faces** along barriers and preferred flow paths:

- Levees, berms (Bonebank berm crest context)  
- Channel banks / thalweg  
- Roads, rail, floodwalls  
- Weir/lateral structure alignments  

Attributes (RAS Mapper):

| Property | Meaning |
|----------|---------|
| Near Spacing | Cell size along breakline |
| Near Repeats | How many rows of that spacing grow outward |
| Far Spacing | Cap on grown cell size |
| 1 Cell Protection Radius | Protect near-breakline cells from later enforcements |

Process: points in a buffer around the breakline are cleared; new cells laid along the line; influence stops at neighboring breaklines.

### Refinement regions

Polygon with interior **Cell Size X/Y**; perimeter behaves like a breakline (spacing / repeats / far / protection). Use for towns, steep zones, or channel belts without global fine mesh.

### Quality rules

- Prefer breaklines/regions over one-off manual node edits (reproducible)  
- Hydro-enforce roads/rail (connectivity through high ground) before final channel nips  
- Avoid abrupt cell-size jumps — transition with repeats or intermediate regions  
- After mesh: check face alignment on crests; run Courant maps  

### Terrain

Mesh sits on **RAS terrain** (usually hydro-conditioned DEM from Class 2 + breaklines). Indiana 3DEP hydro-flattened DEM is the right family of input; project CRS should match analysis (**EPSG:2966** ftUS) or be transformed deliberately.

### Into TSM

Mesh + terrain + plan files are **MODEL** inputs. Depth/WSE GeoTIFF exports feed `scripts/ras-geotiff-ingest.mjs`. Geometry changes → new content hashes; do not silently overwrite sealed evidence.

---

## 3. Authority

| Artifact | Class |
|----------|--------|
| PDAL pipeline JSON + LAS hash | DERIVATION tooling |
| LAG min from Class 2 buffer | DERIVATION |
| HEC-RAS mesh / plan | MODEL |
| LOMA / floodway decision | Human + agency |

Technology informs; it does not silently govern.

See also: [PDAL-CLASSIFICATION-FILTERS-AND-QGIS-MESH.md](./PDAL-CLASSIFICATION-FILTERS-AND-QGIS-MESH.md).
