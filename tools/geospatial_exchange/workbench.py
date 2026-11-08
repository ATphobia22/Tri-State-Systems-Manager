"""Offline interoperability workbench; network acquisition is an explicit separate step."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def write(path, data):
    with Path(path).open('x', encoding='utf-8') as f:
        json.dump(data, f, indent=2, allow_nan=False)
        f.write('\n')


def inventory(root):
    root = Path(root).resolve()
    formats = {'.parquet', '.geojson', '.gpkg', '.fgb', '.tif', '.tiff', '.las',
               '.laz', '.e57', '.ply', '.glb', '.gltf', '.obj', '.mp4', '.jpg', '.png', '.json'}
    files = []
    for p in sorted(root.rglob('*')):
        if p.is_symlink():
            raise ValueError('symlinks are not accepted in exchange bundles')
        if p.is_file() and p.suffix.lower() in formats:
            files.append({'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size,
                          'sha256': sha(p), 'format': p.suffix.lower(),
                          'crs': 'UNVERIFIED', 'verticalDatum': 'UNVERIFIED'})
    if not files:
        raise ValueError('no exchange assets found')
    return {'schema': 'tsm-exchange-v1', 'assets': files, 'runtimeNetworkRequired': False,
            'engineeringAcceptance': 'NOT_ESTABLISHED'}


def stac_plan(document):
    """Plan downloads from saved STAC responses without guessing asset URLs."""
    if document.get('type') != 'FeatureCollection':
        raise ValueError('STAC FeatureCollection required')
    assets = []
    for item in document['features']:
        for key, asset in item.get('assets', {}).items():
            href = asset['href']
            if '.parquet' in href.split('?')[0].lower() or 'parquet' in asset.get('type', '').lower():
                assets.append({'item': item['id'], 'collection': item.get('collection'),
                               'asset': key, 'href': href, 'properties': item.get('properties', {}),
                               'declaredChecksum': asset.get('file:checksum')})
    return {'schema': 'tsm-stac-download-plan-v1', 'assets': assets,
            'nextLinks': [x for x in document.get('links', []) if x.get('rel') == 'next'],
            'complete': not any(x.get('rel') == 'next' for x in document.get('links', [])),
            'downloaded': False}


def parquet_database(paths, output):
    """Keep source tables separate: no guessed USGS schema, units or datum conversions."""
    import duckdb
    paths = [Path(p).resolve() for p in paths]
    output = Path(output)
    if output.exists() or not paths:
        raise ValueError('new database path and at least one Parquet file required')
    before = [sha(p) for p in paths]
    con = duckdb.connect(str(output), config={'autoload_known_extensions': False,
                                            'autoinstall_known_extensions': False})
    try:
        con.execute('BEGIN')
        con.execute('CREATE TABLE source_manifest(table_name VARCHAR, filename VARCHAR, sha256 VARCHAR)')
        for i, p in enumerate(paths):
            name = f'source_{i}'
            con.read_parquet(str(p)).create(name)
            if sha(p) != before[i]:
                raise ValueError('source changed during import')
            con.execute('INSERT INTO source_manifest VALUES (?, ?, ?)', [name, p.name, before[i]])
        con.execute('COMMIT')
    except Exception:
        con.close()
        output.unlink(missing_ok=True)
        raise
    else:
        con.close()
    return {'databaseSha256': sha(output), 'sourceCount': len(paths),
            'unitConversion': 'NOT_PERFORMED', 'datumConversion': 'NOT_PERFORMED'}


def run_tool(executable, arguments, receipt):
    """Run an explicit local authoring executable, retaining logs and its hash."""
    executable = Path(executable).resolve(strict=True)
    receipt = Path(receipt)
    if receipt.exists():
        raise ValueError('receipt already exists')
    result = {'executableSha256': sha(executable), 'arguments': arguments,
              'acceptance': 'NOT_ESTABLISHED'}
    try:
        process = subprocess.run([str(executable), *arguments], capture_output=True,
                                 text=True, timeout=3600, check=False)
        result.update(exitCode=process.returncode, stdout=process.stdout, stderr=process.stderr)
    except subprocess.TimeoutExpired:
        result.update(exitCode=None, error='TIMEOUT')
    write(receipt, result)
    if result['exitCode'] != 0:
        raise RuntimeError('external tool failed; see receipt')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('inventory', 'stac-plan', 'parquet'):
        p = sub.add_parser(name)
        p.add_argument('input', nargs='+' if name == 'parquet' else None)
        p.add_argument('--output', required=True)
    p = sub.add_parser('run')
    p.add_argument('--executable', required=True); p.add_argument('--receipt', required=True)
    p.add_argument('arguments', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command == 'run':
        run_tool(args.executable, args.arguments[1:] if args.arguments[:1] == ['--'] else args.arguments, args.receipt)
    elif args.command == 'parquet':
        print(json.dumps(parquet_database(args.input, args.output)))
    else:
        output = Path(args.output).resolve()
        source = Path(args.input).resolve()
        if args.command == 'inventory' and output.is_relative_to(source):
            raise ValueError('inventory output must be outside the inventoried directory')
        data = inventory(source) if args.command == 'inventory' else stac_plan(json.loads(source.read_text()))
        write(output, data)


if __name__ == '__main__':
    main()
