import test from 'node:test';
import assert from 'node:assert/strict';
import { NasaPowerAdapter } from '../../packages/government/src/adapters/NasaPowerAdapter.ts';
import { EchoAdapter } from '../../packages/government/src/adapters/EchoAdapter.ts';
import { TigerwebAdapter, TIGERWEB_SERVICES } from '../../packages/government/src/adapters/TigerwebAdapter.ts';
import { getGovernmentSource, validateEvidenceEnvelope } from '../../packages/government/src/index.ts';

function jsonResponse(payload: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
    status,
    headers: { 'content-type': contentType },
  });
}

// ---------------------------------------------------------------------------
// RECORDED REAL SAMPLES (fetched live from this VM 2026-11-07, trimmed only
// by dropping dates/rows; values below are verbatim from the live responses).
// They are FIXTURES for parsing/validation tests — never presented as live.
// ---------------------------------------------------------------------------

/** NASA POWER daily point, 2026-01-01..2026-01-02, T2M + PRECTOTCORR, AG community, lon -88.005075 lat 37.845887. Live: HTTP 200, 772 bytes (7-day window). */
const NASA_FIXTURE = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-88.005, 37.846, 124.02] },
  properties: {
    parameter: {
      T2M: { '20260101': 1.05, '20260102': -0.68 },
      PRECTOTCORR: { '20260101': 0.0, '20260102': 0.0 },
    },
    header: {
      title: 'NASA/POWER Source Native Resolution Daily Data',
      api: { version: 'v2.10.3', name: 'POWER Daily API' },
      sources: ['MERRA2'],
      fill_value: -999.0,
      time_standard: 'LST',
      start: '20260101',
      end: '20260102',
    },
    messages: [],
    parameters: {
      T2M: { units: 'C', longname: 'Temperature at 2 Meters' },
      PRECTOTCORR: { units: 'mm/day', longname: 'Precipitation Corrected' },
    },
  },
};

/** ECHO CWA get_facilities for ZIP 47620. Live: HTTP 200, 327 bytes. NOTE the real shape is summary-only — no Facilities array. */
const ECHO_FIXTURE = {
  Results: {
    Message: 'Success',
    Version: 'CWA v2017-10-13 1325',
    QueryRows: '143',
    IndianCountryRows: '0',
    SVRows: '1',
    CVRows: '8',
    V3Rows: '17',
    FEARows: '0',
    InfFEARows: '13',
    INSPRows: '23',
    BioCVRows: '0',
    BioV3Rows: '0',
    VioLast4QRows: '15',
    TotalPenalties: '$0',
    BadSystemIDs: null,
    QueryID: '842',
  },
};

/** TIGERweb Places_CouSub_ConCity_SubMCD MapServer metadata (live: HTTP 200, 14,098 bytes; layers trimmed to the first + Incorporated Places entries, verbatim). */
const TIGERWEB_METADATA_FIXTURE = {
  currentVersion: 11.5,
  cimVersion: '3.5.0',
  serviceDescription: 'Estates, County Subdivisions, Subbarrios, Consolidated Cities, Incorporated Places, and Census Designated Places',
  mapName: 'Places and County Subdivisions',
  copyrightText: 'Source: U.S. Census Bureau',
  layers: [
    { id: 0, name: 'Estates', parentLayerId: -1, defaultVisibility: true, subLayerIds: null, minScale: 325000, maxScale: 1001, type: 'Feature Layer', geometryType: 'esriGeometryPolygon' },
    { id: 4, name: 'Incorporated Places', parentLayerId: -1, defaultVisibility: true, subLayerIds: null, minScale: 1400000, maxScale: 1001, type: 'Feature Layer', geometryType: 'esriGeometryPolygon' },
  ],
};

/** TIGERweb Places layer 4 query, STATE='18' AND BASENAME LIKE '%Mount Vernon%' (live: HTTP 200, 576 bytes, verbatim). */
const TIGERWEB_PLACES_FIXTURE = {
  displayFieldName: 'BASENAME',
  fieldAliases: { NAME: 'NAME', STATE: 'STATE', BASENAME: 'BASENAME' },
  fields: [
    { name: 'NAME', type: 'esriFieldTypeString', alias: 'NAME', length: 100 },
    { name: 'STATE', type: 'esriFieldTypeString', alias: 'STATE', length: 2 },
    { name: 'BASENAME', type: 'esriFieldTypeString', alias: 'BASENAME', length: 100 },
  ],
  features: [{ attributes: { NAME: 'Mount Vernon city', STATE: '18', BASENAME: 'Mount Vernon' } }],
};

