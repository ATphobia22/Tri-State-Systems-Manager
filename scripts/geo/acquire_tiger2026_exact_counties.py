#!/usr/bin/env python3
"""Archive official Census 2026 TIGER county shapefile and extract nine target polygons.

Eight counties form the TSM engineering contract; Wabash IL is separate regional
scope. Preserve original nationwide ZIP and SHA256. Derived GeoJSON coordinates
are explicitly transformed from the native NAD83 geographic CRS to WGS84.
This is boundary source evidence, not a parcel/terrain/hydrologic certification.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import shutil
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = 'https://www2.census.gov/geo/tiger/TIGER2026/COUNTY/tl_2026_us_county.zip'
MAX_DOWNLOAD_BYTES = 140 * 1024 * 1024
MAX_UNPACKED_BYTES = 1_500_000_000
ENGINEERING_COUNTIES = {
    '18129': 'Posey, IN', '18163': 'Vanderburgh, IN',
    '18051': 'Gibson, IN', '18173': 'Warrick, IN',
    '17193': 'White, IL', '17059': 'Gallatin, IL',
    '21101': 'Henderson, KY', '21225': 'Union, KY',
}
EXTRA_COUNTIES = {'17185': 'Wabash, IL'}
EXPECTED_FILES = {f'tl_2026_us_county.{s}' for s in ('shp','shx','dbf','prj')}


def allow_source_url(url: str) -> bool:
    return url == SOURCE_URL


def download_source(url: str, target: Path) -> dict:
    if not allow_source_url(url):
        raise ValueError('SOURCE_URL_NOT_ALLOWLISTED')
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix='.tiger2026-', suffix='.part', dir=target.parent)
    os.close(fd)
    temporary = Path(temporary_name)
    count = 0
    sha = hashlib.sha256()
    try:
        request = urllib.request.Request(url,headers={'User-Agent':'TSM-Census-TIGER2026-Source-Archive/1.0'})
        with urllib.request.urlopen(request, timeout=120) as response:
            if response.geturl() != url:
                raise ValueError('CENSUS_SOURCE_REDIRECTED')
            declared = response.headers.get('Content-Length')
            if declared and int(declared) > MAX_DOWNLOAD_BYTES:
                raise ValueError('SOURCE_EXCEEDS_DOWNLOAD_BUDGET')
            etag = response.headers.get('ETag')
            modified = response.headers.get('Last-Modified')
            with temporary.open('wb') as output:
                while chunk := response.read(1024*1024):
                    count += len(chunk)
                    if count > MAX_DOWNLOAD_BYTES:
                        raise ValueError('SOURCE_EXCEEDS_DOWNLOAD_BUDGET')
                    sha.update(chunk)
                    output.write(chunk)
        if declared and count != int(declared):
            raise ValueError('SOURCE_CONTENT_LENGTH_MISMATCH')
        if count < 1:
            raise ValueError('SOURCE_EMPTY')
        with temporary.open('rb') as file:
            if file.read(4) != b'PK\x03\x04':
                raise ValueError('SOURCE_NOT_ZIP')
        os.replace(temporary,target)
    finally:
        temporary.unlink(missing_ok=True)
    return {'source_url':url,'source_bytes':count,'source_sha256':sha.hexdigest(),
            'source_etag':etag,'source_last_modified':modified}


def extract_target_counties(raw_zip: Path, work_dir: Path) -> dict:
    import shapefile
    from pyproj import CRS, Transformer
    from shapely.geometry import mapping, shape
    from shapely.ops import transform

    targets = {**ENGINEERING_COUNTIES, **EXTRA_COUNTIES}
    with zipfile.ZipFile(raw_zip) as archive:
        members = archive.infolist()
        total_uncompressed = 0
        files = set()
        for item in members:
            path = item.filename
            if (not path.startswith('tl_2026_us_county.') or '/' in path or '\\' in path
                    or '..' in path or item.is_dir()):
                raise ValueError('UNTRUSTED_ZIP_MEMBER')
            total_uncompressed += item.file_size
            if total_uncompressed > MAX_UNPACKED_BYTES:
                raise ValueError('ZIP_UNCOMPRESSED_SIZE_BUDGET')
            if path in files:
                raise ValueError('DUPLICATE_ZIP_MEMBER')
            files.add(path)
        if not EXPECTED_FILES <= files:
            raise ValueError('CENSUS_SHAPEFILE_MEMBER_MISSING')
        # Extract only validated required members into a private temporary folder.
        with tempfile.TemporaryDirectory(prefix='tsm-tiger2026-', dir=work_dir) as temporary:
            temporary = Path(temporary)
            for name in EXPECTED_FILES:
                with archive.open(name) as source, (temporary/name).open('wb') as output:
                    shutil.copyfileobj(source,output,1024*1024)
            crs = CRS.from_wkt((temporary/'tl_2026_us_county.prj').read_text())
            if crs.to_epsg() != 4269:
                raise ValueError('UNEXPECTED_CENSUS_SOURCE_CRS')
            transformer = Transformer.from_crs(crs,CRS.from_epsg(4326),always_xy=True)
            found = {}
            with shapefile.Reader(str(temporary/'tl_2026_us_county.shp')) as source:
                for sr in source.iterShapeRecords():
                    attrs = sr.record.as_dict()
                    fips = str(attrs.get('GEOID',''))
                    if fips not in targets:
                        continue
                    if fips in found or fips != str(attrs.get('STATEFP','')) + str(attrs.get('COUNTYFP','')):
                        raise ValueError('DUPLICATE_OR_INCONSISTENT_COUNTY_ID')
                    geometry_native = shape(sr.shape.__geo_interface__)
                    if geometry_native.is_empty or not geometry_native.is_valid:
                        raise ValueError('UNUSABLE_SOURCE_COUNTY_GEOMETRY')
                    geometry_wgs84 = transform(transformer.transform,geometry_native)
                    if geometry_wgs84.is_empty or not geometry_wgs84.is_valid:
                        raise ValueError('UNUSABLE_TRANSFORMED_COUNTY_GEOMETRY')
                    found[fips] = {'type':'Feature',
                                   'geometry':mapping(geometry_wgs84),
                                   'properties':{
                                       'GEOID':fips,'STATEFP':str(attrs['STATEFP']),
                                       'COUNTYFP':str(attrs['COUNTYFP']),
                                       'NAME':str(attrs.get('NAME','')),
                                       'scope':'additional-regional' if fips in EXTRA_COUNTIES else 'engineering-eight',
                                       'county_label':targets[fips],
                                       'source_year':2026,'source_crs_epsg':4269,'output_crs_epsg':4326,
                                       'geometry_valid':True}}
    missing = set(targets) - set(found)
    if missing:
        raise ValueError('MISSING_TARGET_COUNTIES:'+','.join(sorted(missing)))
    return {'features':[found[fips] for fips in targets], 'present_fips':list(found),
            'source_coordinate_reference_system':'NAD83 (EPSG:4269)',
            'output_coordinate_reference_system':'WGS84 (EPSG:4326)'}


def acquire(root: Path) -> dict:
    root.mkdir(parents=True, exist_ok=True)
    original = root/'tl_2026_us_county.zip'
    source = download_source(SOURCE_URL,original)
    result = extract_target_counties(original,root)
    derived_path = root/'tsm-2026-eight-plus-wabash-wgs84.geojson'
    collection = {'type':'FeatureCollection','features':result['features'],
                  'metadata':{'source_url':SOURCE_URL,
                    'native_crs':'EPSG:4269', 'output_crs':'EPSG:4326',
                    'coordinate_transform':'pyproj Transformer.from_crs always_xy',
                    'engineering_scope_fips':list(ENGINEERING_COUNTIES),
                    'separate_regional_scope_fips':list(EXTRA_COUNTIES)}}
    derived_path.write_text(json.dumps(collection,sort_keys=True,allow_nan=False)+'\n',encoding='utf-8')
    sha_derived = hashlib.sha256(derived_path.read_bytes()).hexdigest()
    receipt = {'schema':'tsm.census-tiger2026-exact-county-acquisition.v1',
        'retrieved_at_utc':datetime.now(timezone.utc).isoformat(),
        'publisher':'U.S. Census Bureau', 'source':source,
        'derived_geojson_file':derived_path.name,
        'derived_sha256':sha_derived,
        'engineering_counties':ENGINEERING_COUNTIES,
        'separate_regional_counties':EXTRA_COUNTIES,
        'exact_county_features_found':len(result['features']),
        'source_crs_epsg':4269,'derived_crs_epsg':4326,
        'engineering_or_regulatory_approved':False,
        'other_geospatial_layers_verified':False}
    (root/'acquisition-receipt.json').write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    (root/'SHA256SUMS.txt').write_text(f"{source['source_sha256']}  {original.name}\n{sha_derived}  {derived_path.name}\n")
    return receipt


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path('tiger2026-nine-county-boundaries'))
    args=parser.parse_args()
    report=acquire(args.output)
    print(json.dumps({'status':'SOURCE_ARCHIVED_AND_EXACT_GEOID_VALIDATED',
        'county_features':report['exact_county_features_found'],
        'source_sha256':report['source']['source_sha256']}))

if __name__ == '__main__':
    main()
