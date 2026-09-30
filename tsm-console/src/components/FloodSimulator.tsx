/**
 * FloodSimulator.tsx — Level-5 3D open-world photorealistic engineering
 * flood simulator (vertical slice).
 *
 * Wires: FloodSimEngine (fixed 60 Hz timestep, accumulator loop) + the
 * three.js open world (terrain / water / markers) + workbench + cinematic
 * flythroughs + scenario picker.
 *
 * Governing axiom (persistent banner below): "Technology informs people;
 * it does not silently govern people. Human authority remains final."
 * All outputs are labeled SIMULATION. Engineering alternatives require an
 * explicit human sign-off checkbox before they apply — never auto-applied.
 *
 * Data honesty labels shown in-UI:
 * - terrain: resolved source label — "live Terrarium tiles" or "3DEP-derived
 *   screening grid". Fail-closed: no synthetic terrain is ever substituted.
 * - water: "real-time approximation, not path tracing"
 * - gauges: RETIRED 2026-09-29 (owner: drop live river data).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { prefersReducedMotion } from '../lib/reduced-motion';
import {
  FloodSimEngine,
  STEP_DT_SEC,
  SIMULATION_PROVENANCE,
  listScenarios,
  getScenario,
  scenarioToEngineConfig,
  createFloodRenderer,
  buildTerrainMesh,
  WaterSurface,
  buildMarkers,
  lagBfeProbe,
  MITIGATION_ALTERNATIVES,
  getAlternative,
  applyAlternativeToTerrain,
  crossSectionProfile,
  cutFillVolumes,
  scenarioFlythrough,
  TimeLapseDriver,
  INTRO_SHOTS,
  OUTRO_SHOTS,
  QUALITY_TIERS,
  QUALITY_TIER_ORDER,
  ANCHOR_SITE,
  resolveElevationGrid,
  LiveDataManager,
  resolveTerrainWithFallback,
  type QualityTier,
  type AlternativeId,
  type FloodRenderer,
  type BuiltTerrain,
  type BuiltMarkers,
  type FloodSimScenario,
  type LiveDataSnapshot,
  type ResolvedLiveTerrain,
  type ResolvedTerrainSource,
  type TerrainDataQuality,
  type SourceDerivedMeta,
} from '../lib/flood-sim/index';
import { BONEBANK_SITE_CONSTANTS } from '../lib/scientific-analytics';

const AXIOM =
  'Technology informs people; it does not silently govern people. Human authority remains final.';

function formatClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface UiSnapshot {
  simTimeSec: number;
  maxDepthFt: number;
  stateHash: string;
  peakDischargeCfs: number;
  totalRunoffIn: number;
  damage: Array<{ id: string; name: string; depthAboveFf: number; totalUsd: number }>;
  probe: { lag: number; ffe: number; berm: number };
  snapshotCount: number;
}

export default function FloodSimulator(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scenarios] = useState<FloodSimScenario[]>(() => listScenarios());
  const [scenarioId, setScenarioId] = useState<string>(() => listScenarios()[0]?.scenarioId ?? '');
  const [quality, setQuality] = useState<QualityTier>('medium');
  // Reduced-motion users start paused and without the RAF loop — a single
  // static frame is rendered instead (gate inside the lifecycle effect).
  const [reducedMotion] = useState(() => prefersReducedMotion());
  const [paused, setPaused] = useState(() => prefersReducedMotion());
  const [timeScale, setTimeScale] = useState(60);
  const [ui, setUi] = useState<UiSnapshot | null>(null);
  const [alternativeId, setAlternativeId] = useState<AlternativeId>('no-action');
  const [signedOff, setSignedOff] = useState(false);
  const [cutFill, setCutFill] = useState<{ cutFt3: number; fillFt3: number; netFt3: number } | null>(null);
  const [crossSection, setCrossSection] = useState<Array<{ d: number; wse: number; g: number }>>([]);
  const [playingTour, setPlayingTour] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildKey, setBuildKey] = useState(0);
  // Terrain source: 'auto' resolves the bundled source-derived screening
  // grid (fail-closed when unavailable); 'live' attempts a live tile fetch
  // with fallback to the bundled grid. No synthetic terrain is substituted.
  const [terrainMode, setTerrainMode] = useState<'auto' | 'live'>('auto');
  const [liveTerrain, setLiveTerrain] = useState<ResolvedLiveTerrain | null>(null);
  const [terrainNotice, setTerrainNotice] = useState<string | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<LiveDataSnapshot | null>(null);
  const [terrainProvenance, setTerrainProvenance] = useState<string>('resolving elevation source…');
  const managerRef = useRef<LiveDataManager | null>(null);

  const worldRef = useRef<{
    renderer: FloodRenderer;
    engine: FloodSimEngine;
    terrain: BuiltTerrain;
    water: WaterSurface;
    markers: BuiltMarkers;
    baselineElev: number[][];
    sourceInfo: Pick<ResolvedTerrainSource, 'source' | 'dataQuality' | 'provenance' | 'sourceDerivedMeta'>;
    orbit: { yaw: number; pitch: number; dist: number; target: THREE.Vector3 };
    driver: TimeLapseDriver | null;
    tourStartWall: number;
    raf: number;
  } | null>(null);
  // Mutable mirror of timeScale for the rAF loop (avoids re-creating the world).
  const timeScaleRef = useRef(timeScale);
  timeScaleRef.current = timeScale;
  // Mutable mirror of paused so world construction can honor it without
  // adding `paused` to the lifecycle effect's dependency array.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Reference to the current world's frame callback so a paused loop can be
  // restarted by the reduced-motion resume path without rebuilding the world.
  const frameRef = useRef<(now: number) => void>(() => {});
  /**
   * Applied mitigation alternative, persisted across world rebuilds. The
   * lifecycle effect reads this when constructing the engine; the Apply
   * handler writes it and bumps `buildKey` so the world is rebuilt WITH the
   * alternative (instead of being discarded by the rebuild). Reset clears it.
   */
  const appliedAltRef = useRef<{ elevationFt: number[][]; manningN: number } | null>(null);

  // Keep the engine's pause flag in sync with the UI.
  useEffect(() => {
    const eng = worldRef.current?.engine;
    if (!eng) return;
    if (paused) eng.pause();
    else eng.resume();
  }, [paused, buildKey, scenarioId]);

  // Reduced-motion RAF management: the loop starts static; an explicit
  // Resume restarts it, Pause stops it again. Normal motion keeps the
  // pre-existing always-on loop untouched.
  useEffect(() => {
    if (!reducedMotion) return;
    const world = worldRef.current;
    if (!world) return;
    if (paused) {
      if (world.raf) {
        cancelAnimationFrame(world.raf);
        world.raf = 0;
      }
    } else if (!world.raf) {
      world.raf = requestAnimationFrame(frameRef.current);
    }
  }, [paused, reducedMotion]);

  // -- quality changes: renderer tier + mesh density, no engine rebuild ----
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.renderer.applyQuality(quality);
    const spec = QUALITY_TIERS[quality];
    const cfg = world.engine.config;
    const elev = world.engine.getElevationGrid();
    world.renderer.scene.remove(world.terrain.mesh);
    world.terrain.dispose();
    const terrain = buildTerrainMesh({
      nx: cfg.nx,
      ny: cfg.ny,
      dxFt: cfg.dxFt,
      seed: cfg.seed,
      baseElevFt: 375,
      valleyReliefFt: 8,
      noiseAmplitudeFt: 2,
      elevationFt: elev,
      sourceInfo: world.sourceInfo,
      segments: spec.terrainSegments,
    });
    world.renderer.scene.add(terrain.mesh);
    world.terrain = terrain;
    // Water mesh density is a tier requirement too: rebuild the mesh with
    // the tier's segment count (shader detail alone is not enough).
    world.renderer.scene.remove(world.water.mesh);
    world.water.dispose();
    const water = new WaterSurface({
      nx: cfg.nx,
      ny: cfg.ny,
      dxFt: cfg.dxFt,
      widthFt: cfg.nx * cfg.dxFt,
      depthFt: cfg.ny * cfg.dxFt,
      segments: spec.waterSegments,
      detailLevel: spec.waterDetail,
    });
    world.renderer.scene.add(water.mesh);
    world.water = water;
  }, [quality]);

  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId, scenarios]);

  // -- live-data manager: terrain endpoint health + unified status snapshot --
  // Polling only (interval HTTPS); the manager never blocks first render.
  // VITE_TSM_TERRAIN_RGB_URL_TEMPLATE is the production variable (full
  // https:// template, e.g. https://tiles.example.com/terrain_3dep/{z}/{x}/{y}.png);
  // VITE_TSM_TERRAIN_TILE_URL (base URL) is the local-dev fallback. The
  // Terrain-RGB decoder is selected for any TSM-published pyramid; Terrarium
  // is assumed only for the default AWS elevation-tiles-prod endpoint.
  useEffect(() => {
    const template = import.meta.env.VITE_TSM_TERRAIN_RGB_URL_TEMPLATE?.trim() || '';
    const fromTemplate = template.replace(/\/\{z\}\/\{x\}\/\{y\}\.png$/, '');
    const tileBaseUrl =
      import.meta.env.VITE_TSM_TERRAIN_TILE_URL?.trim() ||
      (fromTemplate && fromTemplate !== template ? fromTemplate : '') ||
      undefined;
    const manager = new LiveDataManager({
      ...(tileBaseUrl ? { terrainBaseUrl: tileBaseUrl } : {}),
      tileClientOptions: {
        encoding:
          tileBaseUrl == null || /terrarium|elevation-tiles-prod/i.test(tileBaseUrl)
            ? 'terrarium'
            : 'terrain-rgb',
      },
    });
    managerRef.current = manager;
    const unsubscribe = manager.subscribe((snap) => setLiveSnapshot(snap));
    manager.start();
    return () => {
      unsubscribe();
      manager.stop();
      managerRef.current = null;
    };
  }, []);

  // -- live terrain fetch: explicit user action, labeled fallback ------------
  useEffect(() => {
    if (terrainMode !== 'live') {
      setLiveTerrain(null);
      return;
    }
    const manager = managerRef.current;
    if (!manager) {
      setTerrainNotice('Live-data manager not ready — try again in a moment.');
      setTerrainMode('auto');
      return;
    }
    let cancelled = false;
    setTerrainNotice('Fetching live terrain tiles…');
    const scn = getScenario(scenarioId);
    void resolveTerrainWithFallback({
      client: manager.terrainClient,
      anchorLat: ANCHOR_SITE.lat,
      anchorLon: ANCHOR_SITE.lng,
      nx: scn.engine.nx,
      ny: scn.engine.ny,
      dxFt: scn.engine.dxFt,
    }).then((resolved) => {
      if (cancelled) return;
      setLiveTerrain(resolved);
      if (resolved.tier !== 'live') {
        setTerrainNotice(
          'Live tiles unreachable — using the bundled source-derived screening grid.',
        );
      } else {
        setTerrainNotice(null);
      }
      setBuildKey((k) => k + 1);
    }).catch((err) => {
      if (cancelled) return;
      // Fail-closed: no synthetic terrain is substituted.
      setError(
        `Terrain unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrainMode]);

  // -- world + engine lifecycle ----------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scenarioId) return;
    setError(null);

    let world: NonNullable<typeof worldRef.current> | null = null;
    try {
      const scn = getScenario(scenarioId);
      const baseConfig = scenarioToEngineConfig(scn);
      // Resolve the elevation source ONCE per build; the engine and the mesh
      // share the same grid so physics and visuals agree exactly.
      const terrainOpts = {
        nx: baseConfig.nx,
        ny: baseConfig.ny,
        dxFt: baseConfig.dxFt,
        seed: baseConfig.seed,
        baseElevFt: 375,
        valleyReliefFt: 8,
        noiseAmplitudeFt: 2,
      };
      let sourceInfo: Pick<
        ResolvedTerrainSource,
        'source' | 'dataQuality' | 'provenance' | 'sourceDerivedMeta'
      >;
      let resolvedGrid: number[][];
      if (terrainMode === 'live' && liveTerrain) {
        resolvedGrid = liveTerrain.grid;
        sourceInfo = {
          source: 'source-derived',
          dataQuality: 'live-terrain-service' as TerrainDataQuality,
          provenance: liveTerrain.provenance,
          sourceDerivedMeta: null,
        };
      } else {
        const resolved = resolveElevationGrid({
          ...terrainOpts,
          terrainSource: 'auto',
        });
        resolvedGrid = resolved.grid;
        sourceInfo = {
          source: resolved.source,
          dataQuality: resolved.dataQuality,
          provenance: resolved.provenance,
          sourceDerivedMeta: resolved.sourceDerivedMeta,
        };
      }
      // A signed-off alternative persists across rebuilds via appliedAltRef.
      const alt = appliedAltRef.current;
      const config = alt
        ? { ...baseConfig, elevationFt: alt.elevationFt, manningN: alt.manningN }
        : { ...baseConfig, elevationFt: resolvedGrid };
      if (alt) {
        sourceInfo = {
          ...sourceInfo,
          provenance: `${sourceInfo.provenance} (+ signed-off mitigation alternative)`,
        };
      }
      setTerrainProvenance(sourceInfo.provenance);
      const engine = new FloodSimEngine(config);
      if (pausedRef.current) engine.pause();

      const renderer = createFloodRenderer(canvas, quality);
      const spec = QUALITY_TIERS[quality];
      const elev = engine.getElevationGrid();
      const terrain = buildTerrainMesh({
        nx: config.nx,
        ny: config.ny,
        dxFt: config.dxFt,
        seed: config.seed,
        baseElevFt: 375,
        valleyReliefFt: 8,
        noiseAmplitudeFt: 2,
        elevationFt: elev,
        sourceInfo,
        segments: spec.terrainSegments,
      });
      renderer.scene.add(terrain.mesh);

      const water = new WaterSurface({
        nx: config.nx,
        ny: config.ny,
        dxFt: config.dxFt,
        widthFt: config.nx * config.dxFt,
        depthFt: config.ny * config.dxFt,
        segments: spec.waterSegments,
        detailLevel: spec.waterDetail,
      });
      renderer.scene.add(water.mesh);

      const w = config.nx * config.dxFt;
      const d = config.ny * config.dxFt;
      const groundHeightAt = (xFt: number, zFt: number): number => {
        const col = (xFt + w / 2) / config.dxFt - 0.5;
        const row = (zFt + d / 2) / config.dxFt - 0.5;
        const c = Math.min(config.nx - 1.001, Math.max(0, col));
        const r = Math.min(config.ny - 1.001, Math.max(0, row));
        const c0 = Math.floor(c);
        const r0 = Math.floor(r);
        const fc = c - c0;
        const fr = r - r0;
        const g = elev;
        return (
          g[r0][c0] * (1 - fc) * (1 - fr) +
          g[r0][c0 + 1] * fc * (1 - fr) +
          g[r0 + 1][c0] * (1 - fc) * fr +
          g[r0 + 1][c0 + 1] * fc * fr
        );
      };
      const markers = buildMarkers({
        domainHalfWidthFt: w / 2,
        domainHalfDepthFt: d / 2,
        groundHeightAt,
      });
      renderer.scene.add(markers.group);

      const orbit = {
        yaw: 0.6,
        pitch: 0.9,
        dist: 22000,
        target: new THREE.Vector3(0, 0, 0),
      };

      world = {
        renderer,
        engine,
        terrain,
        water,
        markers,
        baselineElev: elev.map((row) => [...row]),
        sourceInfo,
        orbit,
        driver: null,
        tourStartWall: 0,
        raf: 0,
      };
      worldRef.current = world;

      const resize = (): void => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        renderer.resize(Math.max(1, rect.width), Math.max(1, rect.height));
      };
      resize();
      window.addEventListener('resize', resize);

      // Minimal orbit control (dependency-light: no addons import).
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const onPointerDown = (e: PointerEvent): void => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        if (world) {
          world.driver = null;
          setPlayingTour(false);
        }
      };
      const onPointerMove = (e: PointerEvent): void => {
        if (!dragging || !world) return;
        world.orbit.yaw -= (e.clientX - lastX) * 0.005;
        world.orbit.pitch = Math.min(1.45, Math.max(0.15, world.orbit.pitch + (e.clientY - lastY) * 0.004));
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const onPointerUp = (): void => {
        dragging = false;
      };
      const onWheel = (e: WheelEvent): void => {
        if (!world) return;
        e.preventDefault();
        world.orbit.dist = Math.min(120000, Math.max(1500, world.orbit.dist * (1 + e.deltaY * 0.001)));
      };
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });

      // Fixed-timestep accumulator: wall-clock → whole 1/60 s engine quanta.
      let last = performance.now();
      let acc = 0;
      let uiAcc = 0;
      let waterDirty = true;
      const frame = (now: number): void => {
        if (!world) return;
        const dtWall = Math.min(0.1, (now - last) / 1000);
        last = now;
        const engPaused = engine.isPaused;
        if (!engPaused) {
          acc += dtWall * timeScaleRef.current;
          let steps = 0;
          const maxSteps = 6000;
          while (acc >= STEP_DT_SEC && steps < maxSteps) {
            engine.step();
            acc -= STEP_DT_SEC;
            steps += 1;
          }
          if (steps === maxSteps) acc = 0; // shed backlog — never spiral
          if (steps > 0) waterDirty = true;
        }
        if (waterDirty) {
          water.updateFromDepth(engine.getDepthGrid(), engine.getElevationGrid());
          waterDirty = false;
        }
        water.updateVisual(renderer.camera, dtWall);

        // Camera: cinematic driver or free orbit.
        const cam = renderer.camera;
        if (world.driver) {
          const pose = world.driver.poseAt(engine.simTimeSec, now - world.tourStartWall);
          const cy = Math.cos(pose.bearingDeg * (Math.PI / 180));
          const sy = Math.sin(pose.bearingDeg * (Math.PI / 180));
          const cp = Math.cos(pose.pitchDeg * (Math.PI / 180));
          const sp = Math.sin(pose.pitchDeg * (Math.PI / 180));
          cam.position.set(
            pose.target[0] + pose.distanceFt * cp * sy,
            pose.distanceFt * sp,
            pose.target[1] + pose.distanceFt * cp * cy,
          );
          cam.lookAt(pose.target[0], 0, pose.target[1]);
          if (now - world.tourStartWall >= world.driver.tourLengthMs) {
            world.driver = null;
            setPlayingTour(false);
          }
        } else {
          const o = world.orbit;
          cam.position.set(
            o.target.x + o.dist * Math.cos(o.pitch) * Math.sin(o.yaw),
            o.target.y + o.dist * Math.sin(o.pitch),
            o.target.z + o.dist * Math.cos(o.pitch) * Math.cos(o.yaw),
          );
          cam.lookAt(o.target);
        }

        renderer.renderer.render(renderer.scene, cam);

        // UI snapshot at ~4 Hz (not every frame).
        uiAcc += dtWall;
        if (uiAcc > 0.25) {
          uiAcc = 0;
          const totals = engine.getScsTotals();
          const probe = lagBfeProbe(ANCHOR_SITE.lat, ANCHOR_SITE.lng, BONEBANK_SITE_CONSTANTS);
          setUi({
            simTimeSec: engine.simTimeSec,
            maxDepthFt: engine.getMaxDepthFt(),
            stateHash: engine.stateHash(),
            peakDischargeCfs: totals.peakDischargeCfs,
            totalRunoffIn: engine.getCumulativeRunoffIn(),
            damage: engine.getDamageReport().map((r) => ({
              id: r.structureId,
              name: r.structureName,
              depthAboveFf: r.depthAboveFirstFloorFt,
              totalUsd: r.damage.totalUsd,
            })),
            probe: { lag: probe.lagMinusBfeFt, ffe: probe.ffeMinusBfeFt, berm: probe.bermMinusBfeFt },
            snapshotCount: engine.getSnapshotCount(),
          });
          const prof = crossSectionProfile({
            elevationFt: engine.getElevationGrid(),
            depthFt: engine.getDepthGrid(),
            dxFt: config.dxFt,
            from: { col: 0, row: config.ny / 2 },
            to: { col: config.nx - 1, row: config.ny / 2 },
            samples: 48,
          });
          setCrossSection(prof.map((p) => ({ d: p.distanceFt, wse: p.wseFt, g: p.groundElevFt })));
        }
        // Reduced-motion gate: with reduced motion and the engine paused
        // (the reduced-motion default), render this single static frame and
        // do not keep the RAF loop alive.
        if (!(reducedMotion && engine.isPaused)) {
          world.raf = requestAnimationFrame(frame);
        }
      };
      frameRef.current = frame;
      // Reduced-motion starts with a single static render; otherwise the
      // continuous RAF loop starts here.
      if (reducedMotion && pausedRef.current) {
        frame(performance.now());
      } else {
        world.raf = requestAnimationFrame(frame);
      }

      return () => {
        cancelAnimationFrame(world!.raf);
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);
        world!.markers.dispose();
        world!.water.dispose();
        world!.terrain.dispose();
        world!.renderer.dispose();
        worldRef.current = null;
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    }
    return undefined;
  }, [scenarioId, buildKey, terrainMode, liveTerrain]);

  // -- handlers ---------------------------------------------------------------
  const durationSec = scenario.engine.durationHrs * 3600;

  const handleScrub = (v: number): void => {
    const world = worldRef.current;
    if (!world) return;
    world.engine.setTime(v);
  };

  const handlePlayTour = (): void => {
    const world = worldRef.current;
    if (!world) return;
    const keys = scenarioFlythrough(scenarioId);
    world.driver = new TimeLapseDriver(keys, durationSec);
    world.tourStartWall = performance.now();
    setPlayingTour(true);
    // Reduced-motion gate: the RAF loop is static while paused, so render
    // the tour's first keyframe once as a still instead of animating.
    if (reducedMotion && world.engine.isPaused) {
      frameRef.current(performance.now());
      world.driver = null;
      setPlayingTour(false);
    }
  };

  const handleApplyAlternative = (): void => {
    const world = worldRef.current;
    if (!world) return;
    const alt = getAlternative(alternativeId);
    try {
      // The sign-off gate lives here: applyAlternativeToTerrain throws
      // unless humanSignedOff is true (checkbox below).
      const cfg = world.engine.config;
      const isBermCell = (_row: number, col: number): boolean => col >= cfg.nx - 4;
      const isChannelCell = (_row: number, col: number): boolean => col < 4;
      const { elevationFt, manningN } = applyAlternativeToTerrain({
        elevationFt: world.baselineElev,
        manningN: cfg.manningN,
        alternative: alt,
        isBermCell,
        isChannelCell,
        humanSignedOff: signedOff,
      });
      const cf = cutFillVolumes(world.baselineElev, elevationFt, cfg.dxFt);
      setCutFill({ cutFt3: cf.cutFt3, fillFt3: cf.fillFt3, netFt3: cf.netFt3 });
      // Persist the alternative so the lifecycle rebuild constructs the
      // engine on the modified terrain (deterministic: same seed). The
      // previous in-place engine swap was discarded by the rebuild; this is
      // the fix.
      appliedAltRef.current = { elevationFt, manningN };
      setBuildKey((k) => k + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleResetAlternative = (): void => {
    setSignedOff(false);
    setAlternativeId('no-action');
    setCutFill(null);
    // Clearing the persisted override and rebuilding restores the true
    // baseline engine (scenario terrain, same seed).
    appliedAltRef.current = null;
    setBuildKey((k) => k + 1);
  };

  const placedCount = worldRef.current?.markers.placed.length ?? 0;
  const unplacedCount = worldRef.current?.markers.unplaced.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Persistent axiom banner */}
      <div
        role="note"
        aria-label="Simulation honesty banner"
        style={{
          background: '#3a2b00',
          color: '#ffd75e',
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.4,
          borderBottom: '2px solid #ffd75e',
        }}
      >
        SIMULATION — {AXIOM}{' '}
        <span style={{ fontWeight: 400 }}>
          Provenance: <code>{SIMULATION_PROVENANCE}</code> · outputs inform; they do not decide.
        </span>
      </div>

      {error && (
        <div role="alert" style={{ background: '#5a1111', color: '#ffd7d7', padding: '8px 16px', fontSize: 13 }}>
          {error}
        </div>
      )}

      {reducedMotion && (
        <div
          role="status"
          style={{ background: '#12233a', color: '#94a3b8', padding: '8px 16px', fontSize: 12 }}
        >
          Reduced motion is on: showing a static frame. Press Resume to run the simulation; press Pause to stop
          animation.
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 3D viewport */}
        <div style={{ position: 'relative', flex: '1 1 65%', minWidth: 0, background: '#0b0e12' }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="3D flood simulation viewport — terrain, water depth, and engineering markers for the selected scenario"
            style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
          />
          <div
            style={{
              position: 'absolute',
              left: 10,
              bottom: 10,
              background: 'rgba(8,10,14,0.72)',
              color: '#cfd8e3',
              fontSize: 11,
              padding: '6px 10px',
              borderRadius: 6,
              maxWidth: '70%',
            }}
          >
            Terrain: source-derived screening grid or live tiles (see the Terrain badge below).
            Water: screening-level approximation, not path tracing.
            Drag to orbit · scroll to zoom.
          </div>
          {playingTour && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                background: 'rgba(8,10,14,0.72)',
                color: '#ffd75e',
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 6,
              }}
            >
              ▶ Cinematic flythrough — drag to take over the camera
            </div>
          )}
        </div>

        {/* Control panel */}
        <div style={{ flex: '1 1 35%', overflowY: 'auto', padding: 16, background: '#11151b', color: '#dbe2ec', minWidth: 300 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Level-5 Flood Simulator</h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#93a0b4' }}>
            Deterministic engine (60 Hz fixed step) · pure WebGL · REST polling only — no streaming transports.
          </p>

          <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
            Scenario
            <select
              value={scenarioId}
              onChange={(e) => {
                setScenarioId(e.target.value);
                setCutFill(null);
                setSignedOff(false);
                setAlternativeId('no-action');
                appliedAltRef.current = null;
              }}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
            >
              {scenarios.map((s) => (
                <option key={s.scenarioId} value={s.scenarioId}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: 11, color: '#93a0b4', marginBottom: 4 }}>
            Source: {scenario.source.slice(0, 140)}{scenario.source.length > 140 ? '…' : ''}
          </div>
          <div style={{ fontSize: 11, marginBottom: 12 }}>
            {scenario.provisional && (
              <span style={{ background: '#4a2f00', color: '#ffcf6e', padding: '2px 8px', borderRadius: 4 }}>
                PROVISIONAL — {scenario.provisionalFields.length} fields unverified
              </span>
            )}{' '}
            <span style={{ background: '#123', color: '#9fd', padding: '2px 8px', borderRadius: 4 }}>
              human review required
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setPaused((p) => !p)} style={{ padding: '6px 12px' }}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" onClick={handlePlayTour} style={{ padding: '6px 12px' }}>
              ▶ Flythrough
            </button>
            <label style={{ fontSize: 12 }}>
              Quality
              <select value={quality} onChange={(e) => setQuality(e.target.value as QualityTier)} style={{ marginLeft: 6, padding: 4 }}>
                {QUALITY_TIER_ORDER.map((q) => (
                  <option key={q} value={q}>
                    {q} — {QUALITY_TIERS[q].label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              Speed
              <select value={timeScale} onChange={(e) => setTimeScale(Number(e.target.value))} style={{ marginLeft: 6, padding: 4 }}>
                {[15, 30, 60, 120, 300].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              Terrain
              <select
                value={terrainMode}
                onChange={(e) => {
                  setTerrainNotice(null);
                  setTerrainMode(e.target.value as 'auto' | 'live');
                }}
                style={{ marginLeft: 6, padding: 4 }}
                title="Elevation source: auto uses the bundled 3DEP-derived screening grid (fail-closed); live attempts a real-time tile fetch with fallback to the bundled grid. No synthetic terrain."
              >
                <option value="auto">Auto (3DEP-derived screening grid)</option>
                <option value="live">Live tiles (→ bundled grid fallback)</option>
              </select>
            </label>
          </div>

          {/* Live-data status badge — always names the actual source and its age */}
          <div style={{ fontSize: 11, marginBottom: 12, background: '#0d1219', border: '1px solid #222a35', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#93a0b4' }}>Terrain: </span>
              <span>{terrainProvenance}</span>
            </div>
            {liveSnapshot && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#93a0b4' }}>
                <span>
                  Tiles endpoint:{' '}
                  <strong
                    style={{
                      color:
                        liveSnapshot.terrainEndpoint.status === 'LIVE'
                          ? '#9fd8a8'
                          : liveSnapshot.terrainEndpoint.status === 'STALE'
                            ? '#ffcf6e'
                            : '#ff9d9d',
                    }}
                  >
                    {liveSnapshot.terrainEndpoint.status}
                  </strong>
                  {liveSnapshot.terrainEndpoint.ageSec != null &&
                    ` (${Math.round(liveSnapshot.terrainEndpoint.ageSec)}s ago)`}
                </span>
                <span>
                  Gauges: <strong style={{ color: '#ff9d9d' }}>retired</strong>{' '}
                  <span style={{ color: '#6b7280' }}>(owner decision 2026-09-29: live river data dropped)</span>
                </span>
              </div>
            )}
            {terrainNotice && (
              <div style={{ marginTop: 6, color: '#ffcf6e' }}>{terrainNotice}</div>
            )}
          </div>

          <label style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            Timeline scrubber — {ui ? formatClock(ui.simTimeSec) : '--:--:--'} / {formatClock(durationSec)}
            <input
              type="range"
              min={0}
              max={durationSec}
              step={60}
              value={ui?.simTimeSec ?? 0}
              onChange={(e) => handleScrub(Number(e.target.value))}
              style={{ display: 'block', width: '100%' }}
            />
          </label>

          {ui && (
            <div style={{ fontSize: 12, background: '#0c1016', borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div>Max depth: <strong>{ui.maxDepthFt.toFixed(2)} ft</strong></div>
              <div>Cumulative runoff: {ui.totalRunoffIn.toFixed(2)} in · peak discharge: {ui.peakDischargeCfs.toFixed(0)} cfs</div>
              <div>State hash: <code style={{ fontSize: 10 }}>{ui.stateHash}</code></div>
              <div>Snapshots retained: {ui.snapshotCount}</div>
              <div style={{ marginTop: 6 }}>
                LAG−BFE: {ui.probe.lag.toFixed(1)} ft · FFE−BFE: {ui.probe.ffe.toFixed(1)} ft · berm−BFE: {ui.probe.berm.toFixed(1)} ft
                <div style={{ fontSize: 10, color: '#93a0b4' }}>arithmetic on owner constants — not a survey</div>
              </div>
            </div>
          )}

          {/* Hazus damage */}
          {ui && ui.damage.length > 0 && (
            <details style={{ marginBottom: 12 }} open>
              <summary style={{ fontSize: 13, cursor: 'pointer' }}>Hazus-compatible damage (illustrative, not certified)</summary>
              <table style={{ fontSize: 11, width: '100%', marginTop: 6, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#93a0b4' }}>
                    <th>Structure</th><th>Depth&gt;FF</th><th>Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {ui.damage.map((dmg) => (
                    <tr key={dmg.id} style={{ borderTop: '1px solid #222a35' }}>
                      <td>{dmg.name}</td>
                      <td>{dmg.depthAboveFf.toFixed(2)} ft</td>
                      <td>${dmg.totalUsd.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {/* Cross-section */}
          {crossSection.length > 0 && (
            <details style={{ marginBottom: 12 }}>
              <summary style={{ fontSize: 13, cursor: 'pointer' }}>Cross-section (west→east, centerline)</summary>
              <svg viewBox="0 0 300 90" style={{ width: '100%', background: '#0c1016', borderRadius: 8, marginTop: 6 }}>
                {(() => {
                  const wses = crossSection.map((p) => p.wse);
                  const gs = crossSection.map((p) => p.g);
                  const lo = Math.min(...gs) - 1;
                  const hi = Math.max(...wses, ...gs) + 1;
                  const X = (i: number): number => (i / (crossSection.length - 1)) * 300;
                  const Y = (v: number): number => 85 - ((v - lo) / (hi - lo)) * 80;
                  const line = (vals: number[]): string => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
                  return (
                    <g>
                      <path d={`${line(gs)} L300,90 L0,90 Z`} fill="#3d4a35" />
                      <path d={`${line(wses)} L300,90 L0,90 Z`} fill="rgba(64,140,200,0.55)" />
                    </g>
                  );
                })()}
              </svg>
              <div style={{ fontSize: 10, color: '#93a0b4' }}>green: ground · blue: water surface (simulation)</div>
            </details>
          )}

          {/* Mitigation alternatives (sign-off gate) */}
          <details style={{ marginBottom: 12 }} open>
            <summary style={{ fontSize: 13, cursor: 'pointer' }}>Mitigation alternatives — inform only</summary>
            <div style={{ fontSize: 11, color: '#93a0b4', margin: '6px 0' }}>
              Parameter sets mapped to evidence-pipeline stages 6–7 (statutory compliance / grant eligibility).
              Applying one rebuilds the simulation. Nothing here is a permit, a certification, or advice.
            </div>
            <select value={alternativeId} onChange={(e) => setAlternativeId(e.target.value as AlternativeId)} style={{ width: '100%', padding: 6, marginBottom: 6 }}>
              {MITIGATION_ALTERNATIVES.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#93a0b4', marginBottom: 6 }}>
              {getAlternative(alternativeId).description}
            </div>
            <label style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'flex-start', marginBottom: 8 }}>
              <input type="checkbox" checked={signedOff} onChange={(e) => setSignedOff(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                I am a human reviewer and I explicitly sign off on applying “{getAlternative(alternativeId).name}”
                to this simulation. I understand the outputs remain provisional and inform-only.
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleApplyAlternative} style={{ padding: '6px 12px' }}>
                Apply to simulation
              </button>
              <button type="button" onClick={handleResetAlternative} style={{ padding: '6px 12px' }}>
                Reset
              </button>
            </div>
            {cutFill && (
              <div style={{ fontSize: 11, marginTop: 8, background: '#0c1016', borderRadius: 8, padding: 8 }}>
                Cut/fill readout (screening-level): cut {cutFill.cutFt3.toFixed(0)} ft³ · fill {cutFill.fillFt3.toFixed(0)} ft³ · net {cutFill.netFt3.toFixed(0)} ft³
              </div>
            )}
          </details>

          {/* Cinematic shot lists */}
          <details style={{ marginBottom: 12 }}>
            <summary style={{ fontSize: 13, cursor: 'pointer' }}>Cinematic shot lists</summary>
            <div style={{ fontSize: 11, marginTop: 6 }}>
              <div style={{ color: '#93a0b4' }}>Intro ({INTRO_SHOTS.length} shots)</div>
              {INTRO_SHOTS.map((s) => <div key={s.id}>· {s.title}</div>)}
              <div style={{ color: '#93a0b4', marginTop: 6 }}>Outro ({OUTRO_SHOTS.length} shots)</div>
              {OUTRO_SHOTS.map((s) => <div key={s.id}>· {s.title}</div>)}
            </div>
          </details>

          {/* Legend / honesty footer */}
          <div style={{ fontSize: 11, color: '#93a0b4', borderTop: '1px solid #222a35', paddingTop: 8 }}>
            <div>Gauge markers: {placedCount} placed from manifest coordinates · {unplacedCount} listed, not placed (no coordinates in manifest — never guessed).</div>
            <div>Anchor: {ANCHOR_SITE.label}</div>
            <div>Elevation source: {terrainProvenance}</div>
            <div style={{ marginTop: 4 }}>
              Provenance taxonomy: FEMA-effective / State-best / observed / modeled / forecast / simulation.
              This view: <strong>simulation</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
