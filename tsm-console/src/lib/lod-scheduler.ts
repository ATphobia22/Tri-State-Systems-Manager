/**
 * lod-scheduler.ts — runtime LOD-neighbor scheduler for the TSM Transvoxel terrain system.
 *
 * This is the SCHEDULER logic only: it decides which octree nodes to load at
 * which LOD per frame. It does not fetch tiles and does not draw anything.
 *
 * Inputs:
 *   - Octree node metadata (id, AABB bounds, LOD level, geometricError,
 *     parent/children links) — exported from the Python bridge
 *     (scripts/geospatial/dem_to_transvoxel.py), which builds a 2:1 balanced
 *     octree over SDF voxel data.
 *   - Camera state (position, vertical FOV, screen height in px).
 *
 * Per-frame algorithm (same principle as 3D Tiles):
 *   1. Top-down traversal from roots. For each node:
 *        sse = geometricError * screenHeight / (2 * distance * tan(fov/2))
 *      If sse > maxScreenSpaceError and the node has children, descend;
 *      otherwise the node is selected at its level.
 *   2. 2:1 balance enforcement: for every face-adjacent node pair, the LOD
 *      levels must differ by at most 1. Violations are repaired by
 *      force-splitting (raising the coarser node toward the finer one),
 *      which converges because levels only increase and are bounded.
 *   3. Diff against the previously loaded set to produce a fetch plan
 *      (load / evict) and refine|coarsen transition events.
 *
 * Honest scope limits (see docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md):
 *   - No frustum culling, no occlusion — that is renderer/GPU work.
 *   - No network fetch engine, no resource variants — the plan names node ids;
 *     fetching and cache eviction are the caller's job.
 *   - Adjacency is computed from AABB bounds (O(n^2)); for large trees the
 *     caller should pass a precomputed adjacency map instead.
 */

export interface LodNode {
  /** Stable node id, e.g. "L2_x3_y1_z0". */
  id: string;
  /** LOD level: 0 = coarsest (root), increasing downward. */
  level: number;
  /** Axis-aligned bounds [minX, minY, minZ, maxX, maxY, maxZ] in world units (m). */
  bounds: [number, number, number, number, number, number];
  /** World-space geometric error of this node in meters (0 for leaves). */
  geometricError: number;
  parentId: string | null;
  childrenIds: string[];
}

export interface LodCamera {
  /** Camera world position [x, y, z] in meters. */
  position: [number, number, number];
  /** Vertical field of view in degrees. */
  fovDeg: number;
  /** Viewport height in pixels. */
  screenHeightPx: number;
}

export interface LodFetchPlan {
  /** Node ids to load (not currently loaded). */
  load: string[];
  /** Node ids to evict (loaded but no longer selected). */
  evict: string[];
  /** Node ids selected this frame (the desired resident set). */
  selected: string[];
  /** Refine/coarsen transitions vs the previous frame. */
  transitions: LodTransition[];
}

export interface LodTransition {
  type: 'refine' | 'coarsen';
  parentId: string;
  childIds: string[];
  fromLevel: number;
  toLevel: number;
}

export type LodTransitionListener = (t: LodTransition) => void;

const EPS = 1e-6;

/** Clamp a value into [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Closest-point distance from a point to an AABB. Returns 0 when the point
 * is inside the box. Used so a camera inside a node refines to max depth.
 */
export function distanceToBounds(p: [number, number, number], bounds: LodNode['bounds']): number {
  const dx = Math.max(bounds[0] - p[0], 0, p[0] - bounds[3]);
  const dy = Math.max(bounds[1] - p[1], 0, p[1] - bounds[4]);
  const dz = Math.max(bounds[2] - p[2], 0, p[2] - bounds[5]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Screen-space error for a node, 3D-Tiles style:
 *   sse = geometricError * screenHeight / (2 * distance * tan(fov/2))
 * Distance is clamped to a small epsilon so a camera inside the node yields
 * a very large SSE (forces refinement) instead of Infinity/NaN.
 */
export function computeSse(node: LodNode, camera: LodCamera): number {
  if (node.geometricError <= 0) return 0;
  const dist = Math.max(distanceToBounds(camera.position, node.bounds), 1e-3);
  const fovRad = (camera.fovDeg * Math.PI) / 180;
  const denom = 2 * dist * Math.tan(fovRad / 2);
  if (denom <= 0 || !Number.isFinite(denom)) return Number.POSITIVE_INFINITY;
  return (node.geometricError * camera.screenHeightPx) / denom;
}

/**
 * Build face-adjacency from AABB bounds: two nodes are adjacent when they
 * share a face plane (within epsilon) and their face rectangles overlap with
 * positive area. Returns map from node id -> adjacent node ids.
 */
export function buildAdjacency(nodes: LodNode[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  const overlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(a1, b1) - Math.max(a0, b0) > EPS;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].bounds;
      const b = nodes[j].bounds;
      const shareX = (Math.abs(a[3] - b[0]) < EPS || Math.abs(a[0] - b[3]) < EPS)
        && overlap(a[1], a[4], b[1], b[4]) && overlap(a[2], a[5], b[2], b[5]);
      const shareY = (Math.abs(a[4] - b[1]) < EPS || Math.abs(a[1] - b[4]) < EPS)
        && overlap(a[0], a[3], b[0], b[3]) && overlap(a[2], a[5], b[2], b[5]);
      const shareZ = (Math.abs(a[5] - b[2]) < EPS || Math.abs(a[2] - b[5]) < EPS)
        && overlap(a[0], a[3], b[0], b[3]) && overlap(a[1], a[4], b[1], b[4]);
      if (shareX || shareY || shareZ) {
        adj.get(nodes[i].id)!.push(nodes[j].id);
        adj.get(nodes[j].id)!.push(nodes[i].id);
      }
    }
  }
  return adj;
}

