"""Evidence-gated adapters for the regional infrastructure twin.

All writers produce existing state-update v1 events. Only the Kafka consumer
persists them; these helpers never bypass the append-only twin kernel.
"""
from __future__ import annotations

import hashlib
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from .contracts import InvalidEvent, canonical, validate

ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
SHA = re.compile(r"^[a-f0-9]{64}$")
MAX_LOCAL_BYTES = 2 * 1024 * 1024 * 1024


def _identifier(value: str) -> str:
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValueError("Invalid regional twin entity identity")
    return value


def utc(value: str) -> str:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as exc:
        raise ValueError("Expected an ISO-8601 timestamp") from exc
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError("Timestamp must include its timezone")
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def hashed_file(path: str | Path) -> str:
    """Hash an actual local file, not an unverified claim or a symlink."""
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError("Evidence must be a regular local file")
    if path.stat().st_size > MAX_LOCAL_BYTES:
        raise ValueError("Evidence file exceeds the bounded local adapter limit")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def state_update(*, matrix: str, entity_id: str, at: str, source: dict,
                 state: dict, geometry: dict | None = None, asset: dict | None = None,
                 evidence: list[dict] | None = None, timeline: str = "observed",
                 branch: str = "main") -> dict:
    """Make a deterministic, schema-validated event for the existing Kafka ingest."""
    event = {
        "version": 1, "matrix": matrix, "entity_id": _identifier(entity_id),
        "timeline": timeline, "branch": _identifier(branch), "valid_from": utc(at),
        "operation": "upsert", "geometry": geometry, "state": state,
        "source": source, "evidence": evidence or [], "asset": asset,
    }
    event["event_id"] = str(uuid5(NAMESPACE_URL, canonical(event)))
    validate(event)
    return event


def reality_capture(*, capture_id: str, captured_at: str, file_path: str | Path,
                    asset_href: str, media_type: str, source: dict,
                    geometry: dict, horizontal_crs: str, vertical_datum: str,
                    evidence: list[dict] | None = None) -> dict:
    """Register a hashed, georeferenced capture; not a claim of survey approval."""
    _identifier(capture_id)
    if not horizontal_crs or not vertical_datum:
        raise ValueError("Capture must disclose horizontal CRS and vertical datum")
    digest = hashed_file(file_path)
    return state_update(
        matrix="R", entity_id=f"capture:{capture_id}", at=captured_at,
        source=source, geometry=geometry, evidence=evidence,
        state={"capture_id": capture_id, "captured_at": utc(captured_at),
               "horizontal_crs": horizontal_crs, "vertical_datum": vertical_datum,
               "asset_sha256": digest, "review_status": "UNREVIEWED"},
        asset={"href": asset_href, "media_type": media_type, "sha256": digest},
    )


def infrastructure_asset(*, asset_id: str, asset_type: str, at: str, source: dict,
                         geometry: dict | None = None,
                         relationships: list[dict] | None = None,
                         evidence: list[dict] | None = None) -> dict:
    """AAS-inspired infrastructure state. Relationships are assertions, not facts."""
    _identifier(asset_id)
    if not asset_type or not asset_type.strip():
        raise ValueError("Asset type is required")
    links = relationships or []
    for link in links:
        if (not isinstance(link, dict)
            or not isinstance(link.get("type"), str) or not link["type"]
            or not isinstance(link.get("target_id"), str)):
            raise ValueError("Each relationship requires type and target_id")
        _identifier(link["target_id"])
    return state_update(
        matrix="I", entity_id=asset_id, at=at, source=source, geometry=geometry,
        evidence=evidence,
        state={"asset_type": asset_type, "global_asset_id": f"urn:tsm:asset:{asset_id}",
               "relationships": links, "review_status": "UNREVIEWED"},
    )


