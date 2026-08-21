# HTDP Velocity Models · GEOID18

## HTDP velocity models

| Component | Role |
|-----------|------|
| **Interseismic velocity field** | Continuous crustal motion between earthquakes |
| **Coseismic (Okada / `initeq.f`)** | Instantaneous slip; **zero** outside fault radius |
| **Postseismic** | Where models exist (mostly western US) |

Stable continental interior (Indiana / Posey): interseismic rates are small; **coseismic relevance = false** for typical HTDP western-event catalogs.

### NSRS modernization (watch)

| Model | Purpose |
|-------|---------|
| **EPP2022** | Euler pole parameters — rigid plate rotation vs ITRF2020 |
| **IFDM2022** | Intra-frame deformation within a plate |
| **NATRF2022** | New North American terrestrial reference frame |

TSM analysis frame remains **EPSG:2966 + NAVD88** until community + regulatory adoption of modernized products. Record model name on any future chain step.

## GEOID18

- **Last hybrid** geoid before NAPGD2022 / GEOID2022 gravimetric models
- Constrains gravimetric geoid to **NAVD 88** via **32,357** GPSonBM points (~26% more than GEOID12B)
- CONUS relative uncertainty ≈ **±1.27 cm** (vs ~1.7 cm GEOID12B)
- Relation: \(H_{\mathrm{NAVD88}} \approx h_{\mathrm{NAD83}} - N_{\mathrm{GEOID18}}\)
- Includes GRAV-D airborne gravity + GRACE/GOCE

### TSM rules

1. Site BFE/LAG/FFE stay **NAVD88** orthometric constants.
2. GNSS ellipsoid heights → NAVD88 only via **GEOID18** (or successor) chain step.
3. HTDP never rewrites orthometric heights.
4. GEOID2022 / NAPGD2022 = **watch** only until official Posey/Indiana practice migrates.

