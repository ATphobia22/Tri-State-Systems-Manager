"""Build a bounded, hash-receipted, direct-file gauge view for UE5.8.

Headless staging only. A local checksum is not a signature or USGS authentication.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

from .contracts import canonical
from .offline_view import verified_view

SCHEMA = "tsm.offline-gauge-export.v1"
VIEW_NAME = "gauge-view.json"
RECEIPT_NAME = "gauge-view.receipt.json"
MAX_VIEW_BYTES = 1024 * 1024


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def export(bundle: Path, target: Path, *, as_of: str | None = None,
           stale_after_seconds: int = 3600) -> dict:
    """New-directory atomic handoff; validates the full USGS capture before staging."""
    if target.exists() or target.is_symlink():
        raise ValueError("Native export target must be a new directory")
    if not target.parent.is_dir() or target.parent.is_symlink():
        raise ValueError("Native export parent must exist and be a regular directory")
    # The scene reader must never confuse a recorded capture with current telemetry.
    view = verified_view(bundle, as_of=as_of, stale_after_seconds=stale_after_seconds)
    raw = (canonical(view) + "\n").encode("utf-8")
    if len(raw) > MAX_VIEW_BYTES:
        raise ValueError("Native gauge view exceeds 1 MiB limit")
    receipt = {
        "schema": SCHEMA, "version": 1, "runtime": "FILES_ONLY_NO_SERVER",
        "sourceAuthority": "USGS", "sourceBundleSchema": "tsm.offline-observation-bundle.v1",
        "sourceBundleSha256": _sha((bundle / "bundle.json").read_bytes()),
        "viewFile": VIEW_NAME, "viewSha256": _sha(raw), "viewSize": len(raw),
        "capturedAt": view["capturedAt"], "readAt": view["readAt"],
        "navd88WseIncluded": False, "hydraulicSimulationIncluded": False,
        "publicPublication": "REVIEW_REQUIRED",
        "authentication": "UNSIGNED_LOCAL_SHA256_ONLY",
    }
    with tempfile.TemporaryDirectory(dir=target.parent, prefix=".tsm-native-gauge-") as temporary:
        stage = Path(temporary) / "gauge"
        stage.mkdir()
        (stage / VIEW_NAME).write_bytes(raw)
        (stage / RECEIPT_NAME).write_bytes((canonical(receipt) + "\n").encode("utf-8"))
        verify(stage)
        os.rename(stage, target)
    return receipt


def verify(target: Path) -> dict:
    """Local checks only: does not establish public-source authenticity."""
    if not target.is_dir() or target.is_symlink():
        raise ValueError("Native gauge export must be an ordinary directory")
    if set(p.name for p in target.iterdir()) != {VIEW_NAME, RECEIPT_NAME}:
        raise ValueError("Unexpected or missing native gauge export file")
    for name in (VIEW_NAME, RECEIPT_NAME):
        if (target / name).is_symlink() or not (target / name).is_file():
            raise ValueError("Native gauge export may not contain symlinks")
    receipt_bytes = (target / RECEIPT_NAME).read_bytes()
    if len(receipt_bytes) > 16384:
        raise ValueError("Native gauge receipt exceeds size limit")
    receipt = json.loads(receipt_bytes)
    if (receipt.get("schema") != SCHEMA or receipt.get("version") != 1
            or receipt.get("viewFile") != VIEW_NAME
            or receipt.get("runtime") != "FILES_ONLY_NO_SERVER"
            or receipt.get("publicPublication") != "REVIEW_REQUIRED"
            or receipt.get("authentication") != "UNSIGNED_LOCAL_SHA256_ONLY"
            or receipt.get("navd88WseIncluded") is not False
            or receipt.get("hydraulicSimulationIncluded") is not False):
        raise ValueError("Misleading native gauge receipt authority")
    raw = (target / VIEW_NAME).read_bytes()
    if (len(raw) > MAX_VIEW_BYTES or type(receipt.get("viewSize")) is not int
            or receipt["viewSize"] != len(raw) or receipt.get("viewSha256") != _sha(raw)):
        raise ValueError("Native gauge SHA-256 or length mismatch")
    view = json.loads(raw)
    if (view.get("schema") != "tsm.offline-gauge-view.v1"
            or view.get("runtime") != "FILES_ONLY_NO_SERVER"
            or view.get("publicPublication") != "REVIEW_REQUIRED"
            or view.get("engineeringUse") != "NOT_VALIDATED"
            or view.get("navd88WseIncluded") is not False
            or view.get("hydraulicSimulationIncluded") is not False
            or view.get("capturedAt") != receipt.get("capturedAt")
            or view.get("readAt") != receipt.get("readAt")):
        raise ValueError("Native view has misleading or altered evidence schema")
    stations = view.get("stations")
    if not isinstance(stations, dict) or set(stations) != {
            "USGS-03322000", "USGS-03377500", "USGS-03378500"}:
        raise ValueError("Invalid native gauge station set")
    for station, value in stations.items():
        if not isinstance(value, dict) or not isinstance(value.get("series"), list):
            raise ValueError("Invalid gauge series list")
        for series in value["series"]:
            if (not isinstance(series, dict)
                    or series.get("verticalReference") != "STATION_GAGE_DATUM_UNRESOLVED"
                    or series.get("gageHeightFt") is None and
                        series.get("readingStatus") != "MISSING_MEASUREMENT"):
                raise ValueError("Native observation must retain unresolved gage datum")
    return receipt


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    commands = cli.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build")
    build.add_argument("bundle", type=Path)
    build.add_argument("destination", type=Path)
    build.add_argument("--as-of", help="UTC replay time; omit for current capture age")
    build.add_argument("--stale-after-seconds", type=int, default=3600)
    check = commands.add_parser("verify")
    check.add_argument("directory", type=Path)
    args = cli.parse_args()
    result = (export(args.bundle, args.destination, as_of=args.as_of,
                     stale_after_seconds=args.stale_after_seconds)
              if args.command == "build" else verify(args.directory))
    print(json.dumps({"schema": result["schema"], "viewSha256": result["viewSha256"],
                      "status": "LOCAL_INTEGRITY_CHECKED_PUBLIC_REVIEW_REQUIRED"}, sort_keys=True))


if __name__ == "__main__":
    main()
