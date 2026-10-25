import test from 'node:test';
import assert from 'node:assert/strict';
import { UsgsOgcV1Adapter } from '../../packages/government/src/adapters/UsgsOgcV1Adapter.ts';
import { NwisAdapter } from '../../packages/government/src/adapters/NwisAdapter.ts';
import { getGovernmentSource, validateEvidenceEnvelope } from '../../packages/government/src/index.ts';

/** Live-shaped OGC API v1 latest-continuous payload (field names from the verified 2026-10-23 sweep sample). */
function livePayload(siteId: string) {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { monitoring_location_id: `USGS-${siteId}`, parameter_code: '00060', time: '2026-10-23T22:30:00+00:00', value: '255000', unit_of_measure: 'ft^3/s', approval_status: 'Approved' } },
      { type: 'Feature', properties: { monitoring_location_id: `USGS-${siteId}`, parameter_code: '00065', time: '2026-10-23T22:30:00+00:00', value: '15.31', unit_of_measure: 'ft', approval_status: 'Provisional' } },
    ],
    numberReturned: 2,
  };
}

function jsonResponse(payload: unknown, status = 200, contentType = 'application/geo+json'): Response {
  return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
    status,
    headers: { 'content-type': contentType },
  });
}

test('usgs-ogc-v1 parses live-shaped OGC JSON into marked readings', async () => {
  const adapter = new UsgsOgcV1Adapter();
  const envelope = await adapter.getLatestContinuous(['03381700'], '00065,00060', {
    fetcher: (async () => jsonResponse(livePayload('03381700'))) as typeof fetch,
  });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.provenance.provider, 'usgs-waterdata-ogc');
  assert.equal(envelope.result.readings.length, 2);
  assert.equal(envelope.result.unavailable.length, 0);
  const gage = envelope.result.readings.find((r) => r.parameterCode === '00065')!;
  const flow = envelope.result.readings.find((r) => r.parameterCode === '00060')!;
  assert.equal(gage.siteId, '03381700');
  assert.equal(gage.monitoringLocationId, 'USGS-03381700');
  assert.equal(gage.value, 15.31); // string "15.31" parsed to number
  assert.equal(gage.unit, 'ft');
  assert.equal(gage.observedAt, '2026-10-23T22:30:00+00:00');
  assert.equal(gage.approvalStatus, 'Provisional');
  assert.equal(gage.verticalDatum, 'GAGE_DATUM'); // gage height is NOT NAVD88
  assert.equal(gage.path, 'usgs-ogc-v1');
  assert.equal(flow.value, 255000);
  assert.equal(flow.unit, 'ft^3/s');
  assert.equal(flow.verticalDatum, null); // discharge has no vertical datum
  assert.equal(flow.path, 'usgs-ogc-v1');
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('usgs-ogc-v1 builds the documented query URL (correct /ogcapi/v1 base path)', async () => {
  const adapter = new UsgsOgcV1Adapter();
  let captured = '';
  await adapter.getLatestContinuous(['03378500'], '00065', {
    fetcher: (async (input: unknown) => {
      captured = String(input);
      return jsonResponse(livePayload('03378500'));
    }) as typeof fetch,
  });
  const url = new URL(captured);
  assert.equal(url.origin + url.pathname, 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items');
  assert.equal(url.searchParams.get('monitoring_location_id'), 'USGS-03378500');
  assert.equal(url.searchParams.get('parameter_code'), '00065');
  assert.equal(url.searchParams.get('f'), 'json');
  // The overturned 2026-10-23 verdict came from the wrong base path — never regress to it.
  assert.ok(!captured.includes('/ogcapi/observations/v1'), 'must not use the wrong observations/v1 base path');
});

test('usgs-ogc-v1 reports UNAVAILABLE on empty features — never fabricated', async () => {
  const adapter = new UsgsOgcV1Adapter();
  const envelope = await adapter.getLatestContinuous(['03381700'], '00065,00060', {
    fetcher: (async () => jsonResponse({ type: 'FeatureCollection', features: [] })) as typeof fetch,
  });
  assert.equal(envelope.provenance.status, 'UNAVAILABLE');
  assert.equal(envelope.result.readings.length, 0);
  assert.equal(envelope.result.unavailable.length, 1);
  assert.equal(envelope.result.unavailable[0].siteId, '03381700');
  assert.ok(envelope.result.unavailable[0].reason.length > 0);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('usgs-ogc-v1 reports UNAVAILABLE on malformed JSON and HTTP errors', async () => {
  const adapter = new UsgsOgcV1Adapter();
  const bad = await adapter.getLatestContinuous(['03381700'], '00065', {
    fetcher: (async () => jsonResponse('not-json{{{', 200, 'application/json')) as typeof fetch,
  });
  assert.equal(bad.provenance.status, 'UNAVAILABLE');
  assert.equal(bad.result.readings.length, 0);
  assert.deepEqual(validateEvidenceEnvelope(bad), []);

  const http = await adapter.getLatestContinuous(['03381700'], '00065', {
    fetcher: (async () => new Response('oops', { status: 500, headers: { 'content-type': 'text/plain' } })) as typeof fetch,
  });
  assert.equal(http.provenance.status, 'UNAVAILABLE');
  assert.ok(http.result.unavailable[0].reason.includes('500'));
  assert.deepEqual(validateEvidenceEnvelope(http), []);
});

test('usgs-ogc-v1 skips no-data sentinels and unparseable features', async () => {
  const adapter = new UsgsOgcV1Adapter();
  const payload = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { monitoring_location_id: 'USGS-03381700', parameter_code: '00065', time: '2026-10-23T22:30:00+00:00', value: '-999', unit_of_measure: 'ft', approval_status: 'Provisional' } },
      { type: 'Feature', properties: { monitoring_location_id: 'USGS-03381700', parameter_code: '00065', time: 'not-a-time', value: '15.31', unit_of_measure: 'ft', approval_status: 'Provisional' } },
      { type: 'Feature', properties: null },
      { type: 'Feature', properties: { monitoring_location_id: 'USGS-03381700', parameter_code: '00065', time: '2026-10-23T22:30:00+00:00', value: '15.31', unit_of_measure: 'ft', approval_status: 'Provisional' } },
    ],
  };
  const envelope = await adapter.getLatestContinuous(['03381700'], '00065', {
    fetcher: (async () => jsonResponse(payload)) as typeof fetch,
  });
  assert.equal(envelope.result.readings.length, 1);
  assert.equal(envelope.result.readings[0].value, 15.31);
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
});

test('usgs-ogc-v1 stays resilient when one site fails among many', async () => {
  const adapter = new UsgsOgcV1Adapter();
  const envelope = await adapter.getLatestContinuous(['03381700', '03378500'], '00065,00060', {
    fetcher: (async (input: unknown) => {
      if (String(input).includes('03378500')) throw new Error('network down');
      return jsonResponse(livePayload('03381700'));
    }) as typeof fetch,
  });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.result.readings.length, 2);
  assert.ok(envelope.result.readings.every((r) => r.siteId === '03381700'));
  assert.equal(envelope.result.unavailable.length, 1);
  assert.equal(envelope.result.unavailable[0].siteId, '03378500');
  assert.ok(envelope.result.unavailable[0].reason.includes('network down'));
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('usgs-ogc-v1 rejects invalid site IDs and parameter codes before fetching', async () => {
  const adapter = new UsgsOgcV1Adapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(livePayload('03381700'));
  }) as typeof fetch;
  await assert.rejects(() => adapter.getLatestContinuous(['abc'], '00065', { fetcher: never }), /SITE_INVALID/);
  await assert.rejects(() => adapter.getLatestContinuous([], '00065', { fetcher: never }), /SITES_REQUIRED/);
  await assert.rejects(() => adapter.getLatestContinuous(['03381700'], 'abc', { fetcher: never }), /PARAMETER_CD_INVALID/);
  assert.equal(called, false);
});

