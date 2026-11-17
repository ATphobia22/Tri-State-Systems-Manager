import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g);
  if (!channels || channels.length !== 3) throw new Error('Expected RGB hex');
  const linear = channels.map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
const contrast = (a: string, b: string): number => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('map-first shell source contracts', () => {
  it('exposes one nav state and functional keyboard dismissal', async () => {
    const shell = await read('components/RootLayout.tsx');
    expect(shell).toContain('const [navOpen, setNavOpen] = useState(false)');
    expect(shell).not.toContain('desktopNavOpen');
    expect(shell).not.toContain('menuOpen');
    expect(shell).toContain('aria-expanded={navOpen}');
    expect(shell).toContain('inert={!navOpen}');
    expect(shell).toContain("event.key === 'Escape'");
    expect(shell).toContain("window.removeEventListener('keydown', closeOnEscape)");
    expect(shell).toContain('onClick={closeMenu}');
    expect(shell).toContain('tsm-sidebar.collapsed');
  });

  it('organizes every route in a discoverable group exactly once', async () => {
    const shell = await read('components/RootLayout.tsx');
    const nav = shell.split('const nav = [')[1]?.split('];')[0] ?? '';
    const groups = shell.split('const navGroups = [')[1]?.split('] as const;')[0] ?? '';
    const routes = [...nav.matchAll(/\bto: '([^']+)'/g)].map((x) => x[1]);
    const grouped = [...groups.matchAll(/'\/?[\w-]*'/g)].map((x) => x[0].slice(1, -1));
    expect(routes.length).toBeGreaterThan(15);
    expect(new Set(routes).size).toBe(routes.length);
    expect(grouped.sort()).toEqual([...routes].sort());
    expect(shell).toContain('Primary navigation');
    expect(shell).toContain('Engineering settings');
  });

  it('keeps the map visible while the layer inspector is initially closed', async () => {
    const map = await read('components/RealWorldTwinMap.tsx');
    expect(map).toContain('<details aria-label="Map layers, data and engineering tools"');
    expect(map).toContain('Layers, evidence &amp; map tools');
    expect(map).toContain('maxHeight: \'min(72dvh, 720px)\'');
    expect(map).toContain('new ResizeObserver(() => map.resize())');
    expect(map).toContain('observer.disconnect()');
    expect(map).toContain('aria-pressed={btn.pressed}');
  });

  it('keeps hydraulic comparison separate from map rendering and regulatory evidence', async () => {
    const route = await read('routes/MapLibreMap.tsx');
    expect(route).toContain('Hydraulic comparison controls (screening only)');
    expect(route).toContain('Comparison stage (not applied to map)');
    expect(route).toContain('The comparison slider does not change map water levels.');
    expect(route).toContain('FEMA NFHL and Indiana BAFM remain separate authority planes.');
  });

  it('uses accessible light-theme foreground/background combinations', () => {
    expect(contrast('#17324d', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#526879', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#205a63', '#dcefeb')).toBeGreaterThanOrEqual(4.5);
  });
});
