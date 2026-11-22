"""Capture or replay bounded USGS gauge evidence for the Ohio–Wabash pilot."""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.engineering.stage_calibration_gate import (  # noqa: E402
    MAX_BYTES, digest, offset_time, series,
)

STATIONS = ("03322000", "03378500", "03377500")
ENDPOINT = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items"
NO_DATA = {-999, -9999, -8888}
UTC = timezone.utc


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def iso(time: datetime) -> str:
    return time.astimezone(UTC).isoformat().replace("+00:00", "Z")


def read_json(path: Path):
    with path.open("rb") as handle:
        data = handle.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError(f"JSON exceeds size limit: {path}")
    return json.loads(data)


def write_json(path: Path, data):
    with path.open("x", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, allow_nan=False)
        handle.write("\n")


def fetch(url: str) -> bytes:
    request = Request(url, headers={"Accept": "application/geo+json"})
    with build_opener(NoRedirect()).open(request, timeout=25) as response:
        return response.read(MAX_BYTES + 1)


def capture(destination: Path, *, retrieve=fetch, now=None, window_end=None) -> dict:
    started = now if now is not None else datetime.now(UTC)
    end = window_end if window_end is not None else started
    if end > started:
        raise ValueError("Capture window cannot end in the future")
    start = end - timedelta(hours=6)
    manifest = {
        "schema": "tsm.river-twin.observations.v1",
        "window": [iso(start), iso(end)],
        "startedAt": iso(started),
        "stations": {},
    }
    if destination.exists() or destination.is_symlink():
        raise ValueError("Snapshot destination must be new")
    with tempfile.TemporaryDirectory(dir=destination.parent) as temp:
        staging = Path(temp) / "snapshot"
        staging.mkdir()
        for station in STATIONS:
            query = urlencode({
                "f": "json", "monitoring_location_id": f"USGS-{station}",
                "parameter_code": "00065", "time": f"{iso(start)}/{iso(end)}",
                "limit": 1000,
            })
            url = f"{ENDPOINT}?{query}"
            entry = {"sourceUrl": url}
            manifest["stations"][station] = entry
            try:
                raw = retrieve(url)
                if len(raw) > MAX_BYTES:
                    raise ValueError("USGS response exceeds size limit")
                rows = decode(raw)
            except (URLError, OSError, ValueError) as error:
                entry.update(status="SOURCE_UNAVAILABLE", reason=str(error))
                continue
            (staging / f"{station}.geojson").write_bytes(raw)
            entry.update(
                status="CAPTURED" if rows else "NO_OBSERVATIONS",
                rawSha256=hashlib.sha256(raw).hexdigest(), featureCount=len(rows),
            )
        manifest["finishedAt"] = iso(now if now is not None else datetime.now(UTC))
        write_json(staging / "manifest.json", manifest)
        os.rename(staging, destination)
    return manifest


def decode(raw: bytes) -> list:
    collection = json.loads(raw)
    if not isinstance(collection, dict) or collection.get("type") != "FeatureCollection":
        raise ValueError("Expected a USGS FeatureCollection")
    features = collection.get("features")
    if not isinstance(features, list) or len(features) > 1000:
        raise ValueError("Invalid USGS feature count")
    links = collection.get("links", [])
    if not isinstance(links, list) or any(
        not isinstance(link, dict) or link.get("rel") == "next" for link in links
    ):
        raise ValueError("Expected a complete single-page USGS response")
    return features


def station_rows(snapshot: Path, manifest: dict, binding: dict) -> dict:
    if manifest["schema"] != "tsm.river-twin.observations.v1":
        raise ValueError("Unsupported observation snapshot")
    station = binding["stationId"]
    entry = manifest["stations"][station]
    if entry["status"] == "SOURCE_UNAVAILABLE":
        return {}
    path = snapshot / f"{station}.geojson"
    with path.open("rb") as handle:
        raw = handle.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES or hashlib.sha256(raw).hexdigest() != entry["rawSha256"]:
        raise ValueError(f"Observation bytes failed integrity check for {station}")
    start, end = map(offset_time, manifest["window"])
    valid_from = offset_time(binding["validFrom"])
    valid_until = offset_time(binding["validUntil"])
    rows = {}
    for feature in decode(raw):
        p = feature["properties"]
        if (
            p.get("monitoring_location_id") != f"USGS-{station}"
            or p.get("parameter_code") != "00065"
            or p.get("time_series_id") != binding["timeSeriesId"]
            or p.get("unit_of_measure") != "ft"
        ):
            continue
        time = offset_time(p["time"])
        if not start <= time <= end or not valid_from <= time < valid_until:
            continue
        if time in rows:
            raise ValueError(f"Duplicate USGS observation for {station} at {iso(time)}")
        try:
            value = float(p["value"]) if type(p["value"]) in (str, float, int) else None
        except ValueError:
            value = None
        if value is not None and (not math.isfinite(value) or value in NO_DATA):
            value = None
        rows[time] = {
            "featureId": feature.get("id"), "stageFt": value,
            "approvalStatus": p.get("approval_status"), "qualifier": p.get("qualifier"),
        }
    return rows


