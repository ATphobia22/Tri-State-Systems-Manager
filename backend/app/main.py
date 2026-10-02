"""TSM companion API (FastAPI).

Companion to the Node API in tsm-console/server. This service handles
evidence-packet intake and hydrologic-node reads. It is intentionally NOT
wired into the Node server: run it separately (see backend/README.md).

Governing axiom: "Technology informs people; it does not silently govern
people. Human authority remains final." Nothing here submits, issues, or
approves anything with FEMA or any agency. Every accepted artifact is
provisional and human-review-required. Fail-closed on invalid input.
"""

from __future__ import annotations

import hashlib
import math
import json
import os
import re
import uuid
import asyncio
from typing import Any

from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError
from backend.api.v1.evidence_lock import router as evidence_lock_router

import httpx

REPO_ROOT = Path(
    os.environ.get("TSM_REPO_ROOT", Path(__file__).resolve().parents[2])
)
OUTBOX_DIR = Path(
    os.environ.get("TSM_EVIDENCE_OUTBOX", REPO_ROOT / "backend" / "outbox")
)
QUARANTINE_DIR = Path(
    os.environ.get("TSM_GAUGE_QUARANTINE", REPO_ROOT / "backend" / "quarantine")
)
USACE_EXAMPLE = (
    REPO_ROOT / "data" / "schemas" / "examples" / "usace-hydrologic-node.example.json"
)

DISCLAIMER = (
    "Provisional intake only. This service does not submit, issue, or approve "
    "anything with FEMA or any agency. Human authority remains final; every "
    "accepted artifact requires human review."
)

# Identifiers that are interpolated into file paths must be inert path
# segments: no slashes, dots, or separators of any kind.
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
MAX_SAFE_ID_LENGTH = 128
# The gauge-ingest endpoint writes one file per reading, so its request body
# is capped: an unbounded body would be an unbounded disk write.
MAX_GAUGE_INGEST_BODY_BYTES = 2 * 1024 * 1024  # 2 MiB

# ---------------------------------------------------------------------------
# On-demand live gauge snapshot (user-initiated only).
#
# Owner direction 2026-10-01: river data yes, live polling no — plus a button
# that fetches a live snapshot of all gauges when the user presses it.
# This endpoint performs NO background polling, NO scheduling, and stores
# NOTHING. It fetches current instantaneous values from USGS Water Services
# at the moment of the request and returns them with fetch timestamps.
# Every value is marked provisional (USGS data qualifier). Fail-closed: if
# the upstream service is unreachable or returns no data, the station is
# reported unavailable — never filled in.
#
# Station 03378500 is the Wabash River at New Harmony, IN per USGS Water
# Services (verified 2026-10-01: 03378500 = "WABASH RIVER AT NEW HARMONY, IN";
# the separate Mount Carmel, IL gauge is 03377500). A 2026-10-01 registry
# edit briefly mislabeled 03378500 as Mount Carmel; corrected back here.
# ---------------------------------------------------------------------------
SNAPSHOT_STATIONS: tuple[tuple[str, str, str], ...] = (
    ("03378500", "Wabash River at New Harmony, IN", "Wabash River"),
    ("03377500", "Wabash River at Mount Carmel, IL", "Wabash River"),
    ("03322000", "Ohio River at Evansville, IN", "Ohio River"),
    ("03304300", "Ohio River at Newburgh Lock and Dam, IN", "Ohio River"),
    ("03322420", "Ohio River at Uniontown Dam, KY", "Ohio River"),
    ("03381700", "Ohio River at Old Shawneetown, IL-KY", "Ohio River"),
    ("03399800", "Ohio River at Smithland Dam, Smithland, KY", "Ohio River"),
    ("03303280", "Ohio River at Cannelton Dam at Cannelton, IN", "Ohio River"),
    ("03612600", "Ohio River at Olmsted, IL", "Ohio River"),
    ("03277200", "Ohio River at Markland Dam near Warsaw, KY", "Ohio River"),
    ("03293600", "Ohio River at McAlpine Dam - Headwater", "Ohio River"),
    ("03294500", "Ohio River at Louisville, KY", "Ohio River"),
    ("03293551", "Ohio River upstream of McAlpine Dam at railroad bridge at Louisville, KY", "Ohio River"),
)
SNAPSHOT_PARAMETER_LABELS = {"00060": "Discharge", "00065": "Gage height"}
SNAPSHOT_IV_URL = "https://waterservices.usgs.gov/nwis/iv/"
SNAPSHOT_TIMEOUT_SECONDS = 25.0


def _snapshot_registry() -> list[dict]:
    return [
        {"site_no": site_no, "name": name, "river": river, "provider": "USGS"}
        for site_no, name, river in SNAPSHOT_STATIONS
    ]


async def _fetch_usgs_iv(site_nos: list[str]) -> dict:
    """Fetch instantaneous values from USGS Water Services. Raises on failure."""
    params = {
        "format": "json",
        "sites": ",".join(site_nos),
        "parameterCd": "00060,00065",
    }
    async with httpx.AsyncClient(timeout=SNAPSHOT_TIMEOUT_SECONDS) as client:
        response = await client.get(SNAPSHOT_IV_URL, params=params)
        response.raise_for_status()
        return response.json()


