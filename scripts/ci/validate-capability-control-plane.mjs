#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = path.join(root, 'integrations/registry/tsm-capability-control-plane.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
const failures = [];
const ids = new Set();
const validModes = new Set(['ENABLED','GATED']);
const validGovernance = new Set(['human_review_required','human_approval_required','professional_review_required']);

if (catalog.schema_version !== '1.0.0') failures.push('unsupported schema_version');
if (catalog.policy !== 'allow-safe-capabilities-gate-consequential-actions') failures.push('unsafe or missing capability policy');
if (catalog.default_mode !== 'ENABLED') failures.push('default_mode must remain ENABLED');

for (const capability of catalog.capabilities ?? []) {
  for (const key of ['id','mode','authority_class','governance','boundary']) {
    if (typeof capability[key] !== 'string' || capability[key].length === 0) failures.push(`${capability.id ?? '<unknown>'}: missing ${key}`);
  }
  if (ids.has(capability.id)) failures.push(`duplicate capability id: ${capability.id}`);
  ids.add(capability.id);
  if (!validModes.has(capability.mode)) failures.push(`${capability.id}: invalid mode`);
  if (!validGovernance.has(capability.governance)) failures.push(`${capability.id}: invalid governance`);
  if (capability.mode === 'ENABLED' && capability.authority_class === 'REGULATORY_ACTION') failures.push(`${capability.id}: regulatory actions cannot be enabled`);
  if (capability.id === 'agent-assistance-s2' && capability.mode !== 'GATED') failures.push('agent-assistance-s2 must remain GATED');
  if (capability.id === 'regulatory-filing' && capability.mode !== 'GATED') failures.push('regulatory-filing must remain GATED');
  if (capability.id === 'quantum-optimization' && capability.mode !== 'GATED') failures.push('quantum-optimization must remain GATED');
}
if (catalog.capabilities.length < 25) failures.push('capability control plane is incomplete: expected at least 25 capabilities');

if (failures.length) {
  console.error('[tsm] FAIL-CLOSED capability control-plane gate');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log(JSON.stringify({ok:true,capabilities:catalog.capabilities.length,policy:catalog.policy,default_mode:catalog.default_mode},null,2));
