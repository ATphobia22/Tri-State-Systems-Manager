"""Bounded, fail-visible FEMA NFHL effective-layer acquisition for offline TSM staging.

No automatic regulatory decisions, datum inference, or network use at runtime.
Only the official FEMA host is contacted. Never use for countywide completeness
unless the downloaded OID inventory and counts have been independently reviewed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SERVICE = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer"
LAYERS = {"firm_panels": 3, "bfe": 16, "cross_sections": 14,
          "flood_hazard_zones": 28, "flood_hazard_boundaries": 27,
          "levees": 23, "lomas": 2, "lomrs": 1}
MAX_IDS = 100_000
MAX_CHUNK = 500


class AcquisitionError(RuntimeError):
    """Explicit incomplete/invalid acquisition."""


def _fetch(url: str, params: dict, *, timeout: int = 45) -> dict:
    target = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(target, headers={"User-Agent": "TSM-NFHL-evidence/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if urllib.parse.urlsplit(response.url).hostname != "hazards.fema.gov":
            raise AcquisitionError("FEMA request redirected outside approved host")
        data = response.read(32_000_001)
    if len(data) > 32_000_000:
        raise AcquisitionError("Response exceeds 32 MB cap")
    result = json.loads(data)
    if not isinstance(result, dict) or "error" in result:
        raise AcquisitionError("FEMA service returned an error")
    return result


def validate_bbox(bbox: tuple[float, float, float, float]) -> None:
    w, s, e, n = bbox
    if not all(math.isfinite(v) for v in bbox):
        raise ValueError("bbox must be finite")
    if not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
        raise ValueError("bbox must be ordered EPSG:4326 lon/lat bounds")
    if e - w > 2 or n - s > 2:
        raise ValueError("bbox exceeds 2-degree bounded acquisition limit")


def acquire_layer(layer: int, bbox: tuple[float, float, float, float],
                  destination: pathlib.Path, max_features: int = 10_000,
                  page_size: int = 500, fetch=_fetch) -> dict:
    validate_bbox(bbox)
    if layer not in LAYERS.values():
        raise ValueError("unregistered effective NFHL layer")
    if not (1 <= page_size <= MAX_CHUNK and 1 <= max_features <= MAX_IDS):
        raise ValueError("unsafe acquisition limit")
    root = SERVICE + "/" + str(layer)
    metadata = fetch(root, {"f": "json"})
    oid_field = metadata.get("objectIdField")
    if not oid_field:
        oid_field = next((f.get("name") for f in metadata.get("fields", [])
                          if f.get("type") == "esriFieldTypeOID"), None)
    if not oid_field:
        raise AcquisitionError("no OBJECTID field in FEMA layer metadata")
    w, s, e, n = bbox
    geometry = ",".join(str(v) for v in bbox)
    common = {"where": "1=1", "geometry": geometry,
              "geometryType": "esriGeometryEnvelope", "inSR": 4326,
              "spatialRel": "esriSpatialRelIntersects"}
    inventory = fetch(root + "/query", {**common, "returnIdsOnly": "true", "f": "json"})
    ids = inventory.get("objectIds")
    if not isinstance(ids, list) or any(not isinstance(v, int) for v in ids):
        raise AcquisitionError("FEMA object ID inventory unavailable")
    ids = sorted(set(ids))
    if len(ids) > max_features:
        raise AcquisitionError(f"{len(ids)} features exceed explicit cap {max_features}")
    destination.mkdir(parents=True, exist_ok=True)
    chunks = []
    retrieved = set()
    for start in range(0, len(ids), page_size):
        expected = ids[start:start + page_size]
        data = fetch(root + "/query", {
            "objectIds": ",".join(map(str, expected)), "outFields": "*",
            "returnGeometry": "true", "outSR": 4326, "f": "geojson"})
        if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
            raise AcquisitionError("unexpected GeoJSON response")
        features = data["features"]
        actual = set()
        for feature in features:
            props = feature.get("properties") or {}
            value = props.get(oid_field)
            if not isinstance(value, int) or value not in expected or value in retrieved:
                raise AcquisitionError("missing/duplicate/unexpected feature OBJECTID")
            actual.add(value)
        if actual != set(expected):
            raise AcquisitionError("incomplete feature chunk")
        retrieved.update(actual)
        payload = json.dumps(data, separators=(",", ":"), sort_keys=True).encode()
        filename = f"nfhl-{layer}-{start // page_size:05d}.geojson"
        path = destination / filename
        path.write_bytes(payload)
        chunks.append({"path": filename, "count": len(features),
                       "sha256": hashlib.sha256(payload).hexdigest()})
    manifest = {
        "schema": "tsm.fema.nfhl.acquisition.v1",
        "status": "ACQUIRED_UNREVIEWED",
        "authority": "FEMA", "service": SERVICE, "layer_id": layer,
        "service_crs_wkid": (metadata.get("extent") or {}).get("spatialReference", {}).get("wkid"),
        "output_crs": "EPSG:4326", "vertical_datum": "UNVERIFIED",
        "bbox_epsg4326": list(bbox), "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "object_id_field": oid_field, "expected_count": len(ids),
        "retrieved_count": len(retrieved), "chunks": chunks,
        "regulatory_use": "DISPLAY_ONLY_REQUIRES_HUMAN_REVIEW",
    }
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bbox", type=float, nargs=4, required=True,
                        metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    parser.add_argument("--layers", nargs="+", choices=sorted(LAYERS), required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--max-features", type=int, default=10_000)
    parser.add_argument("--page-size", type=int, default=500)
    args = parser.parse_args()
    for name in args.layers:
        manifest = acquire_layer(LAYERS[name], tuple(args.bbox), args.output / name,
                                 args.max_features, args.page_size)
        print(f"{name}: {manifest['retrieved_count']} features; UNREVIEWED")


if __name__ == "__main__":
    main()
