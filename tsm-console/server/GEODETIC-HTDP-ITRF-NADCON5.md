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

