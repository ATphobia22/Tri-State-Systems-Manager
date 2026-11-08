#!/usr/bin/env python3
"""Offline field/office exchange. Source observations are never silently reduced."""
import argparse
import csv
import hashlib
import io
import json
import math
from collections import Counter
from pathlib import Path

UNITS = {'meter': 1.0, 'foot': 0.3048, 'USSurveyFoot': 1200 / 3937}
LIMIT = 64 * 1024 * 1024


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def number(value):
    value = float(value)
    if not math.isfinite(value):
        raise ValueError('nonfinite coordinate')
    return value


def text_input(path):
    if Path(path).stat().st_size > LIMIT:
        raise ValueError('text intake exceeds 64 MiB')
    return Path(path).read_text(encoding='utf-8-sig', errors='strict')


def envelope(path, unit, crs='UNVERIFIED', vertical='UNVERIFIED'):
    if unit not in UNITS:
        raise ValueError('explicit meter, foot or USSurveyFoot required')
    return {'format': 'tsm-survey-v1', 'sourceSha256': digest(path),
            'sourceName': Path(path).name, 'linearUnit': unit, 'axisOrder': 'E,N,Z',
            'horizontalCRS': crs, 'verticalDatum': vertical,
            'referenceStatus': 'OPERATOR_DECLARED_NOT_VERIFIED',
            'engineeringUse': False, 'regulatoryUse': False,
            'points': {}, 'surfaces': [], 'warnings': []}


def import_points(path, order, unit, crs='UNVERIFIED', vertical='UNVERIFIED'):
    if order not in ('PNEZD', 'PENZD'):
        raise ValueError('explicit PNEZD or PENZD order required')
    result = envelope(path, unit, crs, vertical)
    descriptions = {}
    for line, row in enumerate(csv.reader(io.StringIO(text_input(path)), strict=True), 1):
        if not row or all(not x.strip() for x in row):
            continue
        if len(row) != 5:
            raise ValueError(f'row {line}: expected five columns; quote descriptions containing commas')
        pid = row[0].strip()
        if not pid or pid in result['points']:
            raise ValueError(f'row {line}: empty or duplicate point ID')
        first, second, z = map(number, row[1:4])
        result['points'][pid] = [second, first, z] if order == 'PNEZD' else [first, second, z]
        descriptions[pid] = row[4]
    if not result['points']:
        raise ValueError('empty point file')
    result.update(descriptions=descriptions, sourceColumnOrder=order)
    return result


def export_points(document, path, order):
    if order not in ('PNEZD', 'PENZD') or document['axisOrder'] != 'E,N,Z':
        raise ValueError('unsupported axis order')
    with Path(path).open('x', newline='', encoding='utf-8') as out:
        writer = csv.writer(out)
        for pid, xyz in document['points'].items():
            e, n, z = map(number, xyz)
            writer.writerow([pid, n if order == 'PNEZD' else e,
                             e if order == 'PNEZD' else n, z,
                             document.get('descriptions', {}).get(pid, '')])


def import_rw5(path, unit, crs='UNVERIFIED', vertical='UNVERIFIED'):
    """Carlson dialect only. Retain all records; extract stored SP coordinates only."""
    result = envelope(path, unit, crs, vertical)
    result.update(dialect='Carlson-SurvCE-RW5', records=[], pointRecords=[], descriptions={})
    for line, raw in enumerate(text_input(path).splitlines(), 1):
        tokens = raw.split(',')
        kind = tokens[0].strip()
        record = {'line': line, 'type': kind, 'raw': raw, 'fields': tokens[1:],
                  'interpretation': 'PRESERVED_ONLY'}
        result['records'].append(record)
        if kind not in ('SP', 'MO'):
            continue
        fields = {}
        for token in tokens[1:]:
            key, value = token[:2], token[2:]
            if key in fields:
                raise ValueError(f'line {line}: duplicate field {key}')
            fields[key] = value
        if kind == 'MO':
            declared = fields.get('UN')
            if declared is not None and declared not in ('0', '1'):
                raise ValueError(f'line {line}: unsupported RW5 unit code')
            if (declared == '1' and unit != 'meter') or (declared == '0' and unit == 'meter'):
                raise ValueError(f'line {line}: operator units conflict with MO record')
            if declared == '0':
                result['warnings'].append('RW5 feet subtype is operator-declared; MO alone does not prove survey/international feet.')
            continue
        if not all(key in fields for key in ('PN', 'N ', 'E ', 'EL')):
            raise ValueError(f'line {line}: incomplete SP coordinate')
        pid = fields['PN'].strip()
        if not pid:
            raise ValueError(f'line {line}: empty SP point ID')
        xyz = [number(fields[key]) for key in ('E ', 'N ', 'EL')]
        result['pointRecords'].append({'id': pid, 'coordinates': xyz, 'line': line})
        # Repeated field IDs are normal evidence, but do not select a winner.
        if pid in result['points']:
            result['warnings'].append(f'Repeated SP point {pid}: excluded from unique points; see pointRecords.')
        result['points'][pid] = xyz
        result['descriptions'][pid] = fields.get('--', '')
        record['interpretation'] = 'STORED_COORDINATE_ONLY'
    counts = Counter(p['id'] for p in result['pointRecords'])
    for pid, count in counts.items():
        if count > 1:
            result['points'].pop(pid, None)
            result['descriptions'].pop(pid, None)
    result['observationReduction'] = 'NOT_PERFORMED'
    return result


