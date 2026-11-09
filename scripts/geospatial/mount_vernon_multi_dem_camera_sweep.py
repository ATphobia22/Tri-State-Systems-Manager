#!/usr/bin/env python3
"""Repeatable *production Transvoxel transition-cell* DEM camera sweep.
Builds on the already source-hash-checked Mount Vernon pair adapter.
This does NOT establish whole-chunk watertightness, actual octree 2:1 balance,
real geometric-error calibration, GPU rendering or NAVD88 elevation accuracy.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import math
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("mv_pair_gate", HERE / "mount_vernon_dem_transvoxel_gate.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("production real-DEM gate module missing")
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)

def camera_sse(geometric_error_m: float, distance_m: float, viewport_px=1080, vertical_fov_deg=60):
    if not math.isfinite(geometric_error_m) or geometric_error_m <= 0:
        raise ValueError("positive measured geometric error required")
    if distance_m <= 0 or viewport_px <= 0:
        raise ValueError("camera parameters invalid")
    return geometric_error_m * viewport_px / (2.0 * distance_m * math.tan(math.radians(vertical_fov_deg / 2)))

def sweep(raster: Path, expected_hash: str, *, grid=4, window=128):
    if os.getenv("TSM_DEM_VERTICAL_UNIT") != "us-ft":
        raise RuntimeError("preview requires explicit TSM_DEM_VERTICAL_UNIT=us-ft")
    if grid < 2 or grid > 8 or window < 64 or window > 256:
        raise ValueError("invalid bounded sweep grid/window")
    import rasterio
    with rasterio.open(raster) as src:
        if str(src.crs) != "EPSG:2968":
            raise ValueError("unexpected source CRS")
        width, height = src.width, src.height
    if min(width,height) < window * 2:
        raise ValueError("insufficient DEM coverage")
    positions = []
    for row in range(grid):
        yy = int((height-window)*row/(grid-1))
        x_positions = list(range(grid)) if row % 2 == 0 else list(reversed(range(grid)))
        for col in x_positions:
            xx = int((width-window)*col/(grid-1))
            positions.append((xx, yy))
    reports=[]
    for frame, (wx, wy) in enumerate(positions):
        result=GATE.run(str(raster),expected_hash,wx,wy,window)
        reports.append({
            "frame":frame,
            "windowXY":[wx,wy],
            "transitionTriangles":result["transitionTriangleCount"],
            "caseMetadata":result["cases"],
            "sharedPlaneMatches":result["sharedPlaneMatches"],
            "meshingWallMilliseconds":result["meshingWallMilliseconds"],
            "actualSeamIntersectionsLeft":result["sharedPlaneIntersectionLeft"],
            "actualSeamIntersectionsRight":result["sharedPlaneIntersectionRight"],
            "renderedFrame":False,
            "screenSpaceErrorPixels":None,
            "reason":"No measured source geometric error or GPU projection"
        })
    return {
        "schema":"tsm.mount-vernon.dem-transvoxel-camera-sweep.v1",
        "source":raster.name,"sourceSHA256":expected_hash,
        "horizontalCRS":"EPSG:2968",
        "sourceVerticalDatum":"PENDING_EVIDENCE",
        "assumedPreviewVerticalUnits":"us-ft — NOT SOURCE VERIFIED",
        "cameraPath":"SERPENTINE_DEM_WINDOWS_NOT_GPU_CAMERA",
        "testedProductionMesher":"scripts/geospatial/transvoxel_transition_mesh.py",
        "productionBridge":"scripts/geospatial/mount_vernon_dem_transvoxel_gate.py",
        "frames":reports,
        "allTransitionPairsMatch":all(x["sharedPlaneMatches"] for x in reports),
        "full2to1ChunkStitching":"NOT_EVIDENCED",
        "headedGpuValidation":"NOT_EVIDENCED",
        "unrealWorldPartitionIntegration":"NOT_EVIDENCED",
        "regulatoryStatus":"NOT_A_REGULATORY_DETERMINATION"
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--raster",required=True,type=Path)
    p.add_argument("--sha256",required=True)
    p.add_argument("--output",required=True,type=Path)
    p.add_argument("--grid",type=int,default=4)
    p.add_argument("--window",type=int,default=128)
    p.add_argument("--preview-only",action="store_true")
    a=p.parse_args()
    if not a.preview_only:p.error("--preview-only acknowledgement required")
    if len(a.sha256)!=64 or any(c not in "0123456789abcdefABCDEF" for c in a.sha256):
        p.error("--sha256 requires a 64-character hex digest")
    result=sweep(a.raster,a.sha256,grid=a.grid,window=a.window)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"source":result["source"],"frames":len(result["frames"]),"allTransitionPairsMatch":result["allTransitionPairsMatch"]}))
    if not result["allTransitionPairsMatch"]:raise SystemExit(2)
if __name__=="__main__":main()
