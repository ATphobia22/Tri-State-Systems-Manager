/**
 * Tests for the LOD-neighbor scheduler (Transvoxel terrain runtime scheduling).
 * - SSE math matches the 3D-Tiles formula
 * - Top-down selection refines near geometry, keeps far geometry coarse
 * - 2:1 balance is enforced by force-splitting coarse neighbors
 * - Fetch plans diff correctly; refine/coarsen transitions fire
 */
import { describe, expect, it } from 'vitest';
import {
  buildAdjacency,
  computeSse,
  distanceToBounds,
  intersectsFrustum,
  LodScheduler,
  type LodCamera,
  type LodFrustumPlane,
  type LodNode,
} from '../lib/lod-scheduler';

function box(id: string, level: number, b: [number, number, number, number, number, number],
  geometricError: number, parentId: string | null, childrenIds: string[] = []): LodNode {
  return { id, level, bounds: b, geometricError, parentId, childrenIds };
}

/** Two adjacent subtrees: left stays coarse, right refines deep. */
function twoSubtreeScene(): LodNode[] {
  const nodes: LodNode[] = [
    // Left tree: root with small error -> stays at L0, but has children for splitting.
    box('R1', 0, [0, 0, 0, 4, 4, 4], 0.1, null, ['R1a', 'R1b']),
    box('R1a', 1, [0, 0, 0, 4, 4, 2], 0.05, 'R1'),
    box('R1b', 1, [0, 0, 2, 4, 4, 4], 0.05, 'R1'),
    // Right tree: large errors -> refines to L2.
    box('R2', 0, [4, 0, 0, 8, 8, 8], 10, null, ['C']),
    box('C', 1, [4, 0, 0, 8, 8, 8], 5, 'R2', ['G']),
    box('G', 2, [4, 0, 0, 8, 8, 8], 0.01, 'C'),
  ];
  return nodes;
}

const farCamera: LodCamera = { position: [100, 4, 4], fovDeg: 60, screenHeightPx: 800 };
const nearCamera: LodCamera = { position: [6, 4, 4], fovDeg: 60, screenHeightPx: 800 };
/** Far enough that even the high-error right subtree stays at its root. */
const veryFarCamera: LodCamera = { position: [4000, 4, 4], fovDeg: 60, screenHeightPx: 800 };

describe('computeSse', () => {
  it('matches the 3D-Tiles screen-space-error formula', () => {
    const n = box('n', 0, [0, 0, 0, 10, 10, 10], 4, null);
    const cam: LodCamera = { position: [110, 5, 5], fovDeg: 60, screenHeightPx: 800 };
    // dist = 100, sse = 4*800 / (2*100*tan(30°))
    const expected = (4 * 800) / (2 * 100 * Math.tan(Math.PI / 6));
    expect(computeSse(n, cam)).toBeCloseTo(expected, 6);
  });

  it('returns 0 for zero geometric error (leaf)', () => {
    const n = box('n', 2, [0, 0, 0, 1, 1, 1], 0, 'p');
    expect(computeSse(n, farCamera)).toBe(0);
  });

  it('grows without bound as the camera approaches the node', () => {
    const n = box('n', 0, [0, 0, 0, 10, 10, 10], 4, null);
    const close: LodCamera = { position: [10.5, 5, 5], fovDeg: 60, screenHeightPx: 800 };
    expect(computeSse(n, close)).toBeGreaterThan(computeSse(n, farCamera));
    expect(Number.isFinite(computeSse(n, { ...close, position: [5, 5, 5] }))).toBe(true);
  });
});

describe('distanceToBounds', () => {
  it('is 0 inside the box', () => {
    expect(distanceToBounds([2, 2, 2], [0, 0, 0, 4, 4, 4])).toBe(0);
  });
  it('measures closest-point distance outside', () => {
    expect(distanceToBounds([7, 2, 2], [0, 0, 0, 4, 4, 4])).toBeCloseTo(3, 9);
  });
});

