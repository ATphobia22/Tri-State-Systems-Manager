# Level-5 3D Flood Simulator — Technical Reference

> **SIMULATION.** Every output of this system is labeled `provenance: 'simulation'`.
> Governing axiom: **"Technology informs people; it does not silently govern people.
> Human authority remains final."** Engineering actions (mitigation alternatives)
> require explicit human sign-off in the UI and are never auto-applied.

## 1. Architecture

```
data/scenarios/*.json  (schema-validated inputs; see §6)
        │
        ▼
FloodSimEngine — deterministic fixed-timestep core (src/lib/flood-sim/engine.ts)
  ├─ SCS Curve Number runoff  → wired: src/lib/hydrology-runoff.ts
  ├─ 2D diffusion-wave hydraulics → wired: src/lib/hydraulics-diffusion2d.ts
  └─ Hazus depth-damage       → wired: src/lib/hazus-depth-damage.ts
        │
        ▼
three.js open world (src/lib/flood-sim/world/) — pure WebGL, never WebGPU
  terrain (procedural mesh) · water (depth-grid shader) · markers (gauge/anchor)
        │
        ▼
FloodSimulator.tsx — scenario picker, timeline, workbench, live gauge panel,
                     cinematic flythroughs, sign-off gate, axiom banner
```

### Fixed-timestep accumulator

The engine advances sim-time in **fixed quanta of 1/60 sim-second**
(`ENGINE_STEP_HZ = 60`). Rendering is decoupled from physics: the React
component accumulates wall-clock time (`acc += dtWall × timeScale`) and calls
`engine.step()` once per whole quantum; any sub-quantum remainder is banked
for the next frame. Backlog is shed (capped at 6000 quanta/frame) so the
loop can never spiral.

Consequences:

- **Determinism:** same seed + same config + same call sequence ⇒
  bit-identical trajectory, fingerprinted by `stateHash()` (FNV-1a 64-bit
  over canonical sorted-JSON of `{version, scenarioId, seed, stepIndex,
  depth grid, rainfall override}`).
- **Scrubbing:** `setTime(t)` restores the nearest snapshot at or before `t`
  from a ring buffer (default: every 1 sim-minute, capacity 512), then
  fast-forwards through **one single water-advance path** — bulk chunks with
  a constant rainfall rate per hyetograph-node interval. Chunk sizes are
  capped at 1 sim-hour so the wired wave module's internal `dt` stays
  bit-equal to 1/60 s (verified float-exact); scrubbing therefore reproduces
  direct stepping bit-for-bit. Scrub cost scales with the time distance, so
  full-timeline jumps on multi-day scenarios are slow — a documented
  screening-slice limitation, not a bug.
- **Fail-closed:** non-finite config values throw at construction; the 1/60 s
  quantum is probe-checked against the diffusion-wave explicit stability
  limit at construction (refuses to run if violated); `step()` is a no-op
  while paused; `setTime()` clamps to `[0, duration]`.

### SCS → wave coupling (screening-level, documented assumption)

The scenario hyetograph drives `computeSCSRunoff` once at init (the module's
own fail-closed validation applies). The cumulative runoff curve is sampled
at the hyetograph nodes; per quantum, the SCS increment is re-applied to the
wave model as a uniform rainfall rate (in/hr). This assumes the modeled
domain coincides with the watershed footprint and runoff arrives uniformly —
a **conservative screening-level coupling, not a calibrated hydrologic
model**. The hyetograph rain is NOT also fed to the wave model (that would
double-count; the SCS depth already derives from it).

## 2. Data flow: REST polling only

All live data enters via **`startGaugePoll`** (`src/lib/river-gauges`) —
periodic REST polling (60 s interval in the UI). There are **no WebSockets,
no socket.io, no EventSource/SSE, no MQTT** anywhere in the simulator.

Enforcement: `src/lib/flood-sim/no-websocket-gate.test.ts` is a source-grep
gate that reads every non-test file under `src/lib/flood-sim/` and fails on
any reference to a push/streaming transport — comments included (the gate's
own docstring is the only permitted mention, and test files are excluded
from the scan). It is executed through `tests/flood-sim-no-websocket.test.ts`
so the standard `tests/flood-sim-*.test.ts` glob covers it.

