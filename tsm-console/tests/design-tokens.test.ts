/**
 * Design-token contract tests (Phase 2 visual system).
 *
 * 1. Phase 0 contrast values are pinned — the four WCAG 2.1 AA failures must
 *    never regress through a "harmless" token tweak.
 * 2. The token module stays a single typed const object (one mechanism).
 * 3. No migrated shell component may reintroduce the old failing grays —
 *    enforced as literal-string guards on the source.
 */

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { designTokens } from '../src/lib/design-tokens';

const { color } = designTokens;

describe('design tokens — Phase 0 contrast contract', () => {
  it('governance button keeps the fixed #0277b8', () => {
    expect(color.action.primary).toBe('#0277b8');
  });
  it('UNKNOWN chip keeps #a3a3a3', () => {
    expect(color.badge.unknown).toBe('#a3a3a3');
  });
  it('secondary text keeps #94a3b8', () => {
    expect(color.text.secondary).toBe('#94a3b8');
  });
});

describe('design tokens — single mechanism', () => {
  it('exports one typed const object covering color/radius/spacing/font', () => {
    expect(designTokens).toBeTypeOf('object');
    for (const key of ['color', 'radius', 'spacing', 'font'] as const) {
      expect(designTokens[key]).toBeTypeOf('object');
    }
  });
  it('collapses the dark backgrounds to three tiers (base/card/deep)', () => {
    expect(color.surface.base).toBe('#0f172a');
    expect(color.surface.card).toBe('#1e293b');
    expect(color.surface.deep).toBe('#020617');
  });
  it('all color tokens are valid hex or rgba strings', () => {
    const values: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') values.push(node);
      else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(color);
    expect(values.length).toBeGreaterThan(20);
    for (const v of values) {
      expect(v).toMatch(/^(#[0-9a-f]{3,8}|rgba?\()/i);
    }
  });
});

describe('design tokens — migrated shell has no regressions', () => {
  const src = (rel: string): Promise<string> =>
    readFile(new URL(`../src/${rel}`, import.meta.url), 'utf8');

  const migrated = [
    'components/RootLayout.tsx',
    'components/StageAuthorityBanner.tsx',
    'components/AuthorityBadge.tsx',
    'components/EngineeringSimSettings.tsx',
    'components/HumanSignGatePanel.tsx',
    'components/TourOnboardingHint.tsx',
    'components/PublicDataFabricDashboard.tsx',
    'components/RouteErrorPage.tsx',
    'routes/LedgerView.tsx',
    'routes/MapTwinView.tsx',
    'routes/MapLibreEocView.tsx',
    'routes/MapLibreMap.tsx',
    'routes/TwinCanvasView.tsx',
    'routes/PoseyResilienceDashboard.tsx',
    'lib/router.tsx',
  ];

  it.each(migrated)('%s has no failing old grays', async (rel) => {
    const s = await src(rel);
    expect(s).not.toContain('#64748b');
    expect(s).not.toContain('#475569');
    expect(s).not.toContain('#0284c7');
  });

  it.each(migrated)('%s references the token module', async (rel) => {
    expect(await src(rel)).toContain('design-tokens');
  });
});
