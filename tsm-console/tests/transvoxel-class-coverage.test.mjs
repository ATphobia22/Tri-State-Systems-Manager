import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TRANSITION_CELL_CLASS, getTransitionClass, validateLengyelTables } from '../src/lib/transvoxel-lengyel-classes.ts';

test('all 512 Transvoxel transition masks classify into the canonical 56 classes', () => {
  assert.equal(TRANSITION_CELL_CLASS.length, 512);
  const validation = validateLengyelTables();
  assert.equal(validation.ok, true);
  assert.equal(validation.uniqueClasses, 56);
  const seen = new Set();
  for (let mask = 0; mask < 512; mask++) {
    const value = getTransitionClass(mask);
    assert.ok(value.classId >= 0 && value.classId < 56, `invalid class for mask ${mask}`);
    seen.add(value.classId);
  }
  assert.equal(seen.size, 56);
});

test('Transvoxel classifier rejects invalid masks and preserves winding bit', () => {
  assert.throws(() => getTransitionClass(-1), RangeError);
  assert.throws(() => getTransitionClass(512), RangeError);
  assert.throws(() => getTransitionClass(1.5), RangeError);
  assert.deepEqual(getTransitionClass(3), { classId: 4, invertWinding: true });
});
