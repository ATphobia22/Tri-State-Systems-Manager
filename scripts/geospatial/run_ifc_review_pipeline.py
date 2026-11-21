#!/usr/bin/env python3
"""Atomic offline GeoBIM evidence pipeline: source → IFC → GLB → review.

All nonvisual stages are headless. Geometry stays in the IFC local frame.
No source is fetched and no unreviewed IFC is overlaid on survey terrain.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

from scripts.geospatial.verify_geobim_ifc_intake import verify as verify_source
from scripts.geospatial.ifc_preflight import preflight
from scripts.geospatial.export_reviewed_ifc_glb import convert
from scripts.geospatial.build_ifc_review_package import (
    build, file_hash, read_json, compact_json,
)

SCHEMA = "tsm.geobim.offline-review-pipeline.v1"

def run(ifc: Path, metadata_path: Path, crosswalk: Path, asset_registry: Path,
        converter: Path, output_dir: Path, model_id: str, revision_id: str,
        *, controls: Path | None = None) -> dict:
    if output_dir.exists() or output_dir.is_symlink():
        raise ValueError("OUTPUT_EXISTS_REFUSING_OVERWRITE")
    parent = output_dir.parent
    if parent.is_symlink() or not parent.is_dir():
        raise ValueError("OUTPUT_PARENT_MUST_EXIST_AND_NOT_BE_SYMLINK")
    metadata = read_json(metadata_path)
    source = verify_source(ifc, metadata)
    if not source["sourceBytesVerified"]:
        raise ValueError("SOURCE_INTAKE_UNVERIFIED")
    sources = {
        "ifc": file_hash(ifc),
        "metadata": file_hash(metadata_path),
        "crosswalk": file_hash(crosswalk),
        "assetRegistry": file_hash(asset_registry),
    }
    if controls:
        sources["controls"] = file_hash(controls)
    stage = Path(tempfile.mkdtemp(prefix=".geobim-stage-", dir=str(parent)))
    try:
        receipt_path = stage / "ifc-intake-receipt.json"
        with receipt_path.open("xb") as fp:
            fp.write(compact_json(source))
        preflight_path = stage / "ifc-preflight.json"
        parsed = preflight(ifc, preflight_path, metadata["expectedSha256"].lower(),
                           metadata["horizontalCrs"], metadata["verticalDatum"])
        if parsed.get("engineeringUse") is not False or parsed.get("regulatoryUse") is not False:
            raise ValueError("PREFLIGHT_AUTHORITY_MUST_REMAIN_UNCERTIFIED")
        convert(ifc, preflight_path, crosswalk, asset_registry, converter, stage)
        review, feature_map, placement = build(
            ifc, metadata_path, preflight_path, stage / "ifc-model-asset-bridge.json",
            stage / "ifc-model.glb", stage, model_id, revision_id,
            control_path=controls)
        # Before publishing, recheck all inputs. No silent mid-run source changes.
        refreshed = {
            "ifc": file_hash(ifc),
            "metadata": file_hash(metadata_path),
            "crosswalk": file_hash(crosswalk),
            "assetRegistry": file_hash(asset_registry),
        }
        if controls:
            refreshed["controls"] = file_hash(controls)
        if refreshed != sources:
            raise ValueError("INPUT_CHANGED_DURING_PIPELINE")
        outputs = {}
        for name in (
            "ifc-intake-receipt.json", "ifc-preflight.json", "ifc-model.glb",
            "ifc-model-asset-bridge.json", "design-review.json",
            "ifc-feature-map.json", "ifc-placement-screen.json",
        ):
            file = stage / name
            if file.is_symlink() or not file.is_file():
                raise ValueError("MISSING_STAGED_OUTPUT: " + name)
            outputs[name] = file_hash(file)
        manifest = {
            "schema": SCHEMA,
            "modelId": model_id, "revisionId": revision_id,
            "status": "METADATA_READY_GEOMETRY_UNPLACED",
            "authority": "EVIDENCE_PACKAGE_NOT_SURVEY_CERTIFICATION",
            "inputHashes": sources, "outputHashes": outputs,
            "reviewElementCount": len(review["elements"]),
            "glbNodeGuidLinkCount": len(feature_map["bindings"]),
            "independentControlNumericsWithinDeclaredTolerance": placement["numericControlCheckPassed"],
            "controlAuthenticationVerified": False,
            "modelOverlayPermitted": False, "terrainClipPermitted": False,
            "meshFeatureMetadataEncodedIn3DTiles": False,
            "engineeringApproved": False, "regulatoryApproved": False,
            "nativeShippingVerified": False,
            "note": "All generated geometry is local. No survey authentication, 3D Tiles feature metadata, or public overlay is asserted.",
        }
        with (stage / "pipeline-run-manifest.json").open("xb") as fp:
            fp.write(compact_json(manifest))
        if output_dir.exists() or output_dir.is_symlink():
            raise ValueError("OUTPUT_EXISTS_DURING_STAGING")
        # Same-parent rename prevents publishing intermediate/partial data.
        os.rename(stage, output_dir)
        return manifest
    finally:
        shutil.rmtree(stage, ignore_errors=True)

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ("ifc", "metadata", "crosswalk", "asset-registry", "converter", "output"):
        parser.add_argument("--" + key, required=True, type=Path)
    for key in ("model-id", "revision-id"):
        parser.add_argument("--" + key, required=True)
    parser.add_argument("--controls", type=Path)
    args = parser.parse_args(argv)
    try:
        result = run(args.ifc, args.metadata, args.crosswalk, args.asset_registry,
                     args.converter, args.output, args.model_id, args.revision_id,
                     controls=args.controls)
    except (ValueError, OSError, RuntimeError, TypeError, KeyError) as exc:
        print(json.dumps({"status": "REJECTED", "reason": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps({"status": result["status"],
                      "release": str(args.output),
                      "modelOverlayPermitted": result["modelOverlayPermitted"],
                      "terrainClipPermitted": result["terrainClipPermitted"]}))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
