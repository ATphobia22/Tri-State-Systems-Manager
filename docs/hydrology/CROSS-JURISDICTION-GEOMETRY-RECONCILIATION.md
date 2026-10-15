# Cross-jurisdiction geometry reconciliation contract

## Correctness rules

The proposed "EPSG:9822 Albers" designation is not accepted as a CRS definition without resolving it through an authoritative CRS registry. For regional area/overlay operations, use a verified, documented projected CRS suited to the domain (for example, NAD83 / Conus Albers EPSG:5070 for broad tri-state area calculations) and record the exact WKT, transformation pipeline, axis order, and software versions. Use an appropriate local CRS for parcel-scale engineering and never mix the outputs without explicit transformations.

State-plane source CRSs (such as EPSG:2967, EPSG:3443, and EPSG:3089) must be taken from each artifact's actual metadata, not guessed from the jurisdiction. Validate control points and coordinate ranges before transformation. CRS transformation does not fix differing shoreline epochs, vertical datums, or incompatible source definitions.

## Deterministic processing stages

1. Preserve immutable raw source artifacts and their hashes.
2. Validate each geometry, CRS, units, feature identity, vintage, and source authority. Reject missing/ambiguous CRS; never assign a CRS merely to make coordinates fit.
3. Reproject to the documented overlay CRS using a recorded transformation. Retain source geometry and transformed geometry separately.
4. Compute overlay diagnostics: invalid geometries, gaps, overlaps, duplicate features, line endpoint offsets, Hausdorff distance where appropriate, and sliver distributions. Report counts and areas before/after any proposed repair.
5. Apply only documented, source-specific repair policies. Do not automatically delete every polygon below 5 m², snap riverbanks to a generalized federal line, or give one jurisdiction blanket precedence. Small polygons can be real features, and state lines do not define hydrologic catchments.
6. Use authoritative HUC boundaries as reference/stratification layers, not as a substitute for DEM-derived watershed delineation. A HUC-8/12 boundary is not necessarily the site's drainage area or a valid HEC-HMS basin boundary.
7. Generate a reconciled output only when lineage and QA checks pass. Otherwise publish diagnostics and preserve the unreconciled inputs for review.

## Required output manifest

Record raw and output SHA-256 values, feature counts, source URLs and retrieval times, data vintages, native and output CRS/WKT, transformation pipeline, software/library versions, precision model, validity results, repair actions, removed/modified feature IDs with rationale, overlap/gap metrics, area statistics, reviewer disposition, and reproducibility configuration.

## Model gate

Geometry reconciliation alone cannot approve an AOI or establish a hydraulic domain. HEC-RAS requires a defensible terrain and hydraulic domain, and HEC-HMS requires a physically justified catchment, outlet, meteorological inputs, loss/transform/baseflow assumptions, and calibration/validation strategy. Missing or contradictory evidence keeps downstream modeling blocked.
