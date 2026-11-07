import test from 'node:test';
import assert from 'node:assert/strict';
import { NhdAdapter } from '../../packages/government/src/adapters/NhdAdapter.ts';
import { UsgsPublicationsAdapter } from '../../packages/government/src/adapters/UsgsPublicationsAdapter.ts';
import { TnmAdapter } from '../../packages/government/src/adapters/TnmAdapter.ts';
import { getGovernmentSource, validateEvidenceEnvelope } from '../../packages/government/src/index.ts';

/**
 * Fixtures below are RECORDED REAL response samples, trimmed to the fields
 * asserted here. Recorded 2026-11-07 from the live public endpoints with
 * curl (full bodies hashed in the live smoke tests below). They are fixtures
 * for parsing/validation tests only — never presented as live data.
 */

// --- NHD: recorded 2026-11-07, GET .../nhd/MapServer?f=json (trimmed) ---
const NHD_METADATA_FIXTURE = {
  currentVersion: 11.3,
  mapName: 'nhd',
  maxRecordCount: 2000,
  layers: [
    { id: 0, name: 'Point' },
    { id: 2, name: 'Line - Large Scale ' },
    { id: 6, name: 'Flowline - Large Scale' },
  ],
};
// --- NHD: recorded 2026-11-07, GET .../nhd/MapServer/0?f=json (trimmed) ---
const NHD_LAYER_FIXTURE = {
  currentVersion: 11.3,
  id: 0,
  name: 'Point',
  type: 'Feature Layer',
  geometryType: 'esriGeometryPoint',
  fields: [
    { name: 'OBJECTID', type: 'esriFieldTypeOID' },
    { name: 'FDATE', type: 'esriFieldTypeDate' },
    { name: 'GNIS_NAME', type: 'esriFieldTypeString' },
    { name: 'REACHCODE', type: 'esriFieldTypeString' },
    { name: 'FTYPE', type: 'esriFieldTypeInteger' },
  ],
};
// --- NHD: recorded 2026-11-07, GET .../nhd/MapServer/0/query?where=1%3D1&... (trimmed) ---
const NHD_QUERY_FIXTURE = {
  displayFieldName: 'GNIS_NAME',
  features: [
    {
      attributes: {
        OBJECTID: 1,
        FDATE: 1060128000000,
        RESOLUTION: 2,
        GNIS_ID: null,
        GNIS_NAME: null,
        REACHCODE: null,
        FTYPE: 367,
        FCODE: 36700,
        PERMANENT_IDENTIFIER: '93993194',
      },
    },
  ],
  exceededTransferLimit: true,
};
// --- Pubs: recorded 2026-11-07, GET .../publication?mimetype=json&q=flood (1 of 15 records, trimmed) ---
const PUBS_SEARCH_FIXTURE = {
  pageNumber: '1',
  pageRowStart: '0',
  pageSize: '15',
  recordCount: 8655,
  records: [
    {
      id: 70283491,
      title: 'Precipitation probability distribution, percent runoff, and trend analysis for 25 reservoir basins in Texas from 1980–2019',
      publicationType: { id: 2, text: 'Article' },
      publicationSubtype: { id: 10, text: 'Journal Article' },
      publicationYear: '2026',
      doi: '10.21423/twj.v17i1.7221',
    },
  ],
};
// --- Pubs: recorded 2026-11-07, GET .../publication/70283491?mimetype=json (trimmed) ---
const PUBS_ONE_FIXTURE = {
  id: 70283491,
  title: 'Precipitation probability distribution, percent runoff, and trend analysis for 25 reservoir basins in Texas from 1980–2019',
  publicationYear: '2026',
  doi: '10.21423/twj.v17i1.7221',
  publicationType: { id: 2, text: 'Article' },
  publicationSubtype: { id: 10, text: 'Journal Article' },
};
// --- TNM: recorded 2026-11-07, GET .../api/v1/datasets (2 of 15 entries, trimmed) ---
const TNM_DATASETS_FIXTURE = [
  { title: 'US Topo', sbDatasetTag: 'US Topo', parentCategory: 'Map', id: 'us-topo-main' },
  { title: 'Historical Topographic Maps', sbDatasetTag: 'Historical Topographic Maps', parentCategory: 'Map', id: 'historical-topo' },
];
// --- TNM: recorded 2026-11-07, GET .../api/v1/products?bbox=...&datasets=US Topo (1 of 21 items, trimmed) ---
const TNM_PRODUCTS_FIXTURE = {
  total: 21,
  items: [
    {
      title: 'US Topo 7.5-minute map for Emma, IL,IN',
      sourceId: '66c3ff57d34e03388287ece8',
      sourceName: 'ScienceBase',
      metaUrl: 'https://www.sciencebase.gov/catalog/item/66c3ff57d34e03388287ece8',
      downloadURL: 'https://prd-tnm.s3.amazonaws.com/StagedProducts/Maps/USTopo/PDF/IL/IL_Emma_20240816_TM_geo.pdf',
      sizeInBytes: 32160202,
      format: 'Geospatial PDF',
    },
  ],
  errors: [],
  messages: [],
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ---------------------------------------------------------------- NHD ----
test('nhd parses recorded real service-metadata shape', async () => {
  const adapter = new NhdAdapter();
  const envelope = await adapter.getServiceMetadata({
    fetcher: (async () => jsonResponse(NHD_METADATA_FIXTURE)) as typeof fetch,
  });
  assert.equal(envelope.provenance.provider, 'usgs-nhd');
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.result.mapName, 'nhd');
  assert.equal(envelope.result.maxRecordCount, 2000);
  assert.equal((envelope.result.layers as { id: number; name: string }[]).length, 3);
  assert.equal((envelope.result.layers as { name: string }[])[0].name, 'Point');
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('nhd parses recorded real layer shape', async () => {
  const adapter = new NhdAdapter();
  const envelope = await adapter.getLayer(0, {
    fetcher: (async () => jsonResponse(NHD_LAYER_FIXTURE)) as typeof fetch,
  });
  assert.equal(envelope.result.name, 'Point');
  assert.equal(envelope.result.type, 'Feature Layer');
  assert.equal(envelope.result.geometryType, 'esriGeometryPoint');
  const fields = envelope.result.fields as { name: string }[];
  assert.ok(fields.some((f) => f.name === 'GNIS_NAME'));
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('nhd queryLayer parses recorded real query shape and builds a bounded URL', async () => {
  const adapter = new NhdAdapter();
  let captured = '';
  const envelope = await adapter.queryLayer(0, '1=1', {
    fetcher: (async (input: unknown) => {
      captured = String(input);
      return jsonResponse(NHD_QUERY_FIXTURE);
    }) as typeof fetch,
  });
  const url = new URL(captured);
  assert.equal(url.origin + url.pathname, 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/0/query');
  assert.equal(url.searchParams.get('where'), '1=1');
  assert.equal(url.searchParams.get('f'), 'json');
  assert.equal(url.searchParams.get('returnGeometry'), 'false');
  assert.equal(url.searchParams.get('resultRecordCount'), '100');
  const features = envelope.result.features as { attributes: Record<string, unknown> }[];
  assert.equal(features.length, 1);
  assert.equal(features[0].attributes['OBJECTID'], 1);
  assert.equal(features[0].attributes['FTYPE'], 367);
  assert.equal(envelope.result.exceededTransferLimit, true);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('nhd rejects invalid layerId and where before fetching', async () => {
  const adapter = new NhdAdapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(NHD_METADATA_FIXTURE);
  }) as typeof fetch;
  await assert.rejects(() => adapter.getLayer(-1, { fetcher: never }), /NHD_LAYER_ID_INVALID/);
  await assert.rejects(() => adapter.getLayer(1.5, { fetcher: never }), /NHD_LAYER_ID_INVALID/);
  await assert.rejects(() => adapter.getLayer(Number.NaN, { fetcher: never }), /NHD_LAYER_ID_INVALID/);
  await assert.rejects(() => adapter.queryLayer(0, '', { fetcher: never }), /NHD_WHERE_INVALID/);
  await assert.rejects(() => adapter.queryLayer(0, '   ', { fetcher: never }), /NHD_WHERE_INVALID/);
  await assert.rejects(() => adapter.queryLayer(-2, '1=1', { fetcher: never }), /NHD_LAYER_ID_INVALID/);
  assert.equal(called, false);
});

test('nhd surfaces honest HTTP errors, never fabricated data', async () => {
  const adapter = new NhdAdapter();
  await assert.rejects(
    () => adapter.getServiceMetadata({ fetcher: (async () => new Response('oops', { status: 500, headers: { 'content-type': 'text/plain' } })) as typeof fetch }),
    /GOVERNMENT_SOURCE_HTTP_500/,
  );
});

// ------------------------------------------------------- Publications ----
test('usgs-publications search parses recorded real search shape and builds the query URL', async () => {
  const adapter = new UsgsPublicationsAdapter();
  let captured = '';
  const envelope = await adapter.searchPublications('flood', {
    limit: 15,
    fetcher: (async (input: unknown) => {
      captured = String(input);
      return jsonResponse(PUBS_SEARCH_FIXTURE);
    }) as typeof fetch,
  });
  const url = new URL(captured);
  assert.equal(url.origin + url.pathname, 'https://pubs.usgs.gov/pubs-services/publication');
  assert.equal(url.searchParams.get('mimetype'), 'json');
  assert.equal(url.searchParams.get('q'), 'flood');
  assert.equal(url.searchParams.get('pageSize'), '15');
  assert.equal(envelope.provenance.provider, 'usgs-publications');
  assert.equal(envelope.result.recordCount, 8655);
  const records = envelope.result.records as { id: number; title: string }[];
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 70283491);
  assert.ok(records[0].title.includes('Precipitation probability distribution'));
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('usgs-publications getPublication parses recorded real record shape', async () => {
  const adapter = new UsgsPublicationsAdapter();
  let captured = '';
  const envelope = await adapter.getPublication(70283491, {
    fetcher: (async (input: unknown) => {
      captured = String(input);
      return jsonResponse(PUBS_ONE_FIXTURE);
    }) as typeof fetch,
  });
  assert.equal(captured, 'https://pubs.usgs.gov/pubs-services/publication/70283491?mimetype=json');
  assert.equal(envelope.result.id, 70283491);
  assert.equal(envelope.result.doi, '10.21423/twj.v17i1.7221');
  assert.equal(envelope.result.publicationYear, '2026');
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('usgs-publications rejects empty query, bad limit, and empty id before fetching', async () => {
  const adapter = new UsgsPublicationsAdapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(PUBS_SEARCH_FIXTURE);
  }) as typeof fetch;
  await assert.rejects(() => adapter.searchPublications('', { fetcher: never }), /USGS_PUBLICATIONS_QUERY_INVALID/);
  await assert.rejects(() => adapter.searchPublications('   ', { fetcher: never }), /USGS_PUBLICATIONS_QUERY_INVALID/);
  await assert.rejects(() => adapter.searchPublications('flood', { limit: 0, fetcher: never }), /USGS_PUBLICATIONS_LIMIT_INVALID/);
  await assert.rejects(() => adapter.searchPublications('flood', { limit: 101, fetcher: never }), /USGS_PUBLICATIONS_LIMIT_INVALID/);
  await assert.rejects(() => adapter.searchPublications('flood', { limit: 1.5, fetcher: never }), /USGS_PUBLICATIONS_LIMIT_INVALID/);
  await assert.rejects(() => adapter.getPublication('', { fetcher: never }), /USGS_PUBLICATIONS_ID_INVALID/);
  await assert.rejects(() => adapter.getPublication('   ', { fetcher: never }), /USGS_PUBLICATIONS_ID_INVALID/);
  assert.equal(called, false);
});

// ---------------------------------------------------------------- TNM ----
test('tnm getDatasets parses recorded real dataset list shape', async () => {
  const adapter = new TnmAdapter();
  const envelope = await adapter.getDatasets({
    fetcher: (async () => jsonResponse(TNM_DATASETS_FIXTURE)) as typeof fetch,
  });
  assert.equal(envelope.provenance.provider, 'usgs-tnm');
  assert.ok(Array.isArray(envelope.result));
  assert.equal(envelope.result.length, 2);
  assert.equal((envelope.result[0] as { title: string }).title, 'US Topo');
  assert.equal((envelope.result[0] as { id: string }).id, 'us-topo-main');
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('tnm searchProducts parses recorded real product shape and builds the query URL', async () => {
  const adapter = new TnmAdapter();
  let captured = '';
  const envelope = await adapter.searchProducts(
    { bbox: [-88.1, 37.8, -87.9, 37.9], datasets: 'US Topo', prodFormats: 'GeoPDF' },
    {
      fetcher: (async (input: unknown) => {
        captured = String(input);
        return jsonResponse(TNM_PRODUCTS_FIXTURE);
      }) as typeof fetch,
    },
  );
  const url = new URL(captured);
  assert.equal(url.origin + url.pathname, 'https://tnmaccess.nationalmap.gov/api/v1/products');
  assert.equal(url.searchParams.get('bbox'), '-88.1,37.8,-87.9,37.9');
  assert.equal(url.searchParams.get('datasets'), 'US Topo');
  assert.equal(url.searchParams.get('prodFormats'), 'GeoPDF');
  assert.equal(envelope.result.total, 21);
  const items = envelope.result.items as { title: string; format: string; downloadURL: string }[];
  assert.equal(items.length, 1);
  assert.ok(items[0].title.includes('US Topo 7.5-minute map for Emma'));
  assert.equal(items[0].format, 'Geospatial PDF');
  assert.ok(items[0].downloadURL.startsWith('https://prd-tnm.s3.amazonaws.com/'));
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('tnm rejects invalid bbox and empty datasets/prodFormats before fetching', async () => {
  const adapter = new TnmAdapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(TNM_PRODUCTS_FIXTURE);
  }) as typeof fetch;
  const badBboxes: unknown[] = [
    [-88.1, 37.8, -87.9], // too short
    [-88.1, 37.8, -87.9, 37.9, 0], // too long
    [-87.9, 37.8, -88.1, 37.9], // minLon >= maxLon
    [-88.1, 37.9, -87.9, 37.8], // minLat >= maxLat
    [-181, 37.8, -87.9, 37.9], // lon out of range
    [-88.1, -91, -87.9, 37.9], // lat out of range
    [-88.1, 37.8, -87.9, Number.NaN], // non-finite
    'not-a-bbox',
    undefined,
  ];
  for (const bbox of badBboxes) {
    await assert.rejects(
      () => adapter.searchProducts({ bbox: bbox as [number, number, number, number] }, { fetcher: never }),
      /TNM_BBOX_INVALID/,
    );
  }
  await assert.rejects(
    () => adapter.searchProducts({ bbox: [-88.1, 37.8, -87.9, 37.9], datasets: '' }, { fetcher: never }),
    /TNM_DATASETS_INVALID/,
  );
  await assert.rejects(
    () => adapter.searchProducts({ bbox: [-88.1, 37.8, -87.9, 37.9], prodFormats: '   ' }, { fetcher: never }),
    /TNM_PROD_FORMATS_INVALID/,
  );
  assert.equal(called, false);
});

test('all three sources are registered with the expected endpoints', () => {
  assert.equal(getGovernmentSource('usgs-nhd').endpoint, 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer');
  assert.equal(getGovernmentSource('usgs-nhd').authority, 'USGS');
  assert.equal(getGovernmentSource('usgs-publications').endpoint, 'https://pubs.usgs.gov/pubs-services/publication');
  assert.equal(getGovernmentSource('usgs-tnm').endpoint, 'https://tnmaccess.nationalmap.gov/api/v1');
  assert.equal(new NhdAdapter().sourceId, 'usgs-nhd');
  assert.equal(new UsgsPublicationsAdapter().sourceId, 'usgs-publications');
  assert.equal(new TnmAdapter().sourceId, 'usgs-tnm');
});

// ------------------------------------------------------- Live smoke ------
// Live tests assert ONLY structural facts (HTTP 200 via a valid envelope,
// expected top-level shape, recorded SHA-256) — never specific live values
// that change between runs. The SHA-256 printed per test is the hash of the
// raw response body as received in this run.
function logLive(label: string, envelope: { evidence: readonly { sha256: string }[]; citations: readonly { url: string }[] }): void {
  console.log(`LIVE ${label} sha256=${envelope.evidence[0].sha256} url=${envelope.citations[0].url}`);
}

test('LIVE nhd service metadata returns 200 with the real MapServer shape', { timeout: 60000 }, async () => {
  const envelope = await new NhdAdapter().getServiceMetadata();
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  assert.equal(typeof envelope.result.currentVersion, 'number');
  assert.equal(envelope.result.mapName, 'nhd');
  assert.ok(Array.isArray(envelope.result.layers));
  assert.ok((envelope.result.layers as unknown[]).length > 0);
  logLive('nhd-metadata', envelope);
});

test('LIVE usgs-publications search returns 200 with the real search shape', { timeout: 60000 }, async () => {
  const envelope = await new UsgsPublicationsAdapter().searchPublications('flood', { limit: 5 });
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  assert.ok(Array.isArray(envelope.result.records));
  assert.ok('recordCount' in envelope.result);
  logLive('pubs-search', envelope);
});

test('LIVE tnm datasets returns 200 with the real dataset list shape', { timeout: 60000 }, async () => {
  const envelope = await new TnmAdapter().getDatasets();
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  assert.ok(Array.isArray(envelope.result));
  assert.ok(envelope.result.length > 0);
  assert.equal(typeof (envelope.result[0] as { title: string }).title, 'string');
  logLive('tnm-datasets', envelope);
});

test('LIVE tnm products returns 200 with the real product shape (catalog metadata only)', { timeout: 60000 }, async () => {
  const envelope = await new TnmAdapter().searchProducts({
    bbox: [-88.1, 37.8, -87.9, 37.9],
    datasets: 'US Topo',
    prodFormats: 'GeoPDF',
  });
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  assert.equal(typeof envelope.result.total, 'number');
  assert.ok(Array.isArray(envelope.result.items));
  // Catalog records only: no elevation values anywhere in the result.
  assert.ok(!('elevation' in envelope.result));
  logLive('tnm-products', envelope);
});
