import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link } from 'react-router';
import { FILM_PREVIEW_FPS, FILM_SHOTS, lastShotFrame, sampleShotCamera } from '../lib/cesium-film-shots';
import {
  CESIUM_VIEWS, loadCesiumReplay, loadCityScreening, mountCesiumRegionalScene, REPLAY_DATES,
  type LayerState, type PickedFeature, type Replay, type SceneLayer, type ScreeningFrame,
} from '../lib/cesium-regional-scene';
import { type IonImageryPreset, type BuildingPreviewDetail, type TerrainPreviewSource } from '../lib/cesium-ion-assets';
import type { OsmBuildingStyle } from '../lib/cesium-osm-building-style';

const ION_ENABLED = Boolean((import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined)?.trim());

const LAYERS: { id: SceneLayer; title: string; initial: boolean }[] = [
  { id: 'terrain', title: 'USGS terrain', initial: true },
  { id: 'buildings', title: 'Posey 3D buildings', initial: true },
  { id: 'roads', title: 'Regional roads', initial: true },
  { id: 'roadNames', title: 'Road names (TIGER/Line 2024)', initial: true },
  { id: 'city', title: 'Mount Vernon detail', initial: false },
  { id: 'osmContext', title: 'Cesium OSM buildings (online context)', initial: false },
];

type Scene = ReturnType<typeof mountCesiumRegionalScene>;


