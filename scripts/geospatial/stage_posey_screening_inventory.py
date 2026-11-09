#!/usr/bin/env python3
"""Build a 23,082-ID *screening-only* footprint inventory from pinned source evidence.

No missing heights or meshes are fabricated. An identity set match is not
geometric agreement, vertical accuracy, or an engineering/regulatory approval.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

ID_KEYS = ("igioObjectId", "sourceObjectId", "OBJECTID", "objectid", "source_object_id")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ident(feature: dict) -> int:
    props = feature.get("properties") or {}
    candidates = {int(props[k]) for k in ID_KEYS
                  if k in props and isinstance(props[k], (str, int))
                  and not isinstance(props[k], bool) and str(props[k]).isdigit()}
    if len(candidates) != 1:
        raise ValueError("MISSING_OR_AMBIGUOUS_BUILDING_SOURCE_ID")
    return next(iter(candidates))


def read_geojson(path: Path) -> tuple[dict, bytes]:
    raw = path.read_bytes()
    data = json.loads(raw)
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise ValueError("BUILDING_GEOJSON_FEATURE_COLLECTION_REQUIRED")
    return data, raw


def stage(published: Path, archived: Path, candidates: Path, delta_path: Path,
          output: Path) -> dict:
    if output.exists() or Path(str(output) + ".manifest.json").exists():
        raise FileExistsError("STAGED_OUTPUT_EXISTS")
    delta = json.loads(delta_path.read_text("utf8"))
    pub, pub_raw = read_geojson(published)
    src, src_raw = read_geojson(archived)
    live, live_raw = read_geojson(candidates)
    if sha(pub_raw) != delta["publishedAssetSha256"] or sha(src_raw) != delta["sourceAssetSha256"]:
        raise ValueError("ARCHIVED_OR_PUBLISHED_HASH_MISMATCH")
    if len(src["features"]) != 23082 or len(pub["features"]) != 22815:
        raise ValueError("BUILDING_EXPECTED_SOURCE_COUNTS_CHANGED")
    provenance = json.loads(Path(str(candidates) + ".provenance.json").read_text("utf8"))
    if (provenance.get("sha256") != sha(live_raw)
            or provenance.get("retrievedLiveCandidates") != 267
            or provenance.get("notReturnedFromLiveService") != []
            or provenance.get("sourceItemId") != "384f2d5041a14c34bd9e807c568784da"
            or provenance.get("validationStatus") != "UNVERIFIED"):
        raise ValueError("LIVE_SOURCE_PROVENANCE_NOT_ELIGIBLE_FOR_SCREENING")
    def index(features: list) -> dict[int, dict]:
        result = {}
        for feature in features:
            if not isinstance(feature, dict) or feature.get("type") != "Feature":
                raise ValueError("INVALID_BUILDING_FEATURE")
            number = ident(feature)
            if number in result:
                raise ValueError("DUPLICATE_BUILDING_ID")
            result[number] = feature
        return result
    source = index(src["features"])
    current = index(pub["features"])
    addition = index(live["features"])
    expected = set(delta["missingArchivedSourceObjectIds"])
    if set(addition) != expected or set(source) != (set(current) | expected):
        raise ValueError("BUILDING_ARCHIVED_IDENTITY_SETS_DO_NOT_RECONCILE")
    if set(current) & expected:
        raise ValueError("BUILDING_STAGING_WOULD_DUPLICATE_EXISTING_ID")
    staged = list(pub["features"])
    for object_id in sorted(expected):
        candidate = addition[object_id]
        if candidate.get("geometry") is None:
            raise ValueError("LIVE_BUILDING_GEOMETRY_MISSING")
        attrs = candidate.get("properties")
        if not isinstance(attrs, dict) or str(attrs.get("county", "")).casefold() != "posey":
            raise ValueError("LIVE_BUILDING_COUNTY_MISMATCH")
        # Explicitly forbid an inferred vertical/elevation claim for recovered 2D.
        props = {k: v for k, v in attrs.items()
                 if k.lower() not in ("height", "heightm", "heightft", "elevation", "bfe")}
        props.update({
            "sourceObjectId": object_id,
            "tsmProvenance": "IGIO_LIVE_SCREENING_CANDIDATE",
            "tsmHeightStatus": "NOT_EVIDENCED",
            "tsmEngineeringUse": False,
            "tsmRegulatoryUse": False,
            "tsm3DMeshStatus": "NOT_BUILT",
        })
        staged.append({"type": "Feature", "properties": props,
                       "geometry": candidate["geometry"]})
    assert len(staged) == 23082
    body = json.dumps({"type": "FeatureCollection", "features": staged},
                      separators=(",", ":"), ensure_ascii=False).encode()
    report = {
        "schemaVersion": "tsm.posey.screening-staging.v1",
        "publishedCount": 22815, "recoveredCandidateCount": 267,
        "staged2dIdentityCount": len(staged),
        "identitySetMatchesArchived": True,
        "archivedSourceSha256": delta["sourceAssetSha256"],
        "publishedSourceSha256": delta["publishedAssetSha256"],
        "liveCandidateSha256": sha(live_raw),
        "stagedSha256": sha(body), "stagedByteLength": len(body),
        "heightDerivationCountForRecovered": 0,
        "engineeringAccepted": False, "regulatoryApproved": False,
        "threeDTilesRebuilt": False,
        "status": "TWO_DIMENSIONAL_SCREENING_ONLY_UNVERIFIED",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as out:
        out.write(body)
    Path(str(output) + ".manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--published", type=Path, required=True)
    parser.add_argument("--archived", type=Path, required=True)
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--delta", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(stage(args.published, args.archived, args.candidates, args.delta,
                           args.output), indent=2))
