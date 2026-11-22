"""Headless, deterministic, source-receipted offline observation data exchange.

This is not a calibrated model, public publication approval or Unreal executable.
All inputs are saved local files; no Kafka, network, localhost or WebView.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

from .contracts import canonical, validate
from .import_usgs import MAX_SOURCE_BYTES, STATIONS, event_rows, read_bounded

SCHEMA = "tsm.offline-observation-bundle.v1"
MAX_EVENTS_BYTES = 16 * 1024 * 1024


def _hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _read(path: Path, maximum: int) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise ValueError("Bundle evidence must be a regular local file")
    with path.open("rb") as reader:
        data = reader.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError("Offline evidence exceeds size limit")
    return data


def build_bundle(source: Path, destination: Path) -> dict:
    """Fail before writing on invalid source; publish via atomic directory move."""
    if destination.exists() or destination.is_symlink():
        raise ValueError("Destination must be new; no offline evidence overwrite")
    if not destination.parent.is_dir() or destination.parent.is_symlink():
        raise ValueError("Destination parent must be an existing local directory")
    events = event_rows(source)
    for event in events:
        validate(event)
        if event["matrix"] != "O" or event["timeline"] != "observed" or event["branch"] != "main":
            raise ValueError("Offline handoff is source observations only")
    raw_manifest = read_bounded(source / "manifest.json")
    capture = json.loads(raw_manifest)
    event_bytes = "".join(canonical(event) + "\n" for event in events).encode("utf-8")
    if len(event_bytes) > MAX_EVENTS_BYTES:
        raise ValueError("Event handoff exceeds 16 MiB bound")
    files = {}
    states = {}
    with tempfile.TemporaryDirectory(dir=destination.parent, prefix=".tsm-offline-stage-") as temporary:
        staging = Path(temporary) / "bundle"
        (staging / "source").mkdir(parents=True)
        for name, data in (("events.ndjson", event_bytes), ("source/manifest.json", raw_manifest)):
            (staging / name).write_bytes(data)
            files[name] = {"sha256": _hash(data), "size": len(data)}
        for station in STATIONS:
            entry = capture["stations"].get(station)
            if entry is None:
                continue
            states[f"USGS-{station}"] = {"status": entry["status"],
                                          "sourceSha256": entry.get("rawSha256")}
            if entry["status"] == "CAPTURED":
                raw = read_bounded(source / f"{station}.geojson")
                name = f"source/{station}.geojson"
                (staging / name).write_bytes(raw)
                files[name] = {"sha256": _hash(raw), "size": len(raw)}
        receipt = {
            "schema": SCHEMA, "version": 1,
            "sourceAuthority": "USGS", "sourceStates": states,
            "capturedAt": capture["finishedAt"], "eventCount": len(events),
            "matrix": "O", "timeline": "observed",
            "stageDatum": "USGS_STATION_GAGE_DATUM_UNCONVERTED",
            "navd88WseIncluded": False, "hydraulicSimulationIncluded": False,
            "sourceCompleteness": "LOCAL_CAPTURE_PREFLIGHT_VERIFIED",
            "publicPublication": "REVIEW_REQUIRED",
            "runtime": "FILES_ONLY_NO_SERVER", "files": files,
        }
        (staging / "bundle.json").write_bytes((canonical(receipt) + "\n").encode("utf-8"))
        verify_bundle(staging)
        os.rename(staging, destination)
    return receipt


def verify_bundle(directory: Path) -> dict:
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError("Expected local offline bundle directory")
    metadata = json.loads(_read(directory / "bundle.json", MAX_SOURCE_BYTES))
    if metadata.get("schema") != SCHEMA or metadata.get("version") != 1:
        raise ValueError("Unsupported offline bundle schema")
    records = metadata.get("files")
    needed = {"events.ndjson", "source/manifest.json"}
    permitted = needed | {f"source/{station}.geojson" for station in STATIONS}
    if not isinstance(records, dict) or not needed <= set(records) or not set(records) <= permitted:
        raise ValueError("Invalid offline evidence file inventory")
    present = {str(path.relative_to(directory)) for path in directory.rglob("*") if path.is_file()}
    if present != set(records) | {"bundle.json"}:
        raise ValueError("Unreceipted or missing offline bundle file")
    for name, receipt in records.items():
        data = _read(directory / name, MAX_EVENTS_BYTES if name == "events.ndjson" else MAX_SOURCE_BYTES)
        if not isinstance(receipt, dict) or receipt.get("sha256") != _hash(data) or receipt.get("size") != len(data):
            raise ValueError("Offline evidence SHA-256 or byte size mismatch")
    regenerated = event_rows(directory / "source")
    expected = "".join(canonical(event) + "\n" for event in regenerated).encode("utf-8")
    if (expected != _read(directory / "events.ndjson", MAX_EVENTS_BYTES) or
            metadata.get("eventCount") != len(regenerated)):
        raise ValueError("Offline replay differs from verified original source capture")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build")
    build.add_argument("source", type=Path)
    build.add_argument("destination", type=Path)
    check = commands.add_parser("verify")
    check.add_argument("directory", type=Path)
    args = parser.parse_args()
    data = (build_bundle(args.source, args.destination) if args.command == "build"
            else verify_bundle(args.directory))
    print(json.dumps({"schema": data["schema"], "count": data["eventCount"],
                      "status": "VERIFIED_LOCAL_HANDOFF"}, sort_keys=True))


if __name__ == "__main__":
    main()