def basyx_shell(asset_event: dict):
    """Construct a real BaSyx metamodel object when the optional SDK is installed.

    The adapter is AAS-aligned, not a claim of Part 1/2 or AASX conformance.
    Validate serialized exports with the BaSyx compliance tool before exchange.
    """
    if asset_event.get("matrix") != "I":
        raise ValueError("Expected an infrastructure asset event")
    validate(asset_event)
    from basyx.aas import model

    asset_id = asset_event["entity_id"]
    short = re.sub(r"[^A-Za-z0-9_]", "_", asset_id)
    if not short or short[0].isdigit():
        short = "asset_" + short
    return model.AssetAdministrationShell(
        id_=f"urn:tsm:aas:{asset_id}",
        id_short=short,
        asset_information=model.AssetInformation(
            asset_kind=model.AssetKind.INSTANCE,
            global_asset_id=asset_event["state"]["global_asset_id"],
        ),
    )


def watershed(*, watershed_id: str, at: str, source: dict, geometry: dict,
              area_sq_km: float, stations: list[str],
              evidence: list[dict] | None = None) -> dict:
    """Record geographic watershed membership without inventing a stage/BFE."""
    _identifier(watershed_id)
    if not math.isfinite(area_sq_km) or area_sq_km <= 0:
        raise ValueError("Watershed area must be finite and positive")
    if not stations or len(stations) != len(set(stations)):
        raise ValueError("Stations must be a nonempty deduplicated list")
    for station in stations:
        _identifier(station)
    return state_update(
        matrix="S", entity_id=f"watershed:{watershed_id}", at=at,
        source=source, geometry=geometry, evidence=evidence,
        state={"watershed_id": watershed_id, "area_sq_km": area_sq_km,
               "station_ids": sorted(stations),
               "discharge_cfs": None, "stage_ft": None,
               "review_status": "UNREVIEWED"},
    )


def inspect_hec_ras(path: str | Path, max_datasets: int = 500) -> dict:
    """Read a bounded HDF5 dataset inventory without running or modifying RAS.

    Dataset structure differs among HEC-RAS releases. No fixed path is
    assumed, no raster is interpolated, and no result is certified.
    """
    import h5py

    path = Path(path)
    digest = hashed_file(path)
    if not h5py.is_hdf5(str(path)):
        raise ValueError("HEC-RAS input is not an HDF5 file")
    if not 1 <= max_datasets <= 5000:
        raise ValueError("Invalid dataset inventory limit")
    datasets = []
    count = 0
    with h5py.File(str(path), "r") as handle:
        def collect(name, item):
            nonlocal count
            if isinstance(item, h5py.Dataset):
                count += 1
                if count <= max_datasets:
                    datasets.append({"path": "/" + name, "shape": list(item.shape),
                                     "dtype": str(item.dtype)})
        handle.visititems(collect)
    return {"engine": "HEC-RAS", "sha256": digest, "datasets": datasets,
            "dataset_count": count, "truncated": count > max_datasets,
            "results_certified": False}


def hec_ras_simulation(*, simulation_id: str, revision: str, at: str, source: dict,
                       inventory: dict, evidence: list[dict] | None = None,
                       branch: str = "hec-ras-review") -> dict:
    """Represent a simulation as derived scenario evidence, never observation."""
    _identifier(simulation_id)
    if (not revision or inventory.get("engine") != "HEC-RAS"
            or not SHA.fullmatch(inventory.get("sha256", ""))):
        raise ValueError("Provide a verified HEC-RAS HDF5 inventory and revision")
    return state_update(
        matrix="M", entity_id=f"simulation:{simulation_id}", at=at, source=source,
        evidence=evidence, timeline="scenario", branch=branch,
        state={"engine": "HEC-RAS", "revision": revision,
               "output_sha256": inventory["sha256"],
               "dataset_count": inventory["dataset_count"],
               "inventory_truncated": inventory["truncated"],
               "certification": "NOT_CERTIFIED"},
    )


