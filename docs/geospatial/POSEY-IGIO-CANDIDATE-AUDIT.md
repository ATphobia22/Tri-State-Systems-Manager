# Posey County IGIO candidate footprint audit (informational only)

This workflow validates a **user-supplied, untrusted** Posey County GeoJSON
candidate before considering it for TSM. It does not verify the authority or
release vintage of uploaded data, observed roof heights, NAVD88 ground
elevations, engineering design, or NFIP determinations.

The authoritative comparison source is the Indiana Geographic Information
Office's [Indiana Building Footprints 2016–2020 FeatureServer](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0);
its [published metadata](https://www.arcgis.com/sharing/rest/content/items/384f2d5041a14c34bd9e807c568784da/info/metadata/metadata.xml?format=default&output=html)
describes statewide LiDAR-derived building polygons and a 2022 release.
IGIO's 2025 Data Harvest covers *other* GIS layers and must not be treated as
a newer vintage of these building footprints.

## Local verification

Place the raw input **outside Git and public web artifacts**. Install the
project-pinned Python geometry stack and run:

    python3 -m pip install "numpy==2.1.3" "shapely==2.0.6"
    python3 scripts/geospatial/audit_posey_igio_candidate.py \
      --input /secure/offline/posey-igio-buildings.geojson \
      --expected-count 23082 \
      --expected-sha256 172c2568864b6c012dc1fdebab245e25d64d23582d548a3c5a7b8eb09d8dec68 \
      --receipt /secure/offline/posey-audit-receipt.json

Optional: add --normalized-output /secure/offline/unverified-normalized.geojson
to add the \`properties.igioObjectId\` alias without changing a vertex.
The normalized candidate may include raw private attributes: it **must never
be published to GitHub, Pages, or release artifacts**.

An exit code of 0 means *only* that source identity, feature count, and
Shapely topology checks passed. An exit code of 2 means unapproved input or
an unresolved geometry exception. Neither code asserts IGIO provenance,
LiDAR/DEM validity, or 23,082 produced and accepted 3D building GLBs.

## Candidate inspected on 2026-10-26

Source SHA-256: \`172c2568864b6c012dc1fdebab245e25d64d23582d548a3c5a7b8eb09d8dec68\`.
Size 13,585,757 bytes; 23,082 features; 23,082 distinct \`objectid\` values;
23,071 Polygon + 11 MultiPolygon; 12 invalid self-intersection footprints;
no height or NAVD88 ground elevation attributes. The 12 invalid source IDs
are in the coordinate-redacted evidence receipt stored in the restricted evidence inventory.

The candidate's reported \`lidaryear=2020\` and source strings are not
independently verified source provenance. Counts are not evidence of correct
geometry. Do not silently repair using \`buffer(0)\`, \`make_valid\`, convex hull
or a substituted box. Reconcile geometry by OBJECTID with IGIO and archive
original source hashes, source metadata, and per-feature decisions.

The current production chain continues to require valid terrain/elevation
evidence, observed or explicitly derived LiDAR heights, identity cardinality,
and complete 3D Tiles/GLB/HLOD validation before its acceptance claim. Keep a
partial nonengineering viewer accessible without concealing missing coverage.

Related: [issue #416](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/416).
