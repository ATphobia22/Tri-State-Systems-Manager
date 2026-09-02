import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routerSource = fs.readFileSync(path.join(__dirname, '../src/lib/router.tsx'), 'utf8');

test('router imports useLoaderData instead of CommonJS require', () => {
  assert.match(routerSource, /import \{[^}]*useLoaderData[^}]*\} from 'react-router';/s);
  assert.doesNotMatch(routerSource, /require\(['\"]react-router['\"]\)/);
});

test('heavy geospatial routes use React Router route-level lazy loading', () => {
  for (const route of ['TwinCanvasView', 'MapLibreEocView', 'MapLibreMap']) {
    assert.doesNotMatch(
      routerSource,
      new RegExp(`import ${route} from ['\"]\\.\\.\\/routes\\/${route}['\"]`),
    );
    assert.match(routerSource, new RegExp(`lazy:\\s*async \\(\\) => \\({\\s*Component:\\s*\\(await import\\(['\"]\\.\\.\\/routes\\/${route}['\"]\\)\\)\\.default`, 's'));
  }
});

test('heavy route lazy loading preserves the shared mapTwin loader contract', () => {
  for (const route of ['map', 'eoc', 'twin']) {
    assert.match(routerSource, new RegExp(`path: '${route}',\\s*loader: mapTwinLoader,\\s*lazy:`, 's'));
  }
});

test('lightweight core routes remain eagerly imported', () => {
  for (const route of ['CharterView', 'NeedsView', 'LedgerView', 'BenefitView', 'LineageView', 'SandboxView']) {
    assert.match(routerSource, new RegExp(`import ${route} from ['\"]\\.\\.\\/routes\\/${route}['\"]`));
  }
});
