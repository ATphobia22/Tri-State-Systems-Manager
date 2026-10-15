import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertExpectedLayer,
  fetchWmsCapabilities,
  parseWmsLayerNames,
  validateCapabilitiesUrl,
} from '../scripts/geospatial/verify-noaa-cloudgis.mjs';

const capabilities = `<?xml version="1.0"?>
<WMS_Capabilities version="1.3.0">
  <Service><Name>WMS</Name><Title>Test service</Title></Service>
  <Capability><Layer><Title>Root</Title>
    <Layer><Name>wwa:warnings</Name><Title>Warnings</Title></Layer>
    <Layer><Name>conus:conus_cref_qcd</Name><Title>Composite reflectivity</Title></Layer>
  </Layer></Capability>
</WMS_Capabilities>`;

test('NOAA capabilities URLs are HTTPS and host/path allowlisted', () => {
  assert.equal(validateCapabilitiesUrl('https://opengeo.ncep.noaa.gov/geoserver/wwa/warnings/ows?service=WMS&request=GetCapabilities').hostname, 'opengeo.ncep.noaa.gov');
  assert.throws(() => validateCapabilitiesUrl('http://opengeo.ncep.noaa.gov/geoserver/wwa/warnings/ows'), /HTTPS/);
  assert.throws(() => validateCapabilitiesUrl('https://example.com/geoserver/ows'), /approved NOAA/);
  assert.throws(() => validateCapabilitiesUrl('https://opengeo.ncep.noaa.gov.evil.example/geoserver/ows'), /approved NOAA/);
});

test('WMS parser extracts qualified layer names and checks expected layer', () => {
  const names = parseWmsLayerNames(capabilities);
  assert.equal(names.has('wwa:warnings'), true);
  assert.equal(names.has('conus:conus_cref_qcd'), true);
  assert.deepEqual(assertExpectedLayer(capabilities, 'wwa:warnings'), { expectedLayer: 'wwa:warnings', available: true });
  assert.throws(() => assertExpectedLayer(capabilities, 'wwa:renamed_layer'), /missing from GetCapabilities/);
});

test('WMS parser rejects HTML, OGC exception documents, and oversized content', () => {
  assert.throws(() => parseWmsLayerNames('<html><body>maintenance</body></html>'), /not a WMS/);
  assert.throws(() => parseWmsLayerNames('<ServiceExceptionReport/>'), /not a WMS/);
  assert.throws(() => parseWmsLayerNames('<WMS_Capabilities>' + 'x'.repeat(5 * 1024 * 1024) + '</WMS_Capabilities>'), /exceeds/);
});

test('capabilities fetch rejects unexpected content types and redirects are disabled', async () => {
  let requestOptions;
  await assert.rejects(fetchWmsCapabilities(
    'https://opengeo.ncep.noaa.gov/geoserver/wwa/warnings/ows?service=WMS&request=GetCapabilities',
    async (_url, options) => {
      requestOptions = options;
      return new Response('<html/>', { headers: { 'content-type': 'text/html' } });
    },
  ), /unexpected content type/);
  assert.equal(requestOptions.redirect, 'error');
  assert.equal(requestOptions.method, 'GET');
});

test('capabilities fetch accepts a bounded XML response', async () => {
  const xml = await fetchWmsCapabilities(
    'https://opengeo.ncep.noaa.gov/geoserver/wwa/warnings/ows?service=WMS&request=GetCapabilities',
    async () => new Response(capabilities, { headers: { 'content-type': 'application/xml' } }),
  );
  assert.equal(assertExpectedLayer(xml, 'conus:conus_cref_qcd').available, true);
});
