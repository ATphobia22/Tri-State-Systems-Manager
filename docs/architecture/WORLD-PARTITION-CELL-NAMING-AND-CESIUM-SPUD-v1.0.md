# World Partition Cell Naming, Cesium vs SPUD, and Streaming Adoption

**Version:** 1.0.0  
**Date:** 2026-10-24  
**Plane:** Native UE (Scientific Visualization) — informational only; not regulatory elevation or flood products.

---

## 1. World Partition cell naming changes (UE 5.4 → 5.5+)

### What changed

Epic evolved World Partition’s **runtime hash** and **cell identity** strings:

| Era | Typical cell name pattern | Notes |
|-----|---------------------------|--------|
| UE 5.0–5.4 (Spatial Hash style) | `{Map}_MainGrid_{X}_{Y}_{Z}_{Level}` e.g. `MAP_MainGrid_0_0_0_5` | Grid indices + discrete level suffix |
| UE 5.5+ (Loose Hierarchical / Runtime Hash) | `{Map}_MainGrid_L{level}_X{x}_Y{y}_Z{z}` e.g. `MAP_MainGrid_L5_X0_Y0_Z0` | Explicit **L / X / Y / Z** tokens; hierarchical levels |

Cell **GUIDs** and cooked package identities are derived from these names. When the naming scheme changes, any system that **keys saved state by cell name or GUID** can fail to reattach actors after an engine upgrade.

### Why it matters (SPUD / custom persistence)

[sinbad/SPUD](https://github.com/sinbad/SPUD) issue discussions (e.g. #117) report that upgrading **5.4 → 5.5** regenerates cell identities so previously saved LevelActors maps no longer match loaded cells. Persistence that assumes stable `MainGrid_*` strings breaks.

### TSM guidance

1. **Do not** key long-lived evidence or scenario state by UE cell name strings.
2. Prefer **stable domain keys**: site APN, USGS site number, H3 cell index, CRS coordinates (EPSG:2966 / WGS84), or content hashes.
3. If native actor persistence is required, use **location/bounds-based** buckets (as SPUD maintainers have discussed) rather than engine cell names.
4. After any UE minor upgrade, **re-cook** WP streaming generation and treat old cell-keyed saves as non-portable unless a migration tool exists.
5. Runtime distance streaming uses **content bounds** of cells; large actors may promote to parent hierarchical cells (L>0). Name format and hierarchy level both affect identity.

### Related engine evolution

- **5.4:** New Runtime Hash, 3D-capable Loose Hierarchical Grid, custom partition objects.
- **5.5:** Runtime Cell Transformers; continued HLOD/Data Layer stacking.
- **5.6:** Streaming performance, FastGeo for immutable static geometry, async WP streaming state updates.

Authoritative ops notes: Epic [World Building Guide](https://dev.epicgames.com/community/learning/knowledge-base/r6wl/unreal-engine-world-building-guide) and [World Partition docs](https://docs.unrealengine.com/world-partition-in-unreal-engine/).

---

## 2. Cesium vs SPUD — difference

| Dimension | **Cesium for Unreal** | **SPUD** |
|-----------|------------------------|----------|
| **Problem solved** | Stream **real-world geospatial content** (terrain, photogrammetry, buildings) as **3D Tiles** on a WGS84 globe | **Persist game/actor state** across save/load and across **streamed / World Partition cells** |
| **Primary data** | External tilesets (Cesium ion, self-hosted 3D Tiles, OSM buildings, imagery) | UE actors/properties marked SaveGame / `ISpudObject` |
| **Streaming model** | Hierarchical 3D Tiles LOD by view | UE level/WP cell load-unload events |
| **Depends on WP?** | Can coexist; tilesets need careful Data Layer / “Is Spatially Loaded” setup | Explicitly supports WP (`bSupportWorldPartition`) |
| **Georeference** | `CesiumGeoreference` anchors globe | N/A (local UE world coordinates) |
| **Elevation authority** | Source-dependent (Ion vs Google tiles may disagree) — **not** FEMA BFE | N/A |
| **TSM use** | Native **digital twin** of Tri-State real world | Optional **scenario marker / actor memory** if cells unload |
| **License / access** | Apache-2.0 plugin ([CesiumGS/cesium-unreal](https://github.com/CesiumGS/cesium-unreal)) | MIT ([sinbad/SPUD](https://github.com/sinbad/SPUD)) |

**One-line summary:**  
**Cesium streams the planet into Unreal. SPUD remembers what you did in the cells that streamed out.**

They are complementary, not alternatives. TSM can use Cesium without SPUD; SPUD without Cesium; or both.

---

## 3. Expanded repository list (World Partition / terrain / spatial)

### P0

| Repo / source | Role |
|---------------|------|
| [CesiumGS/cesium-unreal](https://github.com/CesiumGS/cesium-unreal) | 3D Tiles + globe in UE 5.6–5.8 |
| Epic World Partition + World Building Guide + FastGeo | Engine streaming authority |
| [igor-suhorukov/openstreetmap_h3](https://github.com/igor-suhorukov/openstreetmap_h3) | OSM → H3-partitioned PostGIS (analytics plane) |

### P1

| Repo | Role |
|------|------|
| [sinbad/SPUD](https://github.com/sinbad/SPUD) | WP-aware persistence |
| [gregorik/TerraDyne](https://github.com/gregorik/TerraDyne) | UE 5.7 Landscape plugin + Virtual Heightfield Mesh |
| [Manu2402/Drop-by-Drop](https://github.com/Manu2402/Drop-by-Drop) | Heightmap → Landscape + WP proxies + erosion |
| [adventuresincausality/game-development-constitution](https://github.com/adventuresincausality/game-development-constitution) | UE 5.8 WP operational skill docs |
| [LocomotionUK/pxlstrm_multiplayer](https://github.com/LocomotionUK/pxlstrm_multiplayer) / make-live multiplayer | WP + Pixel Streaming templates |

### P2 / reference

| Repo | Role |
|------|------|
| [Blika/HeightmapGenerator_UE5](https://github.com/Blika/HeightmapGenerator_UE5) | Mesh → heightmap |
| [04AR/Godot_Chunker](https://github.com/04AR/Godot_Chunker) | Chunk patterns (Godot only) |
| [wme7/MeshPartitioning](https://github.com/wme7/MeshPartitioning) | METIS mesh partition examples |
| VoxelPlugin (marketplace/private) | Voxel chunk streaming concept |
| Epic Mesh Terrain (SOU 2026) | Next-gen mesh terrain + WP |
| Epic City Sample | Dense open-world streaming reference |

### Skip for TSM

Linux MTD partition trees, pure BSP LOS demos, unrelated admin frameworks, Unity-only World Partition ports.

---

## 4. TSM implementation stance (locked)

| Plane | Choice |
|-------|--------|
| Web | MapLibre + Martin/PMTiles + H3 |
| Native visualization | Cesium for Unreal for real-world tiles; WP + Landscape for authored local content |
| Actor persistence | SPUD only if required; **never** key evidence by WP cell name |
| OSM bulk | openstreetmap_h3 offline ETL |
| Research Landscape tools | TerraDyne / Drop-by-Drop optional |

Streamed geometry and tiles remain **informational**. Human authority remains final for flood, elevation, and regulatory claims.
