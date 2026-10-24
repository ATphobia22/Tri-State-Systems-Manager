# Apple Compass, Waypoints & Motion 3D Orientation — TSM Notes (v1.0)

**Sources (Apple Support):**  
- [Use the 3D compass in Motion](https://support.apple.com/guide/motion/use-the-3d-compass-motn17c6a3f0/mac)  
- [View and add waypoints in Compass on Apple Watch](https://support.apple.com/guide/watch/view-and-add-waypoints-apd4d10b939e/watchos)  
- [Use the compass on iPhone](https://support.apple.com/guide/iphone/compass-iph1ac0b663/ios)  

**Plane:** PUBLIC_EXPERIENCE_VISUALIZATION / field orientation only.  
**Not authority for:** FEMA SFHA, BFE, surveyed elevation, LOMA, or BMI solver evidence.

---

## 1. Suggestions closed (BMI plane)

See `BMI-INTERFACE-AND-COUPLING-PATTERNS-v1.1.md`:

- Interface patterns (lifecycle, variables, grid, time, failure enums)  
- Coupling patterns A–E (one-way, chain, synced time, file-mediated, gRPC wrapper)  
- Coupling examples + anti-example  
- Contract-test list (crash, timeout, non-convergence, stale telemetry, unit/datum mismatch, replay, hash tamper)  
- Gage-zero conversion gap remains explicit (`GAGE_DATUM` until `conversionPublished`)

---

## 2. Motion — 3D compass (Mac)

| Behavior | Detail |
|----------|--------|
| Location | Lower-left of canvas when 3D overlays enabled |
| Passive | Shows world axes **X / Y / Z** orientation |
| Active | Shortcuts to **reference cameras** (orthogonal + perspective) |
| Axis convention | **X red, Y green, Z blue**; positive rotation counterclockwise |
| Origin | Canvas center (0,0,0); +X right, +Y up, +Z toward viewer (default) |

**TSM:** Twin camera chrome may use a 3D orientation gizmo (presentation only). Data plane stays EPSG-aware.

---

## 3. Apple Watch — Compass waypoints

| Capability | Detail |
|------------|--------|
| Add | Current location or **manual lat/lon** |
| View | Distance, direction, **relative elevation** |
| Elevation view | Relative to **current** device elevation |
| Auto | Parked car, cellular / Emergency SOS (region-limited) |

**TSM:** Optional observational waypoint notes. Device Δz is **not** NAVD88 survey / BFE.

---

## 4. iPhone — Compass

| Capability | Detail |
|------------|--------|
| Display | Direction, bearing, coordinates, elevation when available |
| Use | Hold flat; align crosshairs; avoid magnetic interference |
| Apple warning | **Basic navigation only** — not precise location/distance/direction |

**TSM:** Optional map heading. Never regulatory vertical.

---

## 5. Rules

1. Presentation only.  
2. Tag device elev as DEVICE_* vs NAVD88/GAGE_DATUM.  
3. No Apple Map Data derivative database.  
4. BMI solvers remain out-of-process.  
5. Human authority remains final.