def _parse_iv_series(payload: dict) -> dict[str, list[dict]]:
    """Index USGS IV time series by site_no -> latest observation per parameter."""
    by_site: dict[str, dict[str, dict]] = {}
    series = payload.get("value", {}).get("timeSeries", []) or []
    for ts in series:
        try:
            site_no = ts["sourceInfo"]["siteCode"][0]["value"]
            param = ts["variable"]["variableCode"][0]["value"]
            unit = ts["variable"].get("unit", {}).get("unitCode")
            values = (ts.get("values") or [{}])[0].get("value") or []
        except (KeyError, IndexError, TypeError):
            continue
        if param not in SNAPSHOT_PARAMETER_LABELS or not values:
            continue
        latest = values[-1]
        try:
            numeric = float(latest["value"])
        except (KeyError, TypeError, ValueError):
            continue
        by_site.setdefault(site_no, {})[param] = {
            "parameter": param,
            "label": SNAPSHOT_PARAMETER_LABELS[param],
            "value": numeric,
            "unit": unit,
            "observed_at": latest.get("dateTime"),
            "qualifiers": latest.get("qualifiers") or [],
            "provisional": True,
        }
    return {
        site_no: [obs for _, obs in sorted(params.items())]
        for site_no, params in by_site.items()
    }


def _validated_id(value: str, field: str) -> str:
    """Allowlist-validate an identifier before it touches a file path."""
    if len(value) > MAX_SAFE_ID_LENGTH or not _SAFE_ID_RE.fullmatch(value):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "UNSAFE_IDENTIFIER",
                "field": field,
                "detail": (
                    f"{field} must match ^[A-Za-z0-9_-]+$ "
                    f"(max {MAX_SAFE_ID_LENGTH} characters)."
                ),
            },
        )
    return value


def _contained_path(base_dir: Path, filename: str) -> Path:
    """Fail closed if the resolved path escapes the intended base directory."""
    base = base_dir.resolve()
    resolved = (base / filename).resolve()
    if resolved != base and base not in resolved.parents:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "PATH_ESCAPE_BLOCKED",
                "detail": "Resolved path escapes the intended storage directory.",
            },
        )
    return resolved

app = FastAPI(
    title="TSM Companion API",
    version="1.0.0",
    description=DISCLAIMER,
)

app.include_router(evidence_lock_router)




# Hardened geospatial/engineering API limits.
MAX_RAS_CELLS = 100_000
MAX_LEDGER_ENTRIES = 100_000
MAX_RASTER_BYTES = 128 * 1024 * 1024
MAX_RASTER_PIXELS = 12_000_000
MAX_RASTER_DIMENSION = 4096
POSEY_MANIFEST = REPO_ROOT / "tsm-console" / "data" / "manifests" / "posey-2020-site-assets.json"
RAS_OUTBOX_DIR = OUTBOX_DIR / "ras-results"
LEDGER_FILE = OUTBOX_DIR / "ledger.json"
POSEY_RASTER_HOSTS = {"di-ingov.img.arcgis.com", "imagery.geoplatform.gov"}
_LEDGER_LOCK = asyncio.Lock()

def _load_posey_manifest() -> dict[str, Any]:
    if not POSEY_MANIFEST.exists():
        raise HTTPException(status_code=503, detail={"code": "POSEY_MANIFEST_UNAVAILABLE"})
    try:
        return json.loads(POSEY_MANIFEST.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail={"code": "POSEY_MANIFEST_INVALID"}) from exc

def _posey_bounds(manifest: dict[str, Any]) -> dict[str, float]:
    bounds = manifest.get("bounds")
    if not isinstance(bounds, dict):
        raise HTTPException(status_code=503, detail={"code": "POSEY_BOUNDS_UNAVAILABLE"})
    try:
        result = {key: float(bounds[key]) for key in ("minX", "minY", "maxX", "maxY")}
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail={"code": "POSEY_BOUNDS_INVALID"}) from exc
    if not (result["minX"] < result["maxX"] and result["minY"] < result["maxY"]):
        raise HTTPException(status_code=503, detail={"code": "POSEY_BOUNDS_INVALID"})
    return result

def _parse_bbox(raw: str, bounds: dict[str, float]) -> dict[str, float]:
    try:
        values = [float(value) for value in raw.split(",")]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "INVALID_BBOX"}) from exc
    if len(values) != 4 or not all(map(lambda value: value == value and abs(value) != float("inf"), values)):
        raise HTTPException(status_code=422, detail={"code": "INVALID_BBOX"})
    min_x, min_y, max_x, max_y = values
    if not (min_x < max_x and min_y < max_y):
        raise HTTPException(status_code=422, detail={"code": "INVALID_BBOX"})
    if not (
        min_x >= bounds["minX"] and min_y >= bounds["minY"]
        and max_x <= bounds["maxX"] and max_y <= bounds["maxY"]
    ):
        raise HTTPException(status_code=422, detail={"code": "BBOX_OUTSIDE_POSEY_BOUNDS"})
    return {"minX": min_x, "minY": min_y, "maxX": max_x, "maxY": max_y}

