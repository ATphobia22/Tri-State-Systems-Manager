import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const component = readFileSync(new URL('../src/components/BackgroundMusic.tsx', import.meta.url), 'utf8');
const tracks = [
  ['monster-down.mp3', 'Monster Down', null],
  ['get-it-out-the-mud.mp3', 'Get It Out The Mud', null],
  ['dadhuntin2.mp3', 'Dad Huntin 2', null],
  ['oak-grove-slim-days.mp3', 'Oak Grove Slim Days', 'a81119c8bf5108ad0bc75b793195fee544dce9ec60ffef394cce05aad23c0403'],
  ['mama-times-changed.mp3', 'Mama Times Changed', '918cde01e21852aab68c02d6faa95569a61ebb9c9feecca361094a227ee91650'],
  ['home-sweet-home.mp3', 'Home Sweet Home', '940e0751f205f3a871fa15c3f29d8d89f05cb2764fc18c5af5cbee5fa0b79d20'],
  ['creek-bank-jumpin.mp3', "Creek Bank Jumpin'", '77071a23f2148fd6553c31c8223287704178716c4802d1e1fb79e3b9ce41806d'],
];

test('music player preserves original three and adds four original works', () => {
  const declared = [...component.matchAll(/\{ file: '([^']+\.mp3)', title:/g)].map((m) => m[1]);
  assert.deepEqual(declared, tracks.map(([name]) => name));
  for (const [name, title] of tracks) {
    assert.ok(component.includes(`file: '${name}'`), name);
    assert.ok(component.includes(title), title);
  }
});

test('every released source MP3 is present and four uploads match exact SHA-256', () => {
  for (const [name, , hash] of tracks) {
    const url = new URL(`../public/audio/${name}`, import.meta.url);
    assert.ok(existsSync(url), `Missing MP3: ${name}`);
    const bytes = readFileSync(url);
    assert.ok(bytes.length > 128, name);
    assert.ok(bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 0xff, `Not MP3: ${name}`);
    if (hash) assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, name);
  }
});

test('uses subpath-aware same-origin URLs, user gesture play and natural track advance', () => {
  assert.match(component, /import\.meta\.env\.BASE_URL\}audio\//);
  assert.match(component, /el\.addEventListener\('ended'/);
  assert.match(component, /preload="none"/);
});
