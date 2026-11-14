/**
 * Evidence-gated, quantum-annealing-INSPIRED (classical) 0/1 tile budget planner.
 *
 * This does NOT run a quantum computer, neural network, WebRTC encoder or
 * renderer. It does NOT authorize or fetch tiles, train on user data, or
 * modify authoritative model values. It ranks independently verified assets
 * for an optional 3D Tiles bridge hook.
 *
 * Objective: maximize Σ priority[i] * x[i] + Σ coherence[i,j] * x[i]*x[j]
 * subject to Σ bytes[i] * x[i] <= maxBytes, Σ x[i] <= maxTiles.
 * Deterministic greedy baselines + seeded, bounded Metropolis local search.
 */
export type StreamTileClass = 'OBSERVED' | 'DERIVED' | 'SCENARIO' | 'PRESENTATION';

export interface StreamTileCandidate {
  readonly id: string;
  readonly estimatedBytes: number;
  readonly qualityGain: number;      // normalized [0, 1], measured or modeled
  readonly freshness: number;        // normalized [0, 1], not source authority
  readonly motionPriority: number;   // normalized [0, 1], camera/viewport interest
  readonly coherenceGroup?: string;  // optional scene-group continuity
  readonly classification: StreamTileClass;
  readonly sourceSha256: string;
  readonly sourceVerified: boolean;
  readonly licenseReviewed: boolean;
}

export interface StreamPriorityBudget {
  readonly maxBytes: number;
  readonly maxTiles: number;
  readonly strategy?: 'greedy' | 'annealed';
  readonly seed?: number;
  readonly annealSteps?: number;
}

export interface StreamPriorityPlan {
  readonly selectedIds: readonly string[];
  readonly estimatedBytes: number;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly strategyUsed: 'greedy' | 'annealed' | 'greedy-fallback';
  readonly eligibleCount: number;
  readonly rejected: readonly { id: string; reason: 'INVALID_EVIDENCE_OR_METRICS' | 'DEFERRED_BY_BUDGET' }[];
  readonly executionClass: 'CLASSICAL_PLANNING_ONLY';
  readonly evidenceMutation: false;
  readonly remoteQuantumJobs: 0;
}

const HASH = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const CLASSES = new Set<StreamTileClass>(['OBSERVED','DERIVED','SCENARIO','PRESENTATION']);
const MAX_CANDIDATES = 64;
const EPS = 1e-12;

