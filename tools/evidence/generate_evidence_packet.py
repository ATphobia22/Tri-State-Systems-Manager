#!/usr/bin/env python3
"""Generate a SHA-256-locked regulatory evidence packet.

Builds a deterministic evidence artifact (conforming to the required fields of
``data/schemas/tsm-evidence-artifact-schema-v1.0.0.json``) from site constants:
address, coordinates, FIRM panel, lowest adjacent grade (LAG), and base flood
elevation (BFE). The packet's ``content_hash_sha256`` is computed over the
canonical JSON of the payload, so any later alteration is detectable.

Fail-closed: every required input must be present and sane (coordinate ranges,
finite elevations, non-empty identifiers). Nothing is guessed or defaulted.

The packet is a *draft supporting artifact* (``governance_status`` is always
``human_review_required``, ``validation_status`` is ``provisional``). It is not
a regulatory determination, elevation certificate, or LOMA approval.

Usage:
    python generate_evidence_packet.py --site site.json --out packet.json
    python generate_evidence_packet.py --site site.json --out packet.json \
        --artifact-id ev-bonebank-20260925
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REQUIRED_SITE_FIELDS = (
    "location_address",
    "latitude",
    "longitude",
    "panel_id",
    "calculated_lag_navd88_ft",
    "effective_bfe_navd88_ft",
    "source_authority",
    "source_uri",
    "source_dataset",
    "verifier",
)


def _fail(msg: str) -> ValueError:
    return ValueError(f"fail-closed: {msg}")


def validate_site(site: dict) -> dict:
    """Validate raw site input; raise ValueError on anything missing or insane."""
    if not isinstance(site, dict):
        raise _fail("site input must be a JSON object")
    for field in REQUIRED_SITE_FIELDS:
        if field not in site or site[field] in (None, ""):
            raise _fail(f"missing required site field: {field}")

    lat, lon = site["latitude"], site["longitude"]
    if not isinstance(lat, (int, float)) or not (-90.0 <= lat <= 90.0):
        raise _fail(f"latitude out of range: {lat!r}")
    if not isinstance(lon, (int, float)) or not (-180.0 <= lon <= 180.0):
        raise _fail(f"longitude out of range: {lon!r}")

    for field in ("calculated_lag_navd88_ft", "effective_bfe_navd88_ft"):
        val = site[field]
        if not isinstance(val, (int, float)) or val != val:  # NaN check
            raise _fail(f"{field} must be a finite number, got {val!r}")
        if not (-1500.0 < val < 30000.0):
            raise _fail(f"{field} outside plausible elevation range: {val!r}")

    if not isinstance(site["panel_id"], str) or len(site["panel_id"].strip()) < 4:
        raise _fail(f"panel_id looks invalid: {site['panel_id']!r}")

    return site


def canonical_json(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def build_packet(site: dict, artifact_id: str,
                 retrieved_at: str | None = None) -> dict:
    """Build the evidence packet dict. Deterministic for identical inputs."""
    site = validate_site(site)
    retrieved_at = retrieved_at or datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ")

    payload = {
        "location_address": site["location_address"],
        "coordinates": {"latitude": site["latitude"],
                        "longitude": site["longitude"]},
        "panel_id": site["panel_id"],
        "calculated_lag_navd88_ft": site["calculated_lag_navd88_ft"],
        "effective_bfe_navd88_ft": site["effective_bfe_navd88_ft"],
        "freeboard_ft": round(
            site["calculated_lag_navd88_ft"] - site["effective_bfe_navd88_ft"], 2),
        "source_dataset": site["source_dataset"],
        "verifier": site["verifier"],
    }
    content_hash = hashlib.sha256(canonical_json(payload)).hexdigest()

    return {
        "artifact_id": artifact_id,
        "artifact_type": "regulatory_evidence_packet",
        "source_authority": site["source_authority"],
        "source_uri": site["source_uri"],
        "retrieved_at": retrieved_at,
        "spatial_reference": {"horizontal_crs": "EPSG:4326"},
        "vertical_reference": {"vertical_datum": "NAVD88"},
        "content_hash_sha256": content_hash,
        "parent_artifacts": [],
        "transformation_chain": [
            {"step": "site_constants_validated",
             "detail": "fail-closed validation of coordinates, elevations, panel id"},
            {"step": "payload_canonicalized",
             "detail": "sorted-key compact JSON, SHA-256 over UTF-8 bytes"},
        ],
        "validation_status": "provisional",
        "authority_class": "DERIVED",
        "derivation_class": "DERIVED",
        "governance_status": "human_review_required",
        "payload": payload,
        "notes": ("DRAFT supporting artifact only. Not a regulatory determination, "
                  "elevation certificate, or LOMA approval. Requires licensed "
                  "professional review before any filing."),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate a SHA-256-locked regulatory evidence packet.")
    parser.add_argument("--site", required=True,
                        help="Path to site-constants JSON file.")
    parser.add_argument("--out", required=True,
                        help="Path to write the evidence packet JSON.")
    parser.add_argument("--artifact-id", required=True,
                        help="Unique artifact id for this packet.")
    args = parser.parse_args(argv)

    try:
        site = json.loads(Path(args.site).read_text(encoding="utf-8"))
        packet = build_packet(site, args.artifact_id)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    out_path = Path(args.out)
    out_path.write_text(json.dumps(packet, indent=2) + "\n", encoding="utf-8")
    print(f"evidence packet written: {out_path}")
    print(f"content_hash_sha256: {packet['content_hash_sha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
