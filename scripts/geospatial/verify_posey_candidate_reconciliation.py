"""Merkle-bound Posey 23,082-feature recovery verification.

Requires the hash-pinned archived IGIO FeatureCollection, current published subset,
recovered official candidates and the identity delta. Never merges 2D candidate
footprints into 3D publication, manufactures heights, or certifies geometry.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from backend.merkle_evidence import build_manifest, verify_manifest, _safe_path
from scripts.geospatial.reconcile_published_buildings import _identifier

def _read_features(path: Path, label: str) -> dict[int, dict]:
    payload = json.loads(path.read_text(encoding="utf8"))
    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        raise ValueError("POSEY_GEOJSON_INVALID:" + label)
    result = {}
    for feature in payload.get("features", []):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ValueError("POSEY_FEATURE_INVALID:" + label)
        props = feature.get("properties")
        identity = _identifier(props) if isinstance(props, dict) else None
        if identity is None:
            raise ValueError("POSEY_SOURCE_OBJECTID_MISSING:" + label)
        if identity in result:
            raise ValueError("POSEY_DUPLICATE_OBJECTID:" + label)
        if not isinstance(feature.get("geometry"), dict):
            raise ValueError("POSEY_GEOMETRY_MISSING:" + label)
        result[identity] = feature
    return result


def verify_posey_2d_candidates(root: Path, *, source: str, published: str,
                               candidates: str, delta: str, expected_count: int = 23082) -> dict:
    paths = {"archived_source": source, "published": published,
             "official_candidate": candidates, "identity_delta": delta}
    manifest = build_manifest(root, [(role, value) for role, value in paths.items()])
    if not verify_manifest(root, manifest):
        raise ValueError("POSEY_MERKLE_ARTIFACTS_INVALID")
    records = {name: _safe_path(root, path) for name, path in paths.items()}
    delta_doc = json.loads(records["identity_delta"].read_text(encoding="utf8"))
    archived = _read_features(records["archived_source"], "archived")
    pub = _read_features(records["published"], "published")
    recovered = _read_features(records["official_candidate"], "candidate")
    expected_missing = set(delta_doc.get("missingArchivedSourceObjectIds", []))
    if (delta_doc.get("sourceFeatureCount") != expected_count
            or len(archived) != expected_count
            or delta_doc.get("idDifferenceCount") != len(expected_missing)
            or len(expected_missing) != len(delta_doc.get("missingArchivedSourceObjectIds", []))):
        raise ValueError("POSEY_ARCHIVED_COUNT_OR_IDENTITY_DELTA_INVALID")
    asset_sha = {x["role"]: x["sha256"] for x in manifest["items"]}
    for field, role in (("sourceAssetSha256", "archived_source"),
                        ("publishedAssetSha256", "published")):
        if delta_doc.get(field) != asset_sha[role]:
            raise ValueError("POSEY_ARCHIVED_SOURCE_HASH_NOT_PINNED:" + field)
    if set(pub) - set(archived):
        raise ValueError("POSEY_PUBLISHED_UNEXPECTED_OBJECTIDS")
    actual_missing = set(archived) - set(pub)
    if actual_missing != expected_missing:
        raise ValueError("POSEY_DELTA_DOES_NOT_MATCH_ARCHIVED_SOURCE")
    if set(recovered) - expected_missing:
        raise ValueError("POSEY_RECOVERY_HAS_UNREQUESTED_IDS")
    missing_live = sorted(expected_missing - set(recovered))
    mismatched_geometry = []
    matching_geometry = []
    mismatched_vintage = []
    no_height = []
    for object_id in sorted(recovered):
        original, candidate = archived[object_id], recovered[object_id]
        if (json.dumps(original["geometry"], sort_keys=True, separators=(",", ":"))
                != json.dumps(candidate["geometry"], sort_keys=True, separators=(",", ":"))):
            mismatched_geometry.append(object_id)
        else:
            matching_geometry.append(object_id)
        original_props, candidate_props = original["properties"], candidate["properties"]
        if (original_props.get("lidaryear") is not None
                and candidate_props.get("lidaryear") is not None
                and str(original_props["lidaryear"]) != str(candidate_props["lidaryear"])):
            mismatched_vintage.append(object_id)
        if not any(isinstance(candidate_props.get(k), (int, float))
                   and not isinstance(candidate_props.get(k), bool)
                   and candidate_props[k] > 0 for k in
                   ("heightM", "height_m", "buildingHeightM", "height")):
            no_height.append(object_id)
    candidates_complete = not missing_live and len(recovered) == len(expected_missing)
    same_serialized_geometry = candidates_complete and not mismatched_geometry
    return {
        "schemaVersion": "tsm.posey.archived-candidate-check.v1",
        "merkleRootSha256": manifest["merkleRootSha256"],
        "merkleAlgorithm": manifest["algorithm"],
        "merkleEvidence": manifest,
        "expectedArchived": expected_count,
        "archivedVerifiedByHash": True,
        "publishedCount": len(pub), "candidateCount": len(recovered),
        "candidateIdentitySetComplete": candidates_complete,
        "restored2dCandidateCount": len(pub) + len(recovered),
        "missingCandidateIds": missing_live,
        "identicalSerializedGeometryCount": len(matching_geometry),
        "nonidenticalSerializedGeometryIds": mismatched_geometry,
        "sourceVintageDifferentIds": mismatched_vintage,
        "candidateHeightNotEvidencedIds": no_height,
        "candidateGeometryStringEquivalent": same_serialized_geometry,
        "full3dEngineeringAcceptance": False,
        "regulatoryUse": False,
        "status": "ARCHIVED_IDENTITY_GAP_RECOVERED_AWAITING_INDEPENDENT_GEOMETRY_HEIGHT_SURVEY_REVIEW"
                  if candidates_complete else "ARCHIVED_IDENTITY_GAP_INCOMPLETE",
        "notice": "String-identical geometry is not independently surveyed shape accuracy. Mismatched polygons may reflect coordinate precision/order or real source updates; never auto-merge.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    for key in ("source", "published", "candidates", "delta"):
        parser.add_argument("--" + key, required=True)
    parser.add_argument("--expected-count", type=int, default=23082)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = verify_posey_2d_candidates(
        args.root, source=args.source, published=args.published,
        candidates=args.candidates, delta=args.delta, expected_count=args.expected_count)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf8") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print(result["status"], result["merkleRootSha256"])
    return 0 if result["candidateIdentitySetComplete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
