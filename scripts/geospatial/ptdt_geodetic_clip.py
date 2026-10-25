#!/usr/bin/env python3
"""Evidence-gated LAS/LAZ clipping for the Point Township digital twin.

Requires an independently sourced EPSG:2966 polygon AND declared NAVD88 heights.
Does not create fabricated input, perform implicit datum conversions, test survey
accuracy from point density, or grant AOI or professional certification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely.validation import explain_validity

EPSG_2966 = "EPSG:2966"
# Geographic sanity fence, NOT an official township, survey, or regulatory boundary.
POSEY_SANITY_BBOX = (-88.2, 37.7, -87.4, 38.3)


class EvidenceError(ValueError):
    pass


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as reader:
        for chunk in iter(lambda: reader.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_token(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdefABCDEF" for c in value)


def load_aoi(path: Path, *, allow_candidate: bool = False):
    """Read explicit projected geometry with verifiable source and review metadata.

    Projected geometry is NOT RFC 7946 GeoJSON. We deliberately use a custom
    manifest so coordinates cannot be misread as WGS84 longitude/latitude.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != "tsm.projected-aoi.v1":
        raise EvidenceError("Expected tsm.projected-aoi.v1; no legacy GeoJSON CRS guessing")
    if data.get("horizontalCrs") != EPSG_2966 or data.get("horizontalUnit") != "ftUS":
        raise EvidenceError("AOI must declare EPSG:2966 and US survey feet")
    if data.get("verticalDatum") != "NAVD88":
        raise EvidenceError("AOI must declare NAVD88; no implicit vertical transformation")
    status = data.get("approvalStatus")
    if status == "APPROVED":
        if not (sha256_token(data.get("sourceBoundarySha256")) and
                sha256_token(data.get("humanApprovalEvidenceSha256")) and
                data.get("approvalAuthority") and data.get("approvalScope")):
            raise EvidenceError("Approved AOI requires source and human approval evidence")
    elif not (status == "CANDIDATE" and allow_candidate):
        raise EvidenceError("AOI not approved; use --allow-candidate-screening for informational exports only")

    geom = shape(data.get("geometry", {}))
    if geom.is_empty or geom.geom_type not in ("Polygon", "MultiPolygon") or not geom.is_valid:
        raise EvidenceError(f"Invalid AOI polygon: {explain_validity(geom)}")
    if geom.area <= 0:
        raise EvidenceError("AOI area must be positive")
    # Compare transformed vertices/bounds against a *coarse* Posey-area sanity
    # envelope. This catches a 2-million-foot easting mistake, not parcel errors.
    transform = Transformer.from_crs(EPSG_2966, "EPSG:4326", always_xy=True)
    minx, miny, maxx, maxy = geom.bounds
    for east, north in ((minx, miny), (minx, maxy), (maxx, miny), (maxx, maxy)):
        lon, lat = transform.transform(east, north)
        west, south, east_limit, north_limit = POSEY_SANITY_BBOX
        if not all(map(math.isfinite, (lon, lat))) or not (
                west <= lon <= east_limit and south <= lat <= north_limit):
            raise EvidenceError(
                "AOI lies outside Posey County geographic sanity envelope: "
                f"EPSG:2966 ({east:.3f},{north:.3f}) maps to ({lon:.6f},{lat:.6f})"
            )
    return data, geom


