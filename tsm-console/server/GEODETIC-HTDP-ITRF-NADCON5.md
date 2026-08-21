# HTDP · ITRF2014 · NADCON5 — TSM Geodetic Policy

Authoritative site frame remains **EPSG:2966 (NAD83 / Indiana West, ftUS) + NAVD88**.  
This note records how time-dependent and multi-step datum transforms are treated on the Evidence Plane.

## 1. HTDP (Horizontal Time-Dependent Positioning)

NGS HTDP models crustal motion between epochs:

\[
\Delta \mathbf{x}(t_1 \rightarrow t_2) = \mathbf{v}\,(t_2 - t_1) + \sum_i \Delta\mathbf{x}^{\mathrm{coseismic}}_i + \Delta\mathbf{x}^{\mathrm{postseismic}}
\]

| Component | Source (NGS) | Notes |
|-----------|--------------|--------|
| Interseismic velocity | Continuous velocity field | Dominant term in stable plate interior |
| Coseismic | `initeq.f` — Okada (1985) elastic half-space dislocations | Applied only inside each fault model’s **radius of influence**; outside → **zero** offset |
| Postseismic | Trajectory models where defined | Mostly western US events |

**Indiana / Posey (TSM):** Far from HTDP major coseismic models (e.g. Denali 2002, Ridgecrest 2019). For most engineering surveys at Bonebank, **epoch difference on NAD83 is negligible** relative to survey and hydraulic uncertainty.  

**TSM rule:** If an artifact is transformed across epochs or into ITRF/WGS84 with HTDP, record:

- `transformation_chain[]` including HTDP version, \(t_1\), \(t_2\)
- Whether coseismic terms were applied (almost always **false** for Posey)
- Software identity (`operator_or_service_identity`)

Do **not** silently apply western-US coseismic grids to Midwest coordinates.

## 2. ITRF2014 (and successors)

ITRF2014 (IERS; epoch **2010.0**) is a global frame realization:

| Parameter | Definition (ITRF2014) |
|-----------|------------------------|
| Origin | SLR → Earth’s center of mass (incl. oceans/atmosphere) |
| Scale | Average VLBI + SLR |
| Orientation | Aligned to ITRF2008 for continuity |
| Deformation | Seasonal annual/semi-annual + post-seismic trajectories |

ITRF2020 is the newer realization; many GNSS products still reference ITRF2014 or IGS14/IGS20.

**TSM rule:**

- **Authoritative analysis CRS** stays EPSG:2966 / NAD83 (not ITRF).
- When GNSS or global datasets arrive in ITRF/WGS84, convert with a **documented** pipeline (e.g. ITRF → NAD83 via NGS tools / published parameters) and store the chain on the EvidenceArtifact.
- Never label an ITRF coordinate as “EPSG:2966” without a transform step.

## 3. NADCON5 uncertainty

NADCON5 provides **per-point formal σ** for horizontal datum shifts (e.g. NAD83 realizations / NAD27 paths where applicable).

Multi-step error (conceptual):

\[
\sigma_{\mathrm{total}}^2 \approx \sum_k \sigma_{\mathrm{method},k}^2 + \sum_k \sigma_{\mathrm{data},k}^2
\]

| Term | Meaning |
|------|---------|
| **Method noise** | Gridding artifacts (NADCON5 uses GMT continuous-curvature **surface**; tension **0.4**) |
| **Data noise** | RMS of residuals of control points vs final grid |

**TSM rule:**

- When NADCON5 (or successor) is used, copy published σ fields into EvidenceArtifact `uncertainty` when available.
- If σ is unknown, set `validation_status` / notes to **provisional** and do not imply sub-foot global accuracy.
- Hydraulic products (BFE, stage) remain governed by **NAVD88** vertical procedures — horizontal NADCON5 σ does not replace vertical datum uncertainty.

## 4. EvidenceArtifact fields (minimum for any CRS change)

```
spatial_reference.horizontal_crs     # e.g. EPSG:2966
vertical_reference.vertical_datum  # NAVD88
transformation_chain[]             # ordered steps with software + version
uncertainty                        # σ or qualitative provisional
content_hash_sha256
authority_class                    # OBSERVATION | DERIVED | ...
```

