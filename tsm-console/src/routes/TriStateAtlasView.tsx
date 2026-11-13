/** 4D Engineering Atlas — composed from existing TSM production components and registered data fabrics.
 * This is NOT a demo map: the component uses the normal MapLibre source adapters, with
 * authority metadata; no simulated river readings, fake heights or auto-polling.
 */
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import TriStateDigitalTwinMap, { defaultMapPlaneVisibility } from '../components/TriStateDigitalTwinMap';
import RiverGaugeBoard from '../components/RiverGaugeBoard';
import { MAP_PLANE_FABRIC, type MapPlaneLayer } from '../lib/map-plane-fabric';
import { TSM_DATA_FABRICS, type FabricPlane } from '../lib/data-fabric-registry';
import { getTerrainRgbStatus } from '../lib/twin-map-style';
import './TriStateAtlasView.css';

type Lens = 'explore' | 'engineer' | 'review';
type Light = 'day' | 'golden' | 'night';
type RegionView = { id: string; label: string; center: [number, number]; zoom: number; pitch: number; bearing: number; imagery: boolean; notes: string };
// Navigation-only geocoding. These coordinates are NOT survey control points.
const REGIONAL_VIEWS: readonly RegionView[] = [
  { id: 'posey', label: 'Mount Vernon · Posey IN', center: [-87.895591, 37.932132], zoom: 11.5, pitch: 57, bearing: -18, imagery: true, notes: 'Indiana imagery can be layered over regional OpenFreeMap roads.' },
  { id: 'new-harmony', label: 'New Harmony · Wabash IN', center: [-87.934995, 38.129801], zoom: 12, pitch: 55, bearing: -12, imagery: true, notes: 'USGS gauge locations can be inspected here; no station readings are prefilled.' },
  { id: 'henderson', label: 'Henderson · Kentucky', center: [-87.5925, 37.839489], zoom: 12, pitch: 52, bearing: -14, imagery: false, notes: 'Regional street basemap only. Indiana aerial coverage is not relabeled as Kentucky.' },
  { id: 'shawneetown', label: 'Shawneetown · Illinois', center: [-88.187197, 37.715479], zoom: 11.5, pitch: 53, bearing: -22, imagery: false, notes: 'Regional street basemap only; local authoritative GIS detail requires separate sources.' },
  { id: 'regional', label: 'Three-state overview', center: [-87.99, 37.96], zoom: 9.3, pitch: 40, bearing: 0, imagery: false, notes: 'Multi-state context view; survey rectangles are not mapped flood or river depths.' },
];
function lightForHour(hour: number): Light {
  return hour < 6 || hour >= 20 ? 'night' : hour >= 16 ? 'golden' : 'day';
}
const LENSES: readonly { id: Lens; label: string; description: string }[] = [
  { id: 'explore', label: 'Explore', description: 'See real mapped places, public GIS layers, rivers and buildings.' },
  { id: 'engineer', label: 'Engineer', description: 'Inspect maps, open scientific workbenches and compare authority layers.' },
  { id: 'review', label: 'Peer review', description: 'Follow the data chain to sources, assumptions and reproducibility.' },
];
const PLANE_LABELS: Record<FabricPlane, string> = {
  EVIDENCE_DATA_GOVERNANCE: 'Evidence and source governance',
  SCIENTIFIC_SIMULATION: 'Scientific and simulation',
  GOVERNANCE_DECISION: 'Governance and decisions',
  PUBLIC_EXPERIENCE_VISUALIZATION: 'Public maps and visualization',
};
const isExternalSource = (endpoint: string): boolean => /^https:\/\//.test(endpoint) && !endpoint.includes('{');
const sourceCount = TSM_DATA_FABRICS.length;
const mapCount = MAP_PLANE_FABRIC.length;