def compare(snapshot: Path, review_path: Path) -> dict:
    review = read_json(review_path)
    manifest = read_json(snapshot / "manifest.json")
    if (
        review["schema"] != "tsm.river-twin.model-review.v1"
        or review["engine"] != "HEC-RAS"
        or not all(isinstance(review[key], str) and review[key].strip()
                   for key in ("runId", "modelRevision", "reviewReference"))
    ):
        raise ValueError("A reviewed HEC-RAS run and revision are required")
    stations = {}
    for binding in review["bindings"]:
        station = binding["stationId"]
        if (
            station not in STATIONS or station in stations
            or not all(isinstance(binding[key], str) and binding[key].strip()
                       for key in ("timeSeriesId", "modelLocation", "datumReference"))
            or binding["modelDatum"] != "NAVD88" or binding["modelUnits"] != "ft"
            or binding["observationUse"] not in (
                "WITHHELD_DECLARED", "MODEL_INPUT_OR_CALIBRATION", "UNDETERMINED",
            )
            or type(binding["gageZeroFtNavd88"]) not in (int, float)
            or not math.isfinite(binding["gageZeroFtNavd88"])
            or offset_time(binding["validFrom"]) >= offset_time(binding["validUntil"])
        ):
            raise ValueError(f"Invalid or duplicate review binding for {station}")
        digest(review_path.parent / binding["datumEvidence"], binding["datumSha256"])
        model = series(review_path.parent / binding["modelCsv"], binding["modelSha256"])
        observations = station_rows(snapshot, manifest, binding)
        pairs = []
        for time in sorted(observations.keys() & model.keys()):
            observation = observations[time]
            stage = observation["stageFt"]
            if stage is None or observation["approvalStatus"] != "Approved":
                continue
            observed = stage + binding["gageZeroFtNavd88"]
            residual = model[time] - observed
            if not math.isfinite(residual):
                raise ValueError("Non-finite residual")
            pairs.append({
                "time": iso(time), **observation, "observedWseFtNavd88": observed,
                "modelWseFtNavd88": model[time], "residualFt": residual,
            })
        count = len(pairs)
        errors = [pair["residualFt"] for pair in pairs]
        stations[station] = {
            "binding": binding, "pairs": pairs,
            "status": (
                manifest["stations"][station]["status"]
                if manifest["stations"][station]["status"] == "SOURCE_UNAVAILABLE"
                else "PAIRED_FOR_REVIEW" if count else "NO_APPROVED_EXACT_MATCHES"
            ),
            "sourceObservationCount": len(observations),
            "count": count,
            "biasFt": math.fsum(error / count for error in errors) if count else None,
            "maeFt": math.fsum(abs(error) / count for error in errors) if count else None,
        }
    if not stations:
        raise ValueError("At least one reviewed station binding is required")
    return {
        "schema": "tsm.river-twin.comparison.v1",
        "runId": review["runId"], "modelRevision": review["modelRevision"],
        "reviewReference": review["reviewReference"],
        "snapshot": manifest, "stations": stations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    capture_parser = commands.add_parser("capture")
    capture_parser.add_argument("destination", type=Path)
    capture_parser.add_argument("--end", help="End of a historical six-hour window")
    compare_parser = commands.add_parser("compare")
    compare_parser.add_argument("snapshot", type=Path)
    compare_parser.add_argument("model_review", type=Path)
    compare_parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "capture":
            result = capture(args.destination, window_end=offset_time(args.end) if args.end else None)
            states = {key: item["status"] for key, item in result["stations"].items()}
            print(json.dumps(states))
            return int(any(status != "CAPTURED" for status in states.values()))
        result = compare(args.snapshot, args.model_review)
        write_json(args.output, result)
        print(json.dumps({key: item["status"] for key, item in result["stations"].items()}))
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"River twin: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
