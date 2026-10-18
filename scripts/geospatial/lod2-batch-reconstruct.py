#!/usr/bin/env python3
"""lod2-batch-reconstruct.py — scale LOD2 roof-mesh reconstruction to production.

Builds watertight LOD2 3D meshes for all 7,453 buildings with roofPlanes,
using the validated TU Delft 3DBAG plane-arrangement method from
lod2-proof-of-concept.py (29/30 built, 29/29 watertight on the PoC sample).

Input:  pipeline-run GeoJSON with `roofPlanes` in EPSG:3857 (NOT the console
        buildings-3d.json, which carries no roofPlanes).
        Default: /home/hatch/workspace/pipeline-run/posey-buildings-lod2-23082.geojson

Output: per-building GLB meshes + summary JSON with per-building status
        (ok / no-usable-planes / failed), watertight flag, triangle/vertex
        counts, volume, and timing.

Usage:
    python3 lod2-batch-reconstruct.py --limit 10            # smoke test
    python3 lod2-batch-reconstruct.py --limit 100 --outdir /tmp/lod2-batch
    python3 lod2-batch-reconstruct.py                      # full run (7,453)
    python3 lod2-batch-reconstruct.py --resume             # continue after interrupt

Resilience: per-building try/except (failures logged, never abort the batch);
--resume skips objectids already present in the summary file.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------- PoC import
# lod2-proof-of-concept.py has a hyphenated filename; load via importlib.
_POC_PATH = Path(__file__).resolve().parent / "lod2-proof-of-concept.py"
_SPEC = importlib.util.spec_from_file_location("lod2_poc", _POC_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_poc = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_poc)

process_one = _poc.process_one  # (feature, outdir) -> result dict
# --------------------------------------------------------------------------

DEFAULT_INPUT = ("/home/hatch/workspace/pipeline-run/"
                 "posey-buildings-lod2-23082.geojson")
DEFAULT_OUTDIR = "/tmp/lod2-batch"
DEFAULT_SUMMARY = "lod2-batch-summary.json"
PROGRESS_EVERY = 50


def load_lod2_features(path: str) -> list[dict]:
    """Load features that are LOD2 candidates (achievedLod==2 + roofPlanes)."""
    with open(path) as f:
        data = json.load(f)
    feats = data.get("features", [])
    lod2 = [ft for ft in feats
            if ft.get("properties", {}).get("achievedLod") == 2
            and ft.get("properties", {}).get("roofPlanes")]
    return lod2


def load_done_ids(summary_path: str) -> set:
    """Objectids already processed (for --resume)."""
    p = Path(summary_path)
    if not p.exists():
        return set()
    try:
        with open(p) as f:
            prev = json.load(f)
        records = prev.get("results", prev if isinstance(prev, list) else [])
        return {r.get("objectid") for r in records if r.get("objectid") is not None}
    except Exception as e:
        print(f"WARN: could not read resume summary {summary_path}: {e}",
              file=sys.stderr)
        return set()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", default=DEFAULT_INPUT,
                    help="GeoJSON with roofPlanes (pipeline-run file)")
    ap.add_argument("--outdir", default=DEFAULT_OUTDIR,
                    help="GLB output directory")
    ap.add_argument("--summary", default=None,
                    help="summary JSON path (default: <outdir>/lod2-batch-summary.json)")
    ap.add_argument("--limit", type=int, default=0,
                    help="process at most N buildings (0 = all)")
    ap.add_argument("--resume", action="store_true",
                    help="skip objectids already in the summary file")
    ap.add_argument("--progress-every", type=int, default=PROGRESS_EVERY)
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    summary_path = args.summary or os.path.join(args.outdir, DEFAULT_SUMMARY)

    print(f"input:   {args.input}", flush=True)
    feats = load_lod2_features(args.input)
    print(f"LOD2 candidates with roofPlanes: {len(feats)}", flush=True)

    done_ids: set = set()
    prior_results: list[dict] = []
    if args.resume:
        done_ids = load_done_ids(summary_path)
        if done_ids:
            # keep prior records so the final summary is cumulative
            with open(summary_path) as f:
                prev = json.load(f)
            prior_results = prev.get("results", [])
            print(f"resume: skipping {len(done_ids)} already-processed buildings",
                  flush=True)

    todo = [ft for ft in feats
            if ft["properties"].get("objectid") not in done_ids]
    if args.limit > 0:
        todo = todo[:args.limit]
    print(f"to process: {len(todo)}", flush=True)
    if not todo:
        print("nothing to do", flush=True)
        return 0

    results: list[dict] = list(prior_results)
    t0 = time.time()
    ok = wt = failed = noplanes = 0

    for i, ft in enumerate(todo):
        oid = ft["properties"].get("objectid")
        r = process_one(ft, args.outdir)
        r["batch_index"] = len(results)
        results.append(r)
        st = r["status"]
        if st == "ok":
            ok += 1
            if r.get("watertight"):
                wt += 1
        elif st == "no-usable-planes":
            noplanes += 1
        else:
            failed += 1

        n = i + 1
        if n % args.progress_every == 0 or n == len(todo):
            el = time.time() - t0
            rate = n / el if el > 0 else 0
            eta = (len(todo) - n) / rate if rate > 0 else 0
            print(f"  [{n}/{len(todo)}] ok={ok} watertight={wt} "
                  f"failed={failed} noplanes={noplanes} "
                  f"{rate:.1f}/s eta={eta/60:.1f}min", flush=True)
            # checkpoint the summary so --resume survives interrupts
            write_summary(summary_path, results, t0)

    write_summary(summary_path, results, t0)
    total_ok = sum(1 for r in results if r["status"] == "ok")
    total_wt = sum(1 for r in results
                   if r["status"] == "ok" and r.get("watertight"))
    print(f"\n==== BATCH DONE: {total_ok}/{len(results)} built, "
          f"{total_wt}/{total_ok} watertight", flush=True)
    print(f"summary: {summary_path}", flush=True)
    return 0 if total_ok else 1


def write_summary(path: str, results: list[dict], t0: float) -> None:
    ok = [r for r in results if r["status"] == "ok"]
    doc = {
        "generated_by": "lod2-batch-reconstruct.py",
        "method": "TU Delft 3DBAG plane-arrangement (lod2-proof-of-concept.py)",
        "roof_planes_crs": "EPSG:3857",
        "elapsed_s": round(time.time() - t0, 1),
        "total": len(results),
        "built": len(ok),
        "watertight": sum(1 for r in ok if r.get("watertight")),
        "failed": sum(1 for r in results if r["status"] == "failed"),
        "no_usable_planes": sum(1 for r in results
                                 if r["status"] == "no-usable-planes"),
        "results": results,
    }
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(doc, f, indent=1, default=str)
    os.replace(tmp, path)


if __name__ == "__main__":
    sys.exit(main())
