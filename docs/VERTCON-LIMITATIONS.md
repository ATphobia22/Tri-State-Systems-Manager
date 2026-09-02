# VERTCON model limitations (TSM policy)

## What VERTCON is

NGS **VERTCON** (now grids consumed via **NCAT**) models the orthometric height difference between paired vertical datums—most commonly **NGVD29 ↔ NAVD88**—by interpolating transformation grids built from hundreds of thousands of benchmark differences.

## Accuracy class

| Claim | Practical meaning |
|-------|-------------------|
| ~**2 cm RMS** (CONUS mapping class) | Suitable for many **cartographic / GIS** overlays |
| Local “problem lines” | Distortions of **20 cm+** can appear in old NGVD29 network patches |
| Sparse data / islands / offshore | **Not reliable** outside modeled CONUS density |
| Post-adjustment motion | **Does not** model ongoing subsidence/uplift after the datum epoch |

NGS position: **readjustment of survey measurements to published NAVD88 control is best practice**; coordinate transformation is **not** equivalent to a new geodetic adjustment.

## What VERTCON must not be used for in TSM

1. **LOMA / LOMR elevation certificates**  
2. **Construction staking / as-built certification**  
3. **Legal freeboard or BFE clearance decisions** without PE survey  
4. Replacing a published **gage zero** table (use NWS/USGS product zeros)  
5. Mixing datums inside one equation without documenting Δ

## Correct TSM pattern

```text
If source height is NGVD29:
  H_navd88 ≈ H_ngvd29 + VERTCON_Δ(lat, lon)   # mapping / provisional only
Prefer: published NAVD88 bench mark or PE leveled value.
Gage products: use agency vertical datum table, not VERTCON alone.
```

At MTVI3, NWS already publishes parallel NAVD88 and NGVD29 thresholds (Δ ≈ −0.33 ft). Prefer those product tables for stage impacts.

## References

- NGS VERTCON 3.0 / NCAT  
- NOAA TR NOS NGS 68  
- NGS Professional Surveyor notes on problem lines
