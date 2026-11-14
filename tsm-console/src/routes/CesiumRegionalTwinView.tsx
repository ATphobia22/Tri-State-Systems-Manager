import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {
  CESIUM_VIEWS, loadCesiumReplay, loadCityScreening, mountCesiumRegionalScene, REPLAY_DATES,
  type LayerState, type PickedFeature, type Replay, type SceneLayer, type ScreeningFrame,
} from '../lib/cesium-regional-scene';
import './CesiumRegionalTwinView.css';

const LAYERS: { id: SceneLayer; title: string; initial: boolean }[] = [
  { id: 'terrain', title: 'USGS terrain', initial: true },
  { id: 'buildings', title: 'Posey 3D buildings', initial: true },
  { id: 'roads', title: 'Regional roads', initial: true },
  { id: 'city', title: 'Mount Vernon detail', initial: false },
];

type Scene = ReturnType<typeof mountCesiumRegionalScene>;


export default function CesiumRegionalTwinView() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [place, setPlace] = useState(0);
  const [tour, setTour] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [status, setStatus] = useState<Partial<Record<SceneLayer, LayerState>>>({});
  const [visible, setVisible] = useState(() => Object.fromEntries(LAYERS.map((layer) => [layer.id, layer.initial])));
  const [aerial, setAerial] = useState(true);
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

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        scene.current?.stopFlight();
        setTour(false);
        setPlaying(false);
      }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!host.current) return;
    try {
      scene.current = mountCesiumRegionalScene(
        host.current,
        (id, layer) => setStatus((current) => ({ ...current, [id]: layer })),
        setPicked,
        setError,
        () => setImageryError(true),
      );
      setReady(true);
    } catch {
      setError('Cesium could not start. A browser with WebGL 2 is required.');
    }
    const abort = new AbortController();
    loadCesiumReplay(abort.signal).then(setReplay).catch(() => {
      if (!abort.signal.aborted) setReplayError(true);
    });
    loadCityScreening(abort.signal).then(setScreening).catch(() => {
      if (!abort.signal.aborted) setScreeningStatus('Mount Vernon screening archive unavailable.');
    });
    return () => {
      abort.abort();
      window.clearTimeout(timer.current);
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setTime(date, hour, replay);
  }, [date, hour, replay, ready]);

  useEffect(() => {
    if (!ready || !scene.current) return;
    let current = true;
    const level = screeningOn && frame ? frame.levelMNavd88 : null;
    if (level !== null) setScreeningStatus('Loading screening extent…');
    scene.current.setScreening(level).then(() => {
      if (current && level !== null) setScreeningStatus('Screening extent on map');
      if (current && level === null && screening.length) setScreeningStatus('');
    }).catch(() => {
      if (current) setScreeningStatus('Screening extent unavailable.');
    });
    return () => { current = false; };
  }, [ready, screeningOn, frame, screening.length]);

  useEffect(() => {
    if (!playing) return;
    if (day === REPLAY_DATES.length - 1) {
      setPlaying(false);
      return;
    }
    const advance = window.setTimeout(() => setDay(day + 1), 1100);
    return () => window.clearTimeout(advance);
  }, [day, playing]);

  function stopTour() {
    window.clearTimeout(timer.current);
    scene.current?.stopFlight();
    setTour(false);
  }

  function choosePlace(index: number) {
    stopTour();
    setPlace(index);
    setPicked(null);
    scene.current?.fly(index, reducedMotion ? 0 : 1.6);
  }

  function startTour() {
    if (tour) { stopTour(); return; }
    if (reducedMotion) { choosePlace(0); return; }
    const order = [0, 1, 2, 3, 4, 5, 6];
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
        </nav>
      </header>
      <div className="tsm-cesium-workspace">
        <div className="tsm-cesium-view">
          <div className="tsm-cesium-viewport" ref={host} aria-label="Interactive Cesium globe" />
          <div className="tsm-cesium-place">
            <strong>{CESIUM_VIEWS[place]?.name}</strong>
            {picked && <p>{picked.title}<small>{picked.detail}</small></p>}
          </div>
          {error && <p className="tsm-cesium-error" role="alert">{error} <Link to="/atlas">Open Atlas</Link></p>}
        </div>
        <aside className="tsm-cesium-controls" aria-label="Scene controls">
          <section>
            <h2>Camera</h2>
            <label htmlFor="cesium-place">Location</label>
            <select id="cesium-place" value={place} disabled={!ready} onChange={(event) => choosePlace(Number(event.target.value))}>
              {CESIUM_VIEWS.map((view, index) => <option value={index} key={view.name}>{view.name}</option>)}
            </select>
            <button type="button" disabled={!ready || reducedMotion} onClick={startTour}>
              {tour ? 'Stop flyover' : 'Play regional flyover'}
            </button>
          </section>
          <section>
            <h2>Map layers</h2>
            {LAYERS.map(({ id, title, initial }) => (
              <div className="tsm-cesium-layer" key={id}>
                <label>
                  <input type="checkbox" checked={visible[id]} disabled={!ready} onChange={(event) => {
                    const show = event.target.checked;
                    setVisible((current) => ({ ...current, [id]: show }));
                    scene.current?.setLayer(id, show);
                  }} />
                  {title}
                </label>
                {status[id] ? (
                  <small data-testid={`cesium-${id}-status`} data-state={status[id]?.state}>{status[id]?.detail}</small>
                ) : !initial && <small>Indiana GIO footprints and road centerlines</small>}
              </div>
            ))}
            <div className="tsm-cesium-layer">
              <label><input type="checkbox" checked={aerial} disabled={!ready} onChange={(event) => {
                setAerial(event.target.checked);
                scene.current?.setImagery(event.target.checked);
              }} /> Aerial imagery</label>
              <small>{imageryError ? 'USGS imagery is partly unavailable' : 'USGS The National Map · streams online'}</small>
            </div>
          </section>
          <section>
            <h2>April 2025 river replay</h2>
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
          <section>
            <h2>Mount Vernon flood screening</h2>
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
          <section>
            <h2>Lighting</h2>
            <label htmlFor="cesium-light">Scene time (CDT) <output>{String(hour).padStart(2, '0')}:00</output></label>
            <input id="cesium-light" type="range" min={0} max={23} value={hour} onChange={(event) => setHour(Number(event.target.value))} />
          </section>
        </aside>
      </div>
      <footer className="tsm-cesium-note">
        Screening visualization. Road lines represent approximate centerlines. Building coverage is partial. The river replay displays station measurements.
      </footer>
    </article>
  );
}
