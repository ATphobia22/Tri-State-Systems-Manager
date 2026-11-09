"""Independent checkpoint accuracy screening with Merkle-bound raw measurements.

This is NOT a field survey, published ASPRS accuracy classification, legal boundary,
or license/seal verification. A surveyor must authenticate control, instrument
calibration, spatial coverage and applicable accuracy standard separately.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from backend.merkle_evidence import verify_manifest, _safe_path


def _number(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("CHECKPOINT_NONFINITE_OR_NONNUMERIC")
    return float(value)


def _points(document: dict) -> dict[str, dict]:
    if not isinstance(document, dict) or not isinstance(document.get("points"), list):
        raise ValueError("CHECKPOINT_DOCUMENT_INVALID")
    index = {}
    for item in document["points"]:
        if not isinstance(item, dict) or not isinstance(item.get("pointId"), str) or not item["pointId"].strip():
            raise ValueError("CHECKPOINT_POINT_ID_MISSING")
        identifier = item["pointId"]
        if identifier in index:
            raise ValueError("CHECKPOINT_DUPLICATE_POINT_ID")
        for key in ("x", "y", "z", "sigmaX", "sigmaY", "sigmaZ"):
            _number(item.get(key))
        if min(item["sigmaX"], item["sigmaY"], item["sigmaZ"]) < 0:
            raise ValueError("CHECKPOINT_SIGMA_NEGATIVE")
        index[identifier] = item
    return index


def assess_checkpoints(root: Path, manifest: dict, *, specification_path: str,
                       reference_path: str, observation_path: str) -> dict:
    """Check two independent purported datasets against Merkle root and explicit thresholds."""
    if not verify_manifest(root, manifest):
        raise ValueError("CHECKPOINT_MERKLE_INVALID")
    expected_roles = {
        ("survey_spec", specification_path),
        ("survey_reference", reference_path),
        ("survey_observation", observation_path),
    }
    if not expected_roles.issubset({(x["role"], x["path"]) for x in manifest["items"]}):
        raise ValueError("CHECKPOINT_REQUIRED_MERKLE_LEAVES_MISSING")
    spec = json.loads(_safe_path(root, specification_path).read_text(encoding="utf8"))
    reference = json.loads(_safe_path(root, reference_path).read_text(encoding="utf8"))
    observation = json.loads(_safe_path(root, observation_path).read_text(encoding="utf8"))
    if spec.get("schemaVersion") != "tsm.survey.checkpoints.v1":
        raise ValueError("CHECKPOINT_SPEC_VERSION_REQUIRED")
    for name, doc in (("reference", reference), ("observation", observation)):
        for field in ("horizontalCrs", "verticalDatum", "geoidModel", "units",
                      "coordinateEpoch", "sourceAuthority", "collectionDate"):
            if not isinstance(doc.get(field), str) or not doc[field].strip():
                raise ValueError("CHECKPOINT_METADATA_MISSING:" + name + ":" + field)
        for field in ("horizontalCrs", "verticalDatum", "geoidModel", "units", "coordinateEpoch"):
            if doc[field] != spec.get(field):
                raise ValueError("CHECKPOINT_DATUM_CRS_UNIT_OR_EPOCH_MISMATCH:" + field)
    if reference["sourceAuthority"] == observation["sourceAuthority"]:
        raise ValueError("CHECKPOINT_REFERENCES_NOT_DISTINCT")
    if spec["units"] not in ("ftUS", "m"):
        raise ValueError("CHECKPOINT_UNITS_UNSUPPORTED")
    min_count = spec.get("minimumCheckpointCount")
    if type(min_count) is not int or min_count < 5:
        raise ValueError("CHECKPOINT_MINIMUM_MUST_BE_AT_LEAST_FIVE")
    ref, obs = _points(reference), _points(observation)
    if set(ref) != set(obs) or len(ref) < min_count:
        raise ValueError("CHECKPOINT_COUNT_OR_ID_SET_INVALID")
    dx, dy, dz = [], [], []
    sig_h2, sig_v2 = [], []
    for point in sorted(ref):
        a, b = ref[point], obs[point]
        dx.append(_number(b["x"]) - _number(a["x"]))
        dy.append(_number(b["y"]) - _number(a["y"]))
        dz.append(_number(b["z"]) - _number(a["z"]))
        sig_h2.append(sum(_number(p["sigmaX"])**2 + _number(p["sigmaY"])**2 for p in (a, b)))
        sig_v2.append(sum(_number(p["sigmaZ"])**2 for p in (a, b)))
    n = len(dx)
    horizontal_rmse = math.sqrt(sum(x*x + y*y for x, y in zip(dx, dy))/n)
    vertical_rmse = math.sqrt(sum(z*z for z in dz)/n)
    h_uncertainty = math.sqrt(sum(sig_h2)/n)
    v_uncertainty = math.sqrt(sum(sig_v2)/n)
    h_combined = math.hypot(horizontal_rmse, h_uncertainty)
    v_combined = math.hypot(vertical_rmse, v_uncertainty)
    max_horizontal = _number(spec.get("maximumHorizontalCombinedError"))
    max_vertical = _number(spec.get("maximumVerticalCombinedError"))
    if max_horizontal <= 0 or max_vertical <= 0:
        raise ValueError("CHECKPOINT_LIMITS_INVALID")
    passed = h_combined <= max_horizontal and v_combined <= max_vertical
    return {
        "schemaVersion": "tsm.survey.checkpoints.assessment.v1",
        "checkpointCount": n,
        "merkleAlgorithm": manifest["algorithm"],
        "merkleRootSha256": manifest["merkleRootSha256"],
        "units": spec["units"],
        "horizontalCrs": spec["horizontalCrs"],
        "verticalDatum": spec["verticalDatum"],
        "geoidModel": spec["geoidModel"],
        "coordinateEpoch": spec["coordinateEpoch"],
        "horizontalRmse": horizontal_rmse, "verticalRmse": vertical_rmse,
        "combinedHorizontalUncertainty": h_combined, "combinedVerticalUncertainty": v_combined,
        "maximumHorizontalCombinedError": max_horizontal,
        "maximumVerticalCombinedError": max_vertical,
        "declaredCheckpointAccuracyPass": passed,
        "surveyControlIndependentlyAuthenticated": False,
        "professionalSealVerified": False,
        "regulatoryApproval": False,
        "notice": "Screening on Merkle-verified claimed checkpoint data; not a professional survey or an ASPRS accuracy certification.",
    }