def import_dxf(path, unit, crs='UNVERIFIED', vertical='UNVERIFIED'):
    import ezdxf
    if Path(path).stat().st_size > LIMIT:
        raise ValueError('DXF exceeds 64 MiB intake limit')
    result = envelope(path, unit, crs, vertical)
    doc = ezdxf.readfile(path)
    insunits = int(doc.header.get('$INSUNITS', 0))
    expected = {'meter': 6, 'foot': 2, 'USSurveyFoot': 21}[unit]
    if insunits not in (0, expected):
        raise ValueError('DXF INSUNITS conflicts with declared unit or is unsupported')
    result.update(dxfVersion=doc.dxfversion, insunits=insunits, entities=[], unsupportedEntities={})
    for entity in doc.modelspace():
        kind = entity.dxftype()
        item = {'type': kind, 'handle': entity.dxf.handle, 'layer': entity.dxf.layer}
        if kind == 'POINT':
            item['coordinates'] = list(map(number, entity.dxf.location))
            result['points'][entity.dxf.handle] = item['coordinates']
        elif kind == 'LINE':
            item['vertices'] = [list(map(number, entity.dxf.start)), list(map(number, entity.dxf.end))]
        else:
            counts = result['unsupportedEntities']
            counts[kind] = counts.get(kind, 0) + 1
            continue
        result['entities'].append(item)
    if result['unsupportedEntities']:
        result['warnings'].append('Partial geometry: curves, polylines, blocks and other entities retained only in original DXF.')
    if insunits == 0:
        result['warnings'].append('Unitless DXF: units supplied by operator.')
    return result


def inventory_las(path):
    import laspy
    import numpy as np
    with laspy.open(path) as source:
        header = source.header
        crs = header.parse_crs()
        counts, total = Counter(), 0
        low, high = np.full(3, np.inf), np.full(3, -np.inf)
        for chunk in source.chunk_iterator(250000):
            xyz = np.column_stack((chunk.x, chunk.y, chunk.z))
            if not np.isfinite(xyz).all():
                raise ValueError('nonfinite LAS point')
            low = np.minimum(low, xyz.min(axis=0))
            high = np.maximum(high, xyz.max(axis=0))
            classes, sizes = np.unique(chunk.classification, return_counts=True)
            counts.update({str(int(k)): int(v) for k, v in zip(classes, sizes)})
            total += len(chunk)
        if total != header.point_count:
            raise ValueError('LAS header/decoded point count mismatch')
        return {'format': 'tsm-las-inventory-v1', 'sourceSha256': digest(path),
                'pointCount': total, 'lasVersion': str(header.version),
                'pointFormat': header.point_format.id, 'scales': header.scales.tolist(),
                'offsets': header.offsets.tolist(), 'classificationCounts': dict(counts),
                'bounds': [low.tolist(), high.tolist()] if total else None,
                'sourceCRSWkt': crs.to_wkt() if crs else None,
                'verticalDatum': 'UNVERIFIED', 'engineeringUse': False,
                'regulatoryUse': False, 'terrainOrBoundaryDerived': False}


