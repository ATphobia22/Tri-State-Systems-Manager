#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const registry = JSON.parse(await readFile(resolve(ROOT, 'integrations/registry/capabilities.json'), 'utf8'));
const quantum = registry.capabilities.find((entry) => entry.id === 'openfermion-cirq');

if (!quantum) throw new Error('OpenFermion-Cirq capability is missing from the registry.');
if (quantum.upstream_status !== 'deprecated-and-archived') throw new Error('Deprecated quantum source must be explicitly marked archived.');
if (!quantum.forbidden_use.includes('authoritative-state-mutation')) throw new Error('Quantum boundary must forbid authoritative-state mutation.');
if (!quantum.forbidden_use.includes('production-regulatory-decision')) throw new Error('Quantum boundary must forbid production regulatory decisions.');
if (quantum.runtime_boundary !== 'isolated-opt-in-research-workflow') throw new Error('Quantum runtime boundary is not isolated and opt-in.');

console.log('Quantum boundary checks passed: research-only, isolated, non-authoritative.');
