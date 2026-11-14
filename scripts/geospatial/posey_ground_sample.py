"""Provenance-safe DEM sample fields; no inferred building roof heights."""
from __future__ import annotations
import math
from pathlib import Path


def ground_elevation_fields(result: tuple | None) -> dict:
    """Return metadata that makes absent or unreviewed terrain explicit."""
    valid = (
        isinstance(result, (list, tuple)) and len(result) == 5
        and all(type(value) in (int, float) and math.isfinite(value)
                for value in result[:3])
        and type(result[3]) is int and result[3] > 0
        and isinstance(result[4], str) and bool(result[4].strip())
        and result[0] <= result[2] <= result[1]
    )
    if not valid:
        return {
            "groundElevationSource": None,
            "groundElevationMethod": None,
            "groundElevationReference": None,
            "groundElevationMinFt": None,
            "groundElevationMaxFt": None,
            "groundElevationMeanFt": None,
            "groundElevationFt": None,
            "groundElevationSampleCount": 0,
            "elevationCoverage": "UNAVAILABLE",
            "groundElevationProvenanceStatus": "UNAVAILABLE",
            "groundElevationRegulatoryCertified": False,
        }
    low, high, mean, count, reference = result
    return {
        "groundElevationSource": Path(reference).name,
        "groundElevationMethod": "IGIO footprint centroid+boundary sampling",
        "groundElevationReference": reference,
        "groundElevationMinFt": low,
        "groundElevationMaxFt": high,
        "groundElevationMeanFt": mean,
        "groundElevationFt": mean,
        "groundElevationSampleCount": count,
        "elevationCoverage": "SAMPLED",
        "groundElevationProvenanceStatus": "LOCAL_SHA256_PINNED_NOT_INDEPENDENTLY_CERTIFIED",
        "groundElevationRegulatoryCertified": False,
    }
