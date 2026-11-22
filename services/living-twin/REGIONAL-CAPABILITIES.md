# Regional infrastructure twin: integrated capability slice

This extension reuses the existing Kafka ingress, append-only twin.event ledger, PostGIS projections, outbox, pgSTAC catalog, evidence links, and Cesium feed.

## Eight connected capabilities

| Capability | Implementation | Validation boundary |
|---|---|---|
| Reality Capture Registry | twin.regional.reality_capture, matrix R, pgSTAC outbox | Hash actual local bytes, require geographic CRS/datum and unreviewed status |
| pgSTAC Integration | Existing twin.catalog and twin.relay plus GET /v1/regional/stac/{event_id} | Item listing is not an independent asset integrity certification |
| Asset Administration Shell | infrastructure_asset, matrix I, optional basyx_shell SDK object | AAS-inspired model; run BaSyx compliance tool before standards claim |
| Watershed Aggregate | watershed, matrix S and station membership | No invented flow, stage, or elevation |
| HEC-RAS Simulation Adapter | inspect_hec_ras HDF5 inventory and hec_ras_simulation matrix M | Read-only structural inspection; no solver execution or certification |
| Calibration Engine | calibration_metrics and calibration_event matrix V | Time/station pairs, identical unit/datum, report withheld until reviewed |
| Evidence Graph | Existing twin.evidence_link with GET /v1/regional/evidence/{event_id} | Verified ledger-linked directional relationships |
| Regional Knowledge Graph | Existing replayable current_entity relationships and GET /v1/regional/knowledge/{entity_id} | Explicit source-attributed edges, no asserted regulatory inference |

All writes remain exclusive to the existing Kafka consumer and twin kernel.
Public routes run SELECT queries only. HEC-RAS and calibration results are scenario
events, not authoritative hydrologic observations.

## Running

Install the existing service dependencies from services/living-twin/requirements.txt.
The HDF5 reader is pinned as h5py. Optional AAS metamodel adapter needs the
Eclipse BaSyx Python SDK installed separately (pip install basyx-python-sdk).
Validate exported models using the BaSyx conformance tool before exchange.

From the service working directory, construct a regional event with a trusted
source record (authority, HTTPS URI, retrieval timestamp and actual source SHA),
and use a real capture file, asset HTTPS URI, geographic geometry, exact CRS
and vertical datum. For example:

    from twin.regional import reality_capture
    import json
    event = reality_capture(
        capture_id="posey-capture-001",
        captured_at="2026-11-22T12:00:00Z",
        file_path="/verified-files/capture.glb",
        asset_href="https://published-assets.example/capture.glb",
        media_type="model/gltf-binary",
        source={
            "authority": "AUTHORIZED_SOURCE",
            "uri": "https://source.example/original",
            "retrieved_at": "2026-11-22T13:00:00Z",
            "sha256": "a" * 64,
        },
        geometry={"type": "Point", "coordinates": [-87.9, 38.1]},
        horizontal_crs="EPSG:2966",
        vertical_datum="NAVD88",
    )
    with open("/tmp/tsm-capture-event.json", "w") as out:
        json.dump(event, out)

The above source hash is EXAMPLE ONLY and must be replaced by an independently
measured digest before real publication. Publish with the established publisher:

    python -m twin.publish /tmp/tsm-capture-event.json

Run full tests on the existing connected runtime:

    docker compose --profile test run --rm tests

The route GET /v1/regional/stac/{event_id} reports delivery, not asset
verification. Other read APIs: /captures, /assets, /watersheds, /simulations,
/calibrations, /evidence/{event_id}, and /knowledge/{entity_id}.

## Unverified independent release gates

- A genuine Posey or other Tri-State survey/capture artifact and published hash.
- HEC-RAS calculation, operator-reviewed model and independent hydrologic skill.
- Official watershed source boundary, certified vertical control and gage zero.
- AAS compliance validation against a pinned BaSyx and IDTA specification.
- Independent quality and throughput checks for regional relationship graph.
- Production integration run; native Windows 11 UE5.8 offline Shipping launch.

Gage-relative stage is never silently converted to NAVD88. The public connected
WebSocket runtime remains separate from the required serverless offline-native
Windows application.

## Official and upstream references

- https://stac-utils.github.io/pgstac/
- https://github.com/stac-utils/stac-fastapi-pgstac
- https://github.com/eclipse-basyx/basyx-python-sdk
- https://www.hec.usace.army.mil/confluence/rasdocs/rmum/6.3/mapping-results/creating-results-maps
- https://api.waterdata.usgs.gov/docs/
