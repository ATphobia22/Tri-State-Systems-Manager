"""Independent, non-promoting audit of the pinned Mount Vernon Roofer review bundle.

This is not a database importer or evidence of survey accuracy. The current
class-1 experimental reconstruction is never publication/engineering eligible.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import tempfile

PINNED_SCENE = 'b279c71f1bf7fc3b455cfa23ad42bd26d764d38db2b17ff2393b698fc4b22205'
PINNED_TILES = {
    'IN2020_27150980_12.copc.laz': 'c591d9bb229fd3e9c38828c043a184e7568ba352fc91fe3d32313120ca8f36c6',
    'IN2020_27150975_12.copc.laz': '60d34afd30e297fe75b4261a0bf3814b10eccaf5cd6ae2a4af376c6a7be2f2e0',
}
METADATA = 'https://www.fisheries.noaa.gov/inport/item/69202'
CANDIDATE = 'LOD22_STRUCTURAL_REVIEW_CANDIDATE'
MAX_JSON = 64 * 1024 * 1024
MAX_FILE = 1024 * 1024 * 1024


class Blocked(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise Blocked(message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def safe_file(root, name):
    require(isinstance(name, str) and '\\' not in name and ':' not in name, 'Unsafe artifact name')
    parts = name.split('/')
    require(all(p not in ('', '.', '..') for p in parts), 'Unsafe artifact path')
    path = Path(root)
    require(path.is_dir() and not path.is_symlink(), 'Missing or unsafe artifact root')
    for part in parts:
        path /= part
        require(not path.is_symlink(), 'Symlinked artifact')
    require(path.is_file() and 0 < path.stat().st_size <= MAX_FILE, 'Missing, empty or oversized artifact')
    return path


def checked(root, name, expected):
    require(isinstance(expected, str) and re.fullmatch(r'[0-9a-f]{64}', expected), 'Invalid SHA-256')
    path = safe_file(root, name)
    require(digest(path) == expected, 'Artifact checksum mismatch: ' + name)
    return path


def unique_object(pairs):
    obj = {}
    for key, value in pairs:
        require(key not in obj, 'Duplicate JSON key')
        obj[key] = value
    return obj


def reject_constant(_):
    raise Blocked('Nonfinite JSON constant')


def decode(raw):
    require(len(raw) <= MAX_JSON, 'JSON size limit')
    return json.loads(raw, object_pairs_hook=unique_object, parse_constant=reject_constant)


def read_json(path):
    require(path.stat().st_size <= MAX_JSON, 'JSON size limit')
    return decode(path.read_bytes())


def review_only(obj):
    require(obj.get('engineering_eligible') is False and obj.get('publication_eligible') is False,
            'Unexpected eligibility flag in review evidence')


def crs_codes(value):
    from pyproj import CRS
    require(value is not None, 'Missing CRS')
    crs = CRS.from_user_input(value)
    h, v = crs.sub_crs_list[:2] if crs.is_compound else (crs, None)
    if h.is_bound:
        h = h.source_crs
    return h.to_epsg(), v.to_epsg() if v is not None else None


def check_las(path, receipt, expected):
    import laspy
    require(receipt.get('crs') == list(expected), 'Point cloud receipt CRS mismatch')
    with laspy.open(path) as source:
        require(crs_codes(source.header.parse_crs()) == expected, 'Point cloud header CRS mismatch')
        require(source.header.point_count > 0 and source.header.point_count == receipt.get('point_count'),
                'Point cloud count mismatch')


def check_rasters(root, rasters, metric_sha):
    import rasterio
    require(set(rasters) == {'dtm', 'dsm', 'ndsm'}, 'Unexpected raster inventory')
    lattice = None
    for name in ('dtm', 'dsm', 'ndsm'):
        receipt = rasters[name]
        path = checked(root, name + '.tif', receipt['sha256'])
        with rasterio.open(path) as ds:
            expected = (2793, None if name == 'ndsm' else 5703)
            require(crs_codes(ds.crs) == expected and ds.count == 1 and ds.units[0] == 'm', 'Raster CRS/unit mismatch')
            require(0 < ds.width * ds.height <= 4_000_000, 'Raster grid size limit')
            require(ds.scales[0] == 1 and ds.offsets[0] == 0, 'Unexpected raster scale or offset')
            tags = ds.tags()
            require(tags.get('TSM_POINT_SHA256') == metric_sha, 'Raster source identity mismatch')
            if name == 'ndsm':
                require(tags.get('TSM_Z_TYPE') == 'RELATIVE_ABOVE_GROUND', 'Relative height datum mismatch')
            else:
                require(tags.get('TSM_Z_DATUM') == 'NAVD88' and tags.get('TSM_Z_UNITS') == 'm', 'Raster vertical datum mismatch')
            grid = (ds.shape, ds.transform)
            require(lattice is None or grid == lattice, 'Raster lattice mismatch')
            lattice = grid
            count = int(ds.read(1, masked=True).count())
            require(count > 0 and count == receipt.get('valid_count'), 'Raster valid-pixel count mismatch')


def check_report(report, expected_ids):
    require(report.get('type') == 'val3dity_report' and report.get('val3dity_version') == '2.7.0', 'Unexpected validator report/version')
    require(report.get('validity') is True and report.get('all_errors') == [] and report.get('dataset_errors') == [], 'Geometry validation failed')
    features = report.get('features')
    require(isinstance(features, list) and len(features) == len(expected_ids), 'Validator feature count mismatch')
    require({f['id'] for f in features} == expected_ids and all(f.get('validity') is True and f.get('errors') == [] for f in features),
            'Validator feature identity or validity mismatch')
    solids = [p for p in report.get('primitives_overview', []) if p.get('type') == 'Solid']
    require(solids and all(type(p.get('total')) is int and p['total'] > 0 and p.get('valid') == p['total'] for p in solids)
            and sum(p['total'] for p in solids) >= len(expected_ids), 'No complete validated solid inventory')


def run_validator(binary, binary_sha, header, features):
    require(digest(binary) == binary_sha, 'Validator executable digest changed')
    with tempfile.TemporaryDirectory(prefix='tsm-review-') as directory:
        work = Path(directory)
        model = work / 'candidates.city.jsonl'
        report = work / 'report.json'
        with model.open('x', encoding='utf-8') as stream:
            for obj in [header, *features]:
                stream.write(json.dumps(obj, allow_nan=False) + '\n')
        subprocess.run([str(binary), str(model), '--report', str(report), '--overlap_tol', '0.0'],
                       cwd=work, check=True, timeout=180, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        result = read_json(safe_file(work, 'report.json'))
        require(result.get('parameters', {}).get('overlap_tol') == 0, 'Overlap validation was not enabled')
        check_report(result, {f['id'] for f in features})
        require(digest(binary) == binary_sha, 'Validator executable digest changed')


def _audit(source, build, binary, binary_sha):
    binary = Path(binary).resolve(strict=True)
    require(re.fullmatch(r'[0-9a-f]{64}', binary_sha) and digest(binary) == binary_sha, 'Validator executable digest mismatch')
    scene = read_json(checked(source, 'source/scene.json', PINNED_SCENE))
    inventory = {}
    for feature in scene['buildings']['features']:
        sid = feature['id']
        sha = feature['properties']['source_feature_sha256']
        require(isinstance(sid, str) and sid and sid not in inventory and re.fullmatch(r'[0-9a-f]{64}', sha), 'Invalid source feature identity')
        inventory[sid] = sha
    require(inventory, 'Empty source inventory')
    roof_path = safe_file(build, 'roof-review.json')
    roof_sha = digest(roof_path)
    roof = read_json(roof_path)
    review_only(roof)
    require(roof.get('schema') == 'tsm.roofer-source-linked-review.v1' and roof.get('scene_sha256') == PINNED_SCENE
            and roof.get('classification') == 'UNCLASSIFIED_CLASS_1_EXPERIMENTAL', 'Unexpected Roofer review contract')
    prep = read_json(checked(build, 'preprocessing-receipt.json', roof['preprocessing_receipt_sha256']))
    review_only(prep)
    require(prep.get('schema') == 'tsm.pdal-reconstruction-review.v1' and prep.get('point_class_1_is_unclassified') is True
            and prep.get('source_metadata_url') == METADATA, 'Unexpected preprocessing review contract')
    checked(build, 'source-metadata.html', prep['source_metadata_sha256'])
    require(set(prep['source_tiles']) == set(PINNED_TILES), 'Raw source inventory mismatch')
    for name, expected in PINNED_TILES.items():
        entry = prep['source_tiles'][name]
        require(entry.get('sha256') == expected, 'Unpinned raw source')
        check_las(checked(build, 'raw/' + name, expected), entry, (2968, 6360))
    metric = prep['metric_points']
    check_las(checked(build, 'metric.las', metric['sha256']), metric, (2793, 5703))
    checked(build, 'footprints.gpkg', prep['footprints_sha256'])
    check_rasters(build, prep['rasters'], metric['sha256'])
    records = {}
    for row in roof['records']:
        review_only(row)
        sid = row['tsm_id']
        require(sid in inventory and sid not in records and row['source_feature_sha256'] == inventory[sid]
                and type(row['roof_source_class']) is int and row['roof_source_class'] == 1, 'Review source identity mismatch')
        require(isinstance(row['status'], str) and row['status'], 'Missing review status')
        records[sid] = row['status']
    require(set(records) == set(inventory) and dict(Counter(records.values())) == roof['status_counts'], 'Incomplete or inconsistent review inventory')
    candidates = {sid for sid, status in records.items() if status == CANDIDATE}
    require(candidates, 'No structural review candidates')
    output = Path(build) / 'roofer-output'
    require(output.is_dir() and not output.is_symlink(), 'Missing or unsafe Roofer output')
    require(not any(p.is_symlink() for p in output.rglob('*')), 'Symlinked Roofer output')
    actual = {p.relative_to(output).as_posix() for p in output.rglob('*.city.jsonl')}
    require(actual and actual == set(roof['file_sha256']), 'CityJSONSeq file inventory mismatch')
    seen = set()
    for name in sorted(actual):
        path = checked(output, name, roof['file_sha256'][name])
        require(path.stat().st_size <= MAX_JSON, 'CityJSONSeq pilot file size limit')
        selected = []
        with path.open('rb') as stream:
            header = decode(stream.readline(MAX_JSON + 1))
            require(header.get('type') == 'CityJSON', 'Missing CityJSONSeq header')
            transform = header['transform']
            scale, translate = transform['scale'], transform['translate']
            require(len(scale) == len(translate) == 3 and all(type(v) in (int, float) and math.isfinite(v) for v in scale + translate)
                    and min(scale) > 0, 'Invalid CityJSON transform')
            for line in stream:
                feature = decode(line)
                sid = feature['id']
                require(feature.get('type') == 'CityJSONFeature' and sid in records and sid not in seen
                        and records[sid] != 'NO_RECONSTRUCTION', 'Unexpected or duplicate CityJSONFeature identity')
                seen.add(sid)
                if sid in candidates:
                    parent = feature['CityObjects'][sid]
                    require(parent.get('type') == 'Building' and any(g.get('type') == 'Solid' and str(g.get('lod')) == '2.2' for g in parent['geometry']), 'Missing LoD2.2 building solid')
                    selected.append(feature)
        require(digest(path) == roof['file_sha256'][name], 'CityJSONSeq changed during audit')
        if selected:
            run_validator(binary, binary_sha, header, selected)
    require(seen == {sid for sid, status in records.items() if status != 'NO_RECONSTRUCTION'}, 'CityJSONSeq record reconciliation mismatch')
    require(digest(roof_path) == roof_sha, 'Roof receipt changed during audit')
    return {'schema': 'tsm.reconstruction-independent-review.v1', 'roof_receipt_sha256': roof_sha,
            'scene_sha256': PINNED_SCENE, 'validator_sha256': binary_sha, 'inventory_count': len(inventory),
            'candidate_count': len(candidates), 'review_integrity_verified': True, 'candidate_geometry_validated': True,
            'engineering_eligible': False, 'publication_eligible': False, 'database_import_eligible': False,
            'production_blockers': ['EXPERIMENTAL_CLASS_1', 'SOURCE_LICENSE_REVIEW_REQUIRED',
                                    'INDEPENDENT_SURVEY_AND_REPRODUCIBILITY_REQUIRED', 'TEMPORAL_RECONCILIATION_REQUIRED',
                                    'CITYGML_DATABASE_ROUNDTRIP_REQUIRED', 'HUMAN_AUTHORITY_FINAL']}


def audit(source, build, binary, binary_sha):
    try:
        return _audit(source, build, binary, binary_sha)
    except Blocked:
        raise
    except Exception as exc:
        raise Blocked('Malformed or unavailable evidence/runtime: ' + type(exc).__name__) from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('build', type=Path)
    parser.add_argument('--val3dity', required=True, type=Path)
    parser.add_argument('--validator-sha256', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(audit(args.source, args.build, args.val3dity, args.validator_sha256), sort_keys=True))
    except Blocked as exc:
        print('BLOCKED: ' + str(exc), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
