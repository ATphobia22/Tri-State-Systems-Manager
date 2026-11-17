# Milestone A — immutable Posey building reconciliation (draft)

**Current state: DRAFT / NO FROZEN BUILDING EVIDENCE.** This directory contains real, version-controlled *templates*, not 23,082 reconciled records or source hashes. Do not describe Milestone A as complete until the freeze and independent validation have succeeded. The expected **23,082** Posey IDs are a count target, not a result established by these templates.

## Purpose and evidence boundary

Keep authoritative Indiana GIO source geometry, reconciled OpenStreetMap IDs, and the rendering style **separate**. The remote Cesium OSM Buildings asset **96188** and the proposed ion terrain asset **2426648** are mutable, externally managed assets; an asset ID does not prove origin, scope, licensed redistribution, survey quality, measured roof height, NAVD88 compatibility, or permission to download into a native offline bundle. Do **not** claim a hash of a live ion tileset.

The frozen Milestone A receipt hashes **these local files only**, in order:

1. posey_buildings_source.csv — one row per source OBJECTID, including independently computed SHA-256 evidence for each source footprint.
2. posey_reconciliation.csv — one row for the same OBJECTID, with a manual-review status and, where justified, an OSM element type/ID and measured intersection-over-union.
3. posey_style.json — presentation rules for a **separately generated reconciled Posey 3D Tiles dataset** whose feature metadata actually contains match_status and height_source.

The initial manifest.milestone-a.json contains null hashes, PENDING source metadata and the explicit DRAFT_UNVERIFIED state. It is *not* a frozen artifact.

## Validation and freeze

When lawful original source material is available, independently inspect authoritative county boundaries (Posey GEOID 18129), source dates, CRS, vertical datum and units, completeness, licenses and geometric matching. Do not infer source heights or roof materials from OSM floor counts. Fill both CSVs with exactly 23,082 **distinct, identically named OBJECTIDs**. Include confirmed elevation evidence classes only (OBSERVED, DERIVED or UNAVAILABLE); leave height blank when UNAVAILABLE. A verified OSM match must include an OSM way/relation ID, a measured overlap between 0 and 1, review reason and timestamp.

Fill the manifest source fields from actual records: HTTPS service URL, source snapshot time, acquisition time, CRS, units, and explicit APPROVED license review and VERIFIED geographic coverage. Vertical datum must remain explicit for every real height. Source building IDs and their per-feature SHA-256s must be computed from frozen inputs, never guessed.

Run from the repository root:

~~~bash
python3 scripts/evidence/freeze_milestone_a.py --lint
python3 scripts/evidence/freeze_milestone_a.py --freeze
python3 scripts/evidence/freeze_milestone_a.py --verify
sha256sum -c evidence/milestone-a/manifest.milestone-a.sha256.txt  # run inside evidence/milestone-a
~~~

The freeze command emits manifest.milestone-a.sha256.txt **only after successful validation** of all 23,082 identity rows and hashes. Never hand-write the checksum. The sidecar hashes the final manifest; that manifest separately binds the frozen inputs. Re-running freeze fails rather than silently overwriting an existing receipt. Verification fails if an input or the manifest changes.

To verify with sha256sum, run:

~~~bash
cd evidence/milestone-a
sha256sum -c manifest.milestone-a.sha256.txt
~~~

The checksum proves byte identity, **not the accuracy of the underlying agency data or a regulatory conclusion**. For independent peer review, retain the original source archives and any licensing records outside GitHub if necessary; disclose their publication and acquisition timestamps, per-source authority and source-unit transformations.

## Reconciliation attributes and color legend

| match_status | Meaning | Color |
|---|---|---|
| MATCHED_VERIFIED with height_source=OBSERVED | Reviewed match with a separately sourced observed height | Green |
| MATCHED_VERIFIED with height_source=DERIVED | Reviewed match with calculated/derived height | Blue |
| POSSIBLE_MATCH | Candidate geometry match requiring human review | Amber |
| CONFLICT | Conflicting geometries or identities; unresolved | Red |
| UNMATCHED | No accepted OSM correspondence | Grey |
| Missing/unsupported attributes | No class can be justified | Neutral |

The styling file is **not applied to the hosted ion asset 96188**. Its conditions reference match_status and height_source, which are custom reconciled-feature fields absent from unmodified OSM metadata. First regenerate a Posey-only evidence-linked tileset with these fields (e.g., EXT_mesh_features / EXT_structural_metadata) and verify exact ID linkage. Apply the style to that layer alone. Source-derived geometry and Cesium OSM context should not be rendered as two coincident opaque building meshes.

## Next release gates

Produce matching-confidence and collision reports; validate all original and reconciled OBJECTIDs, actual roof-plane residuals, three-dimensional datum placement, mesh watertightness, geometry accuracy, 3D Tiles content metadata, and source license. Independently benchmark LOD, streaming performance and visual seams at the IN/IL/KY borders. No LOD2–LOD4 building coverage, PBR material validation, proprietary ion asset ownership, or Windows UE5.8 Shipping acceptance is established by Milestone A scaffolding.

References: [Cesium OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/), [OSM taginfo](https://taginfo.openstreetmap.org/keys), [OGC 3D Tiles](https://www.ogc.org/standard/3dtiles/), [USGS National Map](https://www.usgs.gov/the-national-map-data-delivery), and the [TSM evidence rules](../README.md).