## 3. Level-5 criteria (self-defined)

"Level-5" here means a **fully interactive, deterministic, reviewable
simulation workbench**, not an autonomy level. Criteria and status:

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Open 3D world (terrain, water, markers) in pure WebGL | ✅ |
| 2 | Deterministic fixed-timestep engine with hash-verified replay | ✅ |
| 3 | Timeline scrubbing with snapshot ring buffer | ✅ |
| 4 | Scenario registry (schema-validated JSON, 3 scenarios) | ✅ |
| 5 | Engineering workbench: freeboard arithmetic, mitigation alternatives with sign-off gate, cross-sections, cut/fill, datum-gated WSE | ✅ |
| 6 | Live gauge REST polling with LIVE/STALE/SOURCE UNAVAILABLE states | ✅ |
| 7 | Cinematic flythroughs (intro/outro + per-scenario) | ✅ |
| 8 | Quality tiers affecting renderer AND mesh density | ✅ |
| 9 | Historical-data honesty policy (§5) | ✅ |
| 10 | Calibrated hydrology, surveyed terrain, real DEM tiles | ❌ remaining — terrain is procedural, explicitly labeled "not surveyed"; no tile bytes bundled |
| 11 | Full Saint-Venant solver | ❌ non-goal — diffusion-wave is screening-level by design |
| 12 | Path-traced water | ❌ non-goal — real-time approximation, labeled as such |

## 4. Quality tiers

`QUALITY_TIERS` (low / medium / high / ultra) scale: renderer pixel ratio
and effects, **terrain mesh segments**, and **water mesh segments**
(the water mesh is rebuilt per tier — shader detail alone was insufficient).
Physics grid resolution is scenario-defined and never changes with quality.

## 5. Historical-data honesty policy

**Only one numeric 1937 value in this repository may be treated as factual:**

- **Evansville peak stage 54.0 ft (USGS 03322000)** — sourced from
  `docs/grants/bric-fy2025-subapplication-narrative.md:34`.

Everything else about 1937 — hyetograph shape and timing, local depths,
damage figures, terrain — is **provisional**: illustrative placeholders the
operator must replace with sourced values before any evidentiary use. The
`1937-ohio-river-flood` scenario JSON carries `provisional: true`,
`humanReviewRequired: true`, a `provisionalFields` list, and a single-entry
`sourcedValues` array (54.0 ft only). The UI renders a PROVISIONAL badge and
the field count. No other numeric flood-stage value (including any flood
stage) is carried as a sourced fact in this file.

## 6. Scenario authoring guide

Scenarios live in `data/scenarios/*.json`, validated against
`data/schemas/flood-sim-scenario.schema.json` (structure + numeric ranges).

Required fields: `scenarioId`, `title`, `description`, `provenance`
(must be `"simulation"`), `engine` (grid, hyetograph, SCS params, duration,
structures), `terrain` (procedural params or explicit grid), `source`,
`humanReviewRequired`. Recommended: `provisional: true` + `provisionalFields`
for anything not sourced, and `sourcedValues: [{field, value, unit, source}]`
for the few values that are.

Shipped scenarios:

1. **`1937-ohio-river-flood`** — provisional replay of the Great Ohio River
   Flood at the anchor site. One sourced value: 54.0 ft peak stage
   (USGS 03322000). All else provisional.
2. **`q100-design-event`** — synthetic 1%-annual-chance design storm for
   engineering screening. Fully synthetic; no historical claims.
3. **`live-gauge-driven`** — engine driven by operator rainfall override
   informed by live REST-polled USGS gauges (LIVE/STALE/SOURCE UNAVAILABLE).
   Never interpolates missing data.

`scenarioToEngineConfig()` converts a scenario to an engine config;
`scenarioSeed()` maps the scenario id to a stable uint32 seed.

## 7. Provenance taxonomy

