"""TSM Data Catalog — wires the 11 GB offline bundle to the API.

The bundle lives at OFFLINE_DATA_ROOT (env var, defaults to
~/workspace/offline-data). This module provides a read-only catalog
of counties, datasets, and file paths. It never modifies the bundle.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

# Eight tri-state counties
COUNTIES: dict[str, dict[str, str]] = {
    "18051": {"state": "IN", "name": "gibson", "label": "Gibson County, IN"},
    "18129": {"state": "IN", "name": "posey", "label": "Posey County, IN"},
    "18163": {"state": "IN", "name": "vanderburgh", "label": "Vanderburgh County, IN"},
    "18173": {"state": "IN", "name": "warrick", "label": "Warrick County, IN"},
    "17059": {"state": "IL", "name": "gallatin", "label": "Gallatin County, IL"},
    "17193": {"state": "IL", "name": "white", "label": "White County, IL"},
    "21101": {"state": "KY", "name": "henderson", "label": "Henderson County, KY"},
    "21225": {"state": "KY", "name": "union", "label": "Union County, KY"},
}

# Directory name mapping: fips -> bundle directory
def _bundle_dir(fips: str) -> str:
    info = COUNTIES[fips]
    return f"{info['state'].lower()}-{info['name']}-{fips}"


def offline_root() -> Path:
    root = os.environ.get("OFFLINE_DATA_ROOT", "")
    if root:
        return Path(root)
    return Path.home() / "workspace" / "offline-data"


def county_dir(fips: str) -> Path:
    return offline_root() / _bundle_dir(fips)


def list_counties() -> list[dict[str, Any]]:
    """List all 8 counties with their data availability."""
    result = []
    for fips, info in COUNTIES.items():
        cdir = county_dir(fips)
        datasets: dict[str, bool] = {}
        for ds in ("parcels", "floodplain", "imagery", "elevation", "tiger", "hydrology"):
            dpath = cdir / ds
            datasets[ds] = dpath.is_dir() and any(dpath.iterdir())
        result.append({
            "fips": fips,
            "state": info["state"],
            "name": info["name"],
            "label": info["label"],
            "available": cdir.is_dir(),
            "datasets": datasets,
        })
    return result


def county_detail(fips: str) -> dict[str, Any] | None:
    """Detailed file listing for a county."""
    if fips not in COUNTIES:
        return None
    cdir = county_dir(fips)
    if not cdir.is_dir():
        return None
    info = COUNTIES[fips]
    files: dict[str, list[dict[str, Any]]] = {}
    for ds in ("parcels", "floodplain", "imagery", "elevation", "tiger", "hydrology"):
        dpath = cdir / ds
        entries = []
        if dpath.is_dir():
            for fp in sorted(dpath.rglob("*")):
                if fp.is_file() and fp.suffix in (".geojson", ".json", ".tif", ".zip", ".md"):
                    try:
                        size = fp.stat().st_size
                    except OSError:
                        size = -1
                    entries.append({
                        "path": str(fp.relative_to(cdir)),
                        "name": fp.name,
                        "bytes": size,
                    })
        files[ds] = entries
    # Provenance and MISSING docs
    docs = []
    for doc in ("PROVENANCE.md", "MISSING.md"):
        for fp in cdir.rglob(doc):
            docs.append(str(fp.relative_to(cdir)))
    return {
        "fips": fips,
        "label": info["label"],
        "datasets": files,
        "docs": sorted(docs),
    }


def find_dataset_file(fips: str, dataset: str, suffix: str = ".geojson") -> Path | None:
    """Find the primary data file for a county dataset."""
    if fips not in COUNTIES:
        return None
    dpath = county_dir(fips) / dataset
    if not dpath.is_dir():
        return None
    candidates = sorted(dpath.glob(f"*{suffix}"))
    # Prefer files with the FIPS in the name, skip tile indices
    for cand in candidates:
        if fips in cand.name and "index" not in cand.name.lower():
            return cand
    return candidates[0] if candidates else None


def read_geojson(path: Path, max_features: int = 0) -> dict[str, Any]:
    """Read a GeoJSON file, optionally limiting features."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if max_features > 0 and isinstance(data.get("features"), list):
        data = dict(data)
        data["features"] = data["features"][:max_features]
        data["_truncated"] = True
        data["_total_features"] = len(json.loads(path.read_text(encoding="utf-8")).get("features", []))
    return data


def regional_datasets() -> dict[str, list[dict[str, Any]]]:
    """List regional (multi-county) datasets."""
    rdir = offline_root() / "regional"
    result: dict[str, list[dict[str, Any]]] = {}
    if not rdir.is_dir():
        return result
    for sub in sorted(rdir.iterdir()):
        if not sub.is_dir():
            continue
        entries = []
        for fp in sorted(sub.rglob("*")):
            if fp.is_file() and fp.suffix in (".geojson", ".json", ".tif", ".zip", ".pdf", ".md"):
                try:
                    size = fp.stat().st_size
                except OSError:
                    size = -1
                entries.append({
                    "path": str(fp.relative_to(offline_root())),
                    "name": fp.name,
                    "bytes": size,
                })
        if entries:
            result[sub.name] = entries
    return result