def _parse_dimension(raw: int, name: str) -> int:
    if raw < 256 or raw > MAX_RASTER_DIMENSION:
        raise HTTPException(status_code=422, detail={"code": "INVALID_RASTER_DIMENSION", "field": name})
    return raw

def _posey_raster_request(
    manifest: dict[str, Any],
    bounds: dict[str, float],
    width: int,
    height: int,
    kind: str,
) -> tuple[str, str, dict[str, Any]]:
    asset = manifest.get(kind)
    if not isinstance(asset, dict) or not isinstance(asset.get("sourceUri"), str):
        raise HTTPException(status_code=503, detail={"code": "POSEY_ASSET_UNAVAILABLE", "kind": kind})
    source = asset["sourceUri"]
    parsed = httpx.URL(source)
    if parsed.scheme != "https" or parsed.host not in POSEY_RASTER_HOSTS:
        raise HTTPException(status_code=503, detail={"code": "UPSTREAM_HOST_NOT_ALLOWLISTED"})
    export_url = str(parsed).rstrip("/") + "/exportImage"
    params = {
        "bbox": f'{bounds["minX"]},{bounds["minY"]},{bounds["maxX"]},{bounds["maxY"]}',
        "bboxSR": "2966",
        "imageSR": "2966",
        "size": f"{width},{height}",
        "format": "tiff" if kind == "terrain" else "png32",
        "pixelType": "F32" if kind == "terrain" else "U8",
        "interpolation": "RSP_NearestNeighbor" if kind == "terrain" else "RSP_BilinearInterpolation",
        "f": "image",
    }
    content_type = "image/tiff" if kind == "terrain" else "image/png"
    return export_url, content_type, {"source": asset, "bounds": bounds, "width": width, "height": height, "kind": kind, "params": params}

def _read_json_file(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"code": "RESOURCE_NOT_FOUND"}) from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail={"code": "RESOURCE_UNAVAILABLE"}) from exc

def _reviewer_allowlist() -> set[str]:
    raw = os.environ.get("TSM_REVIEWER_SUBJECTS", "")
    return {value.strip() for value in raw.split(",") if value.strip()}

@app.get("/api/geospatial/posey/manifest")
def posey_manifest() -> dict[str, Any]:
    """Return the immutable registered Posey 2020 asset manifest."""
    manifest = _load_posey_manifest()
    return {
        "manifest": manifest,
        "provenance": {
            "authority_class": "OBSERVATION",
            "horizontal_crs": manifest.get("horizontalCrs"),
            "vertical_datum_verified": bool(manifest.get("verticalDatumVerified", False)),
            "human_review_required": True,
        },
    }

@app.get("/api/geospatial/posey/raster")
async def posey_raster(
    bbox: str | None = Query(default=None),
    width: int = Query(default=1024),
    height: int = Query(default=1024),
    kind: str = Query(default="terrain"),
) -> StreamingResponse:
    """Stream a bounded Posey terrain/orthophoto raster from an allowlisted source."""
    manifest = _load_posey_manifest()
    registered_bounds = _posey_bounds(manifest)
    request_bounds = _parse_bbox(
        bbox or ",".join(str(registered_bounds[key]) for key in ("minX", "minY", "maxX", "maxY")),
        registered_bounds,
    )
    width = _parse_dimension(width, "width")
    height = _parse_dimension(height, "height")
    if width * height > MAX_RASTER_PIXELS:
        raise HTTPException(status_code=422, detail={"code": "RASTER_PIXEL_BUDGET_EXCEEDED"})
    if kind not in {"terrain", "orthophoto"}:
        raise HTTPException(status_code=422, detail={"code": "INVALID_RASTER_KIND"})
    export_url, content_type, descriptor = _posey_raster_request(
        manifest, request_bounds, width, height, kind
    )

    async def stream() -> Any:
        total = 0
        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            try:
                async with client.stream("GET", export_url, params=descriptor["params"]) as response:
                    if 300 <= response.status_code < 400:
                        raise HTTPException(status_code=502, detail={"code": "UPSTREAM_REDIRECT_REJECTED"})
                    if response.status_code != 200:
                        raise HTTPException(status_code=502, detail={"code": "UPSTREAM_RASTER_FAILED", "status": response.status_code})
                    upstream_type = response.headers.get("content-type", "").lower()
                    if "json" in upstream_type or upstream_type.startswith("text/"):
                        raise HTTPException(status_code=502, detail={"code": "UPSTREAM_CONTENT_TYPE_INVALID"})
                    declared = int(response.headers.get("content-length", "0") or "0")
                    if declared > MAX_RASTER_BYTES:
                        raise HTTPException(status_code=502, detail={"code": "UPSTREAM_BYTE_BUDGET_EXCEEDED"})
                    async for chunk in response.aiter_bytes(64 * 1024):
                        total += len(chunk)
                        if total > MAX_RASTER_BYTES:
                            raise HTTPException(status_code=502, detail={"code": "UPSTREAM_BYTE_BUDGET_EXCEEDED"})
                        yield chunk
                    if total == 0:
                        raise HTTPException(status_code=502, detail={"code": "UPSTREAM_RASTER_EMPTY"})
            except httpx.HTTPError as exc:
                raise HTTPException(status_code=502, detail={"code": "UPSTREAM_RASTER_UNAVAILABLE"}) from exc

    headers = {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "X-TSM-Source-URI": descriptor["source"]["sourceUri"],
        "X-TSM-CRS": str(manifest.get("horizontalCrs", "EPSG:2966")),
        "X-TSM-Vertical-Datum": str(descriptor["source"].get("verticalDatum") or "UNVERIFIED"),
        "X-TSM-Vertical-Datum-Verified": str(bool(manifest.get("verticalDatumVerified", False))).lower(),
        "X-TSM-AOI": ",".join(str(request_bounds[key]) for key in ("minX", "minY", "maxX", "maxY")),
    }
    return StreamingResponse(stream(), media_type=content_type, headers=headers)

