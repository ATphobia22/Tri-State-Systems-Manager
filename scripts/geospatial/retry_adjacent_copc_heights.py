#!/usr/bin/env python3
"""Reprocess unresolved edge buildings using returns from adjacent IGIO COPC tiles."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
import math
from pathlib import Path

import laspy
import numpy as np

from extract_derived_heights_copc import (
    atomic_write_json,
    download_tile,
    extract_derived_height,
    get_footprint_polygons_spw,
    load_tile_arrays,
    sha256_file,
)

TILE_FT = 5000
GROUND_BUFFER_FT = 50.0  # Must match the primary COPC extraction window.
SOURCE_PREFIX = 'https://giselevationingov.s3.amazonaws.com/copc/statewide/2020/SPW/ql2/'
MAX_TILES_PER_BUILDING = 64


def search_windows(polygons):
    """Return one ground-search window per polygon exterior, including detached parts."""
    windows = []
    for exterior, *_holes in polygons:
        eastings, northings = zip(*exterior)
        windows.append((
            min(eastings) - GROUND_BUFFER_FT, min(northings) - GROUND_BUFFER_FT,
            max(eastings) + GROUND_BUFFER_FT, max(northings) + GROUND_BUFFER_FT,
        ))
    return windows


def intersecting_grids(windows):
    grids = set()
    for west, south, east, north in windows:
        x0, x1 = math.floor(west / TILE_FT), math.floor(east / TILE_FT)
        y0, y1 = math.floor(south / TILE_FT), math.floor(north / TILE_FT)
        if min(x0, y0) < 0 or max(x1, y1) > 1999:
            raise ValueError('projected footprint lies outside the source grid')
        if (x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES_PER_BUILDING:
            raise ValueError('projected footprint exceeds the bounded tile window')
        grids.update((e, n) for e in range(x0, x1 + 1) for n in range(y0, y1 + 1))
        if len(grids) > MAX_TILES_PER_BUILDING:
            raise ValueError('multipart footprint exceeds the bounded tile window')
    return grids


def grid_url(grid):
    easting, northing = grid
    return f'{SOURCE_PREFIX}IN2020_{easting * 5:04d}{northing * 5:04d}_12.copc.laz'


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
    with laspy.open(path) as source:
        crs = source.header.parse_crs()
        if crs is None:
            raise ValueError('COPC header has no source CRS')
        horizontal = crs.sub_crs_list[0] if crs.is_compound else crs
        if horizontal.is_bound:
            horizontal = horizontal.source_crs
        if horizontal.to_epsg() != 2968:
            raise ValueError('COPC header must use the Indiana West ftUS source CRS')
        vertical = crs.sub_crs_list[1] if crs.is_compound else None
        if vertical is None or vertical.to_epsg() != 6360:
            raise ValueError('COPC header must use NAVD88 US survey feet')
        west, south = (index * TILE_FT for index in grid)
        x_min, y_min = source.header.mins[:2]
        x_max, y_max = source.header.maxs[:2]
        if x_max < west or x_min >= west + TILE_FT or y_max < south or y_min >= south + TILE_FT:
            raise ValueError('COPC header does not intersect the named tile')
    return load_tile_arrays(str(path))


def recover(features, tile_dir, *, keep_tiles=False):
    candidates = {}
    grids_to_buildings = defaultdict(list)
    counts = Counter()
    for index, feature in enumerate(features):
        properties = feature['properties']
        if properties.get('lidarHeightStatus') == 'OK':
            continue
        try:
            polygons = get_footprint_polygons_spw(feature['geometry'])
            windows = search_windows(polygons)
            grids = intersecting_grids(windows)
        except (TypeError, ValueError, KeyError):
            counts['invalid_geometry'] += 1
            continue
        if len(grids) < 2:
            continue
        candidates[index] = (polygons, windows, grids)
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
        if not grids.issubset(verified):
            counts['incomplete_tile_sources'] += 1
            continue
        arrays = tuple(np.concatenate(columns) for columns in zip(*parts.pop(index)))
        result = extract_derived_height('', polygons, arrays)
        if result.get('lidarHeightStatus') != 'OK':
            counts['still_unavailable'] += 1
            continue
        sources = [verified[grid] for grid in sorted(grids)]
        result['lidarSource'] = sources[0]['url']
        result['lidarSourceTiles'] = sources
        result['heightProvenanceMethod'] += '; adjacent tile windows combined'
        features[index]['properties'].update(result)
        counts['recovered'] += 1

    return {
        'candidateBuildings': len(candidates),
        'recoveredBuildings': counts['recovered'],
        'incompleteTileSourceBuildings': counts['incomplete_tile_sources'],
        'stillUnavailableBuildings': counts['still_unavailable'],
        'invalidGeometryBuildings': counts['invalid_geometry'],
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