def calibration_metrics(pairs: list[dict]) -> dict:
    """Compare only same-unit, same-datum, paired observations and predictions."""
    if not pairs:
        raise ValueError("Calibration requires at least one matched observation")
    seen = set()
    reference = None
    residuals = []
    for item in pairs:
        timestamp = utc(item["observed_at"])
        station = _identifier(item["station_id"])
        key = (station, timestamp)
        if key in seen:
            raise ValueError("Duplicate observation pair")
        seen.add(key)
        unit, datum = item["unit"], item["vertical_reference"]
        if not unit or not datum or "UNRESOLVED" in datum.upper() or datum.upper() == "UNKNOWN":
            raise ValueError("Verified units and vertical reference required")
        if reference is None:
            reference = (unit, datum)
        if (unit, datum) != reference:
            raise ValueError("Mixed units or vertical datums cannot be calibrated")
        observed, predicted = float(item["observed"]), float(item["predicted"])
        if not (math.isfinite(observed) and math.isfinite(predicted)):
            raise ValueError("Nonfinite calibration sample")
        residuals.append(predicted - observed)
    n = len(residuals)
    return {
        "sample_count": n, "unit": reference[0],
        "vertical_reference": reference[1],
        "rmse": math.sqrt(math.fsum(x*x for x in residuals) / n),
        "mae": math.fsum(abs(x) for x in residuals) / n,
        "bias": math.fsum(residuals) / n,
        "observation_use": "withheld",
        "method": "time-and-station-matched; no interpolation",
    }


def calibration_event(*, calibration_id: str, at: str, source: dict,
                      pairs: list[dict], evidence: list[dict],
                      branch: str = "calibration-review") -> dict:
    """Withhold fit claims until independent acceptance and evidence review."""
    if not evidence:
        raise ValueError("Calibration must reference existing evidence events")
    state = calibration_metrics(pairs)
    state["metric"] = "RMSE"
    state["review_status"] = "UNREVIEWED"
    return state_update(
        matrix="V", entity_id=f"calibration:{_identifier(calibration_id)}",
        at=at, source=source, evidence=evidence,
        timeline="scenario", branch=branch, state=state,
    )


def evidence_neighborhood(conn, event_id: str, limit: int = 100) -> list[dict]:
    """Read accepted lineage links; no private source bytes or mutations."""
    if not 1 <= limit <= 250:
        raise ValueError("Invalid lineage limit")
    return conn.execute("""
        SELECT src.event_id::text AS source_event, dst.event_id::text AS target_event,
               l.relationship, src.body->'source'->>'authority' AS source_authority,
               dst.body->'source'->>'authority' AS target_authority
        FROM twin.evidence_link l
        JOIN twin.event dst ON dst.seq=l.event_seq
        JOIN twin.event src ON src.event_id=l.evidence_event_id
        WHERE src.event_id=%s::uuid OR dst.event_id=%s::uuid
        ORDER BY dst.seq,src.seq,l.relationship LIMIT %s
    """, (event_id, event_id, limit)).fetchall()


def knowledge_neighborhood(conn, entity_id: str, limit: int = 100) -> list[dict]:
    """Projection-derived, attributed edges, including incoming references.

    The current_entity table is replayable: this is a graph *view*, not an
    independent, untraceable knowledge store.
    """
    _identifier(entity_id)
    if not 1 <= limit <= 250:
        raise ValueError("Invalid graph limit")
    return conn.execute("""
        SELECT c.matrix,c.entity_id AS source_id,c.event_seq,
               edge->>'target_id' AS target_id,edge->>'type' AS relationship,
               c.body->'source'->>'authority' AS authority
        FROM read_model.current_entity c
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(c.body->'state'->'relationships')='array'
                 THEN c.body->'state'->'relationships' ELSE '[]'::jsonb END
        ) AS edge
        WHERE NOT c.retired AND
              (c.entity_id=%s OR edge->>'target_id'=%s)
              AND jsonb_typeof(edge)='object'
        ORDER BY c.matrix,c.entity_id,c.event_seq LIMIT %s
    """, (entity_id, entity_id, limit)).fetchall()


def stac_delivery_status(conn, event_id: str, collection: str) -> dict:
    """Expose the asset receipt without confusing STAC listing with validation."""
    row = conn.execute("""
        SELECT e.event_id::text AS event_id,
               e.body->'asset' AS asset, e.body->'source' AS source,
               EXISTS (SELECT 1 FROM pgstac.items i
                       WHERE i.id=e.event_id::text AND i.collection=%s) AS published
        FROM twin.event e WHERE e.event_id=%s::uuid
    """, (collection, event_id)).fetchone()
    if row is None:
        raise LookupError("No accepted event with this identity")
    return {**row, "asset_integrity_independently_verified": False}