describe('buildAdjacency', () => {
  it('links face-touching boxes and ignores separated ones', () => {
    const nodes = [
      box('a', 0, [0, 0, 0, 4, 4, 4], 1, null),
      box('b', 0, [4, 0, 0, 8, 4, 4], 1, null),
      box('c', 0, [100, 0, 0, 104, 4, 4], 1, null),
    ];
    const adj = buildAdjacency(nodes);
    expect(adj.get('a')).toContain('b');
    expect(adj.get('b')).toContain('a');
    expect(adj.get('a')).not.toContain('c');
    expect(adj.get('c')).toHaveLength(0);
  });
});

describe('LodScheduler.update', () => {
  it('selects coarse nodes for a far camera and enforces 2:1 balance', () => {
    const s = new LodScheduler(twoSubtreeScene());
    const plan = s.update(farCamera);
    // R1 (L0, small error) would stay, but G (L2) next door forces a split.
    expect(plan.selected).not.toContain('R1');
    expect(plan.selected).toContain('R1a');
    expect(plan.selected).toContain('R1b');
    // Right side refines to G.
    expect(plan.selected).toContain('G');
    expect(plan.selected).not.toContain('R2');
    expect(plan.selected).not.toContain('C');
    // 2:1 enforcement must have split R1 (L0) next to G (L2).
    expect(plan.selected).toContain('G');
    const levels = new Map(plan.selected.map((id) => {
      const n = twoSubtreeScene().find((x) => x.id === id)!;
      return [id, n.level] as const;
    }));
    const r1like = plan.selected.filter((id) => id.startsWith('R1'));
    for (const id of r1like) {
      expect(Math.abs(levels.get(id)! - levels.get('G')!)).toBeLessThanOrEqual(1);
    }
  });

  it('refines to max depth for a near camera', () => {
    const s = new LodScheduler(twoSubtreeScene());
    const plan = s.update(nearCamera);
    expect(plan.selected).toContain('G');
    expect(plan.selected).toContain('R1a');
    expect(plan.selected).toContain('R1b');
  });

  it('emits load on first frame and nothing on a repeated frame', () => {
    const s = new LodScheduler(twoSubtreeScene());
    const first = s.update(farCamera);
    expect(first.load.length).toBeGreaterThan(0);
    expect(first.evict).toHaveLength(0);
    const second = s.update(farCamera);
    expect(second.load).toHaveLength(0);
    expect(second.evict).toHaveLength(0);
    expect(second.transitions).toHaveLength(0);
  });

  it('emits refine transitions when zooming in and coarsen when zooming out', () => {
    const s = new LodScheduler(twoSubtreeScene());
    const seen: string[] = [];
    s.onTransition((t) => seen.push(t.type));
    // Start fully zoomed out: {R1, R2}.
    const start = s.update(veryFarCamera);
    expect(start.selected).toContain('R1');
    expect(start.selected).toContain('R2');
    seen.length = 0;
    // Zoom in: right side refines R2 -> G, left side force-splits R1.
    const plan = s.update(farCamera);
    expect(plan.transitions.length).toBeGreaterThan(0);
    expect(seen).toContain('refine');
    const refineToG = plan.transitions.find((t) => t.type === 'refine' && t.parentId === 'R2');
    expect(refineToG?.childIds).toContain('G');
    // Zoom back out: everything coarsens.
    seen.length = 0;
    const back = s.update(veryFarCamera);
    expect(back.transitions.some((t) => t.type === 'coarsen')).toBe(true);
    expect(seen).toContain('coarsen');
  });

  it('evicts nodes that leave the selected set', () => {
    const s = new LodScheduler(twoSubtreeScene());
    s.update(nearCamera);
    const loadedBefore = s.getLoaded();
    expect(loadedBefore.length).toBeGreaterThan(0);
    const plan = s.update(veryFarCamera);
    expect(plan.evict.length).toBeGreaterThan(0);
    for (const id of plan.evict) expect(plan.selected).not.toContain(id);
  });

  it('never selects both an ancestor and its descendant', () => {
    const s = new LodScheduler(twoSubtreeScene());
    for (const cam of [farCamera, nearCamera, { position: [6, 4, 20], fovDeg: 60, screenHeightPx: 800 } as LodCamera]) {
      const plan = s.update(cam);
      const sel = new Set(plan.selected);
      expect(sel.has('R2') && sel.has('C')).toBe(false);
      expect(sel.has('C') && sel.has('G')).toBe(false);
      expect(sel.has('R1') && (sel.has('R1a') || sel.has('R1b'))).toBe(false);
    }
  });

  it('rejects invalid cameras instead of producing NaN plans', () => {
    const s = new LodScheduler(twoSubtreeScene());
    expect(() => s.update({ position: [0, 0, 0], fovDeg: 0, screenHeightPx: 800 })).toThrow();
    expect(() => s.update({ position: [0, 0, 0], fovDeg: 60, screenHeightPx: -1 })).toThrow();
    expect(() => s.update({ position: [NaN, 0, 0], fovDeg: 60, screenHeightPx: 800 })).toThrow();
  });

  it('requires precomputed adjacency for large octrees instead of quadratic construction', () => {
    const nodes = Array.from({ length: 5_001 }, (_, index) =>
      box(`root-${index}`, 0, [index * 2, 0, 0, index * 2 + 1, 1, 1], 0, null),
    );
    expect(() => new LodScheduler(nodes)).toThrow(/provide a precomputed adjacency map/);
    expect(() => new LodScheduler(nodes, {}, new Map(nodes.map((node) => [node.id, []])))).not.toThrow();
  });

  it('accepts a 2:1 violation it cannot repair (leaf with no children)', () => {
    const nodes: LodNode[] = [
      box('leaf', 0, [0, 0, 0, 4, 4, 4], 0.05, null), // no children: cannot split
      box('deep', 2, [4, 0, 0, 8, 8, 8], 0.01, 'mid'),
      box('mid', 1, [4, 0, 0, 8, 8, 8], 5, 'top', ['deep']),
      box('top', 0, [4, 0, 0, 8, 8, 8], 10, null, ['mid']),
    ];
    const s = new LodScheduler(nodes);
    const plan = s.update(farCamera); // must not hang or throw
    expect(plan.selected).toContain('leaf');
    expect(plan.selected).toContain('deep');
  });
});


