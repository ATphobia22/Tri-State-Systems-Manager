#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const file = new URL('../../data/fabrics/live/tsm-live-hydrology-fabric-v1.json', import.meta.url);
const registry = JSON.parse(await readFile(file, 'utf8'));

const ALLOWED_STATUSES = ['ACTIVE_SOURCE_REGISTRY', 'PARTIALLY_RETIRED_BY_OWNER'];
if (!ALLOWED_STATUSES.includes(registry.status)) {
  throw new Error('live fabric registry has an unexpected status: ' + registry.status);
}
if (!Array.isArray(registry.sources) || registry.sources.length < 1) {
  throw new Error('live fabric registry has no sources');
}

for (const source of registry.sources) {
  if (!source.id || !source.authority || !source.class) throw new Error('live source identity is incomplete');
  const endpoint = source.apiBase ?? source.service ?? source.services;
  if (!endpoint || !endpoint.startsWith('https://')) throw new Error(source.id + ': HTTPS source endpoint required');
  if (source.status === 'retired' && !source.retiredReason) {
    throw new Error(source.id + ': retired sources must record a retiredReason');
  }
  if (source.status !== 'retired' && source.status !== 'active') {
    throw new Error(source.id + ': source status must be "active" or "retired"');
  }
}
for (const [key, value] of Object.entries(registry.controls ?? {})) {
  if (value !== true) throw new Error('live fabric control is disabled: ' + key);
}

// Owner decision 2026-09-29: live river data is dropped. The live river
// observation/forecast sources must be retired in this registry.
const retiredIds = new Set(
  registry.sources.filter((s) => s.status === 'retired').map((s) => s.id),
);
for (const mustBeRetired of ['NOAA_NWPS', 'NOAA_NWM']) {
  if (!retiredIds.has(mustBeRetired)) {
    throw new Error(mustBeRetired + ' must be retired: live river data was dropped by owner decision 2026-09-29');
  }
}

const activeCount = registry.sources.filter((s) => s.status === 'active').length;
console.log(
  `validated live fabric registry: ${activeCount} active, ${retiredIds.size} retired (live river data dropped 2026-09-29)`,
);
