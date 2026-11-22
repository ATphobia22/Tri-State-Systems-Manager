# Posey building ECEF placement with source-declared GEOID18 (2026-11-22)

## Observed source-code defect and scope

`scripts/geospatial/build-building-3d-tiles.py` previously computed WGS84 ECEF
`surface(lon, lat)` at ellipsoid height zero and put `groundElevationFt`
(NAVD88 orthometric elevation) directly on ENU `z`. For an orthometric height
`H` and NGS geoid separation `N`, the nominal ellipsoid height must instead
use `h = H + N`. Missing `N` can displace a ground-aligned 3D building by
about 30 m in the Posey County region. Such a preview was previously marked
visualization-only, but its datum error was not distinguishable per feature.

See official NGS references:
- https://geodesy.noaa.gov/GEOID/GEOID18/
- https://geodesy.noaa.gov/TOOLS/Professional_Surveyor_Articles/GEOID.pdf
- https://geodesy.noaa.gov/datums/vertical/index.shtml
- https://geodesy.noaa.gov/web_services/geoid.shtml

## Deterministic implementation

The feature's `properties` may supply an independently acquired **declared**
signed geoid undulation, in metres, as:

```json
{
  "groundElevationFt": 382.0,
  "groundElevationDatum": "NAVD88",
  "groundElevationUnit": "ftUS",
  "lidarHeightUnit": "ftUS",
  "geoidUndulationM": -30.302,
  "geoidModel": "GEOID18",
  "geoidHorizontalFrame": "NAD83(2011)",
  "geoidSourceUrl": "https://geodesy.noaa.gov/GEOID/GEOID18/"
}
```

These numbers are a **synthetic test fixture anchored to a historical site
estimate**, NOT a reusable Posey County value. Production per-feature
undulations must be interpolated from a pinned original GEOID18 grid at the
actual building centroid, with original NOAA reference metadata, grid hash,
interpolation version, horizontal epoch, source response / archive receipt,
and independently reviewed control observations.

The generator converts horizontal coordinates from the supplied GeoJSON
polygon into its existing WGS84 ellipsoid-local ENU visualization frame,
and sets `base_z_m = H_ftUS * (1200 / 3937) + N_m`. Roof height remains a
**relative** building height and is not geoid shifted a second time.
The corrected branch **requires** `groundElevationUnit: "ftUS"` and
`lidarHeightUnit: "ftUS"` and converts both heights with the exact U.S.
survey-foot factor `1200/3937`. The former 0.3048 metres/international-foot
conversion remains only for explicitly labeled legacy uncorrected previews.
The original source's units still require independent proof; a declaration
is not automatically a verified measurement.

The accepted metadata is **not verified by the generator**: a provenance URL
does not prove the supplied numeric N was actually computed from that source.
The manifest and tileset therefore keep `engineeringUse=false`,
`regulatoryUse=false`, `geoidVerifiedByIndependentGridSampling=false`
and `horizontalReferenceFrameTransformationVerified=false`. An explicit
NAD83(2011) ↔ WGS84 frame/epoch transform is still required for higher-accuracy
ECEF engineering positioning. All vector and raster units and origins must
be audited independently.

If no geoid fields exist, the former approximate display remains available
with `NAVD88_AS_ELLIPSOID_UNVERIFIED_PREVIEW` and a null geoid value. A
partial, nonfinite, incorrectly framed or inconsistent geoid declaration
rejects that feature with a source ObjectID diagnosis; it is never silently
treated as N=0. Use `--require-geoid-placement` to reject *any* missing
per-feature geoid, without inventing or backfilling values.

No source LiDAR was reacquired in this PR. This does **not** close the
2,567-building height gap or certify the 23,082 buildings, any terrain seams,
CityGML mesh output, FEMA BFE, or Unreal 5.8 Windows Shipping release.

## Tests

```bash
python -m unittest discover -s tests/geospatial \
  -p 'test_posey_building_geoid_placement.py' -v
```

`.github/workflows/building-geometry-source-id-tests.yml` runs those tests
with the existing pinned Shapely geometry dependencies. The exact
countywide Building 3D Tiles workflow remains an independent source-evidence
gate and may correctly fail until real missing heights are recovered.

## Next engineering gate

Acquire and verify the actual source GEOID18 raster and per-building NAD83
horizontal coordinates/epoch. Interpolate N at each centroid; attach the
derivation receipt and upstream checksum. Rebuild both land surface and
buildings with the same geodetic operation, compare 3D tile geometry to
survey marks and DEM source extents, then test roof/terrain interfaces and
visible Cesium placement in headed screenshots. Report residuals and
measurement uncertainty. Do not promote based solely on passing unit tests.