export default function CesiumRegionalTwinView({ autoFlyover = false, onFlyoverChange }: {
  autoFlyover?: boolean;
  onFlyoverChange?: (active: boolean) => void;
} = {}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const recoveryTimeout = useRef<number | undefined>(undefined);
  const contextLossTimeout = useRef<number | undefined>(undefined);
  const healthTimeout = useRef<number | undefined>(undefined);
  const recoveryAttempts = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [graphicsPaused, setGraphicsPaused] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [place, setPlace] = useState(0);
  const [tour, setTour] = useState(false);
  const previousTour = useRef(false);
  useEffect(() => {
    if (previousTour.current === tour) return;
    previousTour.current = tour;
    onFlyoverChange?.(tour);
  }, [tour, onFlyoverChange]);
  const [shotId, setShotId] = useState('');
  const [shotFrame, setShotFrame] = useState(0);
  const [shotPlayStart, setShotPlayStart] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [status, setStatus] = useState<Partial<Record<SceneLayer, LayerState>>>({});
  const [visible, setVisible] = useState(() => Object.fromEntries(LAYERS.map((layer) => [layer.id, layer.initial])));
  const [aerial, setAerial] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [imageryPreset, setImageryPreset] = useState<IonImageryPreset>('usgs');
  const [terrainSource, setTerrainSource] = useState<TerrainPreviewSource>('local');
  const [buildingDetail, setBuildingDetail] = useState<BuildingPreviewDetail>('balanced');
  const [osmStyle, setOsmStyle] = useState<OsmBuildingStyle>('native');
  const [ionMessage, setIonMessage] = useState('');
  const [imageryError, setImageryError] = useState(false);
  const [picked, setPicked] = useState<PickedFeature | null>(null);
  const [day, setDay] = useState(16);
  const [hour, setHour] = useState(17);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState<Replay[]>([]);
  const [replayError, setReplayError] = useState(false);
  const [screening, setScreening] = useState<ScreeningFrame[]>([]);
  const [screeningOn, setScreeningOn] = useState(false);
  const [screeningLevel, setScreeningLevel] = useState(3);
  const [screeningStatus, setScreeningStatus] = useState('');
  const frame = screening[screeningLevel];
  const date = REPLAY_DATES[day]!;
  const shot = FILM_SHOTS.find(({ id }) => id === shotId);
  const preview = shot?.preview;

  const restoreSceneSelections = useEffectEvent((next: Scene) => {
    next.fly(place, 0);
    for (const { id, initial } of LAYERS) next.setLayer(id, visible[id] ?? initial);
    next.setImagery(aerial);
    next.setBuildingDetail(buildingDetail);
    next.setOsmBuildingStyle(osmStyle);
    void next.setImageryPreset(imageryPreset).catch(() => setIonMessage('Ion imagery unavailable; choose USGS imagery.'));
    void next.setTerrainSource(terrainSource).catch(() => setIonMessage('Ion terrain unavailable; choose local USGS terrain.'));
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        scene.current?.stopFlight();
        setTour(false);
        setShotPlayStart(null);
        setPlaying(false);
      }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!host.current) return;
    window.clearTimeout(recoveryTimeout.current);
    window.clearTimeout(contextLossTimeout.current);
    window.clearTimeout(healthTimeout.current);
    setStatus({});
    setImageryError(false);
    const pause = () => {
      window.clearTimeout(timer.current);
      setTour(false);
      setShotPlayStart(null);
      setReady(false);
      window.clearTimeout(healthTimeout.current);
    };
    try {
      const next = mountCesiumRegionalScene(
        host.current,
        (id, layer) => setStatus((current) => ({ ...current, [id]: layer })),
        setPicked,
        (message) => {
          pause();
          // A transient WebGL render failure should not strand visitors on a dead globe.
          // Cap retries so persistent GPU/driver faults remain visible and actionable.
          window.clearTimeout(contextLossTimeout.current);
          window.clearTimeout(recoveryTimeout.current);
          const attempt = ++recoveryAttempts.current;
          setError(attempt <= 2
            ? `${message} Retrying the 3D view (${attempt}/2)…`
            : `${message} Automatic recovery exhausted; restart manually or use Atlas.`);
          if (attempt <= 2) {
            recoveryTimeout.current = window.setTimeout(
              () => setSceneVersion((version) => version + 1), attempt * 1500,
            );
          }
        },
        () => setImageryError(true),
        (state) => {
          if (state === 'restored') {
            window.clearTimeout(contextLossTimeout.current);
            console.info('Cesium WebGL context restored; rebuilding scene.');
            setSceneVersion((version) => version + 1);
          } else {
            pause();
            window.clearTimeout(recoveryTimeout.current);
            window.clearTimeout(contextLossTimeout.current);
            setGraphicsPaused(true);
            console.warn('Cesium WebGL context lost; awaiting browser restoration.');
            // Chromium can abandon a lost GPU context under resource pressure.
            // Do not leave the globe and its controls permanently disabled.
            contextLossTimeout.current = window.setTimeout(() => {
              const attempt = ++recoveryAttempts.current;
              if (attempt <= 2) {
                console.warn(`Cesium context did not recover; rebuilding widget (${attempt}/2).`);
                setSceneVersion((version) => version + 1);
              } else {
                setError('WebGL context did not recover. Automatic retries exhausted; restart 3D view or use Atlas.');
              }
            }, 8000);
          }
        },
        (message) => setScreeningStatus(message),
      );
      scene.current = next;
      restoreSceneSelections(next);
      setReady(true);
      setError('');
      setGraphicsPaused(false);
      // Only a sustained healthy render interval resets the bounded retry budget.
      healthTimeout.current = window.setTimeout(() => { recoveryAttempts.current = 0; }, 45000);
    } catch {
      setReady(false);
      setError('Cesium could not start. A browser with WebGL 2 is required.');
    }
    return () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(recoveryTimeout.current);
      window.clearTimeout(contextLossTimeout.current);
      window.clearTimeout(healthTimeout.current);
      scene.current?.destroy();
      scene.current = null;
    };
  }, [sceneVersion]);

  useEffect(() => {
    const handle = window.setTimeout(() => scene.current?.resize(), 60);
    return () => window.clearTimeout(handle);
  }, [toolsOpen, ready]);

  useEffect(() => {
    const abort = new AbortController();
    loadCesiumReplay(abort.signal).then(setReplay).catch(() => {
      if (!abort.signal.aborted) setReplayError(true);
    });
    loadCityScreening(abort.signal).then(setScreening).catch(() => {
      if (!abort.signal.aborted) setScreeningStatus('Mount Vernon screening archive unavailable.');
    });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (ready) scene.current?.setTime(date, hour, replay);
  }, [date, hour, replay, ready, sceneVersion]);

  useEffect(() => {
    if (!ready || !preview) return;
    const { headingOffsetDeg, rangeScale } = sampleShotCamera(preview, shotFrame);
    scene.current?.setShotCamera(preview.view, headingOffsetDeg, rangeScale);
  }, [preview, ready, sceneVersion, shotFrame]);

  useEffect(() => {
    if (!ready || error || reducedMotion || !preview || shotPlayStart === null) return;
    let animation: number;
    let startTime: number | undefined;
    const last = lastShotFrame(preview);
    const advance = (now: number) => {
      startTime ??= now;
      const frameIndex = Math.min(last, shotPlayStart + Math.floor((now - startTime) * FILM_PREVIEW_FPS / 1000));
      setShotFrame(frameIndex);
      if (frameIndex < last) animation = window.requestAnimationFrame(advance);
      else setShotPlayStart(null);
    };
    animation = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(animation);
  }, [error, preview, ready, reducedMotion, shotPlayStart]);

  useEffect(() => {
    if (!ready || !scene.current) return;
    let current = true;
    const level = screeningOn && frame ? frame.levelMNavd88 : null;
    if (level !== null) setScreeningStatus('Loading screening extent…');
    scene.current.setScreening(level, frame?.bounds, frame?.cols, frame?.rows).then(() => {
      if (current && level !== null) setScreeningStatus('Screening extent on map');
      if (current && level === null && screening.length) setScreeningStatus('');
    }).catch(() => {
      if (current) setScreeningStatus('Screening extent unavailable.');
    });
    return () => { current = false; };
  }, [ready, sceneVersion, screeningOn, frame, screening.length]);

  useEffect(() => {
    if (!playing) return;
    if (day === REPLAY_DATES.length - 1) {
      setPlaying(false);
      return;
    }
    const advance = window.setTimeout(() => setDay(day + 1), 1100);
    return () => window.clearTimeout(advance);
  }, [day, playing]);

  // External engineering-cinema Play/Pause drives the actual Cesium camera;
  // model water levels are never used as real elevation or gage observations.
  const syncExternalFlyover = useEffectEvent((play: boolean) => {
    if (play && !tour && !reducedMotion) startTour();
    if (!play && tour) stopTour();
  });
  useEffect(() => {
    if (ready && !error) syncExternalFlyover(autoFlyover);
  }, [autoFlyover, ready, error]);

  function stopTour() {
    window.clearTimeout(timer.current);
    scene.current?.stopFlight();
    setTour(false);
  }

  function choosePlace(index: number) {
    stopTour();
    setShotId('');
    setShotPlayStart(null);
    setPlace(index);
    setPicked(null);
    scene.current?.fly(index, reducedMotion ? 0 : 1.6);
  }

  function startTour() {
    if (tour) { stopTour(); return; }
    if (reducedMotion) { choosePlace(0); return; }
    const order = [0, 1, 2, 3, 4, 5, 6];
    setShotId('');
    setShotPlayStart(null);
    setTour(true);
    setPicked(null);
    const advance = (step: number) => {
      const index = order[step];
      if (index === undefined) { setTour(false); return; }
      setPlace(index);
      scene.current?.fly(index, step === 0 ? 0.7 : 2.4,
        () => { timer.current = window.setTimeout(() => advance(step + 1), 1200); },
        () => {
          window.clearTimeout(timer.current);
          setTour(false);
        });
    };
    advance(0);
  }

  function chooseShot(id: string) {
    stopTour();
    setShotPlayStart(null);
    setShotFrame(0);
    setShotId(id);
    setPicked(null);
    setScreeningOn(false);
    const next = FILM_SHOTS.find((entry) => entry.id === id)?.preview;
    if (next) {
      setPlace(CESIUM_VIEWS.findIndex((view) => view.id === next.view));
      setHour(next.lightingHourCdt);
    }
  }

  return (
    <article className="tsm-cesium">
      <header className="tsm-cesium-heading">
        <div>
          <h1>Tri-State River Valley</h1>
          <p>Cesium 4D twin · 3D terrain, buildings, roads and river observations</p>
        </div>
        <nav aria-label="Atlas and engineering">
          <Link to="/atlas">Atlas</Link>
          <Link to="/cinematic-engineering">Engineering</Link>
          <Link to="/flood-sim">Flood workbench</Link>
          <Link to="/photorealistic-3d">Photorealistic 3D (opt-in)</Link>
          <button type="button" className="tsm-cesium-tools-toggle" disabled={!ready || reducedMotion}
            data-testid="cesium-flyover-toolbar" onClick={startTour}>
            {tour ? 'Stop 3D flyover' : 'Play 3D flyover'}
          </button>
          <button type="button" className="tsm-cesium-tools-toggle" data-testid="cesium-tools-toggle"
            aria-controls="tsm-cesium-tools" aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((open) => !open)}>
            {toolsOpen ? 'Hide controls' : 'Show controls'}
          </button>
        </nav>
      </header>
      <div className={`tsm-cesium-workspace${toolsOpen ? "" : " is-map-only"}`}>
        <div className="tsm-cesium-view">
          <div className="tsm-cesium-viewport" ref={host} aria-label="Interactive Cesium globe"
            onPointerDown={() => setShotPlayStart(null)} />
          <div className="tsm-cesium-place">
            <strong>{CESIUM_VIEWS[place]?.name}</strong>
            <small>Posey building layer: {!visible.buildings ? 'hidden' : status.buildings?.state === 'ready' ? 'ready' : status.buildings?.state === 'loading' ? 'loading' : status.buildings?.state === 'unavailable' ? 'source unavailable' : 'awaiting status'} · Online OSM: {ION_ENABLED ? 'opt-in' : 'unavailable without ion token'}</small>
            {picked && <p>{picked.title}<small>{picked.detail}</small></p>}
          </div>
          <div className="tsm-cesium-map-shortcuts" aria-label="Visible Cesium scene shortcuts">
            <button type="button" data-testid="cesium-map-layers-toggle"
              aria-controls="tsm-cesium-tools" aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((open) => !open)}>
              {toolsOpen ? 'Hide 3D layers' : '3D buildings & layers'}
            </button>
            <label>
              <input type="checkbox" data-testid="cesium-buildings-quick-toggle" disabled={!ready} checked={visible.buildings}
                onChange={(event) => {
                  const show = event.target.checked;
                  setVisible((current) => ({ ...current, buildings: show, ...(show ? { osmContext: false } : {}) }));
                  scene.current?.setLayer('buildings', show);
                }} />
              Posey 3D buildings
            </label>
          </div>
          {(graphicsPaused || error) && <div className="tsm-cesium-error" role="alert">
            <p>{graphicsPaused ? 'Graphics paused. Waiting for WebGL to recover.' : error}</p>
            <button type="button" onClick={() => {
              recoveryAttempts.current = 0;
              setSceneVersion((version) => version + 1);
            }}>Restart 3D view</button>{' '}
            <Link to="/atlas">Open Atlas</Link>
          </div>}
        </div>
        <aside id="tsm-cesium-tools" className="tsm-cesium-controls" aria-label="Scene controls" hidden={!toolsOpen}>
          <details className="tsm-cesium-accordion" open>
            <summary>Camera</summary>
            <section>
            <label htmlFor="cesium-place">Location</label>
            <select id="cesium-place" value={place} disabled={!ready} onChange={(event) => choosePlace(Number(event.target.value))}>
              {CESIUM_VIEWS.map((view, index) => <option value={index} key={view.name}>{view.name}</option>)}
            </select>
            <button type="button" disabled={!ready || reducedMotion} onClick={startTour}>
              {tour ? 'Stop flyover' : 'Play regional flyover'}
            </button>
          </section>
          </details>
          <details className="tsm-cesium-accordion" >
            <summary>Cinematic shots</summary>
            <section>
            <label htmlFor="cesium-film-shot">Shot</label>
            <select id="cesium-film-shot" value={shotId} disabled={!ready || Boolean(error)}
              onChange={(event) => chooseShot(event.target.value)}>
              <option value="">Choose a shot</option>
              {FILM_SHOTS.map(({ id, label }) => <option value={id} key={id}>{label}</option>)}
            </select>
            {preview && <>
              <label htmlFor="cesium-shot-frame">Camera time <output>{(shotFrame / FILM_PREVIEW_FPS).toFixed(2)} s</output></label>
              <input id="cesium-shot-frame" type="range" min={0} max={lastShotFrame(preview)} value={shotFrame}
                disabled={!ready} onChange={(event) => {
                  setShotPlayStart(null);
                  setShotFrame(Number(event.target.value));
                }} />
              <button type="button" disabled={reducedMotion || !ready} onClick={() => {
                if (shotPlayStart !== null) setShotPlayStart(null);
                else setShotPlayStart(shotFrame === lastShotFrame(preview) ? 0 : shotFrame);
              }}>{shotPlayStart === null ? 'Play camera preview' : 'Pause camera preview'}</button>
              <small>Camera preview at 24 fps. Release evidence still pending.</small>
            </>}
            {shot && !preview && <small role="status">
              Flood comparison requires a calibrated model and verified water-surface provenance.
            </small>}
          </section>
          </details>
          <details className="tsm-cesium-accordion" >
            <summary>Map layers</summary>
            <section>
            {LAYERS.map(({ id, title, initial }) => (
              <div className="tsm-cesium-layer" key={id}>
                <label>
                  <input type="checkbox" checked={visible[id]} disabled={!ready || (id === 'osmContext' && !ION_ENABLED)} onChange={(event) => {
                    const show = event.target.checked;
                    setVisible((current) => ({
                      ...current,
                      [id]: show,
                      ...(show && id === 'osmContext' ? { buildings: false } : {}),
                      ...(show && id === 'buildings' ? { osmContext: false } : {}),
                    }));
                    scene.current?.setLayer(id, show);
                  }} />
                  {title}
                </label>
                {status[id] ? (
                  <small data-testid={`cesium-${id}-status`} data-state={status[id]?.state}>{status[id]?.detail}</small>
                ) : !initial && <small>{id === 'osmContext' ? 'Online only · requires authorized Cesium ion token' : 'Indiana GIO footprints and road centerlines'}</small>}
              </div>
            ))}
            <label htmlFor="cesium-building-detail">Building mesh refinement</label>
            <select id="cesium-building-detail" value={buildingDetail} onChange={(event) => {
              const detail = event.target.value as BuildingPreviewDetail;
              setBuildingDetail(detail);
              scene.current?.setBuildingDetail(detail);
            }}>
              <option value="performance">Performance</option>
              <option value="balanced">Balanced</option>
              <option value="sharp">Sharper tiles</option>
            </select>
            <small>Refines source tile selection only. Does not invent roof geometry, façades, or PBR materials.</small>
            <label htmlFor="cesium-osm-style">Cesium OSM building metadata style</label>
            <select id="cesium-osm-style" data-testid="cesium-osm-style" value={osmStyle}
              disabled={!ready || !ION_ENABLED || !visible.osmContext}
              onChange={(event) => {
                const mode = event.target.value as OsmBuildingStyle;
                setOsmStyle(mode);
                scene.current?.setOsmBuildingStyle(mode);
              }}>
              <option value="native">Original OSM visual appearance</option>
              <option value="wall-material">Wall material tag · colored</option>
              <option value="building-use">Building use tag · colored</option>
              <option value="roof-shape">Roof shape tag · colored</option>
              <option value="height-evidence">Tagged vs estimated height · colored</option>
            </select>
            <small>These modes color entire available meshes by OSM attributes; they do not add roof polygons, material textures, or verified heights. Untagged properties display neutrally. Click a building to inspect source metadata.</small>
            <label htmlFor="cesium-terrain-source">Terrain source</label>
            <select id="cesium-terrain-source" value={terrainSource} disabled={!ready} onChange={(event) => {
              const source = event.target.value as TerrainPreviewSource;
              setIonMessage('');
              void scene.current?.setTerrainSource(source).then((applied) => { if (applied) setTerrainSource(source); }).catch(() => {
                setIonMessage('Selected ion terrain unavailable; previous terrain remains active.');
              });
            }}>
              <option value="local">Local source-derived USGS terrain</option>
              <option value="world" disabled={!ION_ENABLED}>Cesium World Terrain · asset 1 (online)</option>
              <option value="candidate2426648" disabled={!ION_ENABLED}>ion asset 2426648 · UNVERIFIED terrain preview</option>
            </select>
            <small>Asset 2426648 has not been independently checked for license, coverage, vertical datum or elevation accuracy. Never use this preview for flood design or NAVD88 comparison.</small>
            <label htmlFor="cesium-imagery-source">Imagery source · one active basemap</label>
            <select id="cesium-imagery-source" value={imageryPreset} disabled={!ready} onChange={(event) => {
              const choice = event.target.value as IonImageryPreset;
              setIonMessage('');
              void scene.current?.setImageryPreset(choice).then((applied) => { if (applied) setImageryPreset(choice); }).catch(() => {
                setIonMessage('Requested ion imagery is unavailable; USGS aerial retained.');
                setImageryPreset('usgs');
                void scene.current?.setImageryPreset('usgs');
              });
            }}>
              <option value="usgs">USGS The National Map aerial (default)</option>
              <option value="googleLabels" disabled={!ION_ENABLED}>Google satellite with labels · 3830183</option>
              <option value="azureAerial" disabled={!ION_ENABLED}>Azure aerial · 3891168</option>
              <option value="azureRoads" disabled={!ION_ENABLED}>Azure roads · 3891169</option>
              <option value="sentinel2" disabled={!ION_ENABLED}>Sentinel-2 · 3954</option>
            </select>
            {ionMessage && <small role="status">{ionMessage}</small>}
            {!ION_ENABLED && <small>Ion assets are optional. A public-scoped VITE_CESIUM_ION_TOKEN is required for online access; no token is committed.</small>}
            <div className="tsm-cesium-layer">
              <label><input type="checkbox" checked={aerial} disabled={!ready} onChange={(event) => {
                setAerial(event.target.checked);
                scene.current?.setImagery(event.target.checked);
              }} /> Aerial imagery</label>
              <small>{imageryError ? 'USGS imagery is partly unavailable' : 'USGS The National Map · streams online'}</small>
            </div>
          </section>
          </details>
          <details className="tsm-cesium-accordion" >
            <summary>April 2025 river replay</summary>
            <section>
            <label htmlFor="cesium-day">Observation date <output>{date}</output></label>
            <input id="cesium-day" type="range" min={0} max={REPLAY_DATES.length - 1} value={day}
              onChange={(event) => { setPlaying(false); setDay(Number(event.target.value)); }} />
            {!reducedMotion && <button type="button" disabled={!replay.length} onClick={() => {
              if (!playing && day === REPLAY_DATES.length - 1) setDay(0);
              setPlaying(!playing);
            }}>{playing ? 'Pause observations' : 'Play observations'}</button>}
            {replayError && <p role="status">USGS replay archive unavailable.</p>}
            {replay.map((series) => {
              const row = series.rows.find((value) => value.date === date);
              return <p className="tsm-cesium-reading" key={series.stationId}>
                <a href={series.source}>{series.name}</a>
                <small>{row ? `${row.value.toLocaleString()} ${series.unit} · ${series.label} · ${row.approval}${row.qualifier ? ` (${row.qualifier})` : ''}`
                  : 'No daily value in this archive'}</small>
              </p>;
            })}
            <small>Daily means at each gauge. Gage height uses the station’s own reference.</small>
          </section>
          </details>
          <details className="tsm-cesium-accordion" >
            <summary>Mount Vernon flood screening</summary>
            <section>
            <label><input type="checkbox" checked={screeningOn} disabled={!ready || !screening.length} onChange={(event) => {
              setScreeningOn(event.target.checked);
              if (event.target.checked) choosePlace(0);
            }} /> Show hypothetical extent</label>
            <label htmlFor="cesium-screen-level">Water elevation <output>{frame ? `${frame.levelMNavd88} m NAVD88` : '—'}</output></label>
            <input id="cesium-screen-level" type="range" min={0} max={Math.max(0, screening.length - 1)} value={screeningLevel}
              disabled={!screeningOn} onChange={(event) => setScreeningLevel(Number(event.target.value))} />
            {screeningStatus && <small role="status" data-testid="cesium-screening-status">{screeningStatus}</small>}
            <small>Fixed-level terrain screening. A calibrated hydraulic model is required for forecasts and engineering design.</small>
          </section>
          </details>
          <details className="tsm-cesium-accordion" >
            <summary>Lighting</summary>
            <section>
            <label htmlFor="cesium-light">Scene time (CDT) <output>{String(hour).padStart(2, '0')}:00</output></label>
            <input id="cesium-light" type="range" min={0} max={23} value={hour} onChange={(event) => setHour(Number(event.target.value))} />
          </section>
          </details>
          <details className="tsm-cesium-accordion">
            <summary>Regional county coverage &amp; evidence</summary>
            <section>
              <p><strong>Eight-county exact-boundary target</strong></p>
              <p>Indiana: Posey, Vanderburgh, Gibson, Warrick</p>
              <p>Illinois: White, Gallatin</p>
              <p>Kentucky: Henderson, Union</p>
              <small>Regional TIGER/Line road archive also includes Wabash County, Illinois. These county names identify mapped scope, not proof of complete parcel, roof, elevation, imagery, or flood-layer coverage.</small>
              <small>Posey local mesh is a source-derived LoD1 preview; Illinois and Kentucky building-level materials and LoD2–4 have not been independently verified in the deployed viewer.</small>
              <p><a href="https://github.com/ATphobia22/Tri-State-Systems-Manager/blob/main/data/regional/eight-county-exact-spatial-validation-v1.json" target="_blank" rel="noreferrer">Read county-boundary validation contract</a></p>
            </section>
          </details>
        </aside>
      </div>
      <footer className="tsm-cesium-note">
        Screening visualization. Roads are approximate centerlines. Road names are Census TIGER/Line 2024 FULLNAME values, except three Posey County roads where OpenStreetMap and IndianaMap agree on a different name (Lamont Road, Pumpkin Run Road, Pearl Street); unnamed centerlines stay unlabeled and no name is invented. Posey buildings without preview heights are shown as outlines. The river replay displays station measurements.
      </footer>
    </article>
  );
}
