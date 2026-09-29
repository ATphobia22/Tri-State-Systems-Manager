#!/usr/bin/env python3
"""OpenCV evidence-inspection adapter.

No computer-vision dependency is silently substituted. If OpenCV is absent,
the adapter fails closed so a missing capability cannot become fabricated
engineering evidence.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def main() -> int:
    request = json.load(sys.stdin)
    image_path = Path(request["imagePath"]).resolve()
    if not image_path.is_file():
        raise FileNotFoundError(str(image_path))
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV is required for vision.inspection") from exc

    image = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise RuntimeError("OpenCV could not decode the supplied image")

    digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
    height, width = image.shape[:2]
    channels = 1 if image.ndim == 2 else image.shape[2]
    result = {
        "schemaVersion": "TSM-EvidenceObject-1.0",
        "class": request.get("evidenceClass", "screening-estimate"),
        "sourceSha256": digest,
        "observed": {"widthPx": int(width), "heightPx": int(height), "channels": int(channels)},
        "authority": "observed-or-screening",
        "provenance": [str(image_path)],
    }
    json.dump(result, sys.stdout, sort_keys=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