class RasMeta(BaseModel):
    plan_id: str = Field(min_length=1, max_length=256)
    source: str = Field(default="geotiff:unknown", min_length=1, max_length=512)
    content_hash_sha256: str = Field(pattern=r"^[0-9a-fA-F]{64}$")
    authority_class: str = Field(min_length=1, max_length=128)
    derivation_class: str = Field(default="HEC_RAS_DEPTH_DOWNSAMPLE", min_length=1, max_length=128)
    model_note: str | None = Field(default=None, max_length=1024)
    horizontal_crs_note: str | None = Field(default=None, max_length=1024)

class RasCell(BaseModel):
    id: str = Field(min_length=1, max_length=256)
    x_native: float | None = None
    y_native: float | None = None
    lon: float | None = None
    lat: float | None = None
    depth_ft: float = Field(ge=0)
    wse_ft: float | None = None

class RasResultsRequest(BaseModel):
    meta: RasMeta
    cells: list[RasCell] = Field(min_length=1, max_length=MAX_RAS_CELLS)
    bfe_navd88_ft: float
    lag_navd88_ft: float

@app.post("/api/engineering/ras-results", status_code=201)
def ingest_ras_results(request: RasResultsRequest) -> dict[str, Any]:
    """Validate and persist operator-supplied HEC-RAS model-output evidence."""
    if request.meta.authority_class.strip().upper() not in {"DERIVATION", "MODEL_OUTPUT"}:
        raise HTTPException(
            status_code=422,
            detail={"code": "RAS_AUTHORITY_CLASS_INVALID", "detail": "HEC-RAS results must remain DERIVATION or MODEL_OUTPUT."},
        )
    payload = request.model_dump()
    canonical = canonical_json(payload)
    artifact_hash = request.meta.content_hash_sha256.lower()
    RAS_OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    artifact_id = f"RAS-{uuid.uuid4().hex}"
    artifact = {
        "artifact_id": artifact_id,
        "artifact_type": "engineering_ras_results",
        "source_authority": "HEC-RAS (operator-supplied depth raster)",
        "source_uri": f"internal://tsm/engineering/ras-results/{request.meta.plan_id}",
        "source_identifier": request.meta.plan_id,
        "retrieved_at": utc_now_iso(),
        "horizontal_crs": "EPSG:2966",
        "horizontal_crs_name": "NAD83 / Indiana West (ftUS)",
        "vertical_datum": "NAVD88",
        "content_hash_sha256": artifact_hash,
        "validation_status": "provisional",
        "authority_class": "MODEL_OUTPUT",
        "derivation_class": request.meta.derivation_class,
        "software_version": "tsm-fastapi-ras-ingest@1.0.0",
        "operator_or_service_identity": "ras-results-api",
        "governance_status": "human_review_required",
        "human_review_status": "pending",
        "is_simulation_demo": False,
        "payload": payload,
        "payload_canonical_sha256": sha256_hex(canonical),
        "notes": "Downsampled HEC-RAS depth cells. Model output only; not a regulatory determination.",
    }
    path = _contained_path(RAS_OUTBOX_DIR, f"{artifact_id}.json")
    path.write_text(canonical_json(artifact) + "\n", encoding="utf-8")
    return {
        "ok": True,
        "artifact_id": artifact_id,
        "plan_id": request.meta.plan_id,
        "cells_accepted": len(request.cells),
        "content_hash_sha256": artifact_hash,
        "payload_canonical_sha256": artifact["payload_canonical_sha256"],
        "authority_class": "MODEL_OUTPUT",
        "governance_status": "human_review_required",
    }

class LedgerAuthorization(BaseModel):
    reviewer_identity: str = Field(min_length=1, max_length=256)
    authorization_id: str = Field(min_length=1, max_length=256)
    authorized_at: str = Field(min_length=1, max_length=128)
    reason: str = Field(min_length=1, max_length=2048)

class LedgerAppendRequest(BaseModel):
    artifact_id: str = Field(min_length=1, max_length=256)
    human_authorization: LedgerAuthorization

