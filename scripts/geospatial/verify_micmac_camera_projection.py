#!/usr/bin/env python3
"""Check MicMac projection of the real openMVG viewer reference image set."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import subprocess
import tempfile

from openmvg_to_micmac_adapter import convert_sfm_data, parse_intrinsics, sha256_file


def project(point, pose, camera):
    delta = [coord - origin for coord, origin in zip(point, pose["center"])]
    x, y, depth = [sum(a * b for a, b in zip(row, delta)) for row in pose["rotation"]]
    if depth <= 0:
        raise ValueError("Observed point has nonpositive camera depth")
    x, y = x / depth, y / depth
    r2 = x*x + y*y
    scale = 1 + camera.k1_norm*r2 + camera.k2_norm*r2**2 + camera.k3_norm*r2**3
    return camera.cx_px + camera.focal_px*x*scale, camera.cy_px + camera.focal_px*y*scale


def verify(fixture: Path, binary: Path) -> dict:
    data = json.loads(fixture.read_text())
    poses = {str(pose["key"]): pose["value"] for pose in data["extrinsics"]}
    cameras = parse_intrinsics(data["intrinsics"])
    by_view = defaultdict(list)
    for landmark in data["structure"]:
        row = landmark["value"]
        for observation in row["observations"]:
            by_view[observation["key"]].append((row["X"], observation["value"]["x"]))

    deltas = []
    observed_residuals = []
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        output = root / "Ori-OpenMVG"
        receipt = convert_sfm_data(fixture, output, "LOCAL_SFM", "UNVERIFIED")
        if receipt["converted_count"] != len(data["views"]):
            raise ValueError("Reference fixture contains unconverted camera poses")
        # Invoke MicMac away from the generated orientation folder to exercise
        # calibration lookup after a change of working directory.
        elsewhere = root / "projection"
        elsewhere.mkdir()
        source = elsewhere / "xyz.txt"
        target = elsewhere / "pixels.txt"
        for view in receipt["views"]:
            samples = by_view[view["id_view"]]
            if not samples:
                raise ValueError("Reference view has no measured image correspondences")
            pose = poses[view["id_pose"]]
            camera = cameras[view["id_intrinsic"]]
            source.write_text("".join(" ".join(map(str, xyz)) + "\n" for xyz, _ in samples))
            target.unlink(missing_ok=True)
            subprocess.run(
                [str(binary), "XYZ2Im", str(output / view["orientation_xml"]),
                 str(source), str(target)],
                cwd=elsewhere, check=True, timeout=30,
            )
            actual = [tuple(map(float, line.split())) for line in target.read_text().splitlines()]
            if len(actual) != len(samples) or any(
                len(pixel) != 2 or not all(math.isfinite(v) for v in pixel) for pixel in actual
            ):
                raise ValueError("MicMac output does not cover the reference observations")
            for pixel, (point, observation) in zip(actual, samples):
                deltas.append(math.dist(pixel, project(point, pose, camera)))
                observed_residuals.append(math.dist(pixel, observation))

    if not deltas or max(deltas) > 0.0001:
        raise ValueError("MicMac and openMVG projections differ by more than 0.0001 px")
    return {
        "fixture_sha256": sha256_file(fixture),
        "micmac_binary_sha256": sha256_file(binary),
        "views": receipt["converted_count"],
        "projection_count": len(deltas),
        "max_projection_delta_px": max(deltas),
        "rms_residual_to_sample_observations_px": math.sqrt(
            sum(value**2 for value in observed_residuals) / len(observed_residuals)
        ),
        "geodetic_control_validated": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", type=Path, required=True)
    parser.add_argument("--micmac", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(verify(args.fixture.resolve(strict=True), args.micmac.resolve(strict=True)), indent=2))
