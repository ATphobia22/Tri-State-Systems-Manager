import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('music widget is minimized by default and permits keyboard disclosure', () => {
  const music = read('components/BackgroundMusic.tsx');
  assert.match(music, /\[minimized, setMinimized\] = useState\(true\)/);
  assert.match(music, /aria-expanded=\{!minimized\}/);
  assert.match(music, /id="tsm-music-expanded-controls" hidden=\{minimized\}/);
});
test('full-screen cinema opens free of both engineering sidebar and model HUD overlays', () => {
  const cinema = read('routes/CinematicEngineeringExperienceView.tsx');
  assert.match(cinema, /\[toolsOpen, setToolsOpen\] = useState\(false\)/);
  assert.match(cinema, /\[hudOpen, setHudOpen\] = useState\(false\)/);
  assert.match(cinema, /hudOpen && <div id="tsm-cinema-model-overlay"/);
  assert.match(cinema, /<TriStateDigitalTwinMap hideSidebar regionalAtlas cinematicTour=\{playing\}/);
});
test('Cesium buildings and cinema are discoverable in public navigation', () => {
  const root = read('components/RootLayout.tsx');
  assert.match(root, /to: '\/cesium', label: 'Cesium 3D Buildings'/);
  assert.match(root, /to: '\/cinematic', label: '3D Cinema'/);
  assert.match(root, /to: '\/memorial', label: 'Beverly Ann Tucker Memorial'/);
});
