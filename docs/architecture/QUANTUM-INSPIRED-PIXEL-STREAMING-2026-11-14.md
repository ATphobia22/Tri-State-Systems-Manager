# Quantum-Inspired Pixel Streaming Priority — Evidence-First Integration

**Date:** 2026-11-14. **Status:** bounded classical optimizer, tested headless, opt-in 3D Tiles bridge seam; **not** a deployed UE5.8 Pixel Streaming 2 server, quantum speedup, or trained neural model.

## System separation

```text
USGS / NOAA / USACE / NPS / state official source snapshots (immutable provenance)
    ↓ verify sha256, agency, licenses, CRS / vertical datum / time
HEC-RAS / EPA SWMM / MODFLOW-6 headless solver execution + calibration
    ↓ signed/verified science receipts, not GPU visuals
Authoritative 4D state ledger ──→ 3D Tiles HLOD / spatial tiles / UE5.8 world partition
                                   ↓ candidate manifest with verified hashes
                Classical quantum-inspired binary budget optimizer (THIS PR)
                                   ↓ opt-in lifecycle-approved cache-mark priority
                         TilesFetchBridge / 3d-tiles-renderer
                                   ↓ render and encode on actual GPU (NOT PROVIDED)
                         UE5.8 Pixel Streaming 2 / WebRTC (NOT PROVIDED)
                                   ↓
                          Headed accessible browser / film
```

**Critical boundary:** Unreal Pixel Streaming 2 is a real-time GPU video encoder and WebRTC delivery stack, not a quantum computer. The bridge hook prioritizes existing lifecycle-approved cache-mark operations; it **does not reorder the renderer's autonomous network request queue** or control WebRTC's encoder bitrate. Any future end-to-end network scheduler must be integrated and profiled against actual renderer/network APIs.

## Implemented components

- `tsm-console/src/lib/quantum-inspired-stream-priority.ts`: deterministic binary optimizer. Hard limits 64 candidate tiles per call, 1,024 annealing steps, integer byte and item caps, seeded pseudo-randomness, two classical greedy baselines and a bounded Metropolis local search. Objective combines normalized quality gain, freshness, motion priority, and bounded same-scene coherence. It retains the better baseline whenever annealing fails.
- Evidence guard: **all** candidates require 64-character lowercase SHA-256, source verification, license review, classification `OBSERVED|DERIVED|SCENARIO|PRESENTATION`, safe tile ID, positive integer estimated bytes and finite normalized scores. Missing evidence is excluded, not guessed. The classification is **never promoted** by optimization.
- `createQuantumInspiredLoadPlanner` returns an opt-in bridge callback using a bounded, reviewed tile manifest. Unknown IDs cannot be selected.
- `TilesFetchBridgeOptions.planLoadOrder` accepts only unique IDs from `TileResourceLifecycle.toFetch` and caps them by existing adaptive concurrency. Default bridge behavior is unchanged when the hook is absent.
- `tsm-console/tests/quantum-inspired-stream-priority.test.mjs`: deterministic repeatability, byte/concurrency caps, unknown/unlicensed/hashless exclusions, input validation and non-authoritative receipt. Existing bridge Vitest tests additionally exercise the opt-in path.
- `integrations/quantum/research/bell-state-qasm3.qasm` and accompanying qBraid ideal-statevector result: 50% each `00` and `11`, **zero hardware jobs**. A two-qubit simulator is a circuit sanity check, **not** proof of a quantum speedup or a streaming improvement.

### Example opt-in (not enabled in production)

```ts
import { createQuantumInspiredLoadPlanner } from './quantum-inspired-stream-priority';
import { TilesFetchBridge } from './tiles-fetch-bridge';

// Verified tiles must come from a real immutable asset manifest, never guessed.
const planLoadOrder = createQuantumInspiredLoadPlanner(verifiedTiles, {
  maxBytes: 8_000_000, strategy: 'annealed', seed: 713, annealSteps: 256,
});
const bridge = new TilesFetchBridge(renderer, lodScheduler, {
  resolveTile, planLoadOrder,
});
```

The byte budget is a **per-call estimate** and not a real measured WebRTC bitrate cap. For actual streaming, derive the budget from telemetry, instrument the renderer's queue, and enforce a separate network cap.

## Parallel neural prediction (future opt-in; NOT implemented)

An artificial neural network could predict tile visibility, motion and bandwidth pressure from *consented, non-identifying, bounded* client telemetry, but no network is trained or inferred by this PR. The current scores are explicit caller inputs. Before deploying any predictor:

1. Use only timestamped, opt-in, non-identifying features; no coordinates tied to individuals, IPs or user IDs in training artifacts.
2. Keep a deterministic classical baseline, and deny model outputs when weights, training data, model-card version, validation holdout or drift threshold are unverified.
3. Compare accuracy and total wall-clock latency against the existing SSE scheduler and bandwidth-adaptive controller. A higher ML score is not a substitute for a source-hash or license review.
4. Isolate model training in a headless worker; the browser and Unreal GPU only consume reviewed inference scores and render frames.

## Quantum algorithm experiments (separate, non-authoritative)

The repository already has an IBM Quantum sampler worker with `outputPolicy:'quarantine'` and `authorityClass:'DERIVED'`. Keep all QPU experiments separate from live graphics and flood safety decisions. qBraid's free built-in simulator was used only for the Bell-state experiment. No provider QPU was contacted, no credits spent, and no data were sent to any model-training service.

Research leads:

- [Park, Baek and Kim, *Spatio-Temporal Multi-Metaverse Dynamic Streaming for Hybrid Quantum-Classical Systems*](https://scispace.com/papers/spatio-temporal-multi-metaverse-dynamic-streaming-for-hybrid-3e4w786ci7gq): suggests separating scheduling from classical rendering; paper findings do not establish TSM performance.
- [Huang et al., *Personalized QoE Enhancement for Adaptive Video Streaming: A Digital Twin-Assisted Scheme*](https://scispace.com/papers/personalized-qoe-enhancement-for-adaptive-video-streaming-a-5fn37xz1): context for QoE objectives, not a privacy license.
- [*The Overlap Gap Property: Separating Quantum and Quantum-Inspired Approximate Optimization Algorithms*](https://www.alphaxiv.org/abs/2609.35131): caution against assuming quantum-inspired local optimization always improves on strong classical baselines.
- [Epic UE5.8 Pixel Streaming 2 overview](https://dev.epicgames.com/documentation/unreal-engine/pixel-streaming-2-overview-in-unreal-engine) and [Stream Tuning Guide](https://dev.epicgames.com/documentation/unreal-engine/stream-tuning-guide?lang=en-US): WebRTC adapts bitrate and quality; preserve its feedback loop.

## Acceptance and reproducibility

```bash
node --experimental-strip-types --test tsm-console/tests/quantum-inspired-stream-priority.test.mjs
cd tsm-console && npm run check:type
```

Before enabling in production: benchmark **median/p95 scheduler latency**, **frame time and dropped frames**, **quality-of-experience under loss/RTT**, **GPU memory**, **actual tile cache hit ratio**, **source-evidence denials**, and **solver-to-render provenance continuity** against the existing baseline. Use fixed camera trajectories, packet-loss profiles, data hashes and reproducible seeds. Reject if frame-time regressions or source-denial failures occur; do not assert an advantage without measured baselines.

**Legal boundary:** A patent described as expired is not blanket clearance to implement related claims, copyrighted code, or third-party graphics plugins. The separate patent prior-art register and license review are mandatory before shipping.
