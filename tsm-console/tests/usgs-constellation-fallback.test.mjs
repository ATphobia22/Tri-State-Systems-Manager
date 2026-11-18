import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchUsgsConstellation } from '../src/lib/usgs-constellation.ts';

const sample = (id, code, value, unit, time, approval = 'Provisional') => ({
  type: 'Feature', properties: {
    monitoring_location_id: `USGS-${id}`,
    parameter_code: code, value, unit_of_measure: unit, time,
    approval_status: approval,
  },
});
const fresh = () => new Date(Date.now() - 60_000).toISOString();
const old = () => new Date(Date.now() - 8 * 3600_000).toISOString();

function feed(rows) {
  const calls = [];
  const fetcher = async (url, options) => {
    const target = new URL(url);
    calls.push(target);
    assert.equal(target.origin + target.pathname,
      'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items');
    assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify({ type: 'FeatureCollection',
      features: rows[target.searchParams.get('monitoring_location_id')] ?? [] }),
      {status:200,headers:{'content-type':'application/geo+json'}});
  };
  return { fetcher, calls };
}

test('explicit USGS constellation preserves USGS identity, stage and discharge but never fabricates NAVD88', async () => {
  const {fetcher, calls} = feed({
    'USGS-03378500': [
      sample('03378500','00065', '13.25','ft',fresh()),
      sample('03378500','00060',34500,'ft^3/s',fresh()),
      sample('03322000','00065',99,'ft',fresh()),
    ],
    'USGS-03322000': [sample('03322000','00065',0,'ft',fresh(),'Approved')],
  });
  const rows = await fetchUsgsConstellation(['03378500','03322000'], fetcher);
  assert.equal(calls.length, 2);
  assert.equal(rows[0].stationId,'03378500');
  assert.equal(rows[0].stage_ft,13.25);
  assert.equal(rows[0].discharge_cfs,34500);
  assert.equal(rows[0].vertical_reference,'GAGE_DATUM');
  assert.equal(rows[0].wse_navd88_ft,null);
  assert.equal(rows[0].conversion_applied,false);
  assert.equal(rows[0].status,'provisional');
  assert.match(rows[0].sourceUri,/monitoring_location_id=USGS-03378500/);
  assert.equal(rows[1].stage_ft,0);
  assert.equal(rows[1].status,'current');
  assert.equal(rows[1].wse_navd88_ft,null);
});

test('old USGS values remain stale, not current or invented elevations', async()=>{
  const {fetcher}=feed({'USGS-03378500':[sample('03378500','00065',12,'ft',old())]});
  const [row]=await fetchUsgsConstellation(['03378500'],fetcher);
  assert.equal(row.stage_ft,12);
  assert.equal(row.status,'stale');
  assert.equal(row.conversion_applied,false);
});

test('no valid station-matched stage or wrong units reports unavailable', async()=>{
  const {fetcher}=feed({'USGS-03378500':[
    sample('03322000','00065',100,'ft',fresh()),
    sample('03378500','00065',3,'m',fresh()),
    sample('03378500','00060',100,'ft^3/s',fresh()),
  ]});
  const [row]=await fetchUsgsConstellation(['03378500'],fetcher);
  assert.equal(row.stage_ft,null);
  assert.equal(row.status,'unavailable');
  assert.equal(row.wse_navd88_ft,null);
  assert.match(row.error,/stage|feet|unavailable/i);
});

test('failed remote request and unreviewed station remain unavailable, no invented data',async()=>{
  const down=async()=>new Response('down',{status:503});
  const rows=await fetchUsgsConstellation(['03378500','99999999'],down);
  assert.deepEqual(rows.map(r=>r.status),['unavailable','unavailable']);
  assert.deepEqual(rows.map(r=>r.stage_ft),[null,null]);
  assert.ok(rows.every(r=>r.conversion_applied===false));
});

test('browser constellation fallback is wired only to explicit map button, not polling by default',()=>{
  const fetchSource=readFileSync(new URL('../src/lib/multi-stage-fetch.ts',import.meta.url),'utf8');
  const mapSource=readFileSync(new URL('../src/components/RealWorldTwinMap.tsx',import.meta.url),'utf8');
  assert.match(fetchSource,/browserFallback\?: boolean/);
  assert.match(fetchSource,/options\.browserFallback/);
  assert.match(mapSource,/fetchAllLiveStations\([^)]*browserFallback: true/);
  assert.match(fetchSource,/if \(!options\.browserFallback\) return serverRows/);
});
