"""Offline tests for Census TIGER/Line 2026 national county source acquisition."""
import importlib.util
import io
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest
from pyproj import CRS
import shapefile

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/geo/acquire_tiger2026_exact_counties.py'
spec = importlib.util.spec_from_file_location('tiger2026', SCRIPT)
assert spec and spec.loader
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def synthetic_zip(counties):
    shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
    with shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=shapefile.POLYGON) as w:
        w.field('STATEFP', 'C', size=2)
        w.field('COUNTYFP', 'C', size=3)
        w.field('GEOID', 'C', size=5)
        w.field('NAME', 'C', size=50)
        for i, (geoid, name) in enumerate(counties.items()):
            x = -89 + (i % 3)*0.15
            y = 37 + (i//3)*0.15
            w.poly([[[x,y],[x,y+0.12],[x+0.12,y+0.12],[x+0.12,y],[x,y]]])
            w.record(geoid[:2],geoid[2:],geoid,name)
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for ext, buf in [('shp',shp),('shx',shx),('dbf',dbf)]:
            z.writestr(f'tl_2026_us_county.{ext}', buf.getvalue())
        z.writestr('tl_2026_us_county.prj', CRS.from_epsg(4269).to_wkt(version='WKT1_ESRI'))
    return archive.getvalue()


def test_2026_census_national_source_and_fips_scope():
    assert m.SOURCE_URL == 'https://www2.census.gov/geo/tiger/TIGER2026/COUNTY/tl_2026_us_county.zip'
    assert len(m.ENGINEERING_COUNTIES) == 8
    assert m.EXTRA_COUNTIES == {'17185':'Wabash, IL'}
    assert set(m.ENGINEERING_COUNTIES) == {'18129','18163','18051','18173','17193','17059','21101','21225'}


def test_zip_extracts_exact_county_polygons_with_wgs84_transform(tmp_path):
    counties = dict(m.ENGINEERING_COUNTIES)
    counties.update(m.EXTRA_COUNTIES)
    counties['06037'] = 'Los Angeles, CA'
    raw = tmp_path/'tl_2026_us_county.zip'
    raw.write_bytes(synthetic_zip(counties))
    results = m.extract_target_counties(raw, tmp_path)
    assert set(results['present_fips']) == set(m.ENGINEERING_COUNTIES) | set(m.EXTRA_COUNTIES)
    assert len(results['features']) == 9
    assert all(x['geometry']['type'] in ('Polygon','MultiPolygon') for x in results['features'])
    assert all(x['properties']['source_crs_epsg'] == 4269 for x in results['features'])
    assert all(x['properties']['output_crs_epsg'] == 4326 for x in results['features'])
    assert all(x['properties']['geometry_valid'] for x in results['features'])
    assert next(x for x in results['features'] if x['properties']['GEOID']=='17185')['properties']['scope'] == 'additional-regional'


def test_missing_county_rejected(tmp_path):
    zip_path = tmp_path/'tl_2026_us_county.zip'
    zip_path.write_bytes(synthetic_zip({'18129':'Posey, IN'}))
    with pytest.raises(ValueError, match='MISSING_TARGET_COUNTIES'):
        m.extract_target_counties(zip_path, tmp_path)


def test_zip_traversal_file_rejected(tmp_path):
    raw = tmp_path/'tl_2026_us_county.zip'
    original = synthetic_zip(dict(m.ENGINEERING_COUNTIES, **m.EXTRA_COUNTIES))
    with zipfile.ZipFile(io.BytesIO(original)) as src, zipfile.ZipFile(raw,'w') as dest:
        for name in src.namelist():
            dest.writestr(name,src.read(name))
        dest.writestr('../evil.txt',b'no')
    with pytest.raises(ValueError, match='UNTRUSTED_ZIP_MEMBER'):
        m.extract_target_counties(raw,tmp_path)


def test_source_url_host_and_path_are_fixed():
    assert m.allow_source_url(m.SOURCE_URL)
    assert not m.allow_source_url(m.SOURCE_URL.replace('www2.census.gov','evil.example'))
    assert not m.allow_source_url(m.SOURCE_URL+'?url=https://evil.example')
    assert not m.allow_source_url(m.SOURCE_URL.replace('https:','http:')


def test_download_rejects_oversized_response(tmp_path):
    class Response:
        headers = {'Content-Length': str(m.MAX_DOWNLOAD_BYTES+1)}
        def geturl(self): return m.SOURCE_URL
        def __enter__(self): return self
        def __exit__(self,*args): pass
    with patch.object(m.urllib.request,'urlopen',return_value=Response()):
        with pytest.raises(ValueError,match='BUDGET'):
            m.download_source(m.SOURCE_URL,tmp_path/'county.zip')
    assert not (tmp_path/'county.zip').exists()
