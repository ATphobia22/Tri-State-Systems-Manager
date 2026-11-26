"""Contract-first tests for autonomous, provenance-labelled *visual* city generation."""
import json
from pathlib import Path
import pytest
from citybuilder.cli import build
from citybuilder.auto import run_city_build, design_nerf_job, acquire_arcgis_layer

ROOT=Path(__file__).parents[1]
SAMPLE=ROOT/'examples'/'sample_footprints_32616.geojson'


def test_missing_building_height_is_estimated_and_auditable(tmp_path):
    data=json.loads(SAMPLE.read_text())
    p=data['features'][0]['properties']
    del p['height_m']; del p['ground_m']
    f=tmp_path/'no-heights.geojson'; f.write_text(json.dumps(data))
    m=build(f,tmp_path/'out','EPSG:32616','m','UNVERIFIED_VISUAL','m',estimate_missing=True)
    assert m['features_built']==2
    assert m['estimate_count']>=2
    obj=next(o for o in m['objects'] if o['source_id']==p['source_id'])
    assert obj['height_evidence'] in ('ESTIMATED_FROM_NEARBY', 'ESTIMATED_FROM_FOOTPRINT')
    assert obj['ground_evidence']=='ASSUMED_ZERO_VISUAL'
    ledger=json.loads((tmp_path/'out'/'estimate_ledger.json').read_text())
    assert any(x['source_id']==p['source_id'] and x['field']=='height_m' for x in ledger['estimates'])
    assert 'ground' in ledger['visual_alignment_warning'].lower()
    assert (tmp_path/'out'/'buildings.glb').read_bytes()[:4]==b'glTF'


def test_strict_build_retains_rejection_when_height_is_missing(tmp_path):
    data=json.loads(SAMPLE.read_text()); data['features'][0]['properties'].pop('height_m')
    file=tmp_path/'missing.geojson'; file.write_text(json.dumps(data))
    with pytest.raises(ValueError,match='invalid features'):
        build(file,tmp_path/'out','EPSG:32616','m','NAVD88','m')


def test_offline_city_build_requires_source_snapshot(tmp_path):
    cfg={'name':'Example','slug':'example','center':[0,0],'crs':'EPSG:32616','vertical_datum':'VISUAL_ONLY','source_registry':[]}
    profile=tmp_path/'city.json'; profile.write_text(json.dumps(cfg))
    with pytest.raises(ValueError,match='source snapshot'):
        run_city_build(profile,tmp_path/'output',offline=True)


def test_offline_city_build_produces_reviewable_world(tmp_path):
    profile=ROOT/'profiles'/'sample_city.json'
    result=run_city_build(profile,tmp_path/'city',offline=True,estimate_missing=True)
    assert result['status']=='BUILT_WITH_EVIDENCE_REVIEW'
    assert (tmp_path/'city'/'tileset.json').is_file()
    assert (tmp_path/'city'/'estimate_ledger.json').is_file()
    assert (tmp_path/'city'/'index.html').is_file()
    assert result['build_sha256']


def test_nerf_manifest_no_images_is_not_a_fake_reconstruction(tmp_path):
    job=design_nerf_job(tmp_path/'images',tmp_path/'splats')
    assert job['status']=='BLOCKED_INPUT_MISSING'
    assert job['executed'] is False
    assert not (tmp_path/'splats'/'splats.ply').exists()


def test_nerf_manifest_does_not_run_by_default(tmp_path):
    images=tmp_path/'images'; images.mkdir()
    for n in range(3): (images/f'photo-{n}.jpg').write_bytes(b'fake')
    job=design_nerf_job(images,tmp_path/'job')
    assert job['status']=='READY_FOR_CAPTURE_QA'
    assert job['executed'] is False
    assert all(isinstance(c,list) for c in job['suggested_commands'])


def test_arcgis_acquisition_paginates_reprojects_and_preserves_source_ids(tmp_path):
    # Geometry WGS84, bounding two small polygons in a city AOI.
    def fake_get(url, params):
        offset=int(params['resultOffset'])
        feature={'type':'Feature','properties':{'objectid':offset+1,'county':'Posey'},'geometry':{'type':'Polygon','coordinates':[[[-87.9,37.93],[-87.8999,37.93],[-87.8999,37.9301],[-87.9,37.9301],[-87.9,37.93]]]}}
        if offset>=2: return {'type':'FeatureCollection','features':[]}
        return {'type':'FeatureCollection','features':[feature]}
    doc=acquire_arcgis_layer('https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0',[-87.92,37.91,-87.88,37.96],tmp_path/'out.geojson','EPSG:32616',fetch_json=fake_get,page_size=1,max_records=3)
    assert doc['count']==2
    features=json.loads((tmp_path/'out.geojson').read_text())['features']
    assert features[0]['properties']['source_id'].startswith('arcgis:')
    assert features[0]['geometry']['coordinates'][0][0][0]>100000
    assert features[0]['properties']['source_url'].startswith('https://gisdata.in.gov/')


def test_arcgis_rejects_local_url_and_unbounded_acquisition(tmp_path):
    with pytest.raises(ValueError,match='HTTPS public'):
        acquire_arcgis_layer('http://localhost:80/query',[-89,37,-88,38],tmp_path/'out.geojson','EPSG:32616')
    with pytest.raises(ValueError,match='bounding'):
        acquire_arcgis_layer('https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0',[-180,-90,180,90],tmp_path/'out.geojson','EPSG:32616')
