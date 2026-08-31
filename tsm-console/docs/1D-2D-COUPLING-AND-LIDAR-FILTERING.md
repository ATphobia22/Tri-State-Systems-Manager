# 1D–2D coupling & LiDAR filtering — TSM

Complements `HEC-RAS-AND-LIDAR-CLASSIFICATION.md`. Scientific plane guidance only.

---

## 1. HEC-RAS 1D–2D coupling techniques

### Why couple

| Domain | Strength |
|--------|----------|
| **1D reach** | Efficient mainstem Wabash/Ohio conveyance, rating curves, structures |
| **2D flow area** | Overbank, interior drainage, levee-protected areas, multi-directional flow |

Posey pattern: 1D channel + 2D overbank/floodplain (Point Township ring levees, Mount Vernon outfalls).

### Primary connection: Lateral Structure → 2D Flow Area

USACE workflow:

1. Digitize **Lateral Structure** along levee / bank / overtopping path (georeferenced).
2. Headwater: 1D river stationing (XS upstream/downstream of structure).
3. Tailwater **Type** = Storage Area / **2D Flow Area** → select the 2D area.
4. Define **weir/embankment** station–elevation profile (crest).
5. HEC-RAS links weir stations to 2D **face points** (default or manual).

### Flow transfer options

| Option | When |
|--------|------|
| **1D Weir equation** | Free overflow, critical depth over crest — often more accurate WSEs |
| **Normal 2D Equation Domain** | Submerged exchange; zero-height “open” connection cases |
| Low weir coefficient | 1D→2D lateral links — high \(C_w\) can over-transfer flow |

Rule of thumb (USACE weir guide): free-flowing / critical → **weir equation**; submerged → **2D equations**. Mesh faces should align with structure; avoid faces on steep embankment slopes.

### Other coupling patterns

- **2D Area Connection** (internal structure inside one 2D mesh) — breakline-enforced  
- **1D junction / SA** legacy links still valid where storage dominates  
- **Time slicing**: if 2D needs smaller \(\Delta t\) than 1D, enable time slicing so 2D substeps inside 1D step  
- Courant maps after coupling — hot cells often at lateral structure faces  

### TSM evidence handling

- Geometry + plan + terrain hashes → EvidenceArtifact parents  
- Depth/WSE GeoTIFF → `ras-geotiff-ingest.mjs` (`DERIVATION` / `MODEL`)  
- Coupled run is **not** a FEMA FIS substitute without peer review  

---

## 2. LiDAR data filtering methods

Filtering = noise removal + (re)classification before LAG / DEM use.

### Stage order (recommended)

```
read → (reproject) → assign Class=0 if reclassifying
     → ELM (low pits) → outlier (statistical/radius)
     → SMRF or PMF (ground) ignore Class 7
     → expression Classification == 2
     → crop to foundation buffer (LAG)
     → stats / write
```

For **already classified** Indiana 3DEP QL2 tiles: prefer vendor **Class 2**; filter only if QA fails. Bonebank LOMA path: crop + Class 2 expression (streamable).

### Filter roles

| Filter | Role |
|--------|------|
| **filters.elm** | Extended Local Minimum — flags low pit noise that wrecks morphological ground filters |
| **filters.outlier** | Statistical or radius isolation → Class 7 |
| **filters.smrf** | Simple Morphological Filter — preferred ground segmenter in modern PDAL |
| **filters.pmf** | Progressive Morphological Filter (Zhang 2003) — alternative; SMRF often better behaved |
| **filters.expression / range** | Keep Class 2; drop 7/18; Z gates |
| **filters.crop** | Spatial AOI / foundation buffer — do early when possible |

### SMRF notes

- Often restrict to **last / only** returns for ground  
- `ignore` Class 7 so outliers do not seed the surface  
- Tune `slope`, `window`, `threshold`, `scalar` to terrain (flatter Posey alluvium vs bluffs)  

### PMF notes

- `slope`, `initial_distance` (z noise), `max_window_size`  
- Large windows = more iterations / cost  
- PDAL docs: prefer SMRF over PMF in most cases  

### Stream mode

ELM / outlier / SMRF / PMF generally need **neighborhood context** → often **non-streamable**.  
LAG on pre-classified tiles (crop + expression + writer) **can** stream.

### TSM policy

| Product | Filter policy |
|---------|----------------|
| GIO/3DEP Class 2 LAG | Crop + Class 2; optional light outlier QA |
| Unclassified / bad class tiles | Full ELM → outlier → SMRF → Class 2 extract |
| Evidence | Hash source LAS + pipeline JSON + software versions |

---

## 3. Pipeline sketch (reclassify when needed)

See `pipelines/pdal/ground_reclassify_smrf.json` for a non-stream template.  
Production LOMA still requires human review of \(\Delta_z = \mathrm{LAG} - \mathrm{BFE}\).

See also: [PDAL-CLASSIFICATION-FILTERS-AND-QGIS-MESH.md](./PDAL-CLASSIFICATION-FILTERS-AND-QGIS-MESH.md).
