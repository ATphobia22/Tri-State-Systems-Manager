import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('MapLibre side controls start closed and remain accessible by button', () => {
 const map = read('src/components/TriStateDigitalTwinMap.tsx');
 assert.match(map, /\[mapToolsOpen, setMapToolsOpen\] = useState\(false\)/);
 assert.match(map, /aria-controls="tsm-maplibre-layer-controls"/);
 assert.match(map, /aria-expanded=\{mapToolsOpen\}/);
 assert.match(map, /hideSidebar && mapToolsOpen/);
});
test('Flood workbench keeps genuine viewport open when settings are hidden', () => {
 const flood = read('src/components/FloodSimulator.tsx');
 assert.match(flood, /\[controlsOpen, setControlsOpen\] = useState\(false\)/);
 assert.match(flood, /aria-controls="tsm-flood-controls"/);
 assert.match(flood, /hidden=\{!controlsOpen\}/);
 assert.match(flood, /onClick=\{handlePlayTour\}/);
 assert.match(flood, /window.dispatchEvent\(new Event\('resize'\)\)/);
});
test('Cesium buildings are reachable from the viewport, with visible local toggle', () => {
 const cesium = read('src/routes/CesiumRegionalTwinView.tsx');
 assert.match(cesium, /data-testid="cesium-map-layers-toggle"/);
 assert.match(cesium, /scene.current\?\.setLayer\('buildings', show\)/);
 assert.match(cesium, /Cesium OSM buildings \(online context\)/);
});

test('Cinematic engineering renders the real MapLibre world, not a decorative scene', () => {
  const engine = read('src/routes/CinematicEngineeringExperienceView.tsx');
  assert.match(engine, /<TriStateDigitalTwinMap hideSidebar regionalAtlas cinematicTour=\{playing\}/);
  assert.doesNotMatch(engine, /Streaming viewport placeholder/);
  assert.match(engine, /hidden=\{!toolsOpen\}/);
  assert.match(engine, /aria-controls="tsm-cinematic-engineering-tools"/);
  assert.match(engine, /Cesium cinematic shots/);
});
test('Engineering cinema offers actual Cesium terrain/buildings with preserved MapLibre fallback', () => {
  const engine = read('src/routes/CinematicEngineeringExperienceView.tsx');
  const cesium = read('src/routes/CesiumRegionalTwinView.tsx');
  assert.match(engine, /<CesiumRegionalTwinView autoFlyover=\{playing\}/);
  assert.match(engine, /data-testid="engineering-renderer-toggle"/);
  assert.match(engine, /new URLSearchParams\(window.location.search\).get\('renderer'\) === 'cesium'/);
  assert.match(cesium, /data-testid="cesium-buildings-quick-toggle"/);
  assert.match(cesium, /data-testid="cesium-flyover-toolbar"/);
  assert.match(cesium, /if \(ready && !error\) syncExternalFlyover\(autoFlyover\)/);
});

test('Engineering Cesium flyover synchronizes parent and does not regress raster screening evidence', () => {
  const engine = read('src/routes/CinematicEngineeringExperienceView.tsx');
  const cesium = read('src/routes/CesiumRegionalTwinView.tsx');
  assert.match(engine, /onFlyoverChange=\{setPlaying\}/);
  assert.match(cesium, /onFlyoverChange\?\.\(tour\)/);
  assert.match(cesium, /setScreening\(level, frame\?\.bounds, frame\?\.cols, frame\?\.rows\)/);
  assert.match(cesium, /\(message\) => setScreeningStatus\(message\)/);
  assert.doesNotMatch(cesium, /requested · inspect status/);
  assert.match(cesium, /status\.buildings\?\.state === 'ready'/);
});

test('Cinematic scene HUD defaults map-first and wires real camera tour', () => {
  const cinematic = read('src/routes/CinematicView.tsx');
  const hud = read('src/components/CinematicTwinHud.tsx');
  assert.match(cinematic, /cinematicTour=\{tourActive\}/);
  assert.match(hud, /\[hudCollapsed, setHudCollapsed\] = useState\(true\)/);
  assert.match(hud, /onClick=\{props.onToggleTour\}/);
});

test('Atlas visual settings are a closed-by-default group, leaving map and tour accessible', () => {
 const atlas = read('src/routes/TriStateAtlasView.tsx');
 assert.match(atlas, /\[sceneToolsOpen, setSceneToolsOpen\] = useState\(false\)/);
 assert.match(atlas, /aria-controls="tsm-atlas-scene-tools"/);
 assert.match(atlas, /\{sceneToolsOpen && <div className="tsm-atlas-timebar">/);
 assert.match(atlas, /Play Wabash flyover/);
});
test('Twin Canvas coverage and building notices are collapsible', () => {
 const twin = read('src/routes/TwinCanvasView.tsx');
 assert.match(twin, /<details aria-label="Twin source coverage and building evidence"/);
 assert.match(twin, /<AoiCoveragePanel\s*\/>/);
 assert.match(twin, /<BuildingCoverageNotice\s*\/>/);
});
test('Local cinematic map keeps its source-derived terrain while moving the real camera', () => {
 const cinematic = read('src/routes/CinematicView.tsx');
 const map = read('src/components/TriStateDigitalTwinMap.tsx');
 assert.doesNotMatch(cinematic, /hideSidebar\s*\n\s*regionalAtlas/);
 assert.match(map, /if \(!mapReady \|\| !map \|\| !props.cinematicTour\) return;/);
});


test('Cinematic map-first HUD links directly to the Cesium 3D buildings and terrain viewer', () => {
  const hud = read('src/components/CinematicTwinHud.tsx');
  assert.match(hud, /import \{ Link \} from 'react-router'/);
  assert.match(hud, /<Link to="\/cesium"/);
  assert.match(hud, /Open Cesium 3D buildings and terrain/);
  assert.match(hud, /\[hudCollapsed, setHudCollapsed\] = useState\(true\)/);
});
