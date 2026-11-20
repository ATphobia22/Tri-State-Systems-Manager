#!/usr/bin/env python3
"""
openMVG-to-MicMac Orientation & Calibration Adapter (TSM Photogrammetry Enclave)

Converts an openMVG `sfm_data.json` bundle-adjustment output into MicMac
`OrientationConique` XML files (`Ori-<name>/Orientation-<image>.xml`) and
`AutoCal_Foc-<focal>_Cam-<id>.xml` internal calibration files, plus a
fail-closed SHA-256 provenance manifest for Tri-State Systems Manager (TSM).

Intended to run inside the isolated `.cache/tsm-third-party/` worker enclave
behind TSM's machine-readable evidence contract.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from xml.dom import minidom


SUPPORTED_PINHOLE_MODELS = {
    "pinhole",
    "pinhole_radial_k1",
    "pinhole_radial_k3",
}


@dataclass(frozen=True)
class CameraIntrinsics:
    intrinsic_id: str
    model: str
    width: int
    height: int
    focal_px: float
    cx_px: float
    cy_px: float
    k1_norm: float = 0.0
    k2_norm: float = 0.0
    k3_norm: float = 0.0
    p1_norm: float = 0.0
    p2_norm: float = 0.0

    def to_micmac_radial_coeffs(self) -> Tuple[float, float, float]:
        """
        Convert openMVG normalized-plane radial distortion coefficients (k1, k2, k3)
        to MicMac ModRad pixel-space coefficients:
            k_i_micmac = k_i_openmvg / (focal_px ** (2 * i))
        """
        f2 = self.focal_px * self.focal_px
        return (
            self.k1_norm / f2,
            self.k2_norm / (f2 * f2),
            self.k3_norm / (f2 * f2 * f2),
        )


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def transpose_3x3(mat: List[List[float]]) -> List[List[float]]:
    if len(mat) != 3 or any(len(row) != 3 for row in mat):
        raise ValueError(f"Expected 3x3 rotation matrix, got: {mat}")
    return [[mat[j][i] for j in range(3)] for i in range(3)]


def orthonormal_check(mat: List[List[float]], tol: float = 1e-4) -> None:
    """Fail-closed check that rotation matrix R satisfies R^T R = I and det(R) = +1."""
    if len(mat) != 3 or any(len(row) != 3 for row in mat):
        raise ValueError("Rotation matrix must be 3x3")
    if not all(math.isfinite(v) for row in mat for v in row):
        raise ValueError("Rotation matrix contains non-finite values")
    for i in range(3):
        for j in range(3):
            dot = sum(mat[k][i] * mat[k][j] for k in range(3))
            expected = 1.0 if i == j else 0.0
            if abs(dot - expected) > tol:
                raise ValueError(
                    f"Rotation matrix failed orthogonality check at ({i},{j}): {dot} != {expected}"
                )
    det = (
        mat[0][0] * (mat[1][1] * mat[2][2] - mat[1][2] * mat[2][1])
        - mat[0][1] * (mat[1][0] * mat[2][2] - mat[1][2] * mat[2][0])
        + mat[0][2] * (mat[1][0] * mat[2][1] - mat[1][1] * mat[2][0])
    )
    if abs(det - 1.0) > tol:
        raise ValueError(f"Rotation matrix determinant must be +1, got {det}")


def pretty_xml(elem: ET.Element) -> str:
    rough = ET.tostring(elem, encoding="utf-8")
    reparsed = minidom.parseString(rough)
    return reparsed.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8")


def parse_intrinsics(raw_intrinsics: List[Dict[str, Any]]) -> Dict[str, CameraIntrinsics]:
    parsed: Dict[str, CameraIntrinsics] = {}
    for entry in raw_intrinsics:
        key = str(entry["key"])
        if not key.isascii() or not key.isdecimal():
            raise ValueError(f"Unsafe intrinsic id {key!r}: expected numeric openMVG id")
        if key in parsed:
            raise ValueError(f"Duplicate intrinsic id {key}")
        val = entry["value"]
        poly = val.get("polymorphic_name", "")
        if poly not in SUPPORTED_PINHOLE_MODELS:
            raise ValueError(
                f"Unsupported openMVG intrinsic model '{poly}' for key={key}. "
                f"Supported: {sorted(SUPPORTED_PINHOLE_MODELS)}"
            )
        ptr = val["ptr_wrapper"]["data"]
        if int(ptr["width"]) <= 0 or int(ptr["height"]) <= 0:
            raise ValueError(f"Invalid image dimensions for intrinsic {key}")
        if float(ptr["focal_length"]) <= 0 or not math.isfinite(float(ptr["focal_length"])):
            raise ValueError(f"Invalid focal length for intrinsic {key}")
        disto = ptr.get("disto_k3") or ptr.get("disto_t2") or ptr.get("disto_k1") or []
        k1 = float(disto[0]) if len(disto) > 0 else 0.0
        k2 = float(disto[1]) if len(disto) > 1 else 0.0
        k3 = float(disto[2]) if len(disto) > 2 else 0.0
        p1 = float(disto[3]) if len(disto) > 3 else 0.0
        p2 = float(disto[4]) if len(disto) > 4 else 0.0

        pp = ptr["principal_point"]
        if len(pp) != 2 or not all(math.isfinite(float(x)) for x in pp + disto):
            raise ValueError(f"Non-finite or malformed intrinsic parameters for {key}")
        expected_coeffs = {"pinhole": 0, "pinhole_radial_k1": 1, "pinhole_radial_k3": 3}[poly]
        if len(disto) != expected_coeffs:
            raise ValueError(f"Invalid distortion coefficient count for {key}: expected {expected_coeffs}")
        parsed[key] = CameraIntrinsics(
            intrinsic_id=key,
            model=poly,
            width=int(ptr["width"]),
            height=int(ptr["height"]),
            focal_px=float(ptr["focal_length"]),
            cx_px=float(pp[0]),
            cy_px=float(pp[1]),
            k1_norm=k1,
            k2_norm=k2,
            k3_norm=k3,
            p1_norm=p1,
            p2_norm=p2,
        )
    return parsed


def build_calibration_xml(cam: CameraIntrinsics) -> ET.Element:
    root = ET.Element("ExportAPERO")
    cal = ET.SubElement(root, "CalibrationInternConique")
    ET.SubElement(cal, "KnownConv").text = "eConvApero_DistM2C"
    ET.SubElement(cal, "PP").text = f"{cam.cx_px:.8f} {cam.cy_px:.8f}"
    ET.SubElement(cal, "F").text = f"{cam.focal_px:.8f}"
    ET.SubElement(cal, "SzIm").text = f"{cam.width} {cam.height}"

    dist_wrapper = ET.SubElement(cal, "CalibDistortion")
    mod_rad = ET.SubElement(dist_wrapper, "ModRad")
    ET.SubElement(mod_rad, "CDist").text = f"{cam.cx_px:.8f} {cam.cy_px:.8f}"
    c1, c2, c3 = cam.to_micmac_radial_coeffs()
    for coeff in (c1, c2, c3):
        ET.SubElement(mod_rad, "CoeffDist").text = f"{coeff:.12e}"
    return root


def build_orientation_xml(
    cam: CameraIntrinsics,
    center_world: List[float],
    rot_world_to_cam: List[List[float]],
    autocal_rel_path: str,
) -> ET.Element:
    """
    Build MicMac `OrientationConique` XML.
    OpenMVG stores world-to-camera rotation R_w2c; MicMac CodageMatr stores
    camera-to-world rotation R_c2w = R_w2c^T in rows L1, L2, L3.
    """
    orthonormal_check(rot_world_to_cam)
    rot_c2w = transpose_3x3(rot_world_to_cam)

    root = ET.Element("ExportAPERO")
    ori = ET.SubElement(root, "OrientationConique")
    ET.SubElement(ori, "ConvOri").append(
        _text_elem("KnownConv", "eConvApero_DistM2C")
    )
    ET.SubElement(ori, "FileInterne").text = autocal_rel_path

    ext = ET.SubElement(ori, "Externe")
    ET.SubElement(ext, "Time").text = "0"
    ET.SubElement(ext, "KnownSize").text = "true"
    ET.SubElement(ext, "Centre").text = (
        f"{center_world[0]:.8f} {center_world[1]:.8f} {center_world[2]:.8f}"
    )
    ET.SubElement(ext, "IncCentre").text = "1 1 1"

    param_rot = ET.SubElement(ext, "ParamRotation")
    codage = ET.SubElement(param_rot, "CodageMatr")
    ET.SubElement(codage, "L1").text = " ".join(f"{v:.12f}" for v in rot_c2w[0])
    ET.SubElement(codage, "L2").text = " ".join(f"{v:.12f}" for v in rot_c2w[1])
    ET.SubElement(codage, "L3").text = " ".join(f"{v:.12f}" for v in rot_c2w[2])

    verif = ET.SubElement(ori, "Verif")
    ET.SubElement(verif, "Tol").text = "0.001"
    return root


def _text_elem(tag: str, text: str) -> ET.Element:
    el = ET.Element(tag)
    el.text = text
    return el


def convert_sfm_data(
    sfm_data_path: Path,
    out_ori_dir: Path,
    source_crs: str,
    vertical_datum: str,
) -> Dict[str, Any]:
    if not sfm_data_path.is_file():
        raise FileNotFoundError(f"sfm_data.json not found: {sfm_data_path}")

    with sfm_data_path.open("r", encoding="utf-8") as f:
        sfm = json.load(f)

    version = str(sfm.get("sfm_data_version", ""))
    if not version:
        raise ValueError("Missing sfm_data_version in sfm_data.json (fail-closed)")

    if not source_crs.strip() or not vertical_datum.strip():
        raise ValueError("Explicit source CRS and vertical datum are required")
    intrinsics_map = parse_intrinsics(sfm.get("intrinsics", []))
    extrinsics_map: Dict[str, Dict[str, Any]] = {
        str(e["key"]): e["value"] for e in sfm.get("extrinsics", [])
    }

    seen_names: set[str] = set()
    oriented = 0
    for view_entry in sfm.get("views", []):
        view = view_entry["value"]["ptr_wrapper"]["data"]
        filename = view["filename"]
        if (not isinstance(filename, str) or not filename or filename in (".", "..")
                or "/" in filename or "\\" in filename or Path(filename).name != filename):
            raise ValueError(f"Unsafe image filename: {filename!r}")
        if "\x00" in filename or "\n" in filename or "\r" in filename:
            raise ValueError(f"Unsafe image filename: {filename!r}")
        if filename.casefold() in seen_names:
            raise ValueError(f"Duplicate image filename: {filename!r}")
        seen_names.add(filename.casefold())
        pose = extrinsics_map.get(str(view["id_pose"]))
        if pose is None:
            continue
        if str(view["id_intrinsic"]) not in intrinsics_map:
            raise ValueError(f"View {filename!r} references missing intrinsic")
        orthonormal_check([[float(x) for x in row] for row in pose["rotation"]])
        center = [float(x) for x in pose["center"]]
        if len(center) != 3 or not all(math.isfinite(x) for x in center):
            raise ValueError(f"Invalid camera center for {filename!r}")
        oriented += 1
    if oriented == 0:
        raise ValueError("No oriented views; refusing to generate an empty MicMac orientation set")

    out_ori_dir.mkdir(parents=True, exist_ok=True)

    autocal_files: Dict[str, str] = {}
    for iid, cam in intrinsics_map.items():
        focal_tag = int(round(cam.focal_px))
        autocal_name = f"AutoCal_Foc-{focal_tag}_Cam-{iid}.xml"
        autocal_path = out_ori_dir / autocal_name
        autocal_path.write_text(pretty_xml(build_calibration_xml(cam)), encoding="utf-8")
        autocal_files[iid] = autocal_name

    converted_views: List[Dict[str, Any]] = []
    skipped_views: List[str] = []

    for view_entry in sfm.get("views", []):
        v = view_entry["value"]["ptr_wrapper"]["data"]
        filename = v["filename"]
        id_intrinsic = str(v["id_intrinsic"])
        id_pose = str(v["id_pose"])

        if id_pose not in extrinsics_map:
            skipped_views.append(filename)
            continue
        if id_intrinsic not in intrinsics_map:
            raise KeyError(
                f"View '{filename}' references missing intrinsic id '{id_intrinsic}'"
            )

        cam = intrinsics_map[id_intrinsic]
        ext = extrinsics_map[id_pose]
        ori_xml = build_orientation_xml(
            cam=cam,
            center_world=[float(c) for c in ext["center"]],
            rot_world_to_cam=[[float(x) for x in row] for row in ext["rotation"]],
            autocal_rel_path=f"{out_ori_dir.name}/{autocal_files[id_intrinsic]}",
        )
        ori_file = out_ori_dir / f"Orientation-{filename}.xml"
        ori_file.write_text(pretty_xml(ori_xml), encoding="utf-8")
        converted_views.append(
            {
                "filename": filename,
                "id_view": v["id_view"],
                "id_pose": id_pose,
                "id_intrinsic": id_intrinsic,
                "orientation_xml": ori_file.name,
                "sha256": sha256_file(ori_file),
            }
        )

    manifest = {
        "schema": "tsm-openmvg-micmac-ori-manifest-v1",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source_sfm_data": str(sfm_data_path),
        "source_sfm_data_sha256": sha256_file(sfm_data_path),
        "sfm_data_version": version,
        "geodesy": {
            "horizontal_crs": source_crs,
            "vertical_datum": vertical_datum,
            "evidence_class": "DERIVED",
        },
        "converted_count": len(converted_views),
        "skipped_unoriented_count": len(skipped_views),
        "skipped_views": skipped_views,
        "autocal_files": autocal_files,
        "autocal_sha256": {iid: sha256_file(out_ori_dir / name) for iid, name in autocal_files.items()},
        "micmac_runtime_validated": False,
        "geodetic_control_validated": False,
        "views": converted_views,
    }
    manifest_path = out_ori_dir / "ori_provenance_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert openMVG sfm_data.json to MicMac Ori XML directory."
    )
    parser.add_argument("--sfm-data", required=True, type=Path, help="Path to sfm_data.json")
    parser.add_argument(
        "--out-ori",
        required=True,
        type=Path,
        help="Output MicMac orientation directory (e.g., Ori-OpenMVG)",
    )
    parser.add_argument(
        "--source-crs",
        required=True,
        help="Explicit horizontal CRS of sfm_data poses (e.g., EPSG:4978 or EPSG:2966)",
    )
    parser.add_argument(
        "--vertical-datum",
        required=True,
        help="Explicit vertical datum of sfm_data poses (e.g., WGS84_ELLIPSOID or NAVD88_GEOID18)",
    )
    args = parser.parse_args()

    manifest = convert_sfm_data(
        sfm_data_path=args.sfm_data,
        out_ori_dir=args.out_ori,
        source_crs=args.source_crs,
        vertical_datum=args.vertical_datum,
    )
    print(
        json.dumps(
            {
                "status": "ok",
                "converted_count": manifest["converted_count"],
                "skipped_unoriented_count": manifest["skipped_unoriented_count"],
                "manifest": str(args.out_ori / "ori_provenance_manifest.json"),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())