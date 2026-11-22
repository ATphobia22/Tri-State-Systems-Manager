# TSM five-phase digital-twin integration and acceptance

Checkpoint: 2026-11-22. Human authority is final. This is not an NFIP
determination or a certification of any physical model.

## Phase 1: Canonical twin state

Immutable PostGIS events include typed matrix/entity identity, 4326 geometry,
source SHA-256, valid and recorded times, timeline, and linked evidence.
Transactional outbox routes committed events to Kafka/Redpanda and pgSTAC.
Checkpointed CQRS read models can be rebuilt from event history. The
Compose integration suite tests idempotent ingestion, late effective-date
corrections, tombstones, historical queries and rebuild state equivalence.

## Phase 2: Hydrology and validation

The merged river-twin snapshot captures official USGS 03322000 and 03378500
observations, with 03377500 also importable where available. Model-vs-
observation comparison requires exact station/time/parameter/units agreement,
reviewed station-specific gage-zero datum provenance, effective dates and
NAVD88 model elevations. Missing datum returns WITHHELD, not a fabricated
residual. Uncertainty propagation remains null when inputs are unknown.
Original HEC-RAS model evidence and independent calibration/validation
segregation remain acceptance requirements.

## Phase 3: Infrastructure asset shells

Matrix I events support versioned bridge, levee, gauge, pump_station, road and
port instances with stable UUIDs and typed relationships. AAS exports are
read-only and AAS-shaped, not independently IDTA/BaSyx-profile conformant.
Agency inventories and asset conditions require independent source review.

## Phase 4: Indexed geospatial evidence

Matrix E spatial links bind terrain, building, floodplain, parcel and 3d_tiles
artifacts to stable authoritative source feature IDs, upstream twin event IDs,
native horizontal CRS, explicit vertical datum/units, EPSG:4326 geometry and
source/asset SHA-256 digests. Geometry MUST be transformed into WGS84 before
submission. A REVIEWED coordinate status requires a pinned transformation
receipt, but does not independently establish its accuracy; independent
numerical control testing remains mandatory. UNKNOWN datum and UNVERIFIED /
UNRESOLVED links remain displayed as evidence gaps. No silent conversion
between NAVD88/GEOID18 and EGM2008 is allowed.

Operator commands from services/living-twin directory:

    python -m twin.import_geospatial ./source-layer.json --preview
    python -m twin.import_geospatial ./source-layer.json

The preview does not write state; the regular import commits an immutable E
event, and, when an asset is present, queues the pgSTAC projection. A synthetic
illustrative parcel manifest (never engineering evidence):

    {
      "layer_kind":"parcel", "source_feature_id":"1234",
      "source":{"authority":"EXAMPLE_ONLY","uri":"https://example.org/source",
                "retrieved_at":"2025-02-01T00:00:00Z",
                "sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
      "valid_from":"2025-01-01T00:00:00Z",
      "geometry":{"type":"Point","coordinates":[-88.0,38.0]},
      "source_horizontal_crs":"EPSG:2966", "coordinate_status":"UNVERIFIED",
      "vertical_datum":"UNKNOWN", "vertical_unit":"UNKNOWN"
    }

For bounded PostGIS geometry queries use:

    GET /twin/geospatial?bbox=-88.2,37.8,-87.8,38.2&kind=parcel

The API is read-only, uses spatial indexes and projection-stable pagination,
and does not fetch HTTP tile assets or transform geometries implicitly.
3D Tiles feature IDs must be checked against the official IGIO OBJECTIDs;
the asset manifest must record the source tileset SHA-256 and local URI
integrity. Floodplain FEMA NFHL effective and Indiana BAFL planning layers
must remain distinguished by source authority, purpose and effective date.

The PR #699 Unreal Editor review snapshot was reconciled without overwriting
newer main code. It contains 20,517 source IDs represented by building mesh
payloads and 2,565 footprint-only IDs, not a full set of 23,082 3D meshes.

## Phase 5: Independent release verification

A green source test is NOT clean-host Windows startup, regulatory
certification, or an independently verified production browser render.

1. Replay: independently capture all pages of read state before and after
   the authorized checkpoint rebuild. Both snapshots must have the same
   committed sequence watermark and byte-stable event/geometry state.
   Use the conservative replay comparator below; truncated pages fail.
2. Building identity: export per-OBJECTID JSON arrays of authoritative
   source footprints, mesh-associated IDs, footprint-only fallbacks and
   separately reviewed LAS/COPC height-linked IDs. Pin official source
   hashes separately. Source count 23,082 alone is insufficient: the
   full 3D gate requires source, mesh and verified height ID sets to match.
   Roof and ground elevations require independent numerical audit.
3. Public web: independently verify deployed Cesium asset bytes using
   scripts/release/cesium_published_receipt.py verify-published and
   retain headed Chromium screenshots/browser logs for actual terrain,
   buildings, flood controls, cameras, navigation and gauge state.
4. Windows 11: build, cook, package, install and launch a real Unreal
   Engine 5.8 Shipping executable on a clean x64 host with network
   disconnected; capture process/BuildCookRun logs, executable hashes,
   GPU/FPS details, headed terrain/building evidence, screenshots and
   the local snapshot manifest. Use existing independent acceptance
   validator scripts/release/shipping_acceptance_evidence.py. A green
   generic build-windows-x64 job does not establish this gate.
5. AAS: run current IDTA/BaSyx interoperability validators against
   the JSON projections and retain the validator version and results.

Examples of independent evidence-contract checks, from repository root:

    python scripts/release/verify_phase5_evidence.py \
      --official-ids official-objectids.json \
      --mesh-ids mesh-objectids.json \
      --fallback-ids fallback-objectids.json \
      --reviewed-height-ids reviewed-height-objectids.json \
      --output building-proof.json

    python scripts/release/verify_phase5_evidence.py \
      --replay-before full-before.json --replay-after full-after.json \
      --output replay-proof.json

The input audits cannot prove external source authenticity. Even if the
input identity and replay checks pass, the overall report remains
INPUT_GATES_MATCH_RELEASE_STILL_BLOCKED until independent headed and native
review. Exit code 2 denotes blocked or invalid input. Never treat synthetic
unit-test data as actual dataset or release evidence.

## Known blockers as of this checkpoint

- PR #696 has a failed Building 3D Tiles build job. A full 23,082-feature
  source-linked mesh and reviewed-height match is not demonstrated.
- The PR #699 snapshot is VISUALIZATION_ONLY, not UE5.8 Shipping acceptance.
- A real reviewed HEC-RAS model result and exact station-specific gage-zero
  evidence are not yet shown to be independently accepted in the twin.
- A production web deployment inspection and a clean Windows offline startup
  receipt remain required.

Acquisition, transformation, calculation, validation, building, packaging
and deployment remain headless. Only rendering and headed inspection use
graphics. Human authority final; no automatic agency decisions.