## 5. Implementation stance (Phase 1)

| Item | Action |
|------|--------|
| HTDP Fortran (`htdp.f`, `initeq.f`, …) | **Not** vendored into tsm-console; optional offline NGS binary later |
| ITRF2014 parameters | Document only; no silent re-realization of site constants |
| NADCON5 grids | Use NGS-published grids if a transform worker is authorized; fail-closed if grid missing |
| Site constants BFE/LAG/FFE | Unchanged — NAVD88 elevations at Bonebank |

Human authority remains final for any regulatory coordinate claim.


## 6. NAD 83 → ITRF2014 — NGS mathematical sequence

Plate-fixed **NAD 83** → global **ITRF2014** requires both a frame shift and an epoch change. NGS-style pipeline:

### Step 1 — Geodetic → ECEF (at observation epoch \(t_1\))

Geographic \((arphi, \lambda, h)\) on the NAD 83 ellipsoid → Earth-Centered Earth-Fixed Cartesian \((X,Y,Z)_{\mathrm{NAD83}}(t_1)\).

Datum operations are performed in 3D Cartesian space, not on the map-projection plane.

### Step 2 — 14-parameter Helmert frame shift (at \(t_1\))

\[
\begin{bmatrix} X \\ Y \\ Z \end{bmatrix}_{\mathrm{ITRF}}(t_1)
=
(1+s)\,R(\omega_x,\omega_y,\omega_z)\,
\begin{bmatrix} X \\ Y \\ Z \end{bmatrix}_{\mathrm{NAD83}}(t_1)
+
\begin{bmatrix} T_x \\ T_y \\ T_z \end{bmatrix}
\]

with **rates** applied so parameters are evaluated at \(t_1\):

| Group | Count | Role |
|-------|-------|------|
| Translations \(T_x,T_y,T_z\) | 3 | Origin shift |
| Rotations \(\omega_x,\omega_y,\omega_z\) | 3 | Axis tilt |
| Scale \(s\) | 1 | Frame size |
| Rates \(\dot T, \dot\omega, \dot s\) | 7 | Annual drift of the seven |

Result: ITRF2014 coordinates **still at epoch \(t_1\)**.

### Step 3 — Temporal propagation (HTDP) to target epoch \(t_2\)

Example target: ITRF2014 reference epoch **2010.0**.

- Interseismic velocity integrated over \((t_2 - t_1)\)
- Coseismic (Okada) jumps if \(t_1\tot_2\) crosses a modeled event **and** the point lies inside that event’s radius of influence; otherwise coseismic term = **0**

Modern NGS tooling often embeds **both** the 14-parameter definitions and the kinematic grids inside the HTDP-family workflow (frame jump + time travel).

### Step 4 — ECEF → geodetic

\((X,Y,Z)_{\mathrm{ITRF}}(t_2)\) → \((arphi, \lambda, h)\) on the ITRF/GRS80-compatible ellipsoid at epoch \(t_2\).

### Inverse path

ITRF2014 \((t_2)\) → NAD 83 \((t_1)\) reverses the same chain (time back, then inverse Helmert, then geodetic).

### Projected CRS (EPSG:2966) caveat

**EPSG:2966** is Transverse Mercator on **NAD 83** (US ft). A correct global-frame export is:

1. Inverse project 2966 → NAD 83 geodetic (or geocentric)
2. Run Steps 1–4 (or official NGS software)
3. Never apply Helmert parameters directly to easting/northing in feet

### TSM EvidenceArtifact requirements for this chain

```
transformation_chain: [
  { step: "inverse_tm_2966", software, version },
  { step: "geodetic_to_ecef", ellipsoid: "GRS80/NAD83", epoch: t1 },
  { step: "helmert_14_nad83_to_itrf2014", epoch: t1, param_set_id },
  { step: "htdp_propagate", t1, t2, coseismic_applied: false },  // typical for Posey
  { step: "ecef_to_geodetic_itrf", epoch: t2 }
]
content_hash_sha256: <hash of input + output + param set>
authority_class: DERIVED
```

Site **BFE / LAG / FFE** remain **NAVD88** orthometric (or local published) values — this sequence does not redefine those elevations.