Repo-wide evidence labels: `FEMA-effective` / `State-best` / `observed` /
`modeled` / `forecast`. The flood simulator adds **`simulation`** — every
engine output carries `provenance: 'simulation'` (the underlying modules'
`MODELED/DERIVED` labels are preserved as lineage via `getScsTotals()` and
the Hazus result objects; the engine layer adds the plain-language label).
"Three separate truths" applies: a visualization is never silently evidence.

## 8. Datum rules

- Water-surface elevation (WSE) in NAVD88 is computed **only** from
  `source gage height + a validated NAVD88 gage zero` (`wseFromGageHeight`).
- Without a validated gage zero, the UI shows **SOURCE DATUM ONLY** — never
  a fabricated NAVD88 number. No validated gage zero is on file for the
  live gauges, so the live panel reads SOURCE DATUM ONLY today.
- Gauge freshness: **LIVE** / **STALE** / **SOURCE UNAVAILABLE**. Missing
  data is never interpolated.

## 9. Platform matrix

| Platform | Status |
|----------|--------|
| Web | ✅ Vite build; `tsm-console/dist/` is the build output |
| iOS (Capacitor) | ✅ `capacitor.config.ts` has `webDir: 'dist'`; renderer uses **pure WebGL only — WebGPU is never required** |
| Desktop | Installer script exists at `tsm-native/Installer/TSM-Native.iss`; the build artifact is **not committed** and is not rebuilt by this work |

## 10. Non-goals

- No path tracing (water is a real-time fresnel/specular approximation).
- No full Saint-Venant solver (2D diffusion wave, screening-level).
- No surveyed terrain or bundled DEM tiles (procedural terrain, labeled).
- No streaming transports (REST polling only, §2).
- No auto-applied engineering decisions (sign-off gate, axiom).

## 11. Verification

```bash
npx vitest run tests/flood-sim-*.test.ts                                  # simulator suites
npx vitest run tests/hydrology-runoff.test.ts tests/hazus-depth-damage.test.ts \
  tests/hydraulics-diffusion2d.test.ts tests/scenario-runner.test.ts      # touched suites
npx tsc --noEmit
npm run build   # verify tsm-console/dist/ exists for Capacitor webDir: 'dist'
```

## 12. Known limitations

- Timeline scrub cost scales with scrub distance (see §1); full jumps on
  multi-day scenarios take seconds-to-minutes.
- Only 2 of the 12 `verified_observation_stations` in
  `artifacts/tsm-river-valley-realtime-stations-v1.json` (USGS 03378500 New
  Harmony, 03322000 Evansville) carry latitude/longitude anywhere in the
  artifact; the other 10 are listed in the UI legend as unplaced with the
  explicit reason — positions are never guessed.
- SCS→wave coupling is uniform-rate and screening-level (§1).
- Mitigation alternatives use simplified berm-cell/channel-cell masks, not
  surveyed alignments.

## 13. Terrain elevation, hillshade, and live-data integration

- Elevation source: bundled source-derived screening grid
  (`tsm-console/src/lib/flood-sim/world/data/source-derived-dem-posey.json`,
  fetched by `tools/terrain/fetch-terrarium-dem.py` from AWS Terrarium tiles;
  CONUS portion 3DEP/NED-sourced per Tilezen joerd attribution), resampled to
  each scenario domain by `resolveElevationGrid()`; procedural seeded
  value-noise remains the validated fallback. Full detail:
  `docs/TERRAIN-LIVE-DATA.md`.
- Mesh vertex colours combine the hypsometric tint with an analytic Horn's
  hillshade (`world/hillshade.ts`); the shade is visual only.
- `LiveDataManager` (`world/live-data.ts`) polls gauges (60 s) and probes the
  terrain tile endpoint (5 min) over REST, with an in-memory tile cache and
  the fallback chain live tiles → bundled grid → procedural. The UI status
  badge always names the actual source and its age (LIVE / STALE /
  SOURCE_UNAVAILABLE / CANDIDATE_NOT_LIVE).
- The 3DEP-derived grid is screening-level (~15 m source posting), not
  survey-grade, and changes nothing about the LOMA evidence position.
