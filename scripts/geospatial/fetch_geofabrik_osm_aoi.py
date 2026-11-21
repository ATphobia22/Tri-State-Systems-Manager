"""Download dated Geofabrik PBFs and export a cross-border Mount Vernon AOI.

This command is intentionally run on a connected GIS workstation, NOT in UE
Shipping. Requires osmium-tool, Python stdlib; returns no engineering evidence.
OSM ODbL-1.0, (c) OpenStreetMap contributors.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path
from urllib.request import urlopen

BASE_URL = "https://download.geofabrik.de/north-america/us"
REGIONS = ("indiana", "kentucky", "illinois")


def stream_file(url, destination):
    if destination.exists():
        raise FileExistsError("Immutable snapshot already exists: " + str(destination))
    partial = destination.with_name(destination.name + ".partial")
    try:
        with urlopen(url, timeout=45) as reader, partial.open("xb") as target:
            shutil.copyfileobj(reader, target, length=1024 * 1024)
        partial.rename(destination)
    finally:
        partial.unlink(missing_ok=True)


def hash_file(path, algo):
    digest = hashlib.new(algo)
    with path.open("rb") as reader:
        for part in iter(lambda: reader.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def prepare(output_dir, *, snapshot, bounds, regions):
    if not re.fullmatch(r"\d{6}", snapshot):
        raise ValueError("Require a six-digit YYMMDD immutable snapshot")
    if not regions or any(r not in REGIONS for r in regions):
        raise ValueError("Choose nonempty states: indiana kentucky illinois")
    if not re.fullmatch(r"-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?", bounds):
        raise ValueError("Require bbox WEST,SOUTH,EAST,NORTH in WGS84")
    w, s, e, n = [float(v) for v in bounds.split(",")]
    if not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
        raise ValueError("Invalid WGS84 bounding box")
    if shutil.which("osmium") is None:
        raise RuntimeError("Install osmium-tool before executing")
    out = Path(output_dir).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)
    if (out / "source-manifest.json").exists():
        raise FileExistsError("Output manifest exists; choose a fresh snapshot folder")
    extracts = []
    records = []
    for state in regions:
        filename = f"{state}-{snapshot}.osm.pbf"
        remote = BASE_URL + "/" + filename
        pbf = out / filename
        md5file = out / (filename + ".md5")
        stream_file(remote, pbf)
        stream_file(remote + ".md5", md5file)
        text = md5file.read_text(encoding="utf-8").strip()
        expected = text.split()[0].lower()
        if not re.fullmatch(r"[a-f0-9]{32}", expected) or hash_file(pbf, "md5") != expected:
            raise RuntimeError("Geofabrik MD5 mismatch: " + filename)
        extracted = out / f"{state}-{snapshot}-mv-aoi.osm.pbf"
        subprocess.run(["osmium", "extract", f"--bbox={bounds}",
                        "--strategy=complete_ways", str(pbf), "--output", str(extracted)],
                       check=True)
        extracts.append(extracted)
        records.append({
            "state": state, "url": remote, "source_snapshot": snapshot,
            "geofabrik_md5": expected, "source_sha256": hash_file(pbf, "sha256"),
            "source_bytes": pbf.stat().st_size, "aoi_sha256": hash_file(extracted, "sha256"),
        })
    merged = out / f"mv-{snapshot}-multi-state.osm.pbf"
    exported = out / f"mv-{snapshot}-raw.geojson"
    subprocess.run(["osmium", "merge", *(str(f) for f in extracts), "--output", str(merged)], check=True)
    subprocess.run(["osmium", "export", "--attributes=type,id", "--format=geojson",
                    str(merged), "--output", str(exported)], check=True)
    manifest = {
        "dataset": "OpenStreetMap via Geofabrik",
        "license": "ODbL-1.0", "attribution": "(c) OpenStreetMap contributors",
        "validation": "BYTES_VERIFIED; OSM ATTRIBUTES CROWDSOURCED",
        "snapshot_date_code": snapshot, "aoi_bbox_epsg4326": [w, s, e, n],
        "state_downloads": records, "merged_sha256": hash_file(merged, "sha256"),
        "geojson_sha256": hash_file(exported, "sha256"),
        "geojson_path": exported.name,
        "unreal_vertical_datum": "UNVERIFIED",
    }
    (out / "source-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", required=True)
    p.add_argument("--snapshot", default="261117")
    p.add_argument("--bbox", required=True)
    p.add_argument("--states", nargs="+", choices=REGIONS, default=list(REGIONS))
    args = p.parse_args()
    print(json.dumps(prepare(args.output, snapshot=args.snapshot,
                             bounds=args.bbox, regions=args.states),
                     indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
