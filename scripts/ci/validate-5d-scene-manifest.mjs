#!/usr/bin/env node
// Headless TSM 5D manifest safeguard: deliberately independent of optional packages.
// This is a policy validator, not physical verification of raster or regulatory records.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function validate5dManifest(manifest) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['manifest must be an object'];
  if (manifest.schemaVersion !== 'tsm-5d-scene-manifest-v1') fail('unsupported schemaVersion');
  if (typeof manifest.sceneId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,127}$/.test(manifest.sceneId)) fail('invalid sceneId');
  const allowedCounty = new Set(['18129', '18163', '18051', '18173', '17193', '17059', '21101', '21225']);
  if (!Array.isArray(manifest.countyGeoids) || manifest.countyGeoids.length === 0 || manifest.countyGeoids.some(id => !allowedCounty.has(id)) || new Set(manifest.countyGeoids).size !== manifest.countyGeoids.length) fail('countyGeoids must be unique engineering-eight Census GEOIDs');
  const dims = manifest.dimensions;
  if (!dims || typeof dims !== 'object' || !dims.spatial || !dims.time || !dims.scenario) {
    fail('3D spatial, UTC time and scenario dimensions are mandatory');
  } else {
    if (typeof dims.spatial.horizontalCrs !== 'string' || !dims.spatial.horizontalCrs || typeof dims.spatial.verticalDatum !== 'string' || !dims.spatial.verticalDatum || !['m','ftUS','unknown'].includes(dims.spatial.verticalUnits)) fail('scene CRS/vertical metadata incomplete');
    if (typeof dims.time.instantUtc !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(dims.time.instantUtc) || Number.isNaN(Date.parse(dims.time.instantUtc))) fail('scene time must be real ISO UTC instant');
    if (!dims.scenario.id || !['reference', 'observed', 'historical', 'hypothetical', 'derived'].includes(dims.scenario.kind)) fail('scenario identity/kind is mandatory');
  }
  if (!Array.isArray(manifest.layers)) fail('layers must be an array');
  const layerKinds = new Set(['terrain','imagery','parcels','buildings','road','hydrography','well','waterLevel','floodHazard','modelOutput','cinematicOverlay']);
  const states = new Set(['SOURCE_DISCOVERED','ACQUIRED','QC_FAILED','ENGINEERING_VALIDATED']);
  const temporal = new Set(['static','snapshot','observation','forecast','simulation']);
  const regulatory = new Set(['NOT_REGULATORY','REFERENCE_ONLY','SOURCE_EFFECTIVE_UNVERIFIED','VERIFIED_EFFECTIVE']);
  const hashes = /^[a-f0-9]{64}$/;
  const ids = new Set();
  for (const [i, layer] of (Array.isArray(manifest.layers) ? manifest.layers : []).entries()) {
    const p = 'layers[' + i + ']';
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) { fail(p + ': invalid layer'); continue; }
    if (typeof layer.id !== 'string' || !layer.id.trim() || ids.has(layer.id)) fail(p + ': missing or duplicate id');
    ids.add(layer.id);
    if (!layerKinds.has(layer.kind)) fail(p + ': unknown layer kind');
    if (!states.has(layer.state)) fail(p + ': unknown evidence state');
    if (!temporal.has(layer.temporalClass)) fail(p + ': unknown temporal class');
    if (!regulatory.has(layer.regulatoryStatus)) fail(p + ': invalid regulatory status');
    if (!layer.authority || !layer.license) fail(p + ': source authority and license status required');
    if (typeof layer.sourceUrl !== 'string' || !layer.sourceUrl.startsWith('https://')) fail(p + ': https source URL required');
    if (typeof layer.nativeHorizontalCrs !== 'string' || !layer.nativeHorizontalCrs || typeof layer.nativeVerticalDatum !== 'string' || !layer.nativeVerticalDatum || !['m','ftUS','not_applicable','unknown'].includes(layer.nativeVerticalUnits)) fail(p + ': native datum/units required, unknown allowed only before promotion');
    if (!['NOT_CHECKED','INTERSECTS_EXACT_COUNTY','WITHIN_EXACT_COUNTY','FAILED'].includes(layer.boundaryCheck)) fail(p + ': invalid exact-county relation');
    if (!Array.isArray(layer.validationEvidence)) fail(p + ': validationEvidence must be array');
    if (layer.sourceHashSha256 != null && (typeof layer.sourceHashSha256 !== 'string' || !hashes.test(layer.sourceHashSha256))) fail(p + ': invalid SHA-256');
    if (layer.state === 'ENGINEERING_VALIDATED') {
      if (!hashes.test(layer.sourceHashSha256 ?? '')) fail(p + ': validated layer requires real SHA-256');
      if (typeof layer.retrievedAtUtc !== 'string' || !layer.retrievedAtUtc.endsWith('Z') || Number.isNaN(Date.parse(layer.retrievedAtUtc))) fail(p + ': validated layer requires UTC retrieval time');
      if (layer.nativeHorizontalCrs === 'unknown' || layer.nativeVerticalDatum === 'unknown' || layer.nativeVerticalUnits === 'unknown') fail(p + ': unknown native CRS/datum/units cannot pass validation');
      if (!['INTERSECTS_EXACT_COUNTY','WITHIN_EXACT_COUNTY'].includes(layer.boundaryCheck)) fail(p + ': exact county polygon check required');
      if (!Array.isArray(layer.validationEvidence) || layer.validationEvidence.length === 0) fail(p + ': attach independent validation evidence');
    }
    if (layer.regulatoryStatus === 'VERIFIED_EFFECTIVE' && layer.state !== 'ENGINEERING_VALIDATED') fail(p + ': effective regulatory claim requires engineering evidence');
  }
  if (!['NOT_VALIDATED','PARTIAL','ENGINEERING_VALIDATED'].includes(manifest.releaseGate)) fail('invalid releaseGate');
  if (manifest.releaseGate === 'ENGINEERING_VALIDATED') {
    if (!Array.isArray(manifest.layers) || manifest.layers.length === 0 || manifest.layers.some(layer => layer?.state !== 'ENGINEERING_VALIDATED')) fail('overall validation requires every nonempty layer to pass its checks');
    if (dims?.spatial?.verticalDatum === 'unknown' || dims?.spatial?.verticalUnits === 'unknown') fail('overall validation requires known scene datum and units');
  }
  return errors;
}

const executedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (executedDirectly) {
  const path = resolve(process.argv[2] ?? 'data/schemas/examples/tsm-5d-scene-manifest-v1.example.json');
  try {
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    const errors = validate5dManifest(manifest);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('5D manifest policy valid (does NOT verify source bytes, science, licensing, or shipping): ' + path);
  } catch (error) {
    console.error('Cannot validate 5D manifest:', error.message);
    process.exitCode = 1;
  }
}
