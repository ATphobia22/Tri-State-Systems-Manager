"""Build a civilian GeoJSON observation layer from a verified offline bundle.

This projection does not fetch data, infer missing coordinates or use gage height
as terrain elevation. It preserves station/series identities and review status.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from .offline_view import PILOT_STATIONS, verified_view

SCHEMA = "tsm.community-cop.v1"


def project(view: dict) -> dict:
    if (view.get("schema") != "tsm.offline-gauge-view.v1"
            or view.get("navd88WseIncluded") is not False
            or view.get("hydraulicSimulationIncluded") is not False
            or view.get("publicPublication") != "REVIEW_REQUIRED"
            or set(view["stations"]) != set(PILOT_STATIONS)):
        raise ValueError("Expected verified observation-only projection")
    features = []
    stations = {}
    for station, record in sorted(view["stations"].items()):
        stations[station] = {
            "sourceStatus": record["sourceStatus"],
            "seriesCount": len(record["series"]),
            "unlocatedSeriesCount": 0,
        }
        for series in record["series"]:
            if series["verticalReference"] != "STATION_GAGE_DATUM_UNRESOLVED":
                raise ValueError("Gage datum must remain unresolved")
            geometry = series.get("geometryWgs84")
            if geometry is None:
                stations[station]["unlocatedSeriesCount"] += 1
                continue
            coordinates = geometry.get("coordinates")
            if (geometry.get("type") != "Point" or not isinstance(coordinates, list)
                    or len(coordinates) not in (2, 3)
                    or not all(type(x) in (int, float) and math.isfinite(x) for x in coordinates)
                    or not -180 <= coordinates[0] <= 180
                    or not -90 <= coordinates[1] <= 90):
                raise ValueError("Invalid source point")
            # Discard any third ordinate. No vertical transformation is inferred.
            properties = {key: series[key] for key in (
                "timeSeriesId", "observedAt", "readingStatus", "gageHeightFt",
                "ageSeconds", "quality", "sourceSha256", "verticalReference", "eventId")}
            properties.update(stationId=station, authority="USGS",
                              sourceStatus=record["sourceStatus"])
            features.append({"type": "Feature", "id": series["eventId"],
                             "geometry": {"type": "Point", "coordinates": coordinates[:2]},
                             "properties": properties})
    return {"type": "FeatureCollection", "schema": SCHEMA, "features": features,
            "stations": stations, "capturedAt": view["capturedAt"],
            "readAt": view["readAt"], "staleAfterSeconds": view["staleAfterSeconds"],
            "publicPublication": "REVIEW_REQUIRED", "engineeringUse": "NOT_VALIDATED",
            "navd88WseIncluded": False, "hydraulicSimulationIncluded": False,
            "runtime": "FILES_ONLY_NO_SERVER"}


def build(bundle: Path, *, as_of: str | None = None,
          stale_after_seconds: int = 3600) -> dict:
    return project(verified_view(bundle, as_of=as_of,
                                 stale_after_seconds=stale_after_seconds))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--as-of")
    parser.add_argument("--stale-after-seconds", type=int, default=3600)
    args = parser.parse_args()
    document = build(args.bundle, as_of=args.as_of,
                     stale_after_seconds=args.stale_after_seconds)
    raw = (json.dumps(document, sort_keys=True, separators=(",", ":"),
                      allow_nan=False) + "\n").encode()
    # Never overwrite evidence or publish a file automatically.
    with args.destination.open("xb") as handle:
        handle.write(raw)
    print(json.dumps({"schema": SCHEMA, "featureCount": len(document["features"]),
                      "sha256": hashlib.sha256(raw).hexdigest(),
                      "status": "REVIEW_REQUIRED"}, sort_keys=True))


if __name__ == "__main__":
    main()
