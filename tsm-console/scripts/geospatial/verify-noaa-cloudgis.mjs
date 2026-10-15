#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ALLOWED_HOSTS = new Set(['opengeo.ncep.noaa.gov']);
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export function validateCapabilitiesUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password) {
    throw new Error('NOAA capabilities URL must use HTTPS on the approved NOAA GeoServer host.');
  }
  if (!url.pathname.includes('/geoserver/')) {
    throw new Error('NOAA capabilities URL must target the documented GeoServer path.');
  }
  return url;
}

export function parseWmsLayerNames(xml) {
  if (typeof xml !== 'string' || xml.length === 0 || Buffer.byteLength(xml, 'utf8') > MAX_BYTES) {
    throw new Error('WMS capabilities document is empty or exceeds the safety limit.');
  }
  if (!/<(?:\w+:)?(?:WMS_Capabilities|WMT_MS_Capabilities)\b/i.test(xml)) {
    throw new Error('Response is not a WMS capabilities document.');
  }
  if (/<(?:\w+:)?(?:ServiceException|ExceptionReport)\b/i.test(xml)) {
    throw new Error('WMS service returned an OGC exception document.');
  }
  const names = new Set();
  const namePattern = /<(?:[\w.-]+:)?Name\b[^>]*>\s*([^<\s][^<]*?)\s*<\/(?:[\w.-]+:)?Name\s*>/gi;
  for (const match of xml.matchAll(namePattern)) {
    const name = match[1].trim();
    if (/^[A-Za-z0-9_.:-]+$/.test(name) && name.length <= 256) names.add(name);
  }
  return names;
}

export function assertExpectedLayer(xml, expectedLayer) {
  if (typeof expectedLayer !== 'string' || !/^(?:[A-Za-z0-9_.-]+:)?[A-Za-z0-9_.-]+$/.test(expectedLayer)) {
    throw new Error('Expected published layer name is invalid.');
  }
  const names = parseWmsLayerNames(xml);
  if (!names.has(expectedLayer)) {
    throw new Error('Configured WMS layer is missing from GetCapabilities: ' + expectedLayer);
  }
  return { expectedLayer, available: true };
}

async function readBoundedText(response, maxBytes = MAX_BYTES) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new Error('NOAA capabilities response exceeds the safety limit.');
  }
  if (!response.body) throw new Error('NOAA capabilities response has no body.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('NOAA capabilities response exceeds the safety limit.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size).toString('utf8');
}

export async function fetchWmsCapabilities(rawUrl, fetchImpl = fetch) {
  const url = validateCapabilitiesUrl(rawUrl);
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/xml, text/xml;q=0.9' },
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('NOAA GetCapabilities returned HTTP ' + response.status + '.');
  }
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('xml') && !contentType.includes('text/plain')) {
    await response.body?.cancel();
    throw new Error('NOAA GetCapabilities returned an unexpected content type.');
  }
  return readBoundedText(response);
}

export async function verifyCatalog(catalog, fetchImpl = fetch) {
  if (!catalog || !Array.isArray(catalog.layers) || catalog.layers.length === 0) {
    throw new Error('NOAA catalog must contain at least one layer.');
  }
  const results = [];
  for (const layer of catalog.layers) {
    const xml = await fetchWmsCapabilities(layer.capabilities_url, fetchImpl);
    results.push({
      id: layer.id,
      ...assertExpectedLayer(xml, layer.expected_layer_name),
    });
  }
  return { checkedAt: new Date().toISOString(), results };
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const catalogPath = path.resolve(scriptDir, '../../../data/sources/noaa-cloudgis-catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const result = await verifyCatalog(catalog);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error('[tsm] NOAA CloudGIS verification failed:', error.message);
    process.exitCode = 1;
  });
}
