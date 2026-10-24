import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IDTA_SUBMODEL_TEMPLATES,
  findIdtaTemplate,
  isPublishedIdtaTemplate,
} from '../../packages/ontology/src/idta-submodel-templates.ts';

test('corrects the pasted control-component numbers', () => {
  assert.equal(findIdtaTemplate('02015')?.title, 'Control Component Type');
  assert.equal(findIdtaTemplate('02016')?.title, 'Control Component Instance');
  assert.equal(findIdtaTemplate('02017')?.title, 'Asset Interfaces Description');
  assert.ok(!findIdtaTemplate('02017')?.title.includes('Control Component'));
});

test('uses the suffixed hierarchical-structures number', () => {
  assert.equal(findIdtaTemplate('02011'), undefined);
  assert.ok(findIdtaTemplate('02011-1')?.title.includes('Bills of Material'));
});

test('marks 02002 as legacy, not published', () => {
  assert.equal(findIdtaTemplate('02002')?.status, 'legacy-unconfirmed');
  assert.equal(isPublishedIdtaTemplate('02002'), false);
});

test('publishes the AI cluster templates', () => {
  for (const id of ['02058', '02059', '02060']) {
    assert.equal(isPublishedIdtaTemplate(id), true);
  }
});

test('has no duplicate ids', () => {
  const ids = IDTA_SUBMODEL_TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});