def traverse_closure(data):
    """Horizontal coordinate increments in one declared unit; no automatic adjustment."""
    if data['linearUnit'] not in UNITS:
        raise ValueError('unsupported units')
    start = list(map(number, data['startEN']))
    end = list(map(number, data['endEN']))
    if len(start) != 2 or len(end) != 2 or not data['legs']:
        raise ValueError('start/end require E,N and at least one leg')
    de, dn, lengths = [], [], []
    for leg in data['legs']:
        angle, distance = number(leg['azimuthDegrees']), number(leg['horizontalDistance'])
        if not 0 <= angle < 360 or distance <= 0:
            raise ValueError('azimuth must be [0,360), horizontal distance positive')
        de.append(distance * math.sin(math.radians(angle)))
        dn.append(distance * math.cos(math.radians(angle)))
        lengths.append(distance)
    error = [math.fsum(de) - (end[0] - start[0]), math.fsum(dn) - (end[1] - start[1])]
    closure = math.hypot(*error)
    length = math.fsum(lengths)
    return {'linearUnit': data['linearUnit'], 'misclosureEN': error,
            'linearMisclosure': closure, 'traverseLength': length,
            'relativePrecisionDenominator': length / closure if closure else None,
            'adjustment': 'NOT_PERFORMED', 'acceptance': 'REVIEW_REQUIRED',
            'regulatoryUse': False}


def evidence_manifest(path):
    """References local records without asserting legal authenticity or public release."""
    data = json.loads(text_input(path))
    base = Path(path).resolve().parent
    evidence, ids = [], set()
    for entry in data['records']:
        if not entry['id'] or entry['id'] in ids:
            raise ValueError('duplicate/empty evidence ID')
        ids.add(entry['id'])
        relative = Path(entry['path'])
        target = (base / relative).resolve()
        if relative.is_absolute() or not target.is_relative_to(base) or not target.is_file():
            raise ValueError('evidence must be a local file inside manifest directory')
        actual = digest(target)
        if entry.get('expectedSha256') and entry['expectedSha256'].lower() != actual:
            raise ValueError('evidence checksum mismatch')
        evidence.append({'id': entry['id'], 'path': relative.as_posix(),
                         'role': entry['role'], 'sourceAuthority': entry.get('sourceAuthority'),
                         'recordReference': entry.get('recordReference'), 'sha256': actual,
                         'bytes': target.stat().st_size, 'authenticity': 'NOT_VERIFIED'})
    return {'format': 'tsm-survey-evidence-v1', 'inputSha256': digest(path),
            'records': evidence, 'professionalReview': 'NOT_RECORDED',
            'publication': 'NOT_AUTHORIZED_BY_INTAKE', 'regulatoryUse': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ('points', 'rw5', 'dxf', 'las', 'closure', 'evidence', 'export-points'):
        sub = commands.add_parser(name)
        sub.add_argument('input'); sub.add_argument('--output', required=True)
        if name in ('points', 'rw5', 'dxf'):
            sub.add_argument('--unit', choices=UNITS, required=True)
            sub.add_argument('--crs', default='UNVERIFIED')
            sub.add_argument('--vertical-datum', default='UNVERIFIED')
        if name in ('points', 'export-points'):
            sub.add_argument('--order', choices=('PNEZD', 'PENZD'), required=True)
    args = parser.parse_args()
    source, output = Path(args.input).resolve(), Path(args.output).resolve()
    if source == output or output.exists():
        raise ValueError('choose a new output path; source and existing outputs are immutable')
    before = digest(source)
    if args.command == 'export-points':
        export_points(json.loads(text_input(source)), output, args.order)
        return
    if args.command in ('points', 'rw5', 'dxf'):
        extras = {'order': args.order} if args.command == 'points' else {}
        result = {'points': import_points, 'rw5': import_rw5, 'dxf': import_dxf}[args.command](
            source, unit=args.unit, crs=args.crs, vertical=args.vertical_datum, **extras)
    elif args.command == 'las':
        result = inventory_las(source)
    elif args.command == 'closure':
        result = traverse_closure(json.loads(text_input(source)))
        result['sourceSha256'] = before
    else:
        result = evidence_manifest(source)
    if digest(source) != before:
        raise ValueError('source changed during intake')
    with output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(result, indent=2, allow_nan=False) + '\n')


if __name__ == '__main__':
    main()