@app.post("/api/ledger/append", status_code=201)
async def ledger_append(request: LedgerAppendRequest) -> dict[str, Any]:
    """Append a model/evidence artifact to the local audit ledger only after human authorization."""
    reviewer = request.human_authorization.reviewer_identity.strip()
    allowlist = _reviewer_allowlist()
    if not allowlist:
        raise HTTPException(
            status_code=503,
            detail={"code": "LEDGER_REVIEWER_ALLOWLIST_NOT_CONFIGURED", "detail": "TSM_REVIEWER_SUBJECTS must be configured; fail-closed."},
        )
    if reviewer not in allowlist:
        raise HTTPException(status_code=403, detail={"code": "LEDGER_REVIEWER_NOT_AUTHORIZED"})
    artifact_id = _validated_id(request.artifact_id, "artifact_id")
    artifact_path = _contained_path(RAS_OUTBOX_DIR, f"{artifact_id}.json")
    artifact = _read_json_file(artifact_path)
    if artifact.get("governance_status") != "human_review_required":
        raise HTTPException(status_code=409, detail={"code": "ARTIFACT_GOVERNANCE_STATE_INVALID"})
    authorization = request.human_authorization.model_dump()
    ledger_payload = {
        "artifact_id": artifact_id,
        "leaf_hash": sha256_hex(f"TSM_LEAF:{artifact['content_hash_sha256']}"),
        "reviewer_identity": reviewer,
        "authorization_id": authorization["authorization_id"],
        "authorized_at": authorization["authorized_at"],
        "reason": authorization["reason"],
        "recorded_at": utc_now_iso(),
        "status": "human_authorized",
    }
    async with _LEDGER_LOCK:
        state = _read_json_file(LEDGER_FILE) if LEDGER_FILE.exists() else {"entries": []}
        entries = state.get("entries")
        if not isinstance(entries, list):
            raise HTTPException(status_code=503, detail={"code": "LEDGER_STATE_INVALID"})
        if any(entry.get("artifact_id") == artifact_id for entry in entries):
            raise HTTPException(status_code=409, detail={"code": "LEDGER_DUPLICATE_ARTIFACT"})
        if len(entries) >= MAX_LEDGER_ENTRIES:
            raise HTTPException(status_code=507, detail={"code": "LEDGER_RETENTION_LIMIT_REACHED"})
        entries.append(ledger_payload)
        LEDGER_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = LEDGER_FILE.with_suffix(f".{os.getpid()}.tmp")
        temporary.write_text(canonical_json(state) + "\n", encoding="utf-8")
        temporary.replace(LEDGER_FILE)
    return {"ok": True, **ledger_payload, "disclaimer": "Ledger authorization records human authorization only; it is not an agency approval."}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_json(payload: object) -> str:
    """Deterministic JSON used for every hash in this service."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class ArtifactRef(BaseModel):
    name: str = Field(min_length=1)
    sha256: str = Field(min_length=64, max_length=64)


class EvidencePacket(BaseModel):
    case_id: str = Field(min_length=1)
    artifacts: list[ArtifactRef] = Field(min_length=1)

    model_config = {"extra": "allow"}


class EvidencePushRequest(BaseModel):
    packet: EvidencePacket
    packet_sha256: str = Field(min_length=64, max_length=64)


class GaugeReading(BaseModel):
    node_id: str = Field(min_length=1)
    observed_at: str = Field(min_length=1)

    model_config = {"extra": "allow"}


class GaugeIngestRequest(BaseModel):
    source: str = Field(min_length=1)
    readings: list[GaugeReading] = Field(min_length=1)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "tsm-companion-api",
        "version": "1.0.0",
        "disclaimer": DISCLAIMER,
    }


@app.post("/api/evidence/push", status_code=202)
def push_evidence(request: EvidencePushRequest) -> dict:
    """Accept an evidence packet into the local outbox.

    Validates the packet SHA-256 against the canonical (sort_keys) JSON of the
    packet body. 422 fail-closed on any mismatch or schema violation. The
    response is a signed receipt of INTAKE ONLY — it never claims FEMA
    submission, acceptance, or approval.
    """
    canonical = canonical_json(request.packet.model_dump())
    computed = sha256_hex(canonical)
    if computed.lower() != request.packet_sha256.lower():
        raise HTTPException(
            status_code=422,
            detail={
                "code": "PACKET_HASH_MISMATCH",
                "computed_sha256": computed,
                "claimed_sha256": request.packet_sha256,
            },
        )

    for artifact in request.packet.artifacts:
        if not all(c in "0123456789abcdefABCDEF" for c in artifact.sha256):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "ARTIFACT_HASH_NOT_HEX",
                    "artifact": artifact.name,
                },
            )

    OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    case_id = _validated_id(request.packet.case_id, "case_id")
    packet_path = _contained_path(OUTBOX_DIR, f"{case_id}_{computed}.json")
    if not packet_path.exists():
        packet_path.write_text(canonical + "\n", encoding="utf-8")

    receipt_payload = {
        "receipt_id": sha256_hex(canonical + "|receipt"),
        "packet_sha256": computed,
        "case_id": request.packet.case_id,
        "artifact_count": len(request.packet.artifacts),
        "received_at": utc_now_iso(),
        "status": "received_pending_human_review",
        "stored_at": str(packet_path),
    }
    return {
        **receipt_payload,
        "disclaimer": (
            "Intake receipt only. This packet was NOT submitted to FEMA or any "
            "agency. Human review and human submission remain required."
        ),
    }


POSEY_XSOFT_PARCEL_LAYER = "https://services6.arcgis.com/y6TIO0vqbm8Ixd4w/ArcGIS/rest/services/Posey_Parcels_(Public)/FeatureServer/0"
POSEY_XSOFT_PAGE_SIZE = 2000
POSEY_XSOFT_MAX_FEATURES = 50000
USGS_POSEY_WABASH_SITE = "03378500"
USGS_POSEY_GAGE_DATUM_NAVD88_FT = 352.67
USGS_POSEY_GAGE_SITE_ALTITUDE_NAVD88_FT = 352.71
USGS_POSEY_GAGE_DATUM_SOURCE = "USGS SIR 2016-5119, station 03378500 datum conversion"


async def _fetch_posey_xsoft_parcels() -> dict[str, Any]:
    """Fetch a bounded public Posey parcel geometry set from XSoft's ArcGIS layer."""
    params = {
        "where": "1=1",
        "outFields": "StateCombi,Parcel,ParcelID,CALC_ACRES,Section,Township,Range",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    features: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            for offset in range(0, POSEY_XSOFT_MAX_FEATURES, POSEY_XSOFT_PAGE_SIZE):
                page_params = {**params, "resultRecordCount": POSEY_XSOFT_PAGE_SIZE, "resultOffset": offset}
                response = await client.get(f"{POSEY_XSOFT_PARCEL_LAYER}/query", params=page_params)
                response.raise_for_status()
                payload = response.json()
                page = payload.get("features") if payload.get("type") == "FeatureCollection" else None
                if not isinstance(page, list):
                    raise ValueError("invalid GeoJSON FeatureCollection")
                features.extend(page)
                if len(page) < POSEY_XSOFT_PAGE_SIZE:
                    break
                if len(features) >= POSEY_XSOFT_MAX_FEATURES:
                    raise ValueError("parcel feature limit exceeded")
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "POSEY_PARCEL_GEOMETRY_UNAVAILABLE", "source": POSEY_XSOFT_PARCEL_LAYER},
        ) from exc

    for feature in features:
        if feature.get("type") != "Feature" or feature.get("geometry") is None:
            raise HTTPException(status_code=502, detail={"code": "POSEY_PARCEL_FEATURE_INVALID"})
    return {
        "type": "FeatureCollection",
        "features": features,
        "sourceCrs": "EPSG:4326",
        "sourceAuthority": "Posey County XSoft Engage ArcGIS parcel geometry",
        "recordCrossReference": "Posey County WTH GIS",
        "sourceUri": f"{POSEY_XSOFT_PARCEL_LAYER}/query",
        "retrievedAt": utc_now_iso(),
        "humanReviewRequired": True,
    }


