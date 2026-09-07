import test from 'node:test';
import assert from 'node:assert/strict';
import { scanProductionDataPaths } from './no-production-mock-data.mjs';

test('production scanner rejects mock identity and synthetic operational readings', () => {
  const violations = scanProductionDataPaths('tsm-console', {
    files: new Map([
      ['src/example.ts', "const provider = 'mock';"],
      ['server/example.mjs', 'const stage = 8.23;'],
      ['tests/fixture.test.mjs', "const mock = true;"],
    ]),
  });
  assert.equal(violations.length, 2);
  assert.equal(violations.some((v) => v.path === 'tests/fixture.test.mjs'), false);
});
