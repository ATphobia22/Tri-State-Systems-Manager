#!/usr/bin/env python3
"""Reprocess unresolved edge buildings using returns from adjacent IGIO COPC tiles."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path

import laspy
import numpy as np

from extract_derived_heights_copc import (
    TILE_FT,
    atomic_write_json,
    download_tile,
    extract_derived_height,
    footprint_tile_plan,
    grid_url,
    load_tile_arrays,
    sha256_file,
    verified_tile_bounds,
)

def window_points(arrays, grid, windows):
    """Select window returns owned by this half-open tile, excluding overlap duplicates."""
    xs, ys, zs, classes = arrays
    west, south = (index * TILE_FT for index in grid)
    owned = (
        (xs >= west) & (xs < west + TILE_FT) & (ys >= south) & (ys < south + TILE_FT)
        & np.isfinite(zs) & np.isin(classes, (1, 2, 5))
    )
    indices = np.flatnonzero(owned)
    x, y = xs[indices], ys[indices]
    inside = np.zeros(len(indices), dtype=bool)
    for wx0, wy0, wx1, wy1 in windows:
        inside |= (x >= wx0) & (x <= wx1) & (y >= wy0) & (y <= wy1)
    indices = indices[inside]
    return tuple(column[indices] for column in arrays)


def read_source(path, grid):
    verified_tile_bounds(path, grid)
    return load_tile_arrays(str(path))


def recover(features, tile_dir, *, keep_tiles=False):
    _, candidates, invalid = footprint_tile_plan(features)
    grids_to_buildings = defaultdict(list)
    counts = Counter()
    for index, (_polygons, _windows, grids) in candidates.items():
        for grid in grids:
            grids_to_buildings[grid].append(index)

    parts = defaultdict(list)
    verified = {}
    unavailable = []
    for grid in sorted(grids_to_buildings):
        url = grid_url(grid)
        path = tile_dir / url.rsplit('/', 1)[1]
        try:
            digest = download_tile(url, str(path))
            arrays = read_source(path, grid)
        except (OSError, ValueError, RuntimeError, laspy.errors.LaspyException):
            unavailable.append(url)
            path.unlink(missing_ok=True)
            continue
        verified[grid] = {'url': url, 'sha256': digest}
        for index in grids_to_buildings[grid]:
            parts[index].append(window_points(arrays, grid, candidates[index][1]))
        del arrays
        if not keep_tiles:
            path.unlink()

    for index, (polygons, _windows, grids) in candidates.items():
        properties = features[index]['properties']
        if not grids.issubset(verified):
            if properties.get('lidarHeightStatus') == 'adjacent-tile-window-required':
                properties['lidarHeightStatus'] = 'adjacent-tile-source-unavailable'
            counts['incomplete_tile_sources'] += 1
            continue
        arrays = tuple(np.concatenate(columns) for columns in zip(*parts.pop(index)))
        result = extract_derived_height('', polygons, arrays)
        if result.get('lidarHeightStatus') != 'OK':
            if properties.get('lidarHeightStatus') == 'adjacent-tile-window-required':
                properties.update(result)
            counts['still_unavailable'] += 1
            continue
        sources = [verified[grid] for grid in sorted(grids)]
        result['lidarSource'] = sources[0]['url']
        result['lidarSourceTiles'] = sources
        result['heightProvenanceMethod'] += '; adjacent tile windows combined'
        properties.update(result)
        counts['recovered'] += 1

    return {
        'candidateBuildings': len(candidates),
        'recoveredBuildings': counts['recovered'],
        'incompleteTileSourceBuildings': counts['incomplete_tile_sources'],
        'stillUnavailableBuildings': counts['still_unavailable'],
        'invalidGeometryBuildings': len(invalid),
        'tileCount': len(grids_to_buildings),
        'verifiedTileCount': len(verified),
        'unavailableTileUrls': unavailable,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--geojson', required=True, type=Path)
    parser.add_argument('--tile-dir', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--receipt', required=True, type=Path)
    parser.add_argument('--keep-tiles', action='store_true', help='Retain downloaded COPC tiles for follow-up analysis')
    args = parser.parse_args()
    if len({p.resolve() for p in (args.geojson, args.out, args.receipt)}) != 3:
        parser.error('input, output and receipt must be distinct files')
    with args.geojson.open(encoding='utf-8') as stream:
        data = json.load(stream)
    features = data['features']
    args.tile_dir.mkdir(parents=True, exist_ok=True)
    receipt = recover(features, args.tile_dir, keep_tiles=args.keep_tiles)
    atomic_write_json(str(args.out), data)
    atomic_write_json(str(args.receipt), {
        'inputSha256': sha256_file(args.geojson),
        'outputSha256': sha256_file(args.out),
        **receipt,
    })
    print(json.dumps(receipt, sort_keys=True))


if __name__ == '__main__':
    main()