@app.get("/api/geospatial/posey/parcels")
async def posey_parcel_geometry() -> dict[str, Any]:
    """Serve verified public Posey parcel geometry with WTH record provenance."""
    return await _fetch_posey_xsoft_parcels()


def _posey_wse_from_gage_height(gage_height_ft: float) -> float:
    if not math.isfinite(gage_height_ft):
        raise ValueError("gage height must be finite")
    return USGS_POSEY_GAGE_DATUM_NAVD88_FT + gage_height_ft


async def _fetch_posey_wse() -> dict[str, Any]:
    """Convert USGS gage height to provisional WSE using the published NAVD88 gage datum."""
    params = {
        "format": "json",
        "sites": USGS_POSEY_WABASH_SITE,
        "parameterCd": "00065",
    }
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=False) as client:
            response = await client.get(SNAPSHOT_IV_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail={"code": "POSEY_WSE_UPSTREAM_UNAVAILABLE"}) from exc

    series = payload.get("value", {}).get("timeSeries", []) or []
    if not series:
        raise HTTPException(status_code=502, detail={"code": "POSEY_WSE_NO_SERIES"})
    latest = None
    for item in series:
        if item.get("variable", {}).get("variableCode", [{}])[0].get("value") != "00065":
            continue
        values = (item.get("values") or [{}])[0].get("value") or []
        if values:
            latest = values[-1]
            break
    if not latest:
        raise HTTPException(status_code=502, detail={"code": "POSEY_WSE_NO_OBSERVATION"})
    try:
        gage_height = float(latest["value"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail={"code": "POSEY_WSE_VALUE_INVALID"}) from exc
    if not math.isfinite(gage_height):
        raise HTTPException(status_code=502, detail={"code": "POSEY_WSE_VALUE_INVALID"})

    wse = _posey_wse_from_gage_height(gage_height)
    observed_at = latest.get("dateTime")
    if not isinstance(observed_at, str) or not observed_at:
        raise HTTPException(status_code=502, detail={"code": "POSEY_WSE_TIMESTAMP_INVALID"})

    provenance_payload = canonical_json({
        "source": SNAPSHOT_IV_URL,
        "site": USGS_POSEY_WABASH_SITE,
        "parameter": "00065",
        "gageDatumFtNavd88": USGS_POSEY_GAGE_DATUM_NAVD88_FT,
        "gageSiteAltitudeFtNavd88": USGS_POSEY_GAGE_SITE_ALTITUDE_NAVD88_FT,
        "gageDatumSource": USGS_POSEY_GAGE_DATUM_SOURCE,
        "gageHeightFt": gage_height,
        "observedAt": observed_at,
    })
    return {
        "quantityId": "WaterSurfaceElevation",
        "adapterStandard": "OpenMI-compatible-envelope",
        "waterSurfaceElevationFtNavd88": wse,
        "gageHeightFt": gage_height,
        "gageDatumFtNavd88": USGS_POSEY_GAGE_DATUM_NAVD88_FT,
        "timestamp": observed_at,
        "sourceProvenanceHash": hashlib.sha256(provenance_payload.encode("utf-8")).hexdigest(),
        "sourceAuthority": "USGS NWIS",
        "sourceSite": USGS_POSEY_WABASH_SITE,
        "parameterCode": "00065",
        "units": "ft",
        "horizontalCrs": "EPSG:4326",
        "verticalDatum": "NAVD88",
        "validationStatus": "VALIDATED_PROVISIONAL",
        "humanReviewRequired": True,
        "provisional": True,
        "sourceUri": f"{SNAPSHOT_IV_URL}?sites={USGS_POSEY_WABASH_SITE}&parameterCd=00065&format=json",
        "fetchedAt": utc_now_iso(),
    }


@app.get("/api/hydrologic/posey/openmi-wse")
async def posey_openmi_wse() -> dict[str, Any]:
    """Expose one current USGS-derived WSE observation as an OpenMI-compatible envelope."""
    return await _fetch_posey_wse()


@app.get("/api/hydrologic/nodes")
def hydrologic_nodes() -> dict:
    """Serve the USACE hydrologic node registry example.

    Read-only. Null numerics mean 'not published by the authority' and must
    never be interpolated or converted downstream.
    """
    if not USACE_EXAMPLE.exists():
        raise HTTPException(
            status_code=503,
            detail={
                "code": "NODE_REGISTRY_UNAVAILABLE",
                "detail": "USACE node registry file not present; treating as unavailable (fail-closed).",
            },
        )
    node = json.loads(USACE_EXAMPLE.read_text(encoding="utf-8"))
    return {
        "nodes": [node],
        "count": 1,
        "source": "USACE hydrologic node schema example (data/schemas/examples/)",
        "disclaimer": (
            "Observations only; confers no regulatory standing. Null fields "
            "mean 'not published by the authority' — never interpolate."
        ),
    }


@app.get("/api/hydrologic/snapshot/stations")
def hydrologic_snapshot_stations() -> dict:
    """Static registry behind the snapshot button. No live data here."""
    return {
        "stations": _snapshot_registry(),
        "count": len(SNAPSHOT_STATIONS),
        "source": "TSM station registry (USGS site numbers); fetch via POST /api/hydrologic/snapshot",
    }


@app.post("/api/hydrologic/snapshot")
async def hydrologic_snapshot() -> dict:
    """Fetch a one-time live snapshot of all registry gauges.

    User-initiated only: this route performs no polling, keeps no schedule,
    and persists nothing. Values are USGS instantaneous observations as of
    the fetch moment, marked provisional. Stations the upstream service does
    not return are reported unavailable — never invented.
    """
    fetched_at = utc_now_iso()
    site_nos = [site_no for site_no, _, _ in SNAPSHOT_STATIONS]
    try:
        payload = await _fetch_usgs_iv(site_nos)
    except Exception as exc:  # network, timeout, bad status, bad JSON
        raise HTTPException(
            status_code=502,
            detail={
                "code": "SNAPSHOT_UNAVAILABLE",
                "detail": (
                    "USGS Water Services could not be reached for a live "
                    "snapshot; no values are fabricated in its place."
                ),
                "fetched_at": fetched_at,
                "error": type(exc).__name__,
            },
        )
    latest = _parse_iv_series(payload)
    stations = []
    for site_no, name, river in SNAPSHOT_STATIONS:
        observations = latest.get(site_no, [])
        stations.append(
            {
                "site_no": site_no,
                "name": name,
                "river": river,
                "provider": "USGS",
                "observations": observations,
                "unavailable": not observations,
            }
        )
    return {
        "fetched_at": fetched_at,
        "trigger": "user-initiated",
        "source": "USGS Water Services nwis/iv (instantaneous values)",
        "provisional": True,
        "stations": stations,
        "count": len(stations),
        "unavailable_count": sum(1 for s in stations if s["unavailable"]),
        "disclaimer": (
            "One-time snapshot taken when the user pressed the button. "
            "All values are provisional USGS observations, not validated "
            "records. This service does not poll, schedule, or store gauge "
            "data."
        ),
    }


@app.post("/api/webhooks/gauge-ingest", status_code=202)
async def gauge_ingest(http_request: Request) -> dict:
    """Accept gauge readings into quarantine.

    Every reading is provenance-hashed and written to the quarantine dir.
    Nothing here is authoritative: human_review_required is always true.

    The request body is streamed with a hard byte cap (413 on exceed) so a
    single webhook call cannot force unbounded disk writes.
    """
    body = bytearray()
    async for chunk in http_request.stream():
        body.extend(chunk)
        if len(body) > MAX_GAUGE_INGEST_BODY_BYTES:
            raise HTTPException(
                status_code=413,
                detail={
                    "code": "PAYLOAD_TOO_LARGE",
                    "detail": (
                        "Request body exceeds "
                        f"{MAX_GAUGE_INGEST_BODY_BYTES} bytes."
                    ),
                },
            )
    try:
        request = GaugeIngestRequest.model_validate_json(bytes(body))
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_PAYLOAD",
                "errors": json.loads(exc.json()),
            },
        )

    QUARANTINE_DIR.mkdir(parents=True, exist_ok=True)
    batch_id = uuid.uuid4().hex
    stored = []
    for reading in request.readings:
        node_id = _validated_id(reading.node_id, "node_id")
        payload = canonical_json(reading.model_dump())
        reading_hash = sha256_hex(payload)
        path = _contained_path(
            QUARANTINE_DIR, f"{batch_id}_{node_id}_{reading_hash[:12]}.json"
        )
        path.write_text(
            canonical_json(
                {
                    "reading": reading.model_dump(),
                    "provenance_sha256": reading_hash,
                    "source": request.source,
                    "received_at": utc_now_iso(),
                    "status": "quarantine_pending_human_review",
                }
            )
            + "\n",
            encoding="utf-8",
        )
        stored.append({"node_id": node_id, "provenance_sha256": reading_hash})

    return {
        "accepted": True,
        "batch_id": batch_id,
        "quarantined": len(stored),
        "readings": stored,
        "human_review_required": True,
        "authority_class": "UNVERIFIED_OBSERVATION",
        "disclaimer": (
            "Quarantined observations only. Not authoritative until authorized "
            "human review. No datum conversion performed."
        ),
    }


