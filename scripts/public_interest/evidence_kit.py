#!/usr/bin/env python3
"""Offline public-evidence audits, time-machine diffs and parcel evidence passports.

NO NETWORK. No shapefile inference, hydrologic computation, survey certification,
flood determination or automatic assertion of source authority is performed.
Input snapshots must contain actual local bytes for any BYTES_VERIFIED record.

Examples:
  python scripts/public_interest/evidence_kit.py audit snapshot/ --registry data/acquisitions/tsm-authoritative-source-manifest-v1.json
  python scripts/public_interest/evidence_kit.py compare older/ newer/ --out history.json --html history.html
  python scripts/public_interest/evidence_kit.py passport snapshot/ parcel.json --out passport.json --html passport.html
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from hashlib import sha256
from html import escape
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
from urllib.parse import parse_qsl, urlsplit

SCHEMA = "tsm.public-evidence.snapshot.v1"
PASSPORT_SCHEMA = "tsm.public-evidence.passport.v1"
DIFF_SCHEMA = "tsm.public-evidence.timeline.v1"
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_ARTIFACT_BYTES = 2 * 1024 * 1024 * 1024
MAX_SOURCES = 4096
MAX_FACTS = 500
IDENTIFIER = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
SHA = re.compile(r"^[0-9a-f]{64}$")
CRS = re.compile(r"^EPSG:[1-9][0-9]{2,5}$")
STATES = {"BYTES_VERIFIED", "SOURCE_UNAVAILABLE", "NOT_EVIDENCED"}
ROLES = {"OBSERVATION", "FORECAST", "REGULATORY_SOURCE", "STATE_PLANNING",
         "MODELED", "DERIVED", "REFERENCE", "OWNER_SUPPLIED"}
SENSITIVE_URL_KEYS = {"token", "access_token", "api_key", "apikey", "password", "secret"}


class EvidenceError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise EvidenceError(message)


def _unique_pairs(pairs):
    obj = {}
    for key, value in pairs:
        require(key not in obj, "Duplicate JSON property: " + key)
        obj[key] = value
    return obj


def _read_json(path: Path) -> dict:
    require(not path.is_symlink(), "Symlink JSON input is not allowed")
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        info = os.fstat(descriptor)
        require(stat.S_ISREG(info.st_mode), "JSON input must be a regular file")
        require(0 < info.st_size <= MAX_JSON_BYTES, "JSON exceeds bounded size")
        with os.fdopen(descriptor, "rb", closefd=False) as stream:
            data = stream.read(MAX_JSON_BYTES + 1)
        require(len(data) <= MAX_JSON_BYTES, "JSON grew during reading")
    finally:
        os.close(descriptor)
    try:
        parsed = json.loads(data.decode("utf-8"), object_pairs_hook=_unique_pairs,
                            parse_constant=lambda x: (_ for _ in ()).throw(EvidenceError("Nonfinite JSON value")))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise EvidenceError("Invalid UTF-8 JSON") from exc
    require(isinstance(parsed, dict), "JSON root must be an object")
    return parsed


def timestamp(value, field: str) -> datetime:
    require(isinstance(value, str) and len(value) <= 64, "Missing or invalid " + field)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise EvidenceError("Invalid ISO-8601 timestamp: " + field) from exc
    require(parsed.tzinfo is not None and parsed.utcoffset() is not None,
            "Timestamp must include time-zone offset: " + field)
    return parsed.astimezone(timezone.utc)


def _text(value, field, nullable=False, max_length=256):
    if value is None and nullable:
        return None
    require(isinstance(value, str) and 0 < len(value.strip()) <= max_length,
            "Invalid or missing " + field)
    return value.strip()


def _source_url(value: str) -> str:
    raw = _text(value, "sourceUrl", max_length=2048)
    parsed = urlsplit(raw)
    require(parsed.scheme == "https" and parsed.hostname and not parsed.username
            and not parsed.password, "Source URL requires public HTTPS")
    require(parsed.port in (None, 443), "Nonstandard source port is not allowed")
    require(all(k.casefold() not in SENSITIVE_URL_KEYS for k, _ in parse_qsl(parsed.query)),
            "Source URL includes a potentially sensitive credential parameter")
    return raw


def _safe_asset(root: Path, relative: str) -> Path:
    require(isinstance(relative, str) and relative and len(relative) <= 512
            and "\\" not in relative and "\x00" not in relative and ":" not in relative,
            "Unsafe snapshot asset path")
    parts = PurePosixPath(relative).parts
    require(parts and not PurePosixPath(relative).is_absolute()
            and all(part not in (".", "..", "") for part in parts),
            "Snapshot asset path escapes its directory")
    require(not any(re.fullmatch(r"(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?", p)
                    or p[-1] in (".", " ") for p in parts), "Windows-unsafe asset path")
    current = root
    for part in parts:
        current = current / part
        require(not current.is_symlink(), "Snapshot asset contains a symlink")
    require(current.resolve().is_relative_to(root.resolve()), "Asset escapes snapshot directory")
    return current


def _hash_asset(path: Path) -> tuple[str, int]:
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        before = os.fstat(descriptor)
        require(stat.S_ISREG(before.st_mode) and 0 < before.st_size <= MAX_ARTIFACT_BYTES,
                "Asset must be a bounded regular nonempty file")
        digest = sha256()
        count = 0
        while chunk := os.read(descriptor, 1024 * 1024):
            count += len(chunk)
            require(count <= MAX_ARTIFACT_BYTES, "Asset size bound exceeded")
            digest.update(chunk)
        after = os.fstat(descriptor)
        require(count == before.st_size == after.st_size
                and before.st_mtime_ns == after.st_mtime_ns, "Asset changed while hashing")
        return digest.hexdigest(), count
    finally:
        os.close(descriptor)


def _registry_sources(path: Path | None) -> dict | None:
    if path is None:
        return None
    entries = _read_json(path).get("sources")
    require(isinstance(entries, list), "Registry requires a sources array")
    known = {}
    for item in entries:
        require(isinstance(item, dict), "Invalid registry source record")
        key = _text(item.get("id"), "registry source id")
        require(key not in known, "Duplicate registry source id")
        known[key] = item
    return known


def audit_snapshot(directory: Path, registry: Path | None = None) -> dict:
    require(directory.is_dir() and not directory.is_symlink(),
            "Snapshot root must be a real directory")
    manifest = _read_json(directory / "snapshot.json")
    require(manifest.get("schema") == SCHEMA, "Unknown snapshot schema")
    snapshot_id = _text(manifest.get("snapshotId"), "snapshotId")
    require(bool(IDENTIFIER.fullmatch(snapshot_id)), "Unsafe snapshotId")
    captured_at = timestamp(manifest.get("capturedAt"), "capturedAt")
    rows = manifest.get("sources")
    require(isinstance(rows, list) and len(rows) <= MAX_SOURCES, "Invalid source count")
    known = _registry_sources(registry)
    verified = []
    seen_ids = set()
    seen_paths = set()
    for row in rows:
        require(isinstance(row, dict), "Invalid source record")
        source_id = _text(row.get("sourceId"), "sourceId")
        require(bool(IDENTIFIER.fullmatch(source_id)) and source_id not in seen_ids,
                "Invalid or duplicate sourceId")
        seen_ids.add(source_id)
        if known is not None:
            require(source_id in known, "Source absent from authoritative source registry: " + source_id)
        url = _source_url(row.get("sourceUrl"))
        if known is not None:
            require(urlsplit(url)._replace(query="", fragment="") ==
                    urlsplit(known[source_id]["url"])._replace(query="", fragment=""),
                    "Source URL does not match registry: " + source_id)
        state = row.get("status")
        require(state in STATES, "Invalid source availability state")
        role = row.get("dataRole")
        require(role in ROLES, "Invalid dataRole")
        crs = _text(row.get("horizontalCrs"), "horizontalCrs", nullable=True)
        require(crs is None or bool(CRS.fullmatch(crs)), "Unsupported horizontal CRS label")
        vertical = _text(row.get("verticalDatum"), "verticalDatum", nullable=True)
        units = _text(row.get("units"), "units", nullable=True)
        retrieved = row.get("retrievedAt")
        if retrieved is not None:
            require(timestamp(retrieved, "retrievedAt") <= captured_at,
                    "Retrieval time after snapshot capture")
        if state == "BYTES_VERIFIED":
            relative = _text(row.get("assetPath"), "assetPath")
            key = relative.casefold()
            require(key not in seen_paths, "Case-colliding or duplicate asset path")
            seen_paths.add(key)
            expected = row.get("sha256")
            require(isinstance(expected, str) and SHA.fullmatch(expected) is not None,
                    "Missing lowercase SHA-256 for local asset")
            require(retrieved is not None, "Verified asset must declare retrieval time")
            asset = _safe_asset(directory, relative)
            actual, size = _hash_asset(asset)
            require(actual == expected, "SHA-256 mismatch for source " + source_id)
        else:
            require(row.get("assetPath") is None and row.get("sha256") is None,
                    "Unavailable or unevidenced sources cannot reference local bytes")
            size = None
        verified.append({
            "sourceId": source_id,
            "sourceUrl": url,
            "agency": _text(row.get("agency"), "agency"),
            "dataRole": role,
            "status": state,
            "sha256": row.get("sha256"),
            "bytes": size,
            "horizontalCrs": crs,
            "verticalDatum": vertical,
            "units": units,
            "retrievedAt": retrieved,
            "acquisitionDate": row.get("acquisitionDate"),
            "publicationDate": row.get("publicationDate"),
            "serviceLayerId": row.get("serviceLayerId"),
            "license": row.get("license"),
            "sourceMetadataVerified": False,
            "verticalDatumVerified": False,
            "scientificInterpretationVerified": False,
        })
    return {
        "schema": SCHEMA,
        "snapshotId": snapshot_id,
        "capturedAt": captured_at.isoformat().replace("+00:00", "Z"),
        "integrityStatus": "LOCAL_BYTES_CHECKED",
        "verifiedByteSourceCount": sum(x["status"] == "BYTES_VERIFIED" for x in verified),
        "sourceCount": len(verified),
        "sources": verified,
        "regulatoryDetermination": False,
    }


def timeline(before: dict, after: dict) -> dict:
    require(before.get("schema") == after.get("schema") == SCHEMA,
            "Snapshots must share the supported schema")
    require(timestamp(before["capturedAt"], "before") <= timestamp(after["capturedAt"], "after"),
            "Snapshot timeline must be chronological")
    old = {s["sourceId"]: s for s in before["sources"]}
    new = {s["sourceId"]: s for s in after["sources"]}
    changes = []
    evidence_fields = ("sha256", "status", "horizontalCrs", "verticalDatum", "units",
                       "sourceUrl", "retrievedAt", "acquisitionDate", "publicationDate",
                       "serviceLayerId", "license")
    for key in sorted(old.keys() | new.keys()):
        earlier, later = old.get(key), new.get(key)
        if earlier is None or later is None:
            changes.append({"sourceId": key, "change": "ADDED" if earlier is None else "REMOVED",
                            "fields": ["presence"]})
            continue
        changed = [name for name in evidence_fields if earlier.get(name) != later.get(name)]
        if changed:
            changes.append({"sourceId": key, "change": "REVISED", "fields": changed,
                            "beforeHash": earlier.get("sha256"), "afterHash": later.get("sha256")})
    return {
        "schema": DIFF_SCHEMA,
        "fromSnapshotId": before["snapshotId"],
        "toSnapshotId": after["snapshotId"],
        "fromCapturedAt": before["capturedAt"],
        "toCapturedAt": after["capturedAt"],
        "changes": changes,
        "changeCount": len(changes),
        "engineeringUse": False,
        "regulatoryUse": False,
        "interpretation": "Changes in source bytes or metadata are not proof of changed physical conditions.",
    }


def _fact_status(fact: dict, source: dict | None, as_of: datetime) -> tuple[str, list[str]]:
    if source is None or fact.get("sourceSha256") != source.get("sha256"):
        return "EVIDENCE_UNLINKED", ["Source identity or hash does not match the audited snapshot"]
    if source["status"] != "BYTES_VERIFIED":
        return "SOURCE_UNAVAILABLE", ["Local source bytes were not verified"]
    if fact.get("value") is None:
        return "VALUE_UNAVAILABLE", ["No value supplied; absence is not zero"]
    kind = fact["dataRole"]
    if kind != source["dataRole"]:
        return "ROLE_MISMATCH", ["Fact's source role differs from snapshot metadata"]
    if fact.get("requiresVerticalDatum", False) and (
        not fact.get("verticalDatum") or not source.get("verticalDatum")
        or fact["verticalDatum"] != source["verticalDatum"]
    ):
        return "UNRESOLVED_DATUM", ["Vertical reference is unknown or does not match the source"]
    if kind == "MODELED":
        return "MODELED_UNCALIBRATED", ["Model calibration and input validity have not been reviewed"]
    if kind == "FORECAST":
        return "FORECAST_NOT_OBSERVED", ["Forecast is not an observed condition"]
    if kind == "OBSERVATION":
        observed = fact.get("observedAt")
        if observed is None:
            return "OBSERVATION_TIME_UNKNOWN", ["Observation time was not supplied"]
        if timestamp(observed, "observedAt") > as_of:
            return "FUTURE_OBSERVATION", ["Observation timestamp is after report time"]
        days = (as_of - timestamp(observed, "observedAt")).total_seconds() / 86400
        if days > 7:
            return "STALE_OBSERVATION", ["Observation is older than seven days; not live"]
    return "VALUE_UNREVIEWED", [
        "Source bytes passed hashing; the supplied value, coverage, accuracy and parcel linkage are not independently certified"
    ]


def passport(audited: dict, parcel_input: dict, as_of: str) -> dict:
    now = timestamp(as_of, "asOf")
    require(isinstance(parcel_input, dict), "Parcel input must be an object")
    require(parcel_input.get("schema") == "tsm.public-evidence.parcel-input.v1",
            "Unsupported parcel input schema")
    parcel_id = _text(parcel_input.get("parcelId"), "parcelId", max_length=128)
    county = _text(parcel_input.get("countyFips"), "countyFips")
    require(bool(re.fullmatch(r"[0-9]{5}", county)), "Expected five-digit county FIPS")
    facts = parcel_input.get("facts")
    require(isinstance(facts, list) and len(facts) <= MAX_FACTS, "Invalid fact count")
    sources = {entry["sourceId"]: entry for entry in audited["sources"]}
    result = []
    for f in facts:
        require(isinstance(f, dict), "Invalid fact")
        source_id = _text(f.get("sourceId"), "fact.sourceId")
        require(f.get("dataRole") in ROLES, "Invalid fact data role")
        label = _text(f.get("label"), "fact label", max_length=120)
        value = f.get("value")
        require(value is None or isinstance(value, (str, int, float)) and
                not isinstance(value, bool) and
                (not isinstance(value, float) or math.isfinite(value)),
                "Fact value must be finite number, text, or unavailable")
        if isinstance(value, str):
            require(len(value) <= 200, "Fact text too long")
        require(f.get("requiresVerticalDatum", False) in (True, False),
                "Vertical reference flag must be boolean")
        status, reasons = _fact_status(f, sources.get(source_id), now)
        result.append({
            "label": label,
            "value": value,
            "units": _text(f.get("units"), "fact units", nullable=True),
            "verticalDatum": _text(f.get("verticalDatum"), "fact vertical datum", nullable=True),
            "dataRole": f["dataRole"],
            "sourceId": source_id,
            "sourceSha256": f.get("sourceSha256"),
            "observedAt": f.get("observedAt"),
            "evidenceState": status,
            "reasons": reasons,
            "controlPointVerified": False,
            "valueIndependentlyValidated": False,
        })
    body = {
        "schema": PASSPORT_SCHEMA,
        "parcelId": parcel_id,
        "countyFips": county,
        "asOf": now.isoformat().replace("+00:00", "Z"),
        "snapshotId": audited["snapshotId"],
        "facts": result,
        "evidenceStateCounts": {status: sum(f["evidenceState"] == status for f in result)
                                for status in sorted({f["evidenceState"] for f in result})},
        "engineeringUse": False,
        "regulatoryDetermination": False,
        "surveyCertification": False,
        "sourceBytesVerifiedNotSourceClaims": True,
        "notice": ("Public informational source-evidence passport only. No flood determination, "
                   "survey, design certification, evacuation direction or agency approval."),
    }
    body["integritySha256"] = sha256(json.dumps(body, sort_keys=True, separators=(",", ":"),
                                                ensure_ascii=True, allow_nan=False).encode()).hexdigest()
    return body


def render_html(report: dict) -> str:
    """Entirely static, offline and escaped HTML; no scripts, fonts, remote styles or images."""
    name = "Evidence Time Machine" if report.get("schema") == DIFF_SCHEMA else "Community Evidence Passport"
    if report.get("schema") == DIFF_SCHEMA:
        rows = [
            f"<tr><th scope='row'>{escape(c['sourceId'])}</th><td>{escape(c['change'])}</td>"
            f"<td>{escape(', '.join(c['fields']))}</td></tr>" for c in report["changes"]
        ]
        heading = f"{escape(report['fromSnapshotId'])} → {escape(report['toSnapshotId'])}"
        note = report["interpretation"]
        columns = "<tr><th>Source</th><th>Change</th><th>Changed fields</th></tr>"
    elif report.get("schema") == PASSPORT_SCHEMA:
        rows = [
            f"<tr><th scope='row'>{escape(f['label'])}</th>"
            f"<td>{escape(str(f['value']) if f['value'] is not None else 'Unavailable')}</td>"
            f"<td>{escape(f['evidenceState'])}</td><td>{escape(f['sourceId'])}</td></tr>"
            for f in report["facts"]
        ]
        heading = f"Parcel {escape(report['parcelId'])} · FIPS {escape(report['countyFips'])}"
        note = report["notice"]
        columns = "<tr><th>Evidence item</th><th>Value</th><th>State</th><th>Source</th></tr>"
    else:
        raise EvidenceError("Unknown report schema for HTML")
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; style-src 'unsafe-inline'\">"
        f"<title>{escape(name)} · TSM</title>"
        "<style>body{font:16px system-ui,sans-serif;margin:2rem auto;padding:0 1rem;max-width:72rem;"
        "background:#101926;color:#f5f7fb;line-height:1.5}"
        "h1{font-size:1.8rem}table{border-collapse:collapse;width:100%;overflow-wrap:anywhere}"
        "td,th{padding:.85rem;border-bottom:1px solid #607080;text-align:left;vertical-align:top}"
        "th{font-weight:650}caption{text-align:left;margin:.8rem 0}a{color:#b4daff}"
        ".notice{border:1px solid #a4b3c7;border-radius:.5rem;padding:1rem;margin:1rem 0}"
        "</style></head><body><main>"
        f"<h1>{escape(name)}</h1><h2>{heading}</h2>"
        f"<p class='notice'>{escape(note)}</p>"
        "<div role='region' aria-label='Evidence table' tabindex='0' style='overflow:auto'>"
        f"<table><thead>{columns}</thead><tbody>{''.join(rows)}</tbody></table></div>"
        "<p>Integrity hashes verify bytes only. Unknowns remain unknown. "
        "No credential, account, application server or external resource is required.</p>"
        "</main></body></html>\n"
    )


def _write_new(output: Path, content: str) -> None:
    require(output.parent.is_dir() and not output.parent.is_symlink(),
            "Output parent must already exist and be a real directory")
    with output.open("x", encoding="utf-8") as target:
        target.write(content)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    audit = sub.add_parser("audit")
    audit.add_argument("snapshot", type=Path)
    audit.add_argument("--registry", type=Path)
    compare = sub.add_parser("compare")
    compare.add_argument("before", type=Path)
    compare.add_argument("after", type=Path)
    compare.add_argument("--out", type=Path, required=True)
    compare.add_argument("--html", type=Path)
    report = sub.add_parser("passport")
    report.add_argument("snapshot", type=Path)
    report.add_argument("parcel", type=Path)
    report.add_argument("--as-of", required=True)
    report.add_argument("--out", type=Path, required=True)
    report.add_argument("--html", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "audit":
            output = audit_snapshot(args.snapshot, args.registry)
            print(json.dumps({key: output[key] for key in (
                "snapshotId", "sourceCount", "verifiedByteSourceCount", "integrityStatus"
            )}, sort_keys=True))
        elif args.command == "compare":
            output = timeline(audit_snapshot(args.before), audit_snapshot(args.after))
            require(not args.html or args.html != args.out, "HTML output must differ from JSON output")
            _write_new(args.out, json.dumps(output, indent=2, sort_keys=True) + "\n")
            if args.html:
                _write_new(args.html, render_html(output))
            print(json.dumps({"status": "INFORMATIONAL", "changeCount": output["changeCount"]}))
        else:
            output = passport(audit_snapshot(args.snapshot), _read_json(args.parcel), args.as_of)
            require(not args.html or args.html != args.out, "HTML output must differ from JSON output")
            _write_new(args.out, json.dumps(output, indent=2, sort_keys=True) + "\n")
            if args.html:
                _write_new(args.html, render_html(output))
            print(json.dumps({"status": "INFORMATIONAL", "factCount": len(output["facts"])}))
    except (EvidenceError, OSError, ValueError) as exc:
        print("Public evidence operation rejected: " + str(exc), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