const outsideFrustum: LodFrustumPlane[] = [
  { normal: [1, 0, 0], constant: -10 },
  { normal: [-1, 0, 0], constant: 100 },
  { normal: [0, 1, 0], constant: 100 },
  { normal: [0, -1, 0], constant: 100 },
  { normal: [0, 0, 1], constant: 100 },
  { normal: [0, 0, -1], constant: 100 },
];

describe('conservative frustum culling', () => {
  it('keeps an AABB whose support vertex touches a frustum plane', () => {
    const planes: LodFrustumPlane[] = [
      { normal: [1, 0, 0], constant: 0 },
      { normal: [-1, 0, 0], constant: 4 },
      { normal: [0, 1, 0], constant: 0 },
      { normal: [0, -1, 0], constant: 4 },
      { normal: [0, 0, 1], constant: 0 },
      { normal: [0, 0, -1], constant: 4 },
    ];
    expect(intersectsFrustum([0, 0, 0, 4, 4, 4], planes)).toBe(true);
  });

  it('rejects an AABB fully outside a plane', () => {
    expect(intersectsFrustum([0, 0, 0, 4, 4, 4], outsideFrustum)).toBe(false);
  });

  it('skips an off-screen subtree and emits evictions for its prior residency', () => {
    const scheduler = new LodScheduler([box('root', 0, [0, 0, 0, 4, 4, 4], 1, null)]);
    scheduler.setLoaded(['root']);
    const plan = scheduler.update({ ...farCamera, frustumPlanes: outsideFrustum });
    expect(plan.selected).toEqual([]);
    expect(plan.load).toEqual([]);
    expect(plan.evict).toEqual(['root']);
  });

  it('rejects malformed frusta instead of silently producing an unsafe selection', () => {
    const scheduler = new LodScheduler([box('root', 0, [0, 0, 0, 4, 4, 4], 1, null)]);
    expect(() => scheduler.update({ ...farCamera, frustumPlanes: outsideFrustum.slice(0, 5) })).toThrow(/six planes/);
    expect(() => scheduler.update({ ...farCamera, frustumPlanes: [
      ...outsideFrustum.slice(0, 5), { normal: [0, 0, 0], constant: 1 },
    ] })).toThrow(/invalid frustum plane/);
  });
});
