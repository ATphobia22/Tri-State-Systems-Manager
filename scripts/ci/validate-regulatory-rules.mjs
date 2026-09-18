#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const path = new URL('../../data/regulatory/tsm-floodway-rules-v1.json', import.meta.url);
const registry = JSON.parse(await readFile(path, 'utf8'));

if (!Array.isArray(registry.rules) || registry.rules.length === 0) {
  throw new Error('Regulatory rule registry must contain at least one rule.');
}

const ids = new Set();
for (const rule of registry.rules) {
  for (const key of ['id', 'jurisdiction', 'authority', 'citation', 'title', 'applicability', 'sourceUrl', 'status']) {
    if (!rule[key]) throw new Error(rule.id ?? '<unknown>' + ': missing ' + key);
  }
  if (ids.has(rule.id)) throw new Error('duplicate regulatory rule id: ' + rule.id);
  ids.add(rule.id);

  const url = new URL(rule.sourceUrl);
  if (url.protocol !== 'https:') throw new Error(rule.id + ': source URL must use HTTPS');

  if (rule.status !== 'VERIFIED_OFFICIAL_SOURCE') {
    throw new Error(rule.id + ': only verified official sources may enter the active rule registry');
  }

  if (rule.threshold !== undefined && (!Number.isFinite(rule.threshold) || rule.threshold < 0)) {
    throw new Error(rule.id + ': threshold must be a finite non-negative number');
  }
}

const controls = registry.controls ?? {};
for (const key of [
  'never_use_as_global_constant',
  'require_jurisdiction_match',
  'require_applicability_match',
  'require_source_verification',
  'regulatory_determination_requires_human_review',
]) {
  if (controls[key] !== true) throw new Error('Regulatory rule fail-closed control missing: ' + key);
}

console.log('validated ' + registry.rules.length + ' verified regulatory rule records');
