#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function load(rel) {
  const p = resolve(root, rel);
  if (!existsSync(p)) throw new Error(`missing ${rel}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const incomplete = load('contracts/registries/tsm-incomplete-capability-registry-v1.json');
const gaps = load('contracts/registries/tsm-release-gap-registry-v1.json');
const csManifest = load('contracts/registries/tsm-cs-resource-manifest-v1.json');

assert(incomplete.registry_id === 'tsm-incomplete-capability-registry', 'bad incomplete registry id');
assert(Array.isArray(incomplete.capabilities) && incomplete.capabilities.length >= 5, 'incomplete capabilities missing');
assert(incomplete.policy.includes('Human authority'), 'policy must state human authority');

for (const c of incomplete.capabilities) {
  assert(c.id && c.status && c.authority_class, `capability incomplete fields: ${JSON.stringify(c)}`);
  assert(
    ['PLANNED', 'PARTIAL', 'IMPLEMENTED', 'GATED_OPERATOR', 'REJECTED'].includes(c.status),
    `bad status ${c.status} for ${c.id}`,
  );
}

const webgpu = incomplete.capabilities.find((c) => c.id === 'webgpu-terrain-presentation');
assert(webgpu, 'webgpu-terrain-presentation must be registered');
assert(webgpu.status === 'IMPLEMENTED', 'webgpu-terrain-presentation must be IMPLEMENTED');

const culling = incomplete.capabilities.find((c) => c.id === 'gpu-compute-culling');
assert(culling && culling.status === 'PARTIAL', 'CPU frustum planning must not be labeled GPU compute culling');
const csSwap = incomplete.capabilities.find((c) => c.id === 'cs-asset-swapping');
assert(csSwap && csSwap.status === 'PARTIAL', 'plan-only C/S scheduling must remain PARTIAL');
for (const id of [
  'gpu-hierarchical-z-occlusion',
  'transvoxel-transition-mesh-coverage',
  'aoi-terrain-coverage',
  'crs-vertical-datum-epoch-accuracy-catalog',
  'cross-device-gpu-validation',
]) {
  const capability = incomplete.capabilities.find((c) => c.id === id);
  assert(capability && ['PARTIAL', 'PLANNED'].includes(capability.status), `${id} must remain open until acceptance evidence exists`);
}

for (const rel of [
  'tsm-console/src/gpu/open-world-raytracer.ts',
  'tsm-console/src/gpu/webgpu-camera-bridge.ts',
  'tsm-console/src/gpu/frustum-culling.ts',
  'tsm-console/src/components/WebGpuTerrainCanvas.tsx',
  'tsm-console/src/lib/tiles-cache-policy.ts',
  'tsm-console/src/lib/cs-resource-scheduler.ts',
  'integrations/adapters/external-presentation-adapters.mjs',
]) {
  assert(existsSync(resolve(root, rel)), `missing required path ${rel}`);
}

assert(gaps.registry_id === 'tsm-release-gap-registry', 'bad gap registry id');
const codeClosable = [
  'gap-webgpu-host-bridge',
  'gap-vitest-lock-5.0.5',
  'gap-vitest-lock-5.0.5',
];
for (const id of codeClosable) {
  const g = gaps.gaps.find((x) => x.id === id);
  assert(g && String(g.status).startsWith('CLOSED'), `${id} must be CLOSED`);
}

for (const id of [
  'gap-gpu-compute-culling',
  'gap-renderer-cache-bytes',
  'gap-cs-resource-manifest',
  'gap-gpu-hierarchical-z',
  'gap-transvoxel-full-coverage',
  'gap-aoi-terrain-coverage',
  'gap-crs-datum-accuracy-catalog',
  'gap-cross-device-gpu-validation',
]) {
  const g = gaps.gaps.find((x) => x.id === id);
  assert(g && !String(g.status).startsWith('CLOSED'), `${id} must remain open until acceptance evidence exists`);
}
assert(csManifest.scheduler.swap_enabled === false, 'cs swap must remain disabled until variants exist');
const cachePolicy = readFileSync(resolve(root, 'tsm-console/src/lib/tiles-cache-policy.ts'), 'utf8');
assert(cachePolicy.includes('Byte budgets are host guidance'), 'cache policy must not imply hard byte enforcement');

const plane = load('integrations/registry/tsm-capability-control-plane.json');
const planeEntry = plane.capabilities.find((c) => c.id === 'webgpu-terrain-presentation');
assert(planeEntry && planeEntry.authority_class === 'PRESENTATION', 'control plane webgpu entry required');

console.log(
  JSON.stringify({
    ok: true,
    incomplete_capabilities: incomplete.capabilities.length,
    release_gaps: gaps.gaps.length,
    webgpu_terrain: webgpu.status,
    code_closable_closed: codeClosable.length,
    open_technical_gaps: gaps.gaps.filter((g) => ['PARTIAL_2026-10-23', 'OPEN'].includes(g.status)).map((g) => g.id),
    gated_operator: gaps.gaps.filter((g) => g.status === 'GATED_OPERATOR').map((g) => g.id),
  }),
);
