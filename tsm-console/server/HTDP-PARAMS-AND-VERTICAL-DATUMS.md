# HTDP Parameters · NGS Vertical Datum Shifts — TSM

## HTDP transformation parameters

HTDP uses **14-parameter Helmert** transforms exclusively for frame-to-frame changes (origin, orientation, scale + rates). Crustal motion is a **separate** step (velocity + coseismic).

### Parameter groups

| Symbol | Count | Unit (typical) | Meaning |
|--------|-------|----------------|---------|
| \(T_x, T_y, T_z\) | 3 | m (or mm in some tables) | Translations |
| \(R_x, R_y, R_z\) / \(\varepsilon\) | 3 | mas | Rotations (counterclockwise about axes) |
| \(s\) | 1 | ppb (scale as \(1+s\)) | Differential scale |
| Rates \(\dot T, \dot R, \dot s\) | 7 | m/yr, mas/yr, ppb/yr | Time drift of the seven |

Reference epoch \(t_0\) is part of each parameter set. At time \(t\):

\[
T(t) = T(t_0) + \dot T\,(t - t_0)
\quad\text{(same form for } R, s\text{)}
\]

### Direction and composition

NGS publishes multiple related sets (ITRF/IGS ↔ NAD 83 realizations). Historical CORS pages show e.g. **IGS08 → NAD83(2011)** at \(t_0 = 1997.0\) with translations on the order of **~1 m** and rotations **~10–26 mas**, plus rates.

**Critical NGS rule:** Applying Helmert **alone** is incorrect when input and output **epochs differ** — HTDP must also apply the velocity / coseismic model.

HTDP is **not** the tool for NAD 83 realization-to-realization (use NADCON / GEOCON family). HTDP bridges **NAD 83 plate-fixed frames ↔ ITRS/ITRF/WGS 84**.

### TSM EvidenceArtifact

```
transformation_chain[].parameters = {
  param_set_id: "<NGS/HTDP set name or EPSG op code if known>",
  t0: <reference epoch>,
  t_obs: <observation epoch>,
  t_out: <output epoch>,
  coseismic_applied: false,   // typical Posey
  software: "HTDP <version> | NCAT",
  note: "Parameters from NGS HTDP; not recomputed in tsm-console"
}
```

Do **not** hard-code full numeric tables in application code — they are versioned by NGS. Cite software version + set id.

## NGS vertical datum shifts

Horizontal HTDP ≠ vertical orthometric transforms.

| Tool / model | From → To | Role | Notes |
|--------------|-----------|------|--------|
| **VERTCON** (v2.x / **VERTCON 3.0** grids) | **NGVD 29 ↔ NAVD 88** | Orthometric height difference by lat/lon | ~2 cm (1σ) class for mapping; CONUS; v3 via **NCAT** |
| **GEOID18** | NAD 83 (2011) ellipsoid height ↔ **NAVD 88** (hybrid) | \(H \approx h - N\) | Last hybrid geoid before NSRS modernization; GPSonBM constrained |
| **GEOID12B** | Predecessor | Superseded by GEOID18 for CONUS |
| **NAPGD2022** (modernization) | New geopotential datum | Future replacement of NAVD 88 | TRFs tied to ITRF2020; heights from GNSS + geoid |

### Orthometric vs ellipsoid

\[
H_{\mathrm{NAVD88}} \approx h_{\mathrm{NAD83}} - N_{\mathrm{GEOID18}}
\]

Site constants **BFE / LAG / FFE** at Bonebank are **NAVD88** orthometric (or published orthometric) values — not raw ellipsoid heights.

### TSM vertical policy

| Rule | Detail |
|------|--------|
| Authoritative vertical for analysis | **NAVD88** |
| Reject new artifacts claiming **NAVD29** without VERTCON chain | fail-closed / provisional |
| GEOID / VERTCON steps | Must appear in `transformation_chain` with model name + version |
| Modernization (NAPGD2022) | Watch NGS; do not auto-migrate BFE until official community adoption |
| HTDP | Horizontal / ECEF frame+time only — does not replace GEOID18 for orthometric heights |

## Posey / Bonebank practical summary

1. Analysis: **EPSG:2966 + NAVD88**
2. GNSS ellipsoid heights → NAVD88 via **GEOID18** (or successor) + documented chain
3. NGVD29 legacy marks → NAVD88 via **VERTCON 3 / NCAT**
4. NAD83 ↔ ITRF → **HTDP** (14-param + velocity); coseismic usually **off** for Posey
5. Numeric parameters always from **current NGS software**, not frozen in TSM source