# ---------------------------------------------------------------------------
# Data Catalog — wires the 11 GB offline bundle to the API.
# Read-only. Serves GeoJSON and manifests from OFFLINE_DATA_ROOT.
# ---------------------------------------------------------------------------
from backend.app.data_catalog import (
    COUNTIES as _CATALOG_COUNTIES,
    county_detail as _catalog_county_detail,
    find_dataset_file as _catalog_find_file,
    list_counties as _catalog_list_counties,
    offline_root as _catalog_root,
    read_geojson as _catalog_read_geojson,
    regional_datasets as _catalog_regional,
)


@app.get("/api/catalog/counties")
def catalog_counties() -> dict[str, Any]:
    """List the 8 tri-state counties with dataset availability."""
    return {
        "counties": _catalog_list_counties(),
        "offline_root": str(_catalog_root()),
        "disclaimer": DISCLAIMER,
    }


@app.get("/api/catalog/county/{fips}")
def catalog_county(fips: str) -> dict[str, Any]:
    """Detailed file listing for one county."""
    if fips not in _CATALOG_COUNTIES:
        raise HTTPException(status_code=404, detail={"code": "COUNTY_NOT_FOUND"})
    detail = _catalog_county_detail(fips)
    if detail is None:
        raise HTTPException(status_code=503, detail={"code": "COUNTY_DATA_UNAVAILABLE"})
    detail["disclaimer"] = DISCLAIMER
    return detail


