import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (file) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');

test('public River Watch directly exposes official, on-demand gage readings', () => {
  assert.match(source('routes/RiverWatchView.tsx'), /<PagesUSGSGaugeReader\s*\/>/);
  assert.match(source('routes/RiverWatchView.tsx'), /!pagesMode && <details/);
  assert.match(source('components/PagesUSGSGaugeReader.tsx'), /api\.waterdata\.usgs\.gov/);
  assert.match(source('components/PagesUSGSGaugeReader.tsx'), /station gage reference ONLY/);
});
test('memorial is a dedicated accessible destination', () => {
  assert.match(source('components/RootLayout.tsx'), /to: '\/memorial', label: 'Memorial'/);
  assert.match(source('routes/TriStateAtlasView.tsx'), /to="\/memorial">In loving memory/);
});
test('map-first viewer tools do not block the initial map', () => {
  assert.match(source('components/TriStateDigitalTwinMap.tsx'), /mapToolsOpen\] = useState\(false\)/);
  assert.match(source('components/FloodSimulator.tsx'), /controlsOpen\] = useState\(false\)/);
  assert.match(source('components/CinematicTwinHud.tsx'), /hudCollapsed\] = useState\(true\)/);
  assert.match(source('routes/CinematicEngineeringExperienceView.tsx'), /<CesiumRegionalTwinView autoFlyover=\{playing\}/);
  assert.match(source('routes/CesiumRegionalTwinView.tsx'), /cesium-buildings-quick-toggle/);
});
