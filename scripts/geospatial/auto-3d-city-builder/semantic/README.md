# Semantic city exchange — TSM review-only profiles

These are implementation templates, not a running CityDB instance. The current
official input pipeline is the TSM source-pinned IGIO and COPC acquisition.
Do not import or publish the 425 candidates as survey-grade data.

## 3dfier
Use a verified metre-based projected frame such as EPSG:26916 for XY and
explicit NAVD88 metres for Z. Do not confuse EPSG:2966 with NAD83(2011);
the 2020 Indiana COPC headers use EPSG:2968 + EPSG:6360. Convert vertical
US survey feet using exactly 1200/3937; preserve the input/operation receipts.
Supply exactly one polygon layer in the GeoPackage, a stable string tsm_id
field, and only LAS/LAZ files in input/lidar-metric. Validate class-2 and
class-6 coverage per footprint before calling 3dfier; exclude missing coverage,
and reconcile split multipart IDs. The 2020 unclassified returns are not
class-6 roof observations. Run from the review workspace:

    3dfier /path/to/posey-3dfier-lod1.yml --CityGML output/posey-lod1.gml

Verify emitted CRS, units, object IDs, and topology independently. Do not
trust the output label or any default/fallback geometry. 3dfier supports
LoD0/1 only. Use Roofer (https://3dbag.github.io/roofer/) separately for
LoD2.2, after validating source classifications and alignment.

## 3DCityDB
Install 3DCityDB on a separate local PostGIS database; the v4 and v5 adapters
are alternatives. Run 00-review-schema.sql, then 01-v4-views.sql OR
02-v5-views.sql against that specific version. Populate posey_identity only
from a reconciled source snapshot and reviewed parcel join. Native views
expose source coordinates without relabeling Z. v4 imported generic
attributes are diagnostic only; authoritative exported values are TSM
sidecar attributes in metres. The v5 view selects direct geometry properties
at integer LoDs 1/2/3; verify actual imported property names and val_lod
encoding, and treat absent rows as a blocked semantic import. It deliberately
excludes separate semantic child surfaces, interiors, multi-solid alternatives
and multiple representations to avoid duplicate geometry.

The reviewed_geometry table starts empty. An external reviewed coordinate
operation must create EPSG:4979 geometry with ellipsoidal metre Z, bind the
exact native geometry and source-feature hashes, record transform and review
receipts, and authenticate the reviewer. The SQL checks identity and shape
contracts, not the truth of a receipt or 3D topology. A writer role must be
restricted by the deployment administrator; no grants are made here. Do not
use ST_SetSRID to turn NAVD88 into ellipsoidal height. These views are not
public release authority and deliberately return no rows without review.
Use a local read-only export account, credentials supplied securely:

    pg2b3dm --connection "$TSM_CITYDB_CONNECTION" -t tsm_city.posey_v5_tiles -c geom -a cityobject_id,geometry_id,tsm_id,county_fips,county_parcel_id,height_p90_m,lod,source_feature_sha256,transform_receipt_sha256,review_receipt_sha256,engineering_approved --create_gltf true -o review/tiles

For v4 substitute posey_v4_tiles. Current upstream pg2b3dm removed -i;
attributes use -a. Check the pinned binary's --help. Validate resulting
tiles and verify all source identities; no automatic public staging.
This adapter preserves selected geometry only, not full semantics or textures;
keep CityGML/CityJSON as the semantic authority. Actual database import,
reference-frame validation, 3dfier/Roofer execution and production deployment
are outstanding. No proprietary services are necessary for this route.

References:
- https://tudelft3d.github.io/3dfier/lifting_options.html
- https://tudelft3d.github.io/3dfier/input_options.html
- https://docs.3dcitydb.org/1.3/3dcitydb/geometry-module/
- https://docs.3dcitydb.org/1.3/3dcitydb/feature-module/
- https://3dcitydb-docs.readthedocs.io/en/latest/3dcitydb/schema/building.html
- https://github.com/Geodan/pg2b3dm