test('usgs-ogc-v1 source is registered and the legacy NWIS path is intact', () => {
  const source = getGovernmentSource('usgs-waterdata-ogc');
  assert.equal(source.authority, 'USGS');
  assert.equal(source.endpoint, 'https://api.waterdata.usgs.gov/ogcapi/v1');
  // Legacy path untouched: same sourceId, same endpoint, same class contract.
  const legacy = new NwisAdapter();
  assert.equal(legacy.sourceId, 'usgs-nwis');
  assert.equal(legacy.endpoint, 'https://waterservices.usgs.gov/nwis');
  assert.equal(getGovernmentSource('usgs-nwis').endpoint, 'https://waterservices.usgs.gov/nwis');
});

test('usgs-ogc-v1 never converts missing, blank or boolean observations into zero stage',async()=>{
 const adapter=new UsgsOgcV1Adapter();
 const time='2026-10-23T22:30:00+00:00';
 const values:[unknown,string][]=[[null,'null'],['','empty'],['  ','whitespace'],[false,'boolean'],[-9999,'nodata'],[-8888,'nodata'],['NaN','not number'],['Infinity','nonfinite']];
 const features=values.map(([value])=>({type:'Feature',properties:{monitoring_location_id:'USGS-03378500',parameter_code:'00065',time,value,unit_of_measure:'ft'}}));
 features.push({type:'Feature',properties:{monitoring_location_id:'USGS-03378500',parameter_code:'00065',time,value:0,unit_of_measure:'ft'}});
 const output=await adapter.getLatestContinuous(['03378500'],'00065',{fetcher:(async()=>jsonResponse({type:'FeatureCollection',features})) as typeof fetch});
 assert.equal(output.result.readings.length,1);
 assert.equal(output.result.readings[0].value,0,'genuine numeric zero is valid; blank/null cannot become zero');
 assert.deepEqual(validateEvidenceEnvelope(output),[]);
});

