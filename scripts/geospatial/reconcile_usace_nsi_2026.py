#!/usr/bin/env python3
"""Compare USACE NSI (modeled points) against IGIO footprint polygons.

Only creates sidecar QA evidence. Never changes 3D Tiles, LiDAR heights,
NAVD88 elevations, geometry, regulatory gates, or authoritative source IDs.
All source files are local and the output has no coordinates or addresses.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.strtree import STRtree

FIPS = '18129'
FT_PER_M = 1 / 0.3048
SOURCE_SCHEMA = 'tsm.usace-nsi-igio-qa.v1'
MAX_SOURCE_BYTES = 256 * 1024 * 1024


class InputError(ValueError):
    pass


def read_collection(path: Path) -> tuple[list, str]:
    if not path.is_file() or path.is_symlink():
        raise InputError('Input must be a regular local file')
    if path.stat().st_size > MAX_SOURCE_BYTES:
        raise InputError('Input exceeds the 256 MiB bound')
    raw = path.read_bytes()
    if not raw or len(raw) > MAX_SOURCE_BYTES:
        raise InputError('Input is empty or oversized')
    try:
        data = json.loads(raw)
    except (UnicodeError, ValueError) as ex:
        raise InputError('Input is not valid GeoJSON') from ex
    if not isinstance(data, dict) or data.get('type') != 'FeatureCollection' or not isinstance(data.get('features'), list):
        raise InputError('Input must be a GeoJSON FeatureCollection')
    return data['features'], hashlib.sha256(raw).hexdigest()


def numeric(value) -> float | None:
    if type(value) not in (int, float):
        return None
    if not math.isfinite(value):
        return None
    return float(value)


def compare(igio: list, nsi: list, *, expected_count: int = 23082, tolerance_ft: float = 5.0) -> dict:
    if not isinstance(expected_count, int) or isinstance(expected_count, bool) or expected_count < 1:
        raise InputError('Invalid expected footprint count')
    if not math.isfinite(tolerance_ft) or tolerance_ft < 0:
        raise InputError('Invalid comparison tolerance')
    if len(igio) != expected_count:
        raise InputError('IGIO footprint count does not match requested inventory')
    ids: set[int] = set()
    valid_geoms, valid_ids, bad_ids = [], [], []
    igio_properties = {}
    for feature in igio:
        props = feature.get('properties') if isinstance(feature, dict) else None
        if not isinstance(props, dict):
            raise InputError('IGIO feature missing properties')
        oid = next((props[k] for k in ('igioObjectId', 'objectid', 'OBJECTID') if k in props), None)
        if type(oid) is not int or oid < 0 or oid in ids:
            raise InputError('Invalid/duplicate IGIO identity')
        ids.add(oid)
        igio_properties[oid] = props
        try:
            geom = shape(feature['geometry'])
        except (KeyError, TypeError, ValueError, AttributeError) as ex:
            raise InputError('Invalid IGIO geometry') from ex
        if geom.geom_type not in ('Polygon', 'MultiPolygon'):
            raise InputError('IGIO geometry must be polygons')
        if geom.is_empty or not geom.is_valid or geom.area <= 0:
            bad_ids.append(oid)
        else:
            valid_ids.append(oid)
            valid_geoms.append(geom)
    # Shapely STRtree returns zero-based indices. Do not use nearest-neighbor:
    # containment is required to avoid arbitrary cross-source identity matches.
    tree = STRtree(valid_geoms)
    candidate_matches: dict[int, list[dict]] = defaultdict(list)
    seen_nsi_ids: set[int] = set()
    unsupported = Counter()
    ambiguous_nsi_ids: list[int] = []
    unmatched_nsi = 0
    for feature in nsi:
        props = feature.get('properties') if isinstance(feature, dict) else None
        if not isinstance(props, dict):
            raise InputError('NSI record missing properties')
        fdid = props.get('fd_id')
        if type(fdid) is not int or fdid < 0 or fdid in seen_nsi_ids:
            raise InputError('Invalid/duplicate NSI fd_id')
        seen_nsi_ids.add(fdid)
        cbfips = str(props.get('cbfips', ''))
        if len(cbfips) != 15 or not cbfips.isascii() or not cbfips.isdecimal() or not cbfips.startswith(FIPS):
            unsupported['wrong_or_missing_cbfips'] += 1
            continue
        geom = feature.get('geometry') or {}
        if geom.get('type') != 'Point':
            unsupported['not_point'] += 1
            continue
        xy = geom.get('coordinates')
        if not isinstance(xy, list) or len(xy) < 2 or any(numeric(c) is None for c in xy[:2]):
            unsupported['invalid_coordinates'] += 1
            continue
        lon, lat = xy[:2]
        if not (-90 < lon < -84 and 36 < lat < 42):
            unsupported['outside_regional_coordinate_bounds'] += 1
            continue
        point = Point(lon, lat)
        hits = [int(index) for index in tree.query(point) if valid_geoms[int(index)].covers(point)]
        if len(hits) != 1:
            if len(hits) > 1:
                ambiguous_nsi_ids.append(fdid)
            else:
                unmatched_nsi += 1
            continue
        oid = valid_ids[hits[0]]
        candidate_matches[oid].append(props)
    matched_unique = {oid: entries[0] for oid, entries in candidate_matches.items() if len(entries) == 1}
    multiple_nsi_per_igio = sorted(oid for oid, entries in candidate_matches.items() if len(entries) > 1)
    compared = Counter()
    nsi_height_count, nsi_ground_count = 0, 0
    for oid, props in sorted(matched_unique.items()):
        ht = numeric(props.get('bldheight'))
        ground = numeric(props.get('ground_elv'))
        if ht is not None and ht > 0:
            nsi_height_count += 1
        if ground is not None:
            nsi_ground_count += 1
        ground_m = numeric(props.get('grnd_elv_m'))
        if ground is not None and ground_m is not None:
            compared['NSI_GROUND_UNITS_COMPARED'] += 1
            if abs(ground - ground_m * FT_PER_M) > tolerance_ft:
                compared['NSI_GROUND_UNITS_OUTSIDE_TOLERANCE'] += 1
        local = igio_properties[oid]
        local_height = numeric(local.get('lidarHeightFt'))
        provenance = local.get('heightProvenance')
        if ht is not None and ht > 0 and local_height is not None and local_height > 0 \
                and local.get('lidarHeightStatus') == 'OK' and provenance in ('OBSERVED', 'DERIVED'):
            label = 'NSI_VS_' + provenance + '_LIDAR_HEIGHT'
            compared[label + '_COMPARED'] += 1
            if abs(ht * FT_PER_M - local_height) > tolerance_ft:
                compared[label + '_OUTSIDE_TOLERANCE'] += 1
        local_ground = numeric(local.get('groundElevationFt'))
        if ground is not None and local_ground is not None:
            compared['NSI_VS_IGIO_GROUND_COMPARED'] += 1
            if abs(ground - local_ground) > tolerance_ft:
                compared['NSI_VS_IGIO_GROUND_OUTSIDE_TOLERANCE'] += 1
        # This intentionally creates no source-model mutation or release gate.
    statuses = Counter()
    for oid in ids:
        if oid in bad_ids:
            statuses['INVALID_IGIO_GEOMETRY'] += 1
        elif oid in multiple_nsi_per_igio:
            statuses['MULTIPLE_NSI_POINTS_INSIDE_FOOTPRINT'] += 1
        elif oid in matched_unique:
            statuses['UNIQUE_CONTAINMENT_CANDIDATE_ONLY'] += 1
        else:
            statuses['NO_UNAMBIGUOUS_NSI_MATCH'] += 1
    return {
        'schemaVersion': SOURCE_SCHEMA,
        'fips': FIPS,
        'classification': 'INFORMATIONAL_ONLY_MODELED_CROSS_SOURCE_QA',
        'geometryCrsAssumption': 'EPSG:4326_LONG_LAT_ASSUMED_NOT_INDEPENDENTLY_VERIFIED',
        'nsiDatasetVintageClaim': '2026_REFERENCED_NOT_ATTESTED_BY_INPUT',
        'sourceIdCrosswalkAuthoritative': False,
        'nsiMeasurementsPromotedToLidar': False,
        'engineeringUse': False, 'regulatoryUse': False,
        'countywide3DTilesAccepted': False,
        'igioExpectedFootprints': expected_count,
        'igioUniqueFootprints': len(ids),
        'nsiTotalPointRecords': len(nsi),
        'nsiUniquePointIds': len(seen_nsi_ids),
        'nsiUnmatchedPointRecords': unmatched_nsi,
        'nsiAmbiguousBetweenFootprints': len(ambiguous_nsi_ids),
        'nsiInputExclusions': dict(sorted(unsupported.items())),
        'igioStatusCounts': dict(sorted(statuses.items())),
        'invalidIgiosSourceObjectIds': sorted(bad_ids),
        'multipleNsiPointsIgiosSourceObjectIds': multiple_nsi_per_igio,
        'candidateNsisWithHeightMeters': nsi_height_count,
        'candidateNsisWithGroundFeetNavd88': nsi_ground_count,
        'comparisonToleranceFeet': tolerance_ft,
        'comparisonCounts': dict(sorted(compared.items())),
        'nextStep': 'Inspect ambiguous joins and metadata; compare heights to observed LiDAR; never substitute NSI modeled values in production acceptance.'
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--igio', type=Path, required=True)
    parser.add_argument('--nsi', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    parser.add_argument('--expected-count', type=int, default=23082)
    args = parser.parse_args(argv)
    try:
        locations = [p.resolve() for p in (args.igio, args.nsi, args.receipt)]
        if len(set(locations)) != 3 or args.receipt.exists():
            raise InputError('Refusing to overwrite an input or existing receipt')
        igio, igio_sha = read_collection(args.igio)
        nsi, nsi_sha = read_collection(args.nsi)
        receipt = compare(igio, nsi, expected_count=args.expected_count)
        receipt['igioSha256'] = igio_sha
        receipt['nsiSha256'] = nsi_sha
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps(receipt, sort_keys=True, indent=2) + '\n')
        print(json.dumps({'igioStatusCounts': receipt['igioStatusCounts'],
                          'nsiTotalPointRecords': receipt['nsiTotalPointRecords']}))
        # A missing/ambiguous cross-source join must never be mistaken for a
        # production 3D Tiles acceptance failure: exit 0 means QA ran, not
        # that building heights were accepted.
        return 0
    except (InputError, OSError) as exc:
        print('NSI cross-source QA could not complete: ' + type(exc).__name__)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
