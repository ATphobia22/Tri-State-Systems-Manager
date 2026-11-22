"""Build a local public-address search index from reviewed WGS84 GeoJSON."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
import tempfile

BOUNDS = (-88.6, 37.4, -87.0, 38.6)
ABBREVIATIONS = dict(STREET="ST", ROAD="RD", AVENUE="AVE", DRIVE="DR",
                     NORTH="N", SOUTH="S", EAST="E", WEST="W")


def normalize(text):
    return " ".join(ABBREVIATIONS.get(word, word)
                    for word in re.findall(r"[A-Z0-9]+", text.upper()))


def build(source, output, agency, release):
    raw = source.read_bytes()
    collection = json.loads(raw)
    if collection.get("type") != "FeatureCollection" or "crs" in collection:
        raise ValueError("Supply RFC 7946 WGS84 GeoJSON")
    with tempfile.TemporaryDirectory(dir=output.parent) as temp:
        db_path = Path(temp) / "addresses.sqlite"
        with sqlite3.connect(db_path) as db:
            db.execute("CREATE TABLE source(agency, release, sha256)")
            db.execute("INSERT INTO source VALUES(?,?,?)",
                       (agency, release, hashlib.sha256(raw).hexdigest()))
            db.execute("CREATE TABLE addresses(id TEXT PRIMARY KEY, name TEXT, key TEXT, lon REAL, lat REAL)")
            for feature in collection["features"]:
                geom = feature.get("geometry") or {}
                if geom.get("type") != "Point":
                    raise ValueError("Expected Point features")
                lon, lat = geom["coordinates"][:2]
                if not all(map(math.isfinite, (lat, lon))):
                    raise ValueError("Invalid coordinate")
                if not (BOUNDS[0] <= lon <= BOUNDS[2] and BOUNDS[1] <= lat <= BOUNDS[3]):
                    continue
                props = feature["properties"]
                name = props["display_name"].strip()
                identifier = feature.get("id")
                if identifier is None or not str(identifier).strip() or not name:
                    raise ValueError("Missing source identifier or display_name")
                db.execute("INSERT INTO addresses VALUES(?,?,?,?,?)",
                           (str(identifier), name, normalize(name), lon, lat))
            db.execute("CREATE INDEX by_key ON addresses(key)")
        db.close()
        db_path.replace(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("geojson", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--agency", required=True)
    parser.add_argument("--release", required=True)
    args = parser.parse_args()
    build(args.geojson, args.output, args.agency, args.release)
