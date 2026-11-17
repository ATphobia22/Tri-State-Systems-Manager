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
