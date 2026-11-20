import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const consoleRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const player = readFileSync(path.join(consoleRoot, 'src/components/BackgroundMusic.tsx'), 'utf8');
const additions = [
  ['oak-grove-slim-days.mp3', 'Oak Grove Slim Days', 'a81119c8bf5108ad0bc75b793195fee544dce9ec60ffef394cce05aad23c0403'],
  ['mama-times-changed.mp3', 'Mama Times Changed', '918cde01e21852aab68c02d6faa95569a61ebb9c9feecca361094a227ee91650'],
  ['home-sweet-home.mp3', 'Home Sweet Home', '940e0751f205f3a871fa15c3f29d8d89f05cb2764fc18c5af5cbee5fa0b79d20'],
  ['creek-bank-jumpin.mp3', 'Creek Bank Jumpin', '77071a23f2148fd6553c31c8223287704178716c4802d1e1fb79e3b9ce41806d'],
];

test('old songs remain and four additions are registered exactly once', () => {
  const entries = [...player.matchAll(/\{\s*file:\s*'([^']+)',\s*title:\s*'([^']+)'\s*\}/g)];
  const found = entries.map((entry) => entry[1]);
  const legacy = ['monster-down.mp3', 'get-it-out-the-mud.mp3', 'dadhuntin2.mp3'];
  assert.deepEqual(found, [...legacy, ...additions.map(([filename]) => filename)]);
  assert.equal(new Set(found).size, 7);
  assert.ok(player.includes('import.meta.env.BASE_URL'), 'GitHub Pages subpath needs Vite BASE_URL');
});

for (const [filename, title, expectedSha] of additions) {
  test(`${title}: original uploaded bytes are committed to public/audio/`, () => {
    const file = path.join(consoleRoot, 'public/audio', filename);
    assert.ok(statSync(file).size > 100_000, 'audio asset must not be a tiny placeholder');
    const bytes = readFileSync(file);
    assert.ok(bytes.subarray(0, 3).equals(Buffer.from('ID3')) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0), 'expected MP3 header');
    assert.notEqual(bytes.subarray(0, 50).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1'), true);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedSha);
  });
}
