"""TSM-owned adapter: verified-byte scene receipt to isolated visual candidates.

No publication, survey claim, source mutation or terrain placement. Headless.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile

from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform

from citybuilder.cli import build

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read_local(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError("Missing or symlinked source: " + str(path))
    return path.read_bytes()

def reconstruct(scene_dir, output, *, estimate_missing=False):
    scene_dir, output = Path(scene_dir), Path(output)
    if output.exists() or output.is_symlink():
        raise ValueError("Candidate output already exists")
    if scene_dir.is_symlink():
        raise ValueError("Symlinked input root")
    source_raw = read_local(scene_dir/"scene.json")
    receipt_raw = read_local(scene_dir/"scene.receipt.json")
    receipt = json.loads(receipt_raw)
    if (receipt.get("schema") != "tsm.mount-vernon-city-receipt.v1"
            or receipt.get("scene_path") != "./scene.json"
            or receipt.get("sha256") != sha(source_raw)
            or receipt.get("byte_length") != len(source_raw)
            or receipt.get("regulatory_approval") is not False):
        raise ValueError("TSM source receipt integrity mismatch")
    scene = json.loads(source_raw)
    if scene.get("schema") != "tsm.mount-vernon-city-scene.v1" or scene.get("crs") != "EPSG:4326":
        raise ValueError("Unsupported TSM scene schema or CRS")
    source = scene["sources"]["buildings"]
    if source.get("output_crs") != "EPSG:4326" or not isinstance(source.get("layer_url"), str) or not source["layer_url"]:
        raise ValueError("Missing building source metadata")
    fc = scene["buildings"]
    features = fc["features"]
    if (fc.get("type") != "FeatureCollection" or not isinstance(features, list) or not features
            or len(features) != receipt["feature_counts"]["buildings"]
            or len(features) != source["source_object_count"]
            or len(scene["roads"]["features"]) != receipt["feature_counts"]["roads"]):
        raise ValueError("TSM source counts mismatch")
    projector = Transformer.from_crs("EPSG:4326", "EPSG:26916", always_xy=True)
    projected, ids = [], set()
    for feature in features:
        props = feature["properties"]
        sid = feature["id"]
        if (not isinstance(sid, str) or not sid or sid in ids or props.get("tsm_id") != sid
                or not re.fullmatch(r"[0-9a-f]{64}", str(props.get("source_feature_sha256", "")))):
            raise ValueError("Missing or duplicate TSM source identity")
        ids.add(sid)
        geom = shape(feature["geometry"])
        if geom.is_empty or not geom.is_valid or geom.geom_type not in ("Polygon", "MultiPolygon"):
            raise ValueError("Invalid source footprint")
        west, south, east, north = geom.bounds
        if not (-90 <= west <= east <= -84 and 0 <= south <= north <= 84):
            raise ValueError("Footprint outside northern UTM zone 16")
        projected.append({"type": "Feature", "id": sid, "geometry": mapping(transform(projector.transform, geom)),
                          "properties": {"source_id": sid, "source_feature_sha256": props["source_feature_sha256"]}})
    # This particular government scene is planimetric. Do not trust any height
    # or ground fields supplied without independent evidence; strict mode rejects them.
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".tsm-city-candidate-", dir=output.parent))
    try:
        inp = stage/"projected-footprints.geojson"
        inp.write_text(json.dumps({"type":"FeatureCollection","features":projected}), encoding="utf-8")
        manifest = build(inp, stage, "EPSG:26916", "m", "UNVERIFIED_VISUAL", "m",
                         source_url=source["layer_url"], estimate_missing=estimate_missing)
        files = {name: sha((stage/name).read_bytes()) for name in manifest["output_hashes"]}
        if files != manifest["output_hashes"]:
            raise ValueError("Candidate output integrity mismatch")
        files.update({name: sha((stage/name).read_bytes()) for name in ("manifest.json", inp.name)})
        report = {"schema":"tsm.reconstruction-candidate.v1", "status":"VISUAL_CANDIDATE_ONLY",
                  "input_scene_sha256":sha(source_raw), "input_receipt_sha256":sha(receipt_raw),
                  "source_url":source["layer_url"], "source_ids":sorted(ids),
                  "features_built":manifest["features_built"], "estimate_count":manifest["estimate_count"],
                  "output_sha256":files, "terrain_alignment":"NOT_VALIDATED",
                  "engineering_eligible":False, "publication_eligible":False,
                  "required_review":["license and source review", "height evidence", "terrain/geoid alignment", "mesh and 3D Tiles validation", "human approval"]}
        (stage/"tsm-reconstruction-receipt.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
        # Never overwrite an existing nonempty directory or file.
        if output.exists() or output.is_symlink():
            raise ValueError("Candidate output already exists")
        stage.rename(output)
        return report
    finally:
        if stage.exists():
            shutil.rmtree(stage)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--estimate-missing", action="store_true", help="Explicitly permit visual-only estimates")
    args = parser.parse_args()
    print(json.dumps(reconstruct(args.scene_dir, args.output, estimate_missing=args.estimate_missing), indent=2))

if __name__ == "__main__":
    main()
