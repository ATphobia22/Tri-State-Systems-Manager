"""Download a complete discovery plan into a new local directory (100 MiB per asset)."""
import argparse
import json
import urllib.request
from pathlib import Path
from usgs_discover import Redirect, validate_url
from workbench import sha, write


def download(plan_path, output):
    plan = json.loads(Path(plan_path).read_text())
    if not plan.get('complete'):
        raise ValueError('complete discovery plan required')
    root = Path(output); root.mkdir(parents=True, exist_ok=False)
    opener = urllib.request.build_opener(Redirect())
    receipts = []
    for index, asset in enumerate(plan['assets']):
        url = validate_url(asset['href'])
        path = root / f'asset-{index:04d}.parquet'
        temporary = path.with_suffix('.partial')
        total = 0
        try:
            with opener.open(url, timeout=60) as response, temporary.open('xb') as out:
                while block := response.read(1048576):
                    total += len(block)
                    if total > 100 * 1024 * 1024:
                        raise ValueError('asset exceeds 100 MiB cap')
                    out.write(block)
            with temporary.open('rb') as f:
                if total < 8 or f.read(4) != b'PAR1':
                    raise ValueError('not a Parquet file')
                f.seek(-4, 2)
                if f.read(4) != b'PAR1':
                    raise ValueError('invalid Parquet footer')
            temporary.rename(path)
            receipts.append({'path': path.name, 'source': asset, 'sha256': sha(path), 'bytes': total})
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
    write(root / 'receipt.json', {'planSha256': sha(plan_path), 'assets': receipts,
                                 'complete': True, 'observationAcceptance': 'NOT_ESTABLISHED'})


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('plan'); p.add_argument('--output', required=True)
    a = p.parse_args(); download(a.plan, a.output)
