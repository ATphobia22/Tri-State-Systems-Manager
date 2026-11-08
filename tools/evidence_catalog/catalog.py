#!/usr/bin/env python3
"""Harvest bounded public metadata into an auditable catalog; never infer missing facts."""
import argparse
import datetime as dt
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

FIELDS = ('serviceId', 'layerId', 'geographicCoverage', 'acquisitionDate',
          'publicationDate', 'retrievalTime', 'crs', 'verticalDatum', 'units',
          'accessRequirements', 'checksum', 'verificationStatus')
HOSTS = {'gisdata.in.gov', 'hazards.fema.gov', 'www.arcgis.com', 'storms.ngs.noaa.gov',
         'lance.modaps.eosdis.nasa.gov', 'hls.gsfc.nasa.gov', 'api.waterdata.usgs.gov',
         'portal.igs.indiana.edu', 'msc.fema.gov'}
MAX_BYTES = 4 * 1024 * 1024


def utcnow():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def safe_url(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != 'https' or p.hostname not in HOSTS or p.username or p.password or p.port not in (None,443):
        raise ValueError('URL must use HTTPS on an approved public metadata host')
    return url


class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        safe_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fact(value=None, source=None):
    return {'value': value, 'status': 'UNKNOWN' if value is None else 'SOURCE_REPORTED', 'source': source}


def record(seed, raw=None, metadata=None, retrieved=None, error=None, final_url=None):
    url = seed['url']
    r = {'id': seed['id'], 'title': seed['title'], 'category': seed['category'],
         'sourceUrl': url, 'resolvedUrl': final_url, 'recordType': seed['type'],
         'fields': {k: fact() for k in FIELDS}, 'limitations': [
             'Metadata verification does not establish dataset completeness, accuracy, currency or regulatory acceptance.',
             'Checksums cover retrieved metadata bytes, not dataset assets.']}
    f = r['fields']
    for key in ('serviceId', 'layerId'):
        if seed.get(key) is not None:
            f[key] = {'value': seed[key], 'status': 'CONFIGURED', 'source': 'source-registry'}
    f['retrievalTime'] = {'value': retrieved or utcnow(), 'status': 'RECORDED', 'source': 'harvester-clock'}
    if raw is not None:
        f['checksum'] = {'value': {'algorithm': 'SHA-256', 'hex': hashlib.sha256(raw).hexdigest(),
                                  'scope': 'metadata-response', 'bytes': len(raw)},
                         'status': 'COMPUTED', 'source': 'retrieved-response-bytes'}
    if error:
        f['verificationStatus'] = {'value': 'FETCH_FAILED', 'status': 'RECORDED', 'source': 'harvester'}
        r['error'] = error
        return r
    f['accessRequirements'] = fact({'metadata': 'retrieved without credentials',
                                   'dataDownload': None, 'license': None}, url)
    if metadata is not None:
        if 'error' in metadata:
            f['verificationStatus'] = fact('SERVICE_ERROR', url)
            r['error'] = metadata['error']
            return r
        if seed['type'] == 'arcgis-layer' and ('id' not in metadata or metadata['id'] != seed['layerId']):
            f['verificationStatus'] = fact('IDENTITY_MISMATCH', url)
            return r
        if seed['type'] == 'arcgis-item' and metadata.get('id') != seed['serviceId']:
            f['verificationStatus'] = fact('IDENTITY_MISMATCH', url)
            return r
        if seed['type'] == 'arcgis-layer':
            f['layerId'] = fact(metadata['id'], url + '#id')
        extent = metadata.get('extent') or metadata.get('fullExtent')
        if extent:
            f['geographicCoverage'] = fact(extent, url + '#extent')
        sr = metadata.get('sourceSpatialReference') or metadata.get('spatialReference')
        if not sr and isinstance(extent,dict):
            sr = extent.get('spatialReference')
        if sr:
            f['crs'] = fact(sr, url + '#spatialReference')
            if sr.get('vcsWkid') or sr.get('latestVcsWkid'):
                f['verticalDatum'] = fact({'vcsWkid': sr.get('vcsWkid'), 'latestVcsWkid':sr.get('latestVcsWkid')}, url)
        if metadata.get('units'):
            f['units'] = fact({'horizontalServiceUnits':metadata['units'], 'verticalUnits':None}, url + '#units')
        r['sourceMetadata'] = {k: metadata[k] for k in ('name', 'title', 'type', 'description',
            'maxRecordCount', 'hasZ', 'capabilities', 'supportedQueryFormats', 'editingInfo',
            'created', 'modified', 'access', 'licenseInfo') if k in metadata}
        # ArcGIS created/modified/lastEditDate are NOT acquisition or publication dates.
        f['verificationStatus'] = fact('METADATA_PARSED', url)
    else:
        f['verificationStatus'] = fact('PAGE_RETRIEVED_NOT_INTERPRETED', url)
    return r


def validate(r):
    if set(r['fields']) != set(FIELDS):
        raise ValueError('catalog field set mismatch')
    for name, field in r['fields'].items():
        if not {'value','status','source'} <= field.keys():
            raise ValueError('incomplete fact: ' + name)
        if field['status'] == 'UNKNOWN' and field['value'] is not None:
            raise ValueError('unknown fact must have a null value')


def harvest(seeds, output):
    out = Path(output)
    out.mkdir(parents=True, exist_ok=False)
    opener = urllib.request.build_opener(Redirect())
    records = []
    ids = [s['id'] for s in seeds]
    if len(set(ids)) != len(ids):
        raise ValueError('duplicate registry ID')
    for index, seed in enumerate(seeds):
        raw, metadata, error, final = None, None, None, None
        try:
            request = urllib.request.Request(safe_url(seed['url']), headers={'User-Agent':'TSM-metadata-catalog/1.0'})
            with opener.open(request, timeout=20) as response:
                final = safe_url(response.geturl())
                raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raw = None
                raise ValueError('metadata response exceeds 4 MiB')
            if seed['type'].startswith('arcgis-'):
                metadata = json.loads(raw)
                if not isinstance(metadata,dict):
                    raise ValueError('expected metadata object')
        except (OSError, ValueError) as exc:
            error = {'type':type(exc).__name__, 'message':str(exc)}
        r = record(seed, raw, metadata, utcnow(), error, final)
        if raw is not None:
            filename = f'{index:03d}-metadata.bin'
            (out / filename).write_bytes(raw)
            r['responseFile'] = filename
        validate(r); records.append(r)
    catalog = {'schemaVersion':'1.0.0', 'generatedAt':utcnow(), 'records':records}
    (out / 'catalog.json').write_text(json.dumps(catalog,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    return catalog


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--sources',default=str(Path(__file__).with_name('sources.json')))
    p.add_argument('--output',required=True)
    a=p.parse_args()
    result=harvest(json.loads(Path(a.sources).read_text()),a.output)
    print(json.dumps({r['id']:r['fields']['verificationStatus']['value'] for r in result['records']},indent=2))