@app.get("/api/catalog/regional")
def catalog_regional() -> dict[str, Any]:
    """List regional (multi-county) datasets."""
    return {
        "regional": _catalog_regional(),
        "offline_root": str(_catalog_root()),
        "disclaimer": DISCLAIMER,
    }


@app.get("/api/geospatial/county/{fips}/parcels")
def county_parcels(
    fips: str,
    limit: int = Query(default=0, ge=0, le=5000),
) -> dict[str, Any]:
    """Serve a county's parcel GeoJSON. Use ?limit=N to cap features."""
    if fips not in _CATALOG_COUNTIES:
        raise HTTPException(status_code=404, detail={"code": "COUNTY_NOT_FOUND"})
    path = _catalog_find_file(fips, "parcels")
    if path is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "DATASET_NOT_FOUND", "detail": "No parcel file for this county (see MISSING.md)"},
        )
    try:
        data = _catalog_read_geojson(path, max_features=limit)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail={"code": "DATASET_UNREADABLE"}) from exc
    data["_provenance"] = {
        "source_file": str(path.relative_to(_catalog_root())),
        "authority_class": "OBSERVATION",
        "human_review_required": True,
    }
    return data


@app.get("/api/geospatial/county/{fips}/floodplain")
def county_floodplain(
    fips: str,
    limit: int = Query(default=0, ge=0, le=5000),
) -> dict[str, Any]:
    """Serve a county's flood-zone GeoJSON. Use ?limit=N to cap features."""
    if fips not in _CATALOG_COUNTIES:
        raise HTTPException(status_code=404, detail={"code": "COUNTY_NOT_FOUND"})
    path = _catalog_find_file(fips, "floodplain")
    if path is None:
        raise HTTPException(status_code=404, detail={"code": "DATASET_NOT_FOUND"})
    try:
        data = _catalog_read_geojson(path, max_features=limit)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail={"code": "DATASET_UNREADABLE"}) from exc
    data["_provenance"] = {
        "source_file": str(path.relative_to(_catalog_root())),
        "authority_class": "OBSERVATION",
        "human_review_required": True,
    }
    return data