// ---------------------------------------------------------------------------
// NASA POWER
// ---------------------------------------------------------------------------

test('nasa-power parses the recorded real daily response', async () => {
  const adapter = new NasaPowerAdapter();
  const envelope = await adapter.getDailyPoint(
    { latitude: 37.845887, longitude: -88.005075, start: '20260101', end: '20260102', parameters: ['T2M', 'PRECTOTCORR'] },
    { fetcher: (async () => jsonResponse(NASA_FIXTURE)) as typeof fetch },
  );
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.provenance.provider, 'nasa-power-ag');
  assert.equal(envelope.result.elevation, 124.02);
  assert.equal(envelope.result.timeStandard, 'LST');
  assert.deepEqual(envelope.result.sources, ['MERRA2']);
  assert.equal(envelope.result.parameters.length, 2);
  const t2m = envelope.result.parameters[0];
  assert.equal(t2m.code, 'T2M');
  assert.equal(t2m.units, 'C');
  assert.equal(t2m.longname, 'Temperature at 2 Meters');
  assert.deepEqual(t2m.values, [
    { date: '20260101', value: 1.05 },
    { date: '20260102', value: -0.68 },
  ]);
  assert.equal(envelope.result.parameters[1].values[0].value, 0);
  assert.deepEqual(envelope.result.unavailable, []);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('nasa-power maps the -999 fill value to null, never to a measurement', async () => {
  // Synthetic sentinel check: the recorded sample with one value replaced by
  // NASA's documented -999 fill value.
  const payload = structuredClone(NASA_FIXTURE);
  (payload.properties.parameter as Record<string, Record<string, number>>).T2M['20260102'] = -999;
  const adapter = new NasaPowerAdapter();
  const envelope = await adapter.getDailyPoint(
    { latitude: 37.845887, longitude: -88.005075, start: '20260101', end: '20260102', parameters: ['T2M'] },
    { fetcher: (async () => jsonResponse(payload)) as typeof fetch },
  );
  assert.deepEqual(envelope.result.parameters[0].values, [
    { date: '20260101', value: 1.05 },
    { date: '20260102', value: null },
  ]);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('nasa-power builds the documented point URL', async () => {
  const adapter = new NasaPowerAdapter();
  let captured = '';
  await adapter.getDailyPoint(
    { latitude: 37.845887, longitude: -88.005075, start: '20260101', end: '20260107', parameters: ['T2M', 'PRECTOTCORR'], community: 'AG' },
    {
      fetcher: (async (input: unknown) => {
        captured = String(input);
        return jsonResponse(NASA_FIXTURE);
      }) as typeof fetch,
    },
  );
  const url = new URL(captured);
  assert.equal(url.origin + url.pathname, 'https://power.larc.nasa.gov/api/temporal/daily/point');
  assert.equal(url.searchParams.get('parameters'), 'T2M,PRECTOTCORR');
  assert.equal(url.searchParams.get('community'), 'AG');
  assert.equal(url.searchParams.get('latitude'), '37.845887');
  assert.equal(url.searchParams.get('longitude'), '-88.005075');
  assert.equal(url.searchParams.get('start'), '20260101');
  assert.equal(url.searchParams.get('end'), '20260107');
  assert.equal(url.searchParams.get('format'), 'JSON');
});

test('nasa-power rejects invalid inputs before fetching', async () => {
  const adapter = new NasaPowerAdapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(NASA_FIXTURE);
  }) as typeof fetch;
  const base = { latitude: 37.845887, longitude: -88.005075, start: '20260101', end: '20260107', parameters: ['T2M'] };
  await assert.rejects(() => adapter.getDailyPoint({ ...base, latitude: 91 }, { fetcher: never }), /NASA_LATITUDE_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, latitude: -91 }, { fetcher: never }), /NASA_LATITUDE_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, longitude: 181 }, { fetcher: never }), /NASA_LONGITUDE_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, longitude: -181 }, { fetcher: never }), /NASA_LONGITUDE_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, start: '2026-01-01' }, { fetcher: never }), /NASA_DATE_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, start: '20260230' }, { fetcher: never }), /NASA_DATE_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, end: '20261301' }, { fetcher: never }), /NASA_DATE_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, start: '20260107', end: '20260101' }, { fetcher: never }), /NASA_DATE_RANGE_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, parameters: [] }, { fetcher: never }), /NASA_PARAMETERS_INVALID/);
  await assert.rejects(
    () => adapter.getDailyPoint({ ...base, parameters: ['T2M', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15'] }, { fetcher: never }),
    /NASA_PARAMETERS_INVALID/,
  );
  await assert.rejects(() => adapter.getDailyPoint({ ...base, parameters: ['t2m'] }, { fetcher: never }), /NASA_PARAMETER_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, parameters: ['T2M;DROP'] }, { fetcher: never }), /NASA_PARAMETER_INVALID/);
  await assert.rejects(() => adapter.getDailyPoint({ ...base, community: 'ag' }, { fetcher: never }), /NASA_COMMUNITY_INVALID/);
  assert.equal(called, false);
});

