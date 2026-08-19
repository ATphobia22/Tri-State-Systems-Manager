# HEC-RAS 2D Mesh Generation — TSM Scientific Plane

Reference: USACE HEC RAS Mapper documentation (2D Flow Areas).

## Mesh generation order (RAS)

1. Computation points layer (base grid)
2. Insert refinement region points + perimeter as breaklines
3. Insert breakline points (override points in buffer)
4. Triangulate computation points
5. Build computational mesh from triangulation

## Creating a 2D Flow Area

1. Draw **Perimeter** polygon in RAS Mapper
2. Open **2D Flow Area Editor**
3. Set nominal **DX / DY** point spacing (cell center spacing)
4. **Generate Computational Points** on regular interval
5. Refine with:
   - **Breaklines** (levees, roads, channel centerlines, banks)
   - **Refinement Regions** (finer cells where needed)
   - Optional hand-edited points

## Breakline parameters

| Property | Meaning |
|----------|---------|
| Near Spacing | Cell size along breakline (default = area spacing) |
| Near Repeats | How many rings of Near Spacing laterally |
| Far Spacing | Max cell size as spacing transitions away |
| Enforce | Align faces to breakline so flow cannot cross until WSE exceeds terrain along face |

**Enforce Selected Breaklines** improves face alignment for barriers (levees, embankments).

## Hydraulic property tables

- Each cell stores elevation–volume from underlying terrain
- Each face stores elevation vs area, wetted perimeter, roughness
- Allows **larger cells** while preserving high-res terrain detail in pre-processor
- Run **Compute 2D Flow Areas Hydraulic Tables** in RAS Mapper (or auto at unsteady run)

## TSM Bonebank / Posey guidance (decision support)

| Zone | Suggested starting spacing | Breaklines |
|------|---------------------------|------------|
| Main channel / Wabash–Ohio influence | Finer (e.g. 25–50 ft) | Thalweg, banks |
| Floodplain / overbank | Coarser (e.g. 100–250 ft) | Roads, berms, levees |
| Structure / berm crest (379.8 ft) | Enforce breakline | Berm centerline |

All spacings are **engineering judgment** — final mesh requires PE review.  
Outputs → EvidenceArtifact `MODEL_OUTPUT` with software_version, mesh parameters, terrain hash.

## Terrain input (HEC-HMS / RAS shared)

From HEC-HMS Terrain Data docs: continuous DEM linked to basin models; GDAL rasters supported.  
TSM path: IGIO `mosaic/dem` or derived GeoTIFF → RAS Terrain → 2D mesh.

