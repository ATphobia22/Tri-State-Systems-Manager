import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInfluenceGraph } from './river-influence.mjs';

test('candidate dams are represented without asserting causality', () => {
  const graph = buildInfluenceGraph({
    structures: [{ name: 'Smithland Locks and Dam' }, { name: 'Olmsted Locks and Dam' }],
    stations: [{ stationId: '03378500', name: 'Wabash River at New Harmony' }],
  });
  assert.equal(graph.nodes.some((node) => node.name === 'Smithland Locks and Dam'), true);
  assert.equal(graph.edges.length, 0);
});

test('model evidence is required before a causal influence edge is emitted', () => {
  const graph = buildInfluenceGraph({
    structures: [{ name: 'Smithland Locks and Dam' }],
    stations: [{ stationId: '03381700', name: 'Ohio River at Old Shawneetown' }],
    modeledRelationships: [{ from: 'DAM:Smithland Locks and Dam', to: 'GAUGE:03381700', evidenceIds: ['MODEL-001'], confidence: 'MEDIUM' }],
  });
  assert.equal(graph.edges.length, 1);
  assert.deepEqual(graph.edges[0].evidenceIds, ['MODEL-001']);
});
