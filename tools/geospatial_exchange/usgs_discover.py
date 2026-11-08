"""Discover USGS Parquet assets. Save every STAC response; never infer observation values."""
import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path
from workbench import stac_plan, write

API = 'https://api.waterdata.usgs.gov/stac/v0/search'


def validate_url(url):
    u = urllib.parse.urlsplit(url)
    if u.scheme != 'https' or u.hostname != 'api.waterdata.usgs.gov' or u.port not in (None, 443) or u.username or u.password:
        raise ValueError('unexpected STAC host')
    return url


class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def discover(collection, station, interval, output, max_pages=100):
    if collection not in ('daily', 'continuous') or not station.isdigit() or max_pages < 1:
        raise ValueError('daily/continuous, numeric USGS station and positive page cap required')
    root = Path(output); root.mkdir(parents=True, exist_ok=False)
    params = {'collections': collection, 'filter': f"monitoring_location_id='USGS-{station}'",
              'datetime': interval, 'limit': 1000}
    url = API + '?' + urllib.parse.urlencode(params)
    opener = urllib.request.build_opener(Redirect())
    seen, assets = set(), []
    for index in range(max_pages):
        validate_url(url)
        if url in seen:
            raise ValueError('pagination cycle')
        seen.add(url)
        with opener.open(url, timeout=60) as response:
            raw = response.read(32 * 1024 * 1024 + 1)
        if len(raw) > 32 * 1024 * 1024:
            raise ValueError('STAC page exceeds 32 MiB')
        page = json.loads(raw)
        write(root / f'page-{index:04d}.json', page)
        plan = stac_plan(page)
        if any(a['collection'] != collection or a['properties'].get('monitoring_location_id') != f'USGS-{station}' for a in plan['assets']):
            raise ValueError('server returned a different collection or station; no complete plan emitted')
        assets.extend(plan['assets'])
        if not plan['nextLinks']:
            result = {'assets': assets, 'collection': collection, 'station': station,
                      'datetime': interval, 'complete': True, 'downloaded': False}
            write(root / 'download-plan.json', result)
            return result
        if len(plan['nextLinks']) != 1 or plan['nextLinks'][0].get('method', 'GET') != 'GET':
            raise ValueError('unsupported pagination; saved pages retained')
        url = urllib.parse.urljoin(url, plan['nextLinks'][0]['href'])
    raise ValueError('page cap reached; saved pages retained, no complete plan emitted')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--collection', choices=['continuous', 'daily'], required=True)
    p.add_argument('--station', required=True); p.add_argument('--datetime', required=True)
    p.add_argument('--output', required=True); p.add_argument('--max-pages', type=int, default=100)
    a = p.parse_args()
    discover(a.collection, a.station, a.datetime, a.output, a.max_pages)