export interface LodSchedulerOptions {
  /** SSE threshold above which a node refines. Default 2.0 px. */
  maxScreenSpaceError?: number;
  /** Hard cap on traversal depth. Default Infinity. */
  maxLevel?: number;
}

export class LodScheduler {
  private readonly nodes = new Map<string, LodNode>();
  private readonly roots: LodNode[] = [];
  private readonly adjacency: Map<string, string[]>;
  private readonly maxSse: number;
  private readonly maxLevel: number;
  private loaded = new Set<string>();
  private listeners: LodTransitionListener[] = [];

  constructor(nodes: LodNode[], options: LodSchedulerOptions = {}, adjacency?: Map<string, string[]>) {
    for (const n of nodes) {
      if (this.nodes.has(n.id)) throw new Error(`[LodScheduler] duplicate node id: ${n.id}`);
      this.nodes.set(n.id, n);
      if (n.parentId === null) this.roots.push(n);
    }
    if (this.roots.length === 0) throw new Error('[LodScheduler] no root nodes (parentId === null)');
    this.adjacency = adjacency ?? buildAdjacency(nodes);
    this.maxSse = options.maxScreenSpaceError ?? 2.0;
    this.maxLevel = options.maxLevel ?? Infinity;
  }

  onTransition(listener: LodTransitionListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Nodes currently considered loaded (the last emitted resident set). */
  getLoaded(): string[] {
    return [...this.loaded];
  }

  /** Seed or reset the loaded set (e.g. after a cache clear). */
  setLoaded(ids: Iterable<string>): void {
    this.loaded = new Set(ids);
  }

  /**
   * Run one scheduling pass for the given camera. Returns the fetch plan and
   * updates the internal loaded set. Emits transition events to listeners.
   */
  update(camera: LodCamera): LodFetchPlan {
    this.validateCamera(camera);
    // 1. SSE-driven top-down selection.
    const selected = new Map<string, LodNode>();
    for (const root of this.roots) this.traverse(root, camera, selected);
    // 2. Enforce 2:1 balance on the selected set.
    this.enforceBalance(selected);
    // 3. Diff against loaded set -> fetch plan + transitions.
    const plan = this.diff(selected);
    for (const t of plan.transitions) for (const l of this.listeners) l(t);
    this.loaded = new Set(plan.selected);
    return plan;
  }

  private validateCamera(camera: LodCamera): void {
    if (!Number.isFinite(camera.fovDeg) || camera.fovDeg <= 0 || camera.fovDeg >= 180) {
      throw new Error(`[LodScheduler] invalid fovDeg: ${camera.fovDeg}`);
    }
    if (!Number.isFinite(camera.screenHeightPx) || camera.screenHeightPx <= 0) {
      throw new Error(`[LodScheduler] invalid screenHeightPx: ${camera.screenHeightPx}`);
    }
    if (!camera.position.every(Number.isFinite)) {
      throw new Error('[LodScheduler] camera position must be finite');
    }
  }

  private traverse(node: LodNode, camera: LodCamera, selected: Map<string, LodNode>): void {
    const sse = computeSse(node, camera);
    const canRefine = node.childrenIds.length > 0 && node.level < this.maxLevel;
    if (sse > this.maxSse && canRefine) {
      for (const childId of node.childrenIds) {
        const child = this.nodes.get(childId);
        if (child) this.traverse(child, camera, selected);
        else selected.set(node.id, node); // missing child metadata: keep parent
      }
      return;
    }
    selected.set(node.id, node);
  }

  /**
   * Enforce the 2:1 rule: adjacent selected nodes may differ by at most one
   * level. Repair by force-splitting the coarser node (descend to the child
   * that best covers the shared region). Iterates to a fixed point; levels
   * only increase and are bounded by maxLevel, so this terminates.
   */
  private enforceBalance(selected: Map<string, LodNode>): void {
    for (let pass = 0; pass < 64; pass++) {
      let changed = false;
      for (const [id, node] of [...selected]) {
        for (const neighborId of this.adjacency.get(id) ?? []) {
          const neighbor = selected.get(neighborId);
          if (!neighbor) continue; // neighbor not selected this frame: nothing to balance
          const diff = neighbor.level - node.level;
          if (diff > 1) {
            // node is too coarse next to a much finer neighbor: split node.
            if (this.splitToward(selected, node, neighbor)) changed = true;
          } else if (diff < -1) {
            if (this.splitToward(selected, neighbor, node)) changed = true;
          }
        }
      }
      if (!changed) return;
    }
    // If we somehow did not converge, leave the set as-is rather than looping forever.
  }

  /**
   * Replace `coarse` in the selected set with the child(ren) that overlap the
   * shared face region with `fine`. Returns true if the set changed.
   */
  private splitToward(selected: Map<string, LodNode>, coarse: LodNode, fine: LodNode): boolean {
    if (coarse.childrenIds.length === 0) return false; // cannot split a leaf: accept the violation
    const overlapping = coarse.childrenIds
      .map((cid) => this.nodes.get(cid))
      .filter((c): c is LodNode => !!c && this.boundsOverlapFace(c.bounds, fine.bounds));
    const replacements = overlapping.length > 0 ? overlapping : coarse.childrenIds
      .map((cid) => this.nodes.get(cid))
      .filter((c): c is LodNode => !!c);
    if (replacements.length === 0) return false;
    selected.delete(coarse.id);
    for (const r of replacements) selected.set(r.id, r);
    return true;
  }

  /** True when two AABBs touch or overlap on at least a face region. */
  private boundsOverlapFace(a: LodNode['bounds'], b: LodNode['bounds']): boolean {
    const ox = Math.min(a[3], b[3]) - Math.max(a[0], b[0]);
    const oy = Math.min(a[4], b[4]) - Math.max(a[1], b[1]);
    const oz = Math.min(a[5], b[5]) - Math.max(a[2], b[2]);
    // Touching (ox/oy/oz >= -EPS) with positive area on two axes = shared face or better.
    const tx = ox >= -EPS, ty = oy >= -EPS, tz = oz >= -EPS;
    const areaXY = tx && ty && ox > EPS && oy > EPS;
    const areaXZ = tx && tz && ox > EPS && oz > EPS;
    const areaYZ = ty && tz && oy > EPS && oz > EPS;
    return areaXY || areaXZ || areaYZ;
  }

  /** All descendant ids of a node (any depth). */
  private descendantsOf(id: string): string[] {
    const out: string[] = [];
    const stack = [...(this.nodes.get(id)?.childrenIds ?? [])];
    while (stack.length > 0) {
      const cid = stack.pop()!;
      out.push(cid);
      stack.push(...(this.nodes.get(cid)?.childrenIds ?? []));
    }
    return out;
  }

  private diff(selected: Map<string, LodNode>): LodFetchPlan {
    const selectedIds = new Set(selected.keys());
    const load = [...selectedIds].filter((id) => !this.loaded.has(id));
    const evict = [...this.loaded].filter((id) => !selectedIds.has(id));
    const transitions: LodTransition[] = [];
    const evictedSet = new Set(evict);

    // Refine: an evicted node replaced by any of its selected descendants
    // (handles multi-level jumps, e.g. R2 -> G skipping C).
    for (const id of evict) {
      const node = this.nodes.get(id);
      if (!node) continue;
      const selDesc = this.descendantsOf(id).filter((d) => selectedIds.has(d));
      if (selDesc.length > 0) {
        transitions.push({
          type: 'refine',
          parentId: id,
          childIds: selDesc,
          fromLevel: node.level,
          toLevel: Math.min(...selDesc.map((d) => this.nodes.get(d)!.level)),
        });
      }
    }
    // Coarsen: a newly selected node whose loaded descendants were evicted.
    for (const id of load) {
      const node = this.nodes.get(id);
      if (!node) continue;
      const evDesc = this.descendantsOf(id).filter((d) => evictedSet.has(d));
      if (evDesc.length > 0) {
        transitions.push({
          type: 'coarsen',
          parentId: id,
          childIds: evDesc,
          fromLevel: Math.max(...evDesc.map((d) => this.nodes.get(d)!.level)),
          toLevel: node.level,
        });
      }
    }
    return { load, evict, selected: [...selectedIds], transitions };
  }
}

/** Clamp helper re-exported for tests. */
export const _internal = { clamp };
