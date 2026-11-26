"""Local execution and estimates panel behavioral contracts."""
import json
from pathlib import Path
import subprocess
import os
import sys
import pytest
from citybuilder.cli import build
from citybuilder.auto import run_city_build, acquire_arcgis_layer

ROOT=Path(__file__).parents[1]
SAMPLE=ROOT/'examples'/'sample_footprints_32616.geojson'

def test_missing_heights_are_separate_hideable_layer(tmp_path):
    data=json.loads(SAMPLE.read_text());data['features'][0]['properties'].pop('height_m')
    path=tmp_path/'source.geojson';path.write_text(json.dumps(data))
    m=build(path,tmp_path/'out','EPSG:32616','m','VISUAL_ONLY','m',estimate_missing=True)
    assert set(m['visual_layers'])=={'estimated','verified'}
    for name,p in m['visual_layers'].items():
        assert (tmp_path/'out'/p).is_file()
        assert (tmp_path/'out'/f'buildings_{name}.glb').read_bytes()[:4]==b'glTF'
    assert m['estimate_count']==1
    assert m['objects'][0]['height_evidence'].startswith('ESTIMATED')

def test_official_observation_cannot_lack_digest(tmp_path):
    p=json.loads((ROOT/'profiles'/'sample_city.json').read_text())
    p['timeline_events']=[{'event_id':'not-proven','timestamp_utc':'2024-02-01T00:00:00Z','status':'OBSERVED'}]
    config=tmp_path/'test.json';p['source_snapshot']=str(SAMPLE);config.write_text(json.dumps(p))
    with pytest.raises(ValueError,match='requires provenance'):
        run_city_build(config,tmp_path/'out')

def test_timeline_replay_keeps_simulated_status(tmp_path):
    r=run_city_build(ROOT/'profiles'/'sample_city.json',tmp_path/'out')
    events=json.loads((tmp_path/'out'/'timeline_events.json').read_text())['events']
    assert r['timeline_events']==2
    assert len(events)==2 and all(x['status']=='SIMULATED' for x in events)
    page=(tmp_path/'out'/'index.html').read_text()
    assert 'Evidence &amp; Estimates' in page and 'timepick' in page
    assert "$('estimated').checked" not in page or "'estimated'" in page

def test_mcp_handshake_and_tools_available():
    requests=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'tester','version':'0.1'}}},
              {'jsonrpc':'2.0','id':2,'method':'tools/list'},
              {'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'list_city_profiles','arguments':{}}}]
    if not __import__('shutil').which('node'):
        pytest.skip('Node.js is not installed')
    p=subprocess.run(['node',str(ROOT/'server'/'index.cjs')],input='\n'.join(map(json.dumps,requests))+'\n',capture_output=True,text=True,timeout=10,cwd=ROOT)
    assert p.returncode==0,p.stderr
    lines=list(map(json.loads,p.stdout.strip().splitlines()))
    assert lines[0]['result']['serverInfo']['name']=='auto-3d-city-builder'
    assert 'build_city' in [x['name'] for x in lines[1]['result']['tools']]
    assert 'mount_vernon_in.json' in lines[2]['result']['content'][0]['text']

def test_ledger_discloses_height_nearby_inputs(tmp_path):
    data=json.loads(SAMPLE.read_text())
    p=data['features'][0]['properties'];p.pop('height_m')
    f=tmp_path/'in.geojson';f.write_text(json.dumps(data))
    m=build(f,tmp_path/'out','EPSG:32616','m','VISUAL_ONLY','m',estimate_missing=True)
    evidence=json.loads((tmp_path/'out'/'estimate_ledger.json').read_text())
    entry=next(e for e in evidence['estimates'] if e['field']=='height_m')
    assert entry['references']==['demo-002'] and entry['confidence']=='LOW'
    assert entry['review_status']=='NEEDS_VERIFICATION'
