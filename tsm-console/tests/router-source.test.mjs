import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routerSource = fs.readFileSync(path.join(__dirname, '../src/lib/router.tsx'), 'utf8');

test('router imports useLoaderData instead of CommonJS require', () => {
  assert.match(routerSource, /import \{[^}]*useLoaderData[^}]*\} from 'react-router';/s);
  assert.doesNotMatch(routerSource, /require\(['"]react-router['"]\)/);
});