test('nasa-power reports UNAVAILABLE on HTTP errors and malformed shapes — never fabricated', async () => {
  const adapter = new NasaPowerAdapter();
  const base = { latitude: 37.845887, longitude: -88.005075, start: '20260101', end: '20260107', parameters: ['T2M'] };
  const http = await adapter.getDailyPoint(base, {
    fetcher: (async () => new Response('bad range', { status: 422, headers: { 'content-type': 'text/plain' } })) as typeof fetch,
  });
  assert.equal(http.provenance.status, 'UNAVAILABLE');
  assert.equal(http.result.parameters.length, 0);
  assert.ok(http.result.unavailable[0].reason.includes('422'));
  assert.deepEqual(validateEvidenceEnvelope(http), []);
  const malformed = await adapter.getDailyPoint(base, {
    fetcher: (async () => jsonResponse({ type: 'Feature' })) as typeof fetch,
  });
  assert.equal(malformed.provenance.status, 'UNAVAILABLE');
  assert.ok(malformed.result.unavailable[0].reason.length > 0);
  assert.deepEqual(validateEvidenceEnvelope(malformed), []);
});

test('nasa-power source is registered with the live REST endpoint', () => {
  const adapter = new NasaPowerAdapter();
  assert.equal(adapter.sourceId, 'nasa-power-ag');
  assert.equal(adapter.endpoint, 'https://power.larc.nasa.gov/api/temporal/daily');
  const source = getGovernmentSource('nasa-power-ag');
  assert.equal(source.authority, 'NASA');
  assert.equal(source.access, 'REST_JSON');
});

// ---------------------------------------------------------------------------
// EPA ECHO
// ---------------------------------------------------------------------------

