# Mount Vernon: vertical elevation evidence contract and deployment gate

**Status:** proposed code; not an engineering-certified 3D city model. This workflow
cannot establish source datum or roof accuracy merely from a self-declared input.
No missing height, geoid correction, roof geometry, or regulatory status is guessed.

## Separate coordinate systems and quantities

- The existing city scene is **2D EPSG:4326** official-source planimetric context
  with `height_m: null` and `engineering_approved: false`.
- **EPSG:2966** (NAD83 / Indiana West, US survey feet) is a *2D horizontal*
  projected CRS. It does not define NAVD88, ellipsoid heights, or an
  EPSG-registered compound CRS by itself.
- A vertical source must independently declare **orthometric NAVD88**, units,
  realization, relevant survey/DEM metadata, geoid handling if applicable,
  epoch, and accuracy. A `lidaryear` footprint attribute is not a vertical
  datum certificate.
- **Absolute roof elevation** in meters = NAVD88 bare-earth ground elevation
  in meters + *measured* roof height above that ground in meters. Use
  `1200 / 3937` for US survey foot to meter; international foot is different.
- A DEM ground elevation and a LiDAR roof point cloud must be co-registered
  horizontally, checked for survey epoch/changes, and screened for rooftop
  classification, vegetation, voids, slope, sample coverage, and outliers.
  Sampling a single footprint centroid is not enough for a defensible roof.
- **NGVD29 to NAVD88:** use an appropriate NGS NCAT/VERTCON orthometric
  transformation and retain the actual operation, coordinates, grids/version,
  offsets and uncertainties. Do not assume an offset. NCAT does not convert
  ellipsoidal heights to orthometric heights; a documented geoid workflow is
  needed for that distinct operation.
- No claim that every IndianaMap, IGIO or 3DEP raster uses NAVD88 without
  inspecting that *specific* tile/project metadata and raster CRS.

## Stage A: external geospatial analysis (not performed by this script)

1. Acquire and pin the source footprint feature and its SHA-256, LiDAR LAS/LAZ
   tile and metadata, and bare-earth DTM/DEM with source SHA-256 and
   documented vertical CRS/units. Verify publication and licensing.
2. Validate spatial coverage and horizontal CRS transformation using an
   appropriate GIS library. Use robust terrain samples within/near the
   footprint, avoiding rooftop pixels, nodata, and unrepresentative slopes.
3. Derive roof height from classified rooftop points (or surveyed measurements),
   with enough coverage to support the chosen median or another explicitly
   documented statistic. Retain sample counts and evidence.
4. Only after the ground datum and measurement methods are established, prepare
   a JSON input following the schema described in
   `scripts/geospatial/reconcile_mount_vernon_vertical_evidence.py`.
5. Run `python scripts/geospatial/reconcile_mount_vernon_vertical_evidence.py --input input.json --scene city-artifact/mount-vernon-scene/scene.json --output derived.json`.
   The result is `DERIVED_UNREVIEWED` even when the input says NAVD88.
   Human/source cross-checks and independent benchmarks are separate gates.
6. For PostGIS, transform horizontal footprint and sample point coordinates
   to the raster's *actual* SRID before `ST_Value`. Reject nodata/voids.
   Store planar footprints separately from 3D surface/mesh geometry.
   `ST_Extrude` is not a `geometry(PolygonZ,2966)` value.
7. For React Three Fiber, triangulate each polygon/ring including holes
   independently, use meters for geometry after verified unit conversion,
   subtract a local origin, avoid ring-to-ring triangles, and label any
   unreviewed derived structure explicitly. Do not promise millimeter
   accuracy from 32-bit WebGL buffers.

## Stage B: viewer deployment (web reference only)

The `mount-vernon-official-city-scene.yml` workflow retrieves bounded
official building and road reference geometries, validates the scene receipt,
stages it into the compiled Vite viewer, and invokes:

```bash
python scripts/geospatial/verify_mount_vernon_deployment.py --viewer-dir tsm-console/dist
python scripts/geospatial/verify_mount_vernon_deployment.py --viewer-dir tsm-console/dist --verify
```

The generated `mount-vernon-deployment.manifest.json` contains the SHA-256
and size of every staged viewer asset plus a scene digest and feature counts.
The verifier rejects tampering, missing assets, unknown geometry identities,
unsupported height claims, and symlinks. This is a reproducibility/integrity
gate, **not a digital signature** or proof that the upstream government
publisher's service response was authentic. The viewer bundle is uploaded as
a workflow artifact; it is **not** a verified native Windows UE5.8 Shipping
binary and it is not automatically a public production deployment.

## Outstanding release blockers

- Source-tile-specific DTM vertical CRS/units, LiDAR classification, geoid
  provenance, horizontal alignment, and independently checked roof samples.
- Source completeness, licensed redistribution, full city/county boundary
  rather than the rectangular discovery AOI, and geometry QA.
- Independent PostGIS raster sampling and 3D mesh/LOD pipeline, actual
  end-to-end viewer interaction, and representative field/control benchmarks.
- Native UE5.8 Windows Shipping cook/package on a real Windows runner, offline
  launch without Node/WebView/local server, and artifact/CI verification.
- Hydraulic model calibration, flood elevations, regulatory or survey approval.

## Reference documents

- NGS NCAT: https://www.ngs.noaa.gov/NCAT/index.xhtml
- NGS VERTCON3: https://www.ngs.noaa.gov/VERTCON3/
- EPSG:2966: https://epsg.io/2966
- FEMA vertical datum guidance: https://www.fema.gov/sites/default/files/documents/Vertical_Datum_Conversion_Guidance_Nov_2023.pdf
- Park & Guldmann (2019), *Creating 3D city models with building footprints
  and LIDAR point cloud classification*, Computers, Environment and Urban
  Systems 75, 76–89. Rooftop filtering matters for height quality.
