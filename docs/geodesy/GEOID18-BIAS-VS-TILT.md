# GEOID18 bias vs tilt (NGS hybrid construction)

## Short answer

When NGS builds the **hybrid** GEOID18 surface, residuals between:

- GPS ellipsoid heights on leveled bench marks, and
- a pure **gravimetric** geoid (xGEOID19B),

contain large-scale structure. NGS removes a **continental bias** (constant offset) and a **continental tilt** (planar slope across CONUS) before modeling the remaining local warps with least-squares collocation. The published GEOID18 grid is the gravimetric surface **plus** that hybrid conversion surface (bias + tilt + local warp).

## Bias

- A **near-constant vertical offset** between the gravimetric geoid and the NAVD88 datum surface implied by the bench-mark set.
- Reflects the fact that NAVD88 is not a pure global geoid: it has a systematic offset on the order of **~0.5 m** relative to modern global geoid estimates (among other issues).
- In hybrid construction, this average offset is estimated and removed so residuals are zero-mean before local modeling.

## Tilt

- A **slowly varying planar slope** of those residuals across the continent (east–west / north–south gradient).
- NAVD88 is known to be **tilted by about ~1 m coast-to-coast** relative to the best modern global geoids.
- NGS fits and removes a 2-D plane so GEOID18 is forced to match NAVD88’s long-wavelength shape, not only local gravity.

## After bias + tilt removal

Remaining residuals are modeled as **local warps** (least-squares collocation / Gaussian functions) so GPS-derived orthometric heights agree with leveled NAVD88 at the GPS-on-BM set. CONUS fit of those marks to GEOID18 is about **±1.27 cm (1σ)** — a **fit** statistic, not absolute truth of NAVD88 or of any single project point.

## TSM rules

| Rule | Why |
|------|-----|
| Use GEOID18 only with NAD83(2011) ellipsoid heights | Model definition |
| Report H as model-derived orthometric | Bias/tilt are absorbed into the hybrid; still not a level run |
| Keep NAPGD2022 / GEOID2022 as WATCH | Modernization replaces hybrid approach with a gravimetric geopotential datum |
| Fail-closed outside validated chains | Do not invent N or treat Terrain-RGB as survey H |

## Twin Canvas educational panel

Scope B ships a **static Posey AOI sample table** for teaching \(H = h - N\). It is `authorityClass: DERIVED`, not OPUS, not LOMA input. Full CONUS binary grid remains the authoritative server-side path (`data/geo/geoid18/`).
