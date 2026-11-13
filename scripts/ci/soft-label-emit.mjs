#!/usr/bin/env node
/**
 * Soft-label emitter. Never process.exit(1).
 * Usage: node soft-label-emit.mjs --label STAGE_INVALID --detail "obs_not_current"
 */
const args = process.argv.slice(2);
const label = args[args.indexOf('--label') + 1] || 'UNKNOWN';
const detail = args[args.indexOf('--detail') + 1] || '';
const payload = {
  label,
  detail,
  severity: 'soft',
  timestamp: new Date().toISOString(),
  blocks_system: false,
};
console.log(JSON.stringify(payload));
// always succeed
process.exit(0);
