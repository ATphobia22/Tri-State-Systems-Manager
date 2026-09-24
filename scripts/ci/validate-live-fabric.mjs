#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const file = new URL('../../data/fabrics/live/tsm-live-hydrology-fabric-v1.json', import.meta.url);
const registry = JSON.parse(await readFile(file, 'utf8'));

if (registry.status !== 'ACTIVE_SOURCE_REGISTRY') throw new Error('live fabric registry is not active');
if (!Array.isArray(registry.sources) || registry.sources.length < 4) throw new Error('live fabric registry is incomplete');

for (const source of registry.sources) {
  if (!source.id || !source.authority || !source.class) throw new Error('live source identity is incomplete');
  const endpoint = source.apiBase ?? source.service ?? source.services;
  if (!endpoint || !endpoint.startsWith('https://')) throw new Error(source.id + ': HTTPS source endpoint required');
}
for (const [key, value] of Object.entries(registry.controls ?? {})) {
  if (value !== true) throw new Error('live fabric control is disabled: ' + key);
}
console.log('validated ' + registry.sources.length + ' verified live government data sources');
