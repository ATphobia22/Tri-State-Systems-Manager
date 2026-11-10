# Building reconstruction methods and terrain diagnostics

## Scientific corrections

The following are research methods, not scientific certification of TSM assets.
They are not an automatic DEM → LoD2 → LoD3 → LoD4 chain. A bare-earth DTM
contains neither roof observations nor facade openings or interiors.

| Method | Supported role | Required evidence and limitations |
|---|---|---|
| [PLANES4LOD2, 2024](https://doi.org/10.1016/j.isprsjprs.2024.04.015) | RGB/photogrammetric DSM roof segmentation with a depth-attention UNet; polygonization, RANSAC and plane intersections produce LoD2 candidates | Registered imagery/DSM, independently checked geometry, model/version/weights and their licenses. Reported geometric MAE is **1.06 m and 0.24 m** in two study areas; these are not TSM results or universal accuracy ceilings. |
| [Scan2LoD3, CVPR Workshops 2023](https://arxiv.org/abs/2305.06314) | Probabilistic model conflicts, multimodal Bayesian inference and facade-object fitting | Building priors, scan/ray geometry and multimodal evidence. A ray passing a prior is only a candidate conflict; occlusion, glass, registration, incidence and sampling prevent equating every conflict with a verified window. No facade geometry is fabricated by these diagnostics. |
| [PolyFit, ICCV 2017](https://openaccess.thecvf.com/content_iccv_2017/html/Nan_PolyFit_Polygonal_Surface_ICCV_2017_paper.html) | Binary linear selection of candidate planar faces under manifold/watertight constraints | Piecewise-planar observations and an actual optimizer run. A closed shell does not establish interiors, fabrication accuracy, or LoD4. The original objective balances data fitting, point coverage and model complexity. |
| [Candela et al., ISPRS Archives 2026](https://doi.org/10.5194/isprs-archives-XLIX-B1-2026-553-2026) | City3D-based LiDAR/footprint reconstruction, PolyFit optimization and DTM alignment | This paper addresses **LoD2**, not a demonstration that PolyFit reconstructs interiors. |

[CityGML 3.0](https://docs.ogc.org/guides/20-066.html) uses LoD0–3 and allows
interior representations at those levels. LoD4 is a legacy CityGML 2.0 concept.
LoD is not a millimetre accuracy grade. Neither zero-error claims nor fixed
50/100, 15/30, or 0/15 mm ceilings follow from these methods. Tolerance policies
must state the actual source resolution, survey/checkpoint uncertainty and use.
Fit residuals on training/inlier samples do not establish independent accuracy.

## Implemented scope

TSM implements **original numerical diagnostics**, not the three research systems:

- `native/archimedes/include/TSMLoDReconstructionSolver.h`: scale-normalized
  vertical RMSE and general infinite-plane intersection. Handles the common
  gable case where the supplied example's XY determinant was zero. Parallel,
  coincident, degenerate, nonfinite and undefined inputs do not return success.
- `UTSMSpatialValidator::CalculateRoofVerticalRMSE` and
  `ComputeUnboundedRoofPlaneIntersection`: native Blueprint/C++ access to the
  same implementation. Inputs are in one **local metre coordinate frame**;
  convert Unreal centimetres and reconcile geodetic heights before calling.
- `scripts/geospatial/validate_lod_alignment.py`: non-mutating comparison of
  explicitly identified base-contact vertices against a decoded single-band
  elevation raster. Uses all six GDAL affine coefficients, masks/nodata and
  strict raster bounds. It performs no CRS or vertical-datum transformation.

Plane intersections must still be bounded by supported patches and checked for
adjacency before calling them ridges. For plane `ax+by+cz+d=0`, vertical residuals
use `z_model=-(ax+by+d)/c`. This is not perpendicular point-to-plane RMSE and
is undefined for vertical planes. Empty observations are unavailable, not zero
error. The numerical near-parallel cutoff is dimensionless (`1e-10` for unit
normals); it is not a positional accuracy threshold.

The existing roof extraction and batch tools retain their output/evidence
classification. These helpers do not promote their assets, add openings or
interiors, or replace their reconstruction algorithms. A datum label match is
only metadata compatibility, not independent authentication. Numerical routines
do not prove bounded topology, watertightness, source authority or engineering
approval. Runtime viewing remains available when a comparison is incomplete.

## Terrain command

Install `numpy==2.3.5 rasterio==1.4.3` in the acquisition/validation environment,
not as a runtime network dependency. Export a **decoded metre-elevation GeoTIFF**
and a JSON document containing:

```json
{
  "vertices": [{"x": 510000.0, "y": 4190000.0, "z": 120.0, "is_base": true}],
  "mesh_metadata": {"crs": "EPSG:26916", "vertical_datum": "NAVD88", "vertical_units": "m"},
  "terrain_metadata": {"crs": "EPSG:26916", "vertical_datum": "NAVD88", "vertical_units": "m"},
  "terrain_sha256": "REPLACE_WITH_SHA256_OF_ACTUAL_DTM_FILE"
}
```

This is a **synthetic format example**, not a measured Posey building. Base flags
must identify intended ground contacts; taking all lowest vertices is unreliable
for slopes, stepped foundations, basements, bridges and elevated structures.
An actual wall/foundation may legitimately differ from a bare-earth DTM.
The CRS must match the raster's canonical CRS string, such as `EPSG:26916`.

```bash
python scripts/geospatial/validate_lod_alignment.py \
  --mesh-document building-contact-vertices.json \
  --terrain decoded-dtm-metres.tif \
  --tolerance-m 0.25 \
  --report alignment-report.json
```

Here `0.25` is an **illustrative comparison policy**, not a recommended source
accuracy or a new universal ceiling. The report returns `aligned`, `mismatch`
or `incomplete`, residual statistics, violations and unavailable vertex indices.
Sampling uses the containing cell, without interpolation. Out-of-bounds, nodata,
unknown datum or conflicting metadata cannot count as aligned. The command exits
0 for an aligned comparison and 2 for other results; this applies to the command
only, not global runtime availability. Neither path moves vertices. Reports hash
the actual input JSON and primary GeoTIFF bytes; hashes establish integrity, not
that a supplied building or its metadata are authoritative.

## Dependency admission and remaining work

No upstream research source, pretrained weights or optimizer binaries are
downloaded, vendored, linked or run by this change. Before integrating one:

1. Pin upstream revision, artifact hashes, implementation license and dependency
   licenses separately from the paper license. [PolyFit upstream](https://github.com/LiangliangNan/PolyFit)
   is GPL-3.0; do not silently introduce it into the Apache-licensed native product.
   Its optimizer dependencies also need review. An external process alone is not
   a blanket determination of redistribution compatibility.
2. Verify availability and permitted use of training data, inference code and
   model weights. A paper describing a model does not supply a trained adapter.
   [Scan2LoD3's implementation overview](https://github.com/OloOcki/scan2lod3)
   spans C++, Python, R and **FME** shape/modeling stages; it is not a complete
   dependency-free native C++ plugin. Check licenses per component before reuse.
3. Run a bounded pilot with actual region-specific roof/facade evidence,
   independent checkpoints, uncertainty and geometric/semantic validation.
4. Preserve unsupported buildings and missing-evidence states; do not substitute
   procedural openings or synthetic interiors to reach a county count.

Portable geometry/GeoTIFF tests run in `lod-geometry-validation.yml` on Windows
and Linux. Unreal UHT/BuildCookRun, real-data accuracy and a clean Windows offline
launch require their own actual evidence; portable tests do not close those gates.
