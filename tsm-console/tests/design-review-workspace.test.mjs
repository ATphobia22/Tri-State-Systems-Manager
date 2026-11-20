import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REVIEW_SCHEMA, parseDesignReview, flattenDesignTree,
  compareDesignRevisions, summarizeQuantity,
} from '../src/lib/design-review-workspace.ts';

const HASH = 'a'.repeat(64);
const valid = () => ({
  schema: REVIEW_SCHEMA, modelId: 'bridge-1', revisionId: 'rev-a',
  source: { sourceId: 'engineering-file', sha256: HASH, horizontalCrs: 'EPSG:2966', horizontalUnits: 'ftUS', verticalDatum: 'UNVERIFIED', license: 'internal-review' },
  placement: { state: 'PENDING_EVIDENCE', controlCount: 0, maxResidualM: null, toleranceM: null },
  elements: [
    { id: 'main', parentId: null, title: 'Main assembly', category: 'Assembly', quantities: {} },
    { id: 'beam', parentId: 'main', title: 'Concrete girder', category: 'Beam',
      quantities: { volume: { value: 12.5, unit: 'm3', evidence: 'SOURCE_OBSERVATION' } } },
    { id: 'slab', parentId: 'main', title: 'Concrete slab', category: 'Slab',
      quantities: { volume: { value: 7.5, unit: 'm3', evidence: 'DERIVED' } } },
  ],
});

test('preserves coordinate reference and unverified placement, with deterministic BIM tree', () => {
  const review = parseDesignReview(valid());
  assert.equal(review.source.horizontalCrs, 'EPSG:2966');
  assert.equal(review.placement.state, 'PENDING_EVIDENCE');
  assert.deepEqual(flattenDesignTree(review).map(item => [item.id, item.depth]),
    [['main', 0], ['beam', 1], ['slab', 1]]);
});
test('quantities omit absent, incompatible and unverified entries', () => {
  const raw = valid();
  raw.elements.push({ id: 'untrusted', parentId: 'main', title: 'Unknown', category: 'Slab',
    quantities: { volume: { value: 100, unit: 'm3', evidence: 'UNVERIFIED' } } });
  const q = summarizeQuantity(parseDesignReview(raw), 'volume', 'm3');
  assert.equal(q.count, 2);
  assert.equal(q.omitted, 2);
  assert.equal(q.sourceCount, 1);
  assert.equal(q.derivedCount, 1);
  assert.equal(q.sum, 20);
  assert.equal(q.average, 10);
});
test('revision diff uses stable IDs and does not ignore quantity changes', () => {
  const a = parseDesignReview(valid());
  const next = valid();
  next.revisionId = 'rev-b';
  next.source.sha256 = 'b'.repeat(64);
  next.elements.find(x=>x.id==='beam').quantities.volume.value = 20;
  next.elements = next.elements.filter(x=>x.id!=='slab');
  next.elements.push({ id: 'deck', parentId: 'main', title: 'Bridge deck', category: 'Slab', quantities: {} });
  assert.deepEqual(compareDesignRevisions(a, parseDesignReview(next)), {
    added: ['deck'], removed: ['slab'], modified: ['beam'], unchanged: ['main'],
  });
});
test('rejects conflicting duplicate revision source bytes', () => {
  const b = valid(); b.source.sha256 = 'b'.repeat(64);
  assert.throws(()=>compareDesignRevisions(parseDesignReview(valid()),parseDesignReview(b)),/conflicting source hash/);
});
test('rejects incompatible CRS and datum during revision compare', () => {
  const b = valid(); b.source.horizontalCrs = 'EPSG:2968';
  assert.throws(()=>compareDesignRevisions(parseDesignReview(valid()), parseDesignReview(b)),/CRS\/datums/);
});
test('rejects duplicate or missing parents', () => {
  const a = valid(); a.elements.push({ ...a.elements[0] });
  assert.throws(()=>parseDesignReview(a),/Duplicate element/);
  const b = valid(); b.elements[1].parentId = 'missing';
  assert.throws(()=>parseDesignReview(b),/Orphan BIM/);
});
test('rejects cycles and ill-typed quantities', () => {
  const a = valid(); a.elements[0].parentId = 'slab';
  assert.throws(()=>parseDesignReview(a),/Cyclic/);
  const b = valid(); b.elements[1].quantities.volume.value = Infinity;
  assert.throws(()=>parseDesignReview(b),/non-finite/);
});
test('requires actual control metrics before accepting a claimed review', () => {
  const a = valid(); a.placement.state = 'CONTROL_REVIEWED';
  assert.throws(()=>parseDesignReview(a),/Alignment cannot/);
  a.source.verticalDatum = 'NAVD88';
  a.placement.controlCount = 3; a.placement.maxResidualM = 0.16; a.placement.toleranceM = 0.1;
  assert.throws(()=>parseDesignReview(a),/Alignment cannot/);
  a.placement.maxResidualM = 0.04;
  assert.equal(parseDesignReview(a).placement.state,'CONTROL_REVIEWED');
});
test('rejects unknown datum as falsely declared', () => {
  const a = valid(); a.source.verticalDatum = 'unknown';
  assert.throws(()=>parseDesignReview(a),/UNVERIFIED/);
});
test('count values must remain integers', () => {
  const a = valid(); a.elements[1].quantities.volume = { value: 4.5, unit: 'count', evidence: 'DERIVED' };
  assert.throws(()=>parseDesignReview(a),/Invalid quantity unit/);
});
