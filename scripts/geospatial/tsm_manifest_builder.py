#!/usr/bin/env python3
"""TSM immutable government source snapshot builder (metadata discovery only).

Source bytes are captured without HTML fallback, redirects, or unbounded reads.
SHA-256 of a captured response is NOT an agency-published checksum. Declared
CRS/vertical datums and licensing are not automatically verified.

Default mode is offline planning. Opt into live capture using --mode fetch.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import urlsplit

MAX_BYTES = 8 * 1024 * 1024
ALLOWED_HOSTS = frozenset({
    "api.water.noaa.gov", "tnmaccess.nationalmap.gov",
    "hazards.fema.gov", "gisdata.in.gov",
    "api.waterdata.usgs.gov",
})
ID_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{2,79}$")
HEX_SHA = re.compile(r"^[0-9a-f]{64}$")
SCHEMA = "tsm.immutable-government-snapshot-manifest.v1"


class HarvestError(ValueError):
    pass


def utc_timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_spec(spec: dict):
    if not isinstance(spec, dict):
        raise HarvestError("registry record must be an object")
    for name in ("dataset_id", "agency", "layer_id", "source_url", "resource_kind"):
        if not isinstance(spec.get(name), str) or not spec[name].strip():
            raise HarvestError("missing or empty field: " + name)
    if not ID_PATTERN.fullmatch(spec["dataset_id"]):
        raise HarvestError("unsafe dataset_id")
    if spec["resource_kind"] != "service_metadata_json":
        raise HarvestError("only bounded JSON service metadata may be fetched")
    url = urlsplit(spec["source_url"])
    if url.scheme != "https" or url.hostname not in ALLOWED_HOSTS or url.username or url.password or url.port:
        raise HarvestError("source must use approved official HTTPS host without credentials or port")
    if not url.path or url.fragment:
        raise HarvestError("source URL path required; fragments forbidden")
    if "\r" in spec["source_url"] or "\n" in spec["source_url"]:
        raise HarvestError("invalid source URL")
    epsg = spec.get("declared_epsg")
    if epsg is not None and (type(epsg) is not int or epsg < 100 or epsg > 999999):
        raise HarvestError("declared_epsg must be an integer EPSG code or null")
    expected_hash = spec.get("publisher_sha256")
    if expected_hash is not None and (not isinstance(expected_hash, str) or not HEX_SHA.fullmatch(expected_hash)):
        raise HarvestError("publisher_sha256 must be 64 lowercase hexadecimal digits")
    return spec


def validate_registry(registry: dict):
    if not isinstance(registry, dict) or not isinstance(registry.get("sources"), list):
        raise HarvestError("registry must contain a sources array")
    if not registry["sources"] or len(registry["sources"]) > 100:
        raise HarvestError("registry must contain 1-100 sources")
    seen = set()
    for spec in registry["sources"]:
        validate_spec(spec)
        if spec["dataset_id"] in seen:
            raise HarvestError("duplicate dataset_id")
        seen.add(spec["dataset_id"])
    return registry["sources"]


def inspect_declared_crs(epsg):
    if epsg is None:
        return {"declaredEpsg": None, "declarationValid": False,
                "state": "NOT_DECLARED", "observedEpsg": None}
    try:
        from pyproj import CRS
        crs = CRS.from_epsg(epsg)
    except (ImportError, Exception) as exc:
        return {"declaredEpsg": epsg, "declarationValid": False,
                "state": "DECLARATION_UNRESOLVED",
                "errorType": type(exc).__name__, "observedEpsg": None}
    return {"declaredEpsg": epsg, "declarationValid": True,
            "name": crs.name, "isGeographic": crs.is_geographic,
            "isProjected": crs.is_projected,
            "axisUnits": [axis.unit_name for axis in crs.axis_info],
            "state": "DECLARATION_ONLY", "observedEpsg": None}


def observed_arcgis_epsg(data):
    if not isinstance(data, dict):
        return None
    spatial = data.get("spatialReference")
    if not isinstance(spatial, dict):
        ext = data.get("fullExtent")
        spatial = ext.get("spatialReference") if isinstance(ext, dict) else None
    if not isinstance(spatial, dict):
        return None
    code = spatial.get("latestWkid", spatial.get("wkid"))
    return code if type(code) is int and 100 <= code <= 999999 else None


def prepare_record(spec, timestamp):
    crs = inspect_declared_crs(spec.get("declared_epsg"))
    return {
        "dataset_id": spec["dataset_id"], "agency": spec["agency"],
        "layer_id": spec["layer_id"], "resource_kind": spec["resource_kind"],
        "source_url": spec["source_url"],
        "acquisition_date_declared": spec.get("acquisition_date"),
        "publication_date_declared": spec.get("publication_date"),
        "coverage_declared": spec.get("coverage"),
        "license_declared": spec.get("license"),
        "license_verified": False,
        "horizontal_crs": crs,
        "vertical_datum_declared": spec.get("vertical_datum"),
        "vertical_units_declared": spec.get("vertical_units"),
        "transformation_model_declared": spec.get("transformation_model"),
        "vertical_datum_verified": False,
        "transformation_verified": False,
        "notes": spec.get("notes"),
        "retrieved_at": None, "attempted_at": timestamp,
        "http_status": None, "content_type": None,
        "etag": None, "last_modified": None,
        "sha256": None, "size_bytes": None, "snapshot_file": None,
        "publisher_sha256": spec.get("publisher_sha256"),
        "publisher_hash_verified": False,
        "verification_state": "REGISTERED_NOT_FETCHED",
    }


def harvest_one(spec, record, session, out_dir: Path, max_bytes: int):
    """Capture one bounded JSON response. Never follow redirects or overwrite bytes."""
    response = None
    temporary = None
    try:
        response = session.get(
            spec["source_url"], stream=True, allow_redirects=False,
            timeout=(8, 30),
            headers={"Accept": "application/json",
                     "User-Agent": "TSM-public-source-evidence/1.0"},
        )
        record["http_status"] = int(response.status_code)
        if not 200 <= response.status_code < 300:
            raise HarvestError("source returned non-success HTTP status")
        if getattr(response, "url", spec["source_url"]) != spec["source_url"]:
            raise HarvestError("unexpected response URL")
        content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
        record["content_type"] = content_type
        record["etag"] = response.headers.get("ETag")
        record["last_modified"] = response.headers.get("Last-Modified")
        if content_type not in ("application/json", "application/geo+json", "text/plain"):
            raise HarvestError("response is not JSON metadata")
        declared_size = response.headers.get("Content-Length")
        if declared_size and int(declared_size) > max_bytes:
            raise HarvestError("declared response size exceeds configured bound")
        digest = hashlib.sha256()
        total = 0
        with tempfile.NamedTemporaryFile(mode="wb", prefix=".tsm-source-",
                                         suffix=".part", dir=out_dir, delete=False) as handle:
            temporary = Path(handle.name)
            for block in response.iter_content(chunk_size=65536):
                if not block:
                    continue
                total += len(block)
                if total > max_bytes:
                    raise HarvestError("streamed response exceeds configured bound")
                handle.write(block)
                digest.update(block)
        if not total:
            raise HarvestError("empty response")
        with temporary.open("r", encoding="utf-8") as handle:
            doc = json.load(handle)
        if not isinstance(doc, dict) or "error" in doc:
            raise HarvestError("JSON metadata has an invalid or API-error root")
        sha = digest.hexdigest()
        record["sha256"] = sha
        record["size_bytes"] = total
        # Hash is only locally calculated, not publisher attested.
        state = "SNAPSHOT_CAPTURED_UNVERIFIED"
        expected = spec.get("publisher_sha256")
        if expected is not None and expected != sha:
            state = "PUBLISHER_HASH_MISMATCH"
        elif expected is not None:
            record["publisher_hash_verified"] = True
            state = "PUBLISHER_HASH_MATCHED"
        observed = observed_arcgis_epsg(doc) if "arcgis/rest/services" in spec["source_url"] or "/server/rest/services/" in spec["source_url"] else None
        record["horizontal_crs"]["observedEpsg"] = observed
        if observed is not None and record["horizontal_crs"]["declarationValid"]:
            if observed != spec["declared_epsg"]:
                state = "CRS_CONFLICT"
                record["horizontal_crs"]["state"] = "CONFLICT"
            else:
                record["horizontal_crs"]["state"] = "SOURCE_METADATA_MATCHES_DECLARATION"
        # Record even mismatched metadata: this is negative evidence, never approved data.
        filename = sha + ".json"
        destination = out_dir / filename
        try:
            os.link(temporary, destination)  # exclusive atomic link, no overwrite
        except FileExistsError:
            if sha256_file(destination) != sha:
                raise HarvestError("existing content-addressed snapshot is corrupted")
        record["snapshot_file"] = filename
        record["retrieved_at"] = utc_timestamp()
        record["verification_state"] = state
    except (OSError, ValueError, TypeError, UnicodeError) as exc:
        if record["verification_state"] == "REGISTERED_NOT_FETCHED":
            record["verification_state"] = "SOURCE_UNAVAILABLE_OR_INVALID"
        record["failure_type"] = type(exc).__name__
        record["failure_reason"] = str(exc)[:200]
    except Exception as exc:
        # requests raises RequestException; bound the negative evidence.
        record["verification_state"] = "SOURCE_UNAVAILABLE_OR_INVALID"
        record["failure_type"] = type(exc).__name__
        record["failure_reason"] = str(exc)[:200]
    finally:
        if response is not None:
            response.close()
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return record


def build_manifest(registry, out_dir: Path, mode="plan", *, session=None,
                   max_bytes=MAX_BYTES, timestamp=None, previous_manifest=None):
    specs = validate_registry(registry)
    if mode not in ("plan", "fetch"):
        raise HarvestError("mode must be plan or fetch")
    if type(max_bytes) is not int or not 1 <= max_bytes <= 256 * 1024 * 1024:
        raise HarvestError("max_bytes must be 1..268435456")
    timestamp = timestamp or utc_timestamp()
    if mode == "fetch":
        out_dir.mkdir(parents=True, exist_ok=True)
        if out_dir.is_symlink():
            raise HarvestError("snapshot directory cannot be a symlink")
    records = []
    if mode == "fetch" and session is None:
        import requests
        session = requests.Session()
        session.trust_env = False
    for spec in specs:
        rec = prepare_record(spec, timestamp)
        if mode == "fetch":
            rec = harvest_one(spec, rec, session, out_dir, max_bytes)
        records.append(rec)
    counts = {}
    for rec in records:
        status = rec["verification_state"]
        counts[status] = counts.get(status, 0) + 1
    payload = {
        "schema": SCHEMA, "project": "Tri-State Systems Manager",
        "generated_at": timestamp, "mode": mode,
        "source_registry_version": registry.get("registry_version"),
        "geographic_scope": "Ohio-Wabash confluence IN/IL/KY (source coverage unverified)",
        "previous_manifest_file_sha256": sha256_file(previous_manifest) if previous_manifest else None,
        "total_datasets": len(records), "status_counts": counts,
        "sources": records, "engineeringUse": False, "regulatoryDetermination": False,
        "provenance_policy": "Source-response SHA-256 is not independent publisher attestation. Spatial and vertical metadata require per-product verification.",
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"),
                           ensure_ascii=True, allow_nan=False).encode("utf-8")
    payload["manifest_payload_sha256"] = hashlib.sha256(canonical).hexdigest()
    payload["canonicalization"] = "python-json-sorted-keys-utf8-v1 (not RFC8785)"
    return payload


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--snapshot-dir", type=Path)
    parser.add_argument("--mode", choices=("plan", "fetch"), default="plan")
    parser.add_argument("--max-bytes", type=int, default=MAX_BYTES)
    parser.add_argument("--previous-manifest", type=Path)
    args = parser.parse_args(argv)
    try:
        registry = json.loads(args.registry.read_text(encoding="utf-8"))
        snapshot_dir = args.snapshot_dir or args.out.parent / "source-snapshots"
        if args.out.is_symlink() or args.out.exists():
            raise HarvestError("manifest output already exists; never overwrite")
        manifest = build_manifest(
            registry, snapshot_dir, mode=args.mode,
            max_bytes=args.max_bytes, previous_manifest=args.previous_manifest)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with args.out.open("x", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2, sort_keys=True, allow_nan=False)
            handle.write("\n")
    except (HarvestError, OSError, ValueError, TypeError) as exc:
        parser.exit(2, "TSM source manifest rejected: " + str(exc) + "\n")
    print(json.dumps({"manifest": str(args.out), "mode": args.mode,
                      "status_counts": manifest["status_counts"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