function unit(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function eligible(c: StreamTileCandidate): boolean {
  return !!c && typeof c.id === 'string' && ID.test(c.id) &&
    Number.isSafeInteger(c.estimatedBytes) && c.estimatedBytes > 0 &&
    unit(c.qualityGain) && unit(c.freshness) && unit(c.motionPriority) &&
    CLASSES.has(c.classification) && HASH.test(c.sourceSha256) &&
    c.sourceVerified === true && c.licenseReviewed === true &&
    (c.coherenceGroup === undefined || (typeof c.coherenceGroup === 'string' && ID.test(c.coherenceGroup)));
}

function assertBudget(b: StreamPriorityBudget): void {
  if (!b || !Number.isSafeInteger(b.maxBytes) || b.maxBytes < 0 ||
      !Number.isInteger(b.maxTiles) || b.maxTiles < 0 || b.maxTiles > MAX_CANDIDATES ||
      (b.strategy !== undefined && b.strategy !== 'greedy' && b.strategy !== 'annealed') ||
      (b.seed !== undefined && (!Number.isInteger(b.seed) || b.seed < 0 || b.seed > 0xffffffff)) ||
      (b.annealSteps !== undefined && (!Number.isInteger(b.annealSteps) || b.annealSteps < 1 || b.annealSteps > 1024))) {
    throw new RangeError('Invalid bounded stream priority budget');
  }
}

function priority(c: StreamTileCandidate): number {
  return 0.55 * c.qualityGain + 0.25 * c.freshness + 0.20 * c.motionPriority;
}

function seededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/** Strictly non-authoritative and non-networked selection. */
export function planQuantumInspiredStream(
  candidates: readonly StreamTileCandidate[],
  budget: StreamPriorityBudget,
): StreamPriorityPlan {
  assertBudget(budget);
  if (!Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) {
    throw new RangeError('Stream candidate batch must contain at most 64 tiles');
  }
  const seen = new Set<string>();
  const rejected: { id: string; reason: 'INVALID_EVIDENCE_OR_METRICS' | 'DEFERRED_BY_BUDGET' }[] = [];
  const good: StreamTileCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.id !== 'string' || !ID.test(candidate.id)) {
      throw new Error('Invalid tile identity');
    }
    if (seen.has(candidate.id)) throw new Error('Duplicate tile identity: ' + candidate.id);
    seen.add(candidate.id);
    if (!eligible(candidate)) rejected.push({id:candidate.id,reason:'INVALID_EVIDENCE_OR_METRICS'});
    else good.push(candidate);
  }
  const n = good.length;
  const gains = good.map(priority);
  const groups = new Map<string,number>();
  for (const c of good) if (c.coherenceGroup) groups.set(c.coherenceGroup,(groups.get(c.coherenceGroup) ?? 0)+1);
  const score = (bits: readonly boolean[]): number => {
    let value = 0;
    for (let i=0;i<n;i++) if (bits[i]) {
      value += gains[i]!;
      const group = good[i]!.coherenceGroup;
      if (group) for (let j=0;j<i;j++) {
        if (bits[j] && good[j]!.coherenceGroup === group) {
          // Per-tile coherence contribution is bounded as group size grows.
          value += 0.08 * Math.min(gains[i]!,gains[j]!) / Math.max(1,(groups.get(group) ?? 1)-1);
        }
      }
    }
    return value;
  };
  const greedy = (density: boolean): boolean[] => {
    const bits = new Array<boolean>(n).fill(false);
    const order = good.map((_,i)=>i).sort((a,b)=>{
      const pa = density ? gains[a]!/good[a]!.estimatedBytes : gains[a]!;
      const pb = density ? gains[b]!/good[b]!.estimatedBytes : gains[b]!;
      return pb-pa || good[a]!.id.localeCompare(good[b]!.id);
    });
    let bytes = 0, count = 0;
    for (const i of order) if (count < budget.maxTiles && bytes + good[i]!.estimatedBytes <= budget.maxBytes) {
      bits[i] = true;
      bytes += good[i]!.estimatedBytes;
      count++;
    }
    return bits;
  };
  const density = greedy(true), gain = greedy(false);
  let baseline = score(density) + EPS >= score(gain) ? density : gain;
  const baselineScore = score(baseline);
  let best = [...baseline], bestScore = baselineScore;
  const strategy = budget.strategy ?? 'greedy';
  if (strategy === 'annealed' && n > 1 && budget.maxTiles > 0 && budget.maxBytes > 0) {
    const rng = seededRandom(budget.seed ?? 0x5eedcafe);
    const steps = budget.annealSteps ?? 512;
    let current = [...baseline], currentScore = baselineScore;
    let currentBytes = current.reduce((sum,on,i)=>sum+(on?good[i]!.estimatedBytes:0),0);
    let currentCount = current.filter(Boolean).length;
    for (let step=0;step<steps;step++) {
      const a = Math.floor(rng()*n);
      const b = Math.floor(rng()*n);
      const trial = [...current];
      trial[a] = !trial[a];
      if (a !== b && rng() < 0.65) trial[b] = !trial[b];
      const nextCount = currentCount + Number(trial[a])-Number(current[a]) +
        (a!==b ? Number(trial[b])-Number(current[b]) : 0);
      const nextBytes = currentBytes + (Number(trial[a])-Number(current[a]))*good[a]!.estimatedBytes +
        (a!==b ? (Number(trial[b])-Number(current[b]))*good[b]!.estimatedBytes : 0);
      if (nextCount > budget.maxTiles || nextBytes > budget.maxBytes || nextCount < 0 || nextBytes < 0) continue;
      const nextScore = score(trial);
      const temperature = 0.18 * Math.pow(0.01, step / Math.max(1,steps-1));
      if (nextScore >= currentScore || rng() < Math.exp((nextScore-currentScore)/temperature)) {
        current = trial; currentScore = nextScore; currentBytes = nextBytes; currentCount = nextCount;
        if (nextScore > bestScore + EPS) {best = [...trial];bestScore = nextScore;}
      }
    }
  }
  const selected = good.filter((_,i)=>best[i]);
  selected.sort((a,b)=>priority(b)-priority(a) || a.id.localeCompare(b.id));
  const selectedIds = selected.map(c=>c.id);
  const picked = new Set(selectedIds);
  for (const c of good) if (!picked.has(c.id)) rejected.push({id:c.id,reason:'DEFERRED_BY_BUDGET'});
  const estimatedBytes = selected.reduce((sum,c)=>sum+c.estimatedBytes,0);
  return {
    selectedIds,estimatedBytes,objectiveScore:bestScore,baselineScore,
    strategyUsed: strategy==='greedy' ? 'greedy' : bestScore > baselineScore + EPS ? 'annealed' : 'greedy-fallback',
    eligibleCount:n,rejected,executionClass:'CLASSICAL_PLANNING_ONLY',
    evidenceMutation:false,remoteQuantumJobs:0,
  };
}

/**
 * Optional TilesFetchBridge planLoadOrder hook. The caller supplies a reviewed
 * content-addressed tile manifest and an explicit per-update byte budget.
 * No data are fetched here. Unknown or unverified tile IDs are never selected.
 */
export function createQuantumInspiredLoadPlanner(
  manifest: readonly StreamTileCandidate[],
  budget: Omit<StreamPriorityBudget,'maxTiles'>,
): (loadIds: readonly string[], concurrency: number) => readonly string[] {
  if (!Array.isArray(manifest) || manifest.length > MAX_CANDIDATES) throw new RangeError('Manifest must be bounded');
  const byId = new Map<string,StreamTileCandidate>();
  for (const tile of manifest) {
    if (!tile || !ID.test(tile.id) || byId.has(tile.id)) throw new Error('Duplicate or invalid tile identity');
    byId.set(tile.id,tile);
  }
  return (loadIds,concurrency) => {
    if (!Number.isInteger(concurrency) || concurrency < 0 || concurrency > MAX_CANDIDATES) throw new RangeError('Invalid concurrency');
    if (loadIds.length > MAX_CANDIDATES) throw new RangeError('Unbounded per-frame load batch');
    const available = loadIds.map(id=>byId.get(id)).filter((x):x is StreamTileCandidate=>x!==undefined);
    return planQuantumInspiredStream(available,{...budget,maxTiles:concurrency}).selectedIds;
  };
}