test('usgs-ogc-v1 rejects features from another station or unrequested parameter',async()=>{
 const adapter=new UsgsOgcV1Adapter();
 const time='2026-10-23T22:30:00+00:00';
 const features=[
  {properties:{monitoring_location_id:'USGS-03381700',parameter_code:'00065',time,value:'15.31',unit_of_measure:'ft'}},
  {properties:{monitoring_location_id:'USGS-03378500',parameter_code:'00060',time,value:'255000',unit_of_measure:'ft^3/s'}},
  {properties:{monitoring_location_id:'USGS-03378500',parameter_code:'00065',time,value:'15.31',unit_of_measure:'ft'}},
  {properties:{parameter_code:'00065',time,value:'18.20',unit_of_measure:'ft'}},
  {properties:{monitoring_location_id:'USGS-03378500',parameter_code:'00065',time,value:'16.00',unit_of_measure:null}}
 ];
 const output=await adapter.getLatestContinuous(['03378500'],'00065',{fetcher:(async()=>jsonResponse({type:'FeatureCollection',features})) as typeof fetch});
 assert.equal(output.result.readings.length,1);
 assert.equal(output.result.readings[0].siteId,'03378500');
 assert.equal(output.result.readings[0].parameterCode,'00065');
 assert.equal(output.result.readings[0].value,15.31);
 assert.deepEqual(validateEvidenceEnvelope(output),[]);
});

test('usgs-ogc-v1 treats cross-station-only responses as unavailable rather than inventing requested station evidence',async()=>{
 const adapter=new UsgsOgcV1Adapter();
 const output=await adapter.getLatestContinuous(['03378500'],'00065',{fetcher:(async()=>jsonResponse(livePayload('03381700'))) as typeof fetch});
 assert.equal(output.provenance.status,'UNAVAILABLE');
 assert.equal(output.result.readings.length,0);
 assert.equal(output.result.unavailable[0].siteId,'03378500');
});
