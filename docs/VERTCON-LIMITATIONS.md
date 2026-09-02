# VERTCON model limitations (TSM policy)

## What VERTCON is

NOAA/National Geodetic Survey (NGS) VERTCON 3.0 is a gridded **orthometric-height transformation model**, primarily used for transformations such as **NGVD29 ↔ NAVD88**. VERTCON 3.0 (release 20190601) is no longer a standalone transformation application; it is implemented through NGS **NCAT** and its transformation grids.

VERTCON is therefore a **datum-conversion model**, not a replacement for a survey adjustment or a new set of geodetic control.

## Accuracy and uncertainty

| Limitation | TSM interpretation |
|---|---|
| NGS mapping-class accuracy | NOAA documents VERTCON3 as approximately **2 cm (1σ)** for the NAVD88/NGVD29 transformation class; this is not a guaranteed pointwise maximum error. |
| Local NGVD29 distortions | NOAA notes rare local distortions of **20 cm or more** in the legacy NGVD29 network. A project should test multiple nearby transformations when legacy control is suspected. |
| Source-control quality | A VERTCON result cannot recover errors already present in the source benchmark, leveling, GPS, or legacy datum realization. |
| Spatial interpolation | VERTCON uses transformation grids/interpolation. Local error estimates are available through NCAT; do not treat a grid value as survey-grade control. |
| Datum epoch / crustal motion | A datum conversion does not constitute a new geodetic adjustment and does not independently solve later subsidence, uplift, or other physical changes. |
| Coverage | Transformations outside the supported NGS model boundaries are rejected rather than extrapolated. |

NGS explicitly recommends **readjusting survey measurements to published NAVD88 control** when high accuracy is required. A transformation is not equivalent to a geodetic readjustment.

## Sign convention — do not reverse the result

NGS VERTCON 3.0 grids use **new minus old**:

```text
ΔH = H_NAVD88 - H_NGVD29
H_NAVD88 = H_NGVD29 + ΔH
H_NGVD29 = H_NAVD88 - ΔH
```

A sign error can create a material elevation error and must be caught by tests before an elevation is promoted into an engineering artifact.

## What VERTCON must not be used for in TSM

1. **LOMA / LOMR elevation certification by itself**.
2. **Construction staking or as-built certification**.
3. **Legal freeboard, BFE, or floodway-clearance determinations** without the required survey/engineering basis.
4. Replacing a published **USGS/NWS gage datum or gage-zero table**.
5. Mixing horizontal CRS transformations and vertical-datum transformations as if they were the same operation.
6. Treating a VERTCON-derived value as an **authoritative observation**; it is a **DERIVED transformation result**.

## Correct TSM pattern

```text
Legacy source height in NGVD29
        |
        v
NCAT / VERTCON3 transformation + local error estimate
        |
        v
NAVD88-derived value (DERIVED / provisional)
        |
        +--> compare against published NAVD88 control
        +--> require human engineering/survey review for regulatory use
```

For agency gage products, prefer the agency-published vertical-datum information and published control over an independent VERTCON conversion. Where the project requires survey-grade elevation, obtain or adjust to published NAVD88 control.

## Official references

- NGS VERTCON 3.0 — VERTCON is implemented through NCAT: https://www.ngs.noaa.gov/VERTCON3/
- NGS NCAT — coordinate/datum transformation service and local error estimates: https://geodesy.noaa.gov/NCAT/
- NOAA VDatum uncertainty guidance — includes the documented VERTCON3 uncertainty discussion: https://www.geodesy.noaa.gov/docs/est_uncertainties.html
- NOAA Technical Report NOS NGS 68 — VERTCON 3.0 methodology and limitations: https://geodesy.noaa.gov/library/pdfs/NOAA_TR_NOS_NGS_0068.pdf
