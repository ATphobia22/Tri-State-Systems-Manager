# IGIO Posey Building Footprints — pinned offline staging

**No 23,082-feature snapshot file is committed here.** This is a staging
procedure for an existing IGIO-derived release snapshot, not evidence that
the data is already available offline or independently survey certified.

Source: https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0
Snapshot: GitHub release igio-posey-20261006, posey-buildings-igio-23082.geojson
Pinned SHA-256: d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f

Place the exact released bytes at:

    offline_packages/igio/posey-buildings-igio-23082.geojson

Run the verifier before ingesting the cache:

    python scripts/geospatial/verify_igio_footprint_cache.py \
      --snapshot offline_packages/igio/posey-buildings-igio-23082.geojson \
      --sha256 d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f \
      --expected-count 23082

Then run ingestion without internet:

    python scripts/geospatial/acquire-and-enrich-igio-posey-buildings.py \
      --offline-only --output /tmp/tsm-igio/posey-buildings-igio-enriched.geojson

Normal (online) mode attempts live IGIO first. If an IGIO query times out
or provides incomplete results, a staged *pinned* local snapshot is preferred.
If absent, the existing GitHub release is retried as a separate REMOTE
fallback. Explicit --offline-only never reaches IGIO or GitHub. An invalid
local cache is rejected, not silently replaced by unverified data.

The recorded checksum proves **byte identity**, not source freshness,
survey-grade vertical accuracy, current agency provenance, acceptable
roof/ground heights, LOD or regulatory findings. Those need independent gates.

## Indiana elevation public S3 archive

Official catalog: https://registry.opendata.aws/in-elevation/
Bucket: giselevationingov
Region: us-east-2
Public listing (no AWS account needed):

    aws s3 ls s3://giselevationingov/ --no-sign-request --region us-east-2

The catalog describes **uncompressed LAS tiles** and separate state data
collections. It does not guarantee that every object is precompressed LAZ,
COPC, an orthophoto COG, or that the repo's hard-coded COPC prefix exists.
List and verify a 2020/zone-specific key before downloading. Capture actual
object key, bytes, acquisition date, SHA-256, embedded CRS, height units,
original vertical datum, and source metadata. Do not confuse EPSG:2966
horizontal US-survey-foot coordinates with orthometric vertical units.
