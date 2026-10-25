# PTDT geodetic AOI and LiDAR evidence contract

Status: **informational only, not an approved township boundary, licensed survey, or regulatory finding** (2026-10-25).

## Reject incorrect proposed geometry

The proposed EPSG:2966 rectangle with corner (830000,930000) maps to
approximately (-94.403,37.574) longitude/latitude, not Posey County.
EPSG:2966 (NAD83 / Indiana West) uses **US survey feet**. Generalized,
synthetic projected coordinates in the Posey region have eastings on the
order of 2.7 million ftUS, not 830,000 ftUS. Do not publish private site
centroids or unreviewed parcel coordinates as example AOI inputs.

RFC 7946 GeoJSON is WGS84 longitude/latitude, not projected EPSG:2966
with an old-style crs member. Use the explicit custom projected-AOI
manifest here; do not silently reinterpret coordinates.

## Datum and accuracy rules

- Horizontal: EPSG:2966 for Indiana West project calculations. Record
  actual NAD83 realization, epoch, coordinate operation and grid files.
  Generic NAD83 is **not** equivalent to NAD83(2011) 2010.0 for a
  sub-foot accuracy assertion.
- Vertical: use NAVD88 orthometric heights only for certified-local
  computations. Reject unknown and NGVD29 input pending a documented
  and controlled vertical datum transform; never silently relabel it.
- GPS ellipsoid heights: use GEOID18 only with NAD83(2011)
  epoch 2010.0; H_NAVD88 = h_NAD83(2011) - N_GEOID18.
  Never substitute WGS84/EGM2008 or a constant geoid separation.
- US survey foot = exactly 1200/3937 m; international foot = 0.3048 m.
  Track horizontal and vertical units independently.
- NGS monuments and independent surveyed benchmarks must have
  source observations, uncertainty, professional review, and control
  reports. A +/-0.05 ft LAG criterion is an **unverified project-specific
  requirement**, not a general USGS or IGIC certification threshold.
- As of October 2026 the current USGS Lidar Base Specification is
  2025 rev. A. QL2 thresholds include first-return, swath-based
  aggregate nominal pulse density >=2 pulses/m2 and nonvegetated
  RMSEv <=0.100 m. These are dataset QA metrics, not a per-point
  height filter or a density computed from ground points after clipping.
  The newer ASPRS approach requires independent checkpoints including
  survey error; vegetated accuracy is reported, not a universal
  0.300 m pass/fail threshold.
- Historical LiDAR must be assessed against its actual contractual
  specification vintage. A resampled DEM or clipped LAS cannot certify
  new field LAG accuracy or imply survey-grade measurements.

## Processing contract

Obtain an authoritative county/township/parcel geometry and verify
its provenance, vintage and authorized sign-off. It must be supplied
in a custom JSON manifest with:

- schemaVersion = tsm.projected-aoi.v1
- horizontalCrs = EPSG:2966; horizontalUnit = ftUS
- verticalDatum = NAVD88; valid polygon or multipolygon geometry
- approvalStatus = CANDIDATE or APPROVED
- For reported APPROVED status: approvalAuthority, approvalScope,
  sourceBoundarySha256, humanApprovalEvidenceSha256. Existence of
  these fields is **not independent authenticity verification**.

Input is an existing LAS/LAZ with an explicit matching embedded CRS,
a source metadata JSON with horizontalCrs, verticalDatum, verticalUnit
and real sourceSha256, and optional source quality metrics with
independentAccuracyReportSha256. No fake point cloud is generated.

Sample CLI invocation (paths are placeholders, not shipped inputs):

    python scripts/geospatial/ptdt_geodetic_clip.py \
      --input /verified/source.laz \
      --aoi /reviewed/point-aoi-envelope.json \
      --source-metadata /verified/source-metadata.json \
      --output /derived/screening.laz \
      --report /derived/screening-evidence.json \
      --allow-candidate-screening

Candidate status needs the explicit informational-only CLI override.
Neither candidate nor human-reported approval grants professional
certification. The original source is immutable; output and source
SHA-256 and point counts are reported. LAS/LAZ compression requires
a compatible laspy LAZ backend.

## Native Unreal Engine 5.8 coordinate mapping

Perform origin translation on the CPU in double precision with a
verified local origin, not the supplied 830000/930000:

    x_cm = (east_ftUS - origin_east_ftUS) * (1200.0/3937.0) * 100.0
    y_cm = (north_ftUS - origin_north_ftUS) * (1200.0/3937.0) * 100.0

Z uses explicit NAVD88 vertical units, relative to an approved
vertical origin. No duplicate geoid subtraction; no hidden datum shifts.

Use UE5.8 Large World Coordinates and Georeferencing plugin with
a documented axis convention and world origin/rebasing. Unreal World
Position Offset is a **displacement delta**, not replacement geodetic
coordinates. Subtracting the GIS origin from AbsoluteWorldPosition and
feeding it into WPO double-translates the rendered geometry and
does not make HLSL float parameters 64-bit. Prelocalize geometry
on the CPU or use explicit UE LWC high/low operations when required.

## Primary authoritative references

- https://epsg.io/2966
- https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-online
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-data-processing-and-handling-requirements
- https://dev.epicgames.com/documentation/unreal-engine/georeferencing-a-level-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/large-world-coordinates-rendering-in-unreal-engine-5
