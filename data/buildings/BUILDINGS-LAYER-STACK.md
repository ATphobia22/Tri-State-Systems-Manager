# Buildings layer stack — join map

## building vs building_part (Overture)

| Type | Meaning |
|------|---------|
| **`building`** | Whole structure footprint. One feature ≈ one building. Optional `height`, `num_floors`, multi-source. |
| **`building_part`** | Sub-volume for 3D massing (wing/tower). Links via `building_id` to parent `building`. Rare in rural Posey (**15** vs **24k** buildings). |

Use **`building`** for 2D/screening maps. Use **`building_part`** only for complex 3D massing.

## TSM stack

```text
IGIO / LiDAR + NDHM → buildings-3d.json (22,815, height_m)
        ↓ 20 m centroid gate
Microsoft ML heights (tile 032000212)
        ↓ independent open inventory
Overture building (24,375 Posey) + building_part (15)
```

| Layer | Map role | Authority |
|-------|----------|-----------|
| buildings-3d / 3D Tiles | Production extrusion screening | DERIVED |
| Microsoft footprints | Independent height check | DERIVED (ML) |
| Overture building | Open basemap conflation | ODbL |
| Overture building_part | Optional 3D detail | ODbL |
| Scenario cascade pins | Facility residual risk | SIMULATION_DEMO |

## Join keys

- Spatial: centroid ≤ 20 m (MS ↔ TSM).
- Overture: `building_part.building_id` → `building.id`.

Production Twin path remains buildings-3d + terrain + flood layers; MS/Overture are validation / optional DERIVED overlays.