test('echo parses the recorded real summary-only response for ZIP 47620', async () => {
  const adapter = new EchoAdapter();
  const envelope = await adapter.getFacilitiesByZip('47620', {
    fetcher: (async () => jsonResponse(ECHO_FIXTURE)) as typeof fetch,
  });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.provenance.provider, 'epa-facilities');
  assert.equal(envelope.result.zip, '47620');
  assert.equal(envelope.result.message, 'Success');
  assert.equal(envelope.result.version, 'CWA v2017-10-13 1325');
  assert.equal(envelope.result.queryRows, 143);
  assert.equal(envelope.result.counts.CVRows, 8);
  assert.equal(envelope.result.counts.INSPRows, 23);
  // The live service returns no Facilities array: honest empty, not invented.
  assert.deepEqual(envelope.result.facilities, []);
  assert.deepEqual(envelope.result.unavailable, []);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('echo carries Facilities verbatim when the service actually returns them', async () => {
  // Synthetic branch coverage: a Facilities array is NOT in the recorded
  // live response; this only proves the parser forwards one if it appears.
  const payload = structuredClone(ECHO_FIXTURE);
  (payload.Results as Record<string, unknown>).Facilities = [
    { RegistryID: '110000000001', FacName: 'Example Plant', FacZip: '47620' },
  ];
  const adapter = new EchoAdapter();
  const envelope = await adapter.getFacilitiesByZip('47620', {
    fetcher: (async () => jsonResponse(payload)) as typeof fetch,
  });
  assert.equal(envelope.result.facilities.length, 1);
  assert.equal((envelope.result.facilities[0] as Record<string, unknown>).FacName, 'Example Plant');
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('echo builds the documented get_facilities URL', async () => {
  const adapter = new EchoAdapter();
  let captured = '';
  await adapter.getFacilitiesByZip('47620', {
    fetcher: (async (input: unknown) => {
      captured = String(input);
      return jsonResponse(ECHO_FIXTURE);
    }) as typeof fetch,
  });
  const url = new URL(captured);
  assert.equal(url.origin + url.pathname, 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities');
  assert.equal(url.searchParams.get('output'), 'JSON');
  assert.equal(url.searchParams.get('p_zip'), '47620');
});

test('echo rejects invalid ZIPs before fetching', async () => {
  const adapter = new EchoAdapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(ECHO_FIXTURE);
  }) as typeof fetch;
  await assert.rejects(() => adapter.getFacilitiesByZip('4762', { fetcher: never }), /ECHO_ZIP_INVALID/);
  await assert.rejects(() => adapter.getFacilitiesByZip('47620-1234', { fetcher: never }), /ECHO_ZIP_INVALID/);
  await assert.rejects(() => adapter.getFacilitiesByZip('ABCDE', { fetcher: never }), /ECHO_ZIP_INVALID/);
  await assert.rejects(() => adapter.getFacilitiesByZip('', { fetcher: never }), /ECHO_ZIP_INVALID/);
  assert.equal(called, false);
});

test('echo reports UNAVAILABLE on HTTP errors and missing Results — never fabricated', async () => {
  const adapter = new EchoAdapter();
  const http = await adapter.getFacilitiesByZip('47620', {
    fetcher: (async () => new Response('down', { status: 500, headers: { 'content-type': 'text/plain' } })) as typeof fetch,
  });
  assert.equal(http.provenance.status, 'UNAVAILABLE');
  assert.deepEqual(http.result.facilities, []);
  assert.ok(http.result.unavailable[0].reason.includes('500'));
  assert.deepEqual(validateEvidenceEnvelope(http), []);
  const malformed = await adapter.getFacilitiesByZip('47620', {
    fetcher: (async () => jsonResponse({ nope: true })) as typeof fetch,
  });
  assert.equal(malformed.provenance.status, 'UNAVAILABLE');
  assert.deepEqual(validateEvidenceEnvelope(malformed), []);
});

test('echo source is registered with the live REST endpoint', () => {
  const adapter = new EchoAdapter();
  assert.equal(adapter.sourceId, 'epa-facilities');
  assert.equal(adapter.endpoint, 'https://echodata.epa.gov/echo');
  const source = getGovernmentSource('epa-facilities');
  assert.equal(source.authority, 'EPA');
  assert.equal(source.access, 'REST_JSON');
});

// ---------------------------------------------------------------------------
// Census TIGERweb
// ---------------------------------------------------------------------------

test('tigerweb parses the recorded real service metadata', async () => {
  const adapter = new TigerwebAdapter();
  const envelope = await adapter.getServiceMetadata('Places_CouSub_ConCity_SubMCD', {
    fetcher: (async () => jsonResponse(TIGERWEB_METADATA_FIXTURE)) as typeof fetch,
  });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.provenance.provider, 'census-tigerweb');
  assert.equal(envelope.result.service, 'Places_CouSub_ConCity_SubMCD');
  assert.equal(envelope.result.mapName, 'Places and County Subdivisions');
  assert.equal(envelope.result.currentVersion, 11.5);
  const places = envelope.result.layers.find((l) => l.id === 4)!;
  assert.equal(places.name, 'Incorporated Places');
  assert.equal(places.geometryType, 'esriGeometryPolygon');
  assert.deepEqual(envelope.result.unavailable, []);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('tigerweb parses the recorded real Places query (Mount Vernon city, IN)', async () => {
  const adapter = new TigerwebAdapter();
  const envelope = await adapter.queryPlaces(
    { state: 'Indiana', where: "BASENAME LIKE '%Mount Vernon%'" },
    { fetcher: (async () => jsonResponse(TIGERWEB_PLACES_FIXTURE)) as typeof fetch },
  );
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.result.state, 'IN');
  assert.equal(envelope.result.stateFips, '18');
  assert.equal(envelope.result.features.length, 1);
  assert.equal(envelope.result.features[0].NAME, 'Mount Vernon city');
  assert.equal(envelope.result.features[0].BASENAME, 'Mount Vernon');
  assert.equal(envelope.result.exceededTransferLimit, false);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('tigerweb queryPlaces builds the bounded Places layer-4 URL and resolves state names', async () => {
  const adapter = new TigerwebAdapter();
  let captured = '';
  await adapter.queryPlaces(
    { state: 'IN', where: "BASENAME LIKE '%Mount Vernon%'" },
    {
      fetcher: (async (input: unknown) => {
        captured = String(input);
        return jsonResponse(TIGERWEB_PLACES_FIXTURE);
      }) as typeof fetch,
    },
  );
  const url = new URL(captured);
  assert.equal(
    url.origin + url.pathname,
    'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4/query',
  );
  assert.equal(url.searchParams.get('where'), "(BASENAME LIKE '%Mount Vernon%') AND STATE='18'");
  assert.equal(url.searchParams.get('outFields'), 'NAME,STATE,BASENAME');
  assert.equal(url.searchParams.get('returnGeometry'), 'false');
  assert.equal(url.searchParams.get('f'), 'json');
  assert.equal(url.searchParams.get('resultRecordCount'), '100');
});

test('tigerweb rejects invalid services, states, where clauses and outFields before fetching', async () => {
  const adapter = new TigerwebAdapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(TIGERWEB_PLACES_FIXTURE);
  }) as typeof fetch;
  await assert.rejects(() => adapter.getServiceMetadata('Nope_Not_A_Service', { fetcher: never }), /TIGERWEB_SERVICE_INVALID/);
  await assert.rejects(() => adapter.getServiceMetadata('tigerWMS_Current', { fetcher: never }), /TIGERWEB_SERVICE_INVALID/);
  await assert.rejects(() => adapter.queryPlaces({ state: 'XX', where: '1=1' }, { fetcher: never }), /TIGERWEB_STATE_INVALID/);
  await assert.rejects(() => adapter.queryPlaces({ state: 'Indiana2', where: '1=1' }, { fetcher: never }), /TIGERWEB_STATE_INVALID/);
  await assert.rejects(() => adapter.queryPlaces({ state: 'IN', where: '' }, { fetcher: never }), /TIGERWEB_WHERE_INVALID/);
  await assert.rejects(() => adapter.queryPlaces({ state: 'IN', where: '   ' }, { fetcher: never }), /TIGERWEB_WHERE_INVALID/);
  await assert.rejects(() => adapter.queryPlaces({ state: 'IN', where: 'x'.repeat(501) }, { fetcher: never }), /TIGERWEB_WHERE_INVALID/);
  await assert.rejects(
    () => adapter.queryPlaces({ state: 'IN', where: '1=1', outFields: ['NAME;DROP'] }, { fetcher: never }),
    /TIGERWEB_OUTFIELDS_INVALID/,
  );
  assert.equal(called, false);
});

test('tigerweb reports UNAVAILABLE on HTTP errors and malformed shapes — never fabricated', async () => {
  const adapter = new TigerwebAdapter();
  const http = await adapter.getServiceMetadata('State_County', {
    fetcher: (async () => new Response('down', { status: 500, headers: { 'content-type': 'text/plain' } })) as typeof fetch,
  });
  assert.equal(http.provenance.status, 'UNAVAILABLE');
  assert.deepEqual(http.result.layers, []);
  assert.ok(http.result.unavailable[0].reason.includes('500'));
  assert.deepEqual(validateEvidenceEnvelope(http), []);
  const malformed = await adapter.queryPlaces(
    { state: 'IN', where: '1=1' },
    { fetcher: (async () => jsonResponse({ nope: true })) as typeof fetch },
  );
  assert.equal(malformed.provenance.status, 'UNAVAILABLE');
  assert.deepEqual(malformed.result.features, []);
  assert.deepEqual(validateEvidenceEnvelope(malformed), []);
});

test('tigerweb allowlist contains only services verified live, and the source is registered', () => {
  assert.ok(TIGERWEB_SERVICES.includes('Places_CouSub_ConCity_SubMCD'));
  assert.ok(TIGERWEB_SERVICES.includes('State_County'));
  assert.ok(TIGERWEB_SERVICES.includes('PUMA_TAD_TAZ_UGA_ZCTA'));
  assert.ok(!TIGERWEB_SERVICES.some((s) => s.startsWith('tigerWMS_')));
  const adapter = new TigerwebAdapter();
  assert.equal(adapter.sourceId, 'census-tigerweb');
  assert.equal(adapter.endpoint, 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb');
  const source = getGovernmentSource('census-tigerweb');
  assert.equal(source.authority, 'CENSUS');
  assert.equal(source.access, 'REST_JSON');
});

// ---------------------------------------------------------------------------
// LIVE SMOKE TESTS — real fetches; structural facts only, never live values.
// Each logs its evidence SHA-256 so the run output records what was seen.
// ---------------------------------------------------------------------------

test('LIVE nasa-power daily point returns HTTP 200 with the real daily shape', async () => {
  const adapter = new NasaPowerAdapter();
  const envelope = await adapter.getDailyPoint({
    latitude: 37.845887,
    longitude: -88.005075,
    start: '20260101',
    end: '20260107',
    parameters: ['T2M', 'PRECTOTCORR'],
  });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.result.parameters.length, 2);
  assert.ok(envelope.result.parameters.every((p) => p.values.length === 7));
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  console.log('LIVE nasa-power evidence sha256=' + envelope.evidence[0].sha256 + ' output sha256=' + envelope.hash);
});

test('LIVE echo get_facilities for ZIP 47620 returns HTTP 200 with a Success summary', async () => {
  const adapter = new EchoAdapter();
  const envelope = await adapter.getFacilitiesByZip('47620');
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.result.message, 'Success');
  assert.equal(typeof envelope.result.queryRows, 'number');
  assert.ok((envelope.result.queryRows as number) >= 0);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  console.log('LIVE echo evidence sha256=' + envelope.evidence[0].sha256 + ' output sha256=' + envelope.hash + ' queryRows=' + envelope.result.queryRows);
});

test('LIVE tigerweb Places metadata + Mount Vernon query return HTTP 200 with the real shape', async () => {
  const adapter = new TigerwebAdapter();
  const meta = await adapter.getServiceMetadata('Places_CouSub_ConCity_SubMCD');
  assert.equal(meta.provenance.status, 'UNVERIFIED');
  assert.ok(meta.result.layers.some((l) => l.id === 4 && l.name === 'Incorporated Places'));
  assert.deepEqual(validateEvidenceEnvelope(meta), []);
  console.log('LIVE tigerweb metadata evidence sha256=' + meta.evidence[0].sha256 + ' output sha256=' + meta.hash);
  const places = await adapter.queryPlaces({ state: 'IN', where: "BASENAME LIKE '%Mount Vernon%'" });
  assert.equal(places.provenance.status, 'UNVERIFIED');
  assert.ok(places.result.features.some((f) => f.BASENAME === 'Mount Vernon'));
  assert.deepEqual(validateEvidenceEnvelope(places), []);
  console.log('LIVE tigerweb places evidence sha256=' + places.evidence[0].sha256 + ' output sha256=' + places.hash);
});

test('LIVE tigerweb State_County metadata returns HTTP 200', async () => {
  const adapter = new TigerwebAdapter();
  const meta = await adapter.getServiceMetadata('State_County');
  assert.equal(meta.provenance.status, 'UNVERIFIED');
  assert.ok(meta.result.layers.some((l) => l.name === 'States'));
  assert.ok(meta.result.layers.some((l) => l.name === 'Counties'));
  assert.deepEqual(validateEvidenceEnvelope(meta), []);
  console.log('LIVE tigerweb state_county evidence sha256=' + meta.evidence[0].sha256 + ' output sha256=' + meta.hash);
});