def validate_source(source_path: Path, metadata_path: Path) -> dict:
    if not source_path.is_file() or source_path.suffix.lower() not in (".las", ".laz"):
        raise EvidenceError("Existing LAS or LAZ input file required; no synthetic fallback")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("horizontalCrs") != EPSG_2966:
        raise EvidenceError("Source CRS must be EPSG:2966; explicit grid-backed reprojection required first")
    if metadata.get("verticalDatum") != "NAVD88":
        raise EvidenceError("Source must be independently transformed to NAVD88 before ingest")
    if metadata.get("verticalUnit") not in ("m", "ftUS", "ft"):
        raise EvidenceError("Missing explicit source vertical height unit")
    expected = metadata.get("sourceSha256")
    if not sha256_token(expected) or expected.lower() != digest(source_path):
        raise EvidenceError("Source SHA-256 missing or does not match LAS/LAZ bytes")
    # QL2 pulse density is assessed using single-swath first returns, NOT
    # ground-classified point density in a clipped output.
    if metadata.get("qualityLevel") == "QL2":
        density = metadata.get("aggregateNominalPulseDensity")
        if density is not None and (not isinstance(density, (int, float)) or
                                    not math.isfinite(density) or density < 2.0):
            raise EvidenceError("Declared QL2 pulse density below 2 pulses/m2")
        rmse = metadata.get("nonvegetatedRmseVmeters")
        if rmse is not None and (not isinstance(rmse, (int, float)) or
                                 not math.isfinite(rmse) or rmse < 0 or rmse > 0.1):
            raise EvidenceError("Declared QL2 NVA RMSEv outside 0.100 m limit")
        if density is not None or rmse is not None:
            if not sha256_token(metadata.get("independentAccuracyReportSha256")):
                raise EvidenceError("Do not claim QL2 measured metrics without accuracy report SHA-256")
    return metadata


def clip(source: Path, out: Path, aoi: Path, metadata: Path, report: Path, *,
         allow_candidate: bool = False, chunk_size: int = 250_000) -> dict:
    if chunk_size < 1:
        raise EvidenceError("chunk_size must be positive")
    data, polygon = load_aoi(aoi, allow_candidate=allow_candidate)
    source_info = validate_source(source, metadata)
    try:
        import laspy
        from shapely import intersects_xy
    except ImportError as exc:
        raise EvidenceError("Clipping requires laspy >=2 and shapely >=2") from exc
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.resolve() == source.resolve():
        raise EvidenceError("Output must not overwrite original evidence")
    total = retained = 0
    try:
        with laspy.open(source) as reader:
            embedded_crs = reader.header.parse_crs()
            if embedded_crs is None or CRS.from_user_input(embedded_crs).to_epsg() != 2966:
                raise EvidenceError("LAS header must explicitly contain EPSG:2966 CRS; manifest alone is insufficient")
            with laspy.open(out, mode="w", header=reader.header) as writer:
                for points in reader.chunk_iterator(chunk_size):
                    xs, ys = points.x, points.y
                    selected = intersects_xy(polygon, xs, ys)  # includes edge pixels/points
                    total += len(points)
                    if selected.any():
                        subset = points[selected]
                        writer.write_points(subset)
                        retained += len(subset)
        if retained == 0:
            raise EvidenceError("No points inside AOI; no empty raster/terrain is publishable")
        result = {
            "schemaVersion": "tsm.point-cloud-clip.v1",
            "classification": "INFORMATIONAL_ONLY",
            "approvalStatus": data["approvalStatus"],
            "approvedForEngineering": False,
            "surveyGradeCertified": False,
            "independentAccuracyVerified": False,
            "aoiManifestSha256": digest(aoi),
            "sourceMetadataSha256": digest(metadata),
            "sourceSha256": source_info["sourceSha256"].lower(),
            "outputSha256": digest(out),
            "sourceCrs": EPSG_2966,
            "sourceVerticalDatum": "NAVD88",
            "sourceVerticalUnit": source_info["verticalUnit"],
            "originalPointCount": total,
            "retainedPointCount": retained,
            "accuracyMeaning": "Source reported information only; point clipping cannot establish survey-grade accuracy",
            "regulatoryDetermination": None,
        }
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        return result
    except Exception:
        out.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--aoi", type=Path, required=True)
    parser.add_argument("--source-metadata", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--allow-candidate-screening", action="store_true")
    args = parser.parse_args()
    result = clip(args.input, args.output, args.aoi, args.source_metadata,
                  args.report, allow_candidate=args.allow_candidate_screening)
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
