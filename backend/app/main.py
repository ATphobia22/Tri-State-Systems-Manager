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
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

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

app = FastAPI(
    title="TSM Companion API",
    version="1.0.0",
    description=DISCLAIMER,
)


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
    packet_path = OUTBOX_DIR / f"{request.packet.case_id}_{computed}.json"
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


@app.post("/api/webhooks/gauge-ingest", status_code=202)
def gauge_ingest(request: GaugeIngestRequest) -> dict:
    """Accept gauge readings into quarantine.

    Every reading is provenance-hashed and written to the quarantine dir.
    Nothing here is authoritative: human_review_required is always true.
    """
    QUARANTINE_DIR.mkdir(parents=True, exist_ok=True)
    batch_id = uuid.uuid4().hex
    stored = []
    for reading in request.readings:
        payload = canonical_json(reading.model_dump())
        reading_hash = sha256_hex(payload)
        path = QUARANTINE_DIR / f"{batch_id}_{reading.node_id}_{reading_hash[:12]}.json"
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
        stored.append({"node_id": reading.node_id, "provenance_sha256": reading_hash})

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