export default function TriStateAtlasView(): JSX.Element {
  const [lens, setLens] = useState<Lens>('explore');
  const [light, setLight] = useState<Light>('golden');
  const [sceneHour, setSceneHour] = useState(17);
  const [regionId, setRegionId] = useState('posey');
  const [regionalLayers, setRegionalLayers] = useState({ gauges: true, surveys: false });
  const [layers, setLayers] = useState<Record<string, boolean>>(defaultMapPlaneVisibility);
  const [sourceId, setSourceId] = useState(MAP_PLANE_FABRIC[0]?.id ?? '');
  const [fabricPlane, setFabricPlane] = useState<FabricPlane>('EVIDENCE_DATA_GOVERNANCE');
  const [riverOpen, setRiverOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState('Map initialization pending; source availability unknown.');
  const onMapStatus = useCallback((status: string) => setMapStatus(status), []);
  const selectedSource: MapPlaneLayer | undefined = MAP_PLANE_FABRIC.find((layer) => layer.id === sourceId);
  const terrain = getTerrainRgbStatus();
  const region = REGIONAL_VIEWS.find((item) => item.id === regionId) ?? REGIONAL_VIEWS[0]!;
  const visibleFabric = TSM_DATA_FABRICS.filter((item) => item.plane === fabricPlane);
  const changeLens = (next: Lens) => {
    setLens(next);
    if (next === 'review') setFabricPlane('EVIDENCE_DATA_GOVERNANCE');
    if (next === 'engineer') setFabricPlane('SCIENTIFIC_SIMULATION');
  };

  return (
    <div className="tsm-atlas">
      <div className="tsm-atlas-heading">
        <div>
          <p className="tsm-atlas-kicker">Ohio–Wabash River Valley · Indiana / Illinois / Kentucky</p>
          <h1>Explore the 4D engineering twin</h1>
          <p>The mapped landscape is from TSM's actual repository source adapters. Lighting is cinematic; spatial positions, layers, observations and mathematical results retain their own evidence requirements.</p>
        </div>
        <div className="tsm-atlas-links">
          <Link to="/river-watch">River Watch</Link>
          <Link to="/flood-sim">Flood workbench</Link>
          <Link to="/cinematic">Cinematic view</Link>
          <Link to="/spatial-planes">Regional spatial fabric</Link>
        </div>
      </div>

      <nav className="tsm-atlas-lenses" aria-label="Choose an experience level">
        {LENSES.map((item) => <button
          type="button" key={item.id} onClick={() => changeLens(item.id)}
          aria-pressed={lens === item.id}
          className={lens === item.id ? 'selected' : ''}
        ><strong>{item.label}</strong><span>{item.description}</span></button>)}
      </nav>

      <div className="tsm-atlas-workspace">
        <aside className="tsm-atlas-panel tsm-atlas-controls" aria-label="Real source layer controls">
          <h2>Explore the river valley</h2>
          <label htmlFor="tsm-atlas-region">Travel to a community</label>
          <select id="tsm-atlas-region" value={regionId} onChange={(event) => setRegionId(event.target.value)}>
            {REGIONAL_VIEWS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <p className="tsm-atlas-region-note">{region.notes}</p>
          <fieldset className="tsm-atlas-regional-layers">
            <legend>Repository-staged regional evidence</legend>
            <label><input type="checkbox" checked={regionalLayers.gauges}
              onChange={(event) => setRegionalLayers((prev) => ({ ...prev, gauges: event.target.checked }))} />
              USGS gauge points <small>(10 locations, not live stage)</small></label>
            <label><input type="checkbox" checked={regionalLayers.surveys}
              onChange={(event) => setRegionalLayers((prev) => ({ ...prev, surveys: event.target.checked }))} />
              USACE eHydro extents <small>(20 survey footprints, not flood water)</small></label>
          </fieldset>
          <h2>Real map layers</h2>
          <p>Registered layers come from TSM's existing spatial fabric. Switch sources on/off; unavailable endpoints are not replaced with invented geometry.</p>
          <div className="tsm-atlas-map-layers">
            {MAP_PLANE_FABRIC.map((item) => {
              const blocked = !item.mapRenderable || (item.id === 'terrain-rgb' && !terrain.enabled);
              return <label key={item.id} className="tsm-atlas-layer">
                <input type="checkbox"
                  disabled={blocked}
                  checked={!blocked && Boolean(layers[item.id])}
                  onChange={(event) => setLayers((current) => ({ ...current, [item.id]: event.target.checked }))} />
                <span><strong>{item.title}</strong>
                  <small>{item.authority} · {blocked ? 'Unavailable / not map-renderable' : 'Configured source'}</small></span>
              </label>;
            })}
          </div>
          <button type="button" className="tsm-atlas-reset" onClick={() => setLayers(defaultMapPlaneVisibility())}>Reset repository layer defaults</button>
        </aside>

        <section className="tsm-atlas-stage" aria-label="Actual TSM MapLibre digital twin">
          <div className="tsm-atlas-stage-toolbar">
            <div><strong>3D map canvas</strong><small>OpenFreeMap regional context + authority layers · EPSG:3857</small></div>
            <fieldset className="tsm-atlas-lighting">
              <legend>Visual lighting only</legend>
              {(['day', 'golden', 'night'] as const).map((preset) =>
                <label key={preset}><input type="radio" name="tsm-atlas-light" value={preset}
                  checked={light === preset} onChange={() => { setLight(preset); setSceneHour(preset === 'day' ? 12 : preset === 'golden' ? 18 : 22); }} />{preset}</label>)}
            </fieldset>
          </div>
          <div className="tsm-atlas-timebar">
            <label htmlFor="tsm-atlas-hour">Visual day/night cycle <strong>{String(sceneHour).padStart(2, '0')}:00</strong></label>
            <input id="tsm-atlas-hour" type="range" min={0} max={23} step={1} value={sceneHour}
              onChange={(event) => { const next = Number(event.target.value); setSceneHour(next); setLight(lightForHour(next)); }} />
            <small>4D presentation time only: does not advance USGS observations, hydrology, land cover, or hydraulic simulations.</small>
          </div>
          <div className="tsm-atlas-map">
            <TriStateDigitalTwinMap hideSidebar visible={layers} onVisibleChange={setLayers}
              regionalAtlas regionalView={region} regionalLayers={regionalLayers}
              showIndianaImagery={region.imagery} lightPreset={light} onStatusChange={onMapStatus} />
          </div>
          <div className="tsm-atlas-map-status" role="status" aria-live="polite">
            <strong>Map adapter:</strong> {mapStatus}
          </div>
          <p className="tsm-atlas-note">Source map features are observational, contextual, planning, regulatory, or derived depending on their registry authority. Visible does not mean validated; 3D roof estimates and flood screening must not be interpreted as engineering measurements.</p>
        </section>

        <aside className="tsm-atlas-panel tsm-atlas-inspector" aria-label="Data and evidence inspector">
          <h2>{lens === 'explore' ? 'Discover the valley' : lens === 'engineer' ? 'Engineering desk' : 'Source provenance desk'}</h2>
          <p>{lens === 'explore'
            ? 'Start with a mapped feature, then open the official source. Large controls and plain-language explanations are available in this panel.'
            : lens === 'engineer'
              ? 'Use the existing TSM hydraulic, survey, building, terrain and cinematic tools. Check datum and model prerequisites before comparing results.'
              : 'Inspect registered sources, documentation, authority class and data limitations before relying on any outcome.'}</p>

          {lens === 'engineer' && <div className="tsm-atlas-tools">
            <Link to="/flood-sim">Hydraulic screening & placement tools</Link>
            <Link to="/engineering-section">Engineering section</Link>
            <Link to="/cinematic-engineering">Cinematic engineering</Link>
            <Link to="/digital-twin">Site calculations</Link>
          </div>}
          {lens === 'review' && <div className="tsm-atlas-tools">
            <Link to="/ledger">Evidence ledger</Link>
            <Link to="/lineage">Data contracts</Link>
            <Link to="/architecture">Four trust planes</Link>
            <a href="https://github.com/ATphobia22/Tri-State-Systems-Manager/blob/main/docs/architecture/ENGINEERING-ASSURANCE-STANDARD.md" target="_blank" rel="noopener noreferrer">Engineering assurance standard</a>
          </div>}

          <label htmlFor="tsm-atlas-source">Inspect a mapped data source</label>
          <select id="tsm-atlas-source" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
            {MAP_PLANE_FABRIC.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          {selectedSource && <div className="tsm-atlas-evidence">
            <h3>{selectedSource.title}</h3>
            <dl>
              <dt>Source authority</dt><dd>{selectedSource.authority}</dd>
              <dt>Fabric layer</dt><dd><code>{selectedSource.id}</code></dd>
              <dt>Adapter type</dt><dd>{selectedSource.kind}</dd>
              <dt>Map capable</dt><dd>{selectedSource.mapRenderable ? 'Registered as renderable, not runtime-verified' : 'No map renderer registered'}</dd>
              <dt>Known limitations</dt><dd>{selectedSource.notes}</dd>
            </dl>
            {isExternalSource(selectedSource.endpoint) && <a href={selectedSource.endpoint} target="_blank" rel="noopener noreferrer">Open original source service</a>}
          </div>}
        </aside>
      </div>

      <section className="tsm-atlas-bottom" aria-label="Data fabrics and real-time observations">
        <div className="tsm-atlas-panel">
          <h2>Source fabric inventory</h2>
          <p><strong>{sourceCount}</strong> documented data-fabric contracts and <strong>{mapCount}</strong> map-plane definitions are loaded from repository code, not hardcoded display claims. A contract marked live-capable is not proof of a successful source request.</p>
          <label htmlFor="tsm-atlas-fabric-plane">Trust plane</label>
          <select id="tsm-atlas-fabric-plane" value={fabricPlane} onChange={(event) => setFabricPlane(event.target.value as FabricPlane)}>
            {(Object.keys(PLANE_LABELS) as FabricPlane[]).map((id) => <option key={id} value={id}>{PLANE_LABELS[id]}</option>)}
          </select>
          <div className="tsm-atlas-fabrics">
            {visibleFabric.map((fabric) =>
              <details key={fabric.id}>
                <summary><strong>{fabric.id.replaceAll('-', ' ')}</strong><span>{fabric.implemented ? 'CODE / CONTRACT' : 'NOT IMPLEMENTED'} · {fabric.live ? 'live-capable' : 'offline/review'}</span></summary>
                <p>{fabric.notes}</p>
                <dl><dt>Sources</dt><dd>{fabric.sources.join(', ')}</dd><dt>Outputs</dt><dd>{fabric.output.join(', ')}</dd><dt>Code module</dt><dd><code>{fabric.module}</code></dd><dt>Authority</dt><dd>{fabric.authority}</dd></dl>
              </details>)}
          </div>
        </div>
        <div className="tsm-atlas-panel">
          <h2>River Watch — live on request</h2>
          <p>Retrieve USGS/NOAA hydrologic observations through the existing TSM server API only when you press the existing fetch button. There is no polling, no default water-level number and no invented NAVD88 conversion.</p>
          <button type="button" className="tsm-atlas-reset" onClick={() => setRiverOpen((current) => !current)} aria-expanded={riverOpen} aria-controls="tsm-atlas-gauge-board">
            {riverOpen ? 'Close station board' : 'Open real station board'}
          </button>
          <div id="tsm-atlas-gauge-board">
            {riverOpen ? <RiverGaugeBoard /> :
              <p className="tsm-atlas-note">Station observations have not been requested in this view. Open the board, then request an authoritative snapshot. An unavailable API remains visibly unavailable.</p>}
          </div>
          <p className="tsm-atlas-note">GitHub Pages alone cannot host the server API. Public imagery/GIS source tiles may be accessible while on-demand gauge results still require the configured backend.</p>
        </div>
      </section>
      <footer className="tsm-atlas-footer">
        <strong>Human authority final.</strong> No automatic filing or professional certification. FEMA effective mapping, Indiana DNR planning products and model scenarios retain separate authority and evidence chains. If data are missing, they stay missing.
      </footer>
    </div>
  );
}
