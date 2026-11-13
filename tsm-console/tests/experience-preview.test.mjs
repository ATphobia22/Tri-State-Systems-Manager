import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Static contract tests verify that the standalone GitHub Pages / Vite-public
// concept stays accessible and demonstrative, never silently becoming a source
// of authoritative data. Browser/a11y QA remains an independent release gate.
const html = readFileSync(new URL('../public/experience-preview.html', import.meta.url), 'utf8');
const blueprint = readFileSync(new URL('../../docs/UX-CINEMATIC-4D-ATLAS.md', import.meta.url), 'utf8');

test('interactive preview distinguishes itself from measured GIS and live data', () => {
  assert.match(html, /NON-GEOGRAPHIC/);
  assert.match(html, /NOT (?:CONNECTED|LOADED)|Not loaded/i);
  assert.match(html, /Not running/);
  assert.match(html, /no scientific solver/i);
  assert.match(html, /Human authority remains final/i);
});

test('preview offers keyboard navigable Explore, Simulate and Verify modes', () => {
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tabpanel"/);
  for (const mode of ['explore', 'simulate', 'verify']) {
    assert.match(html, new RegExp('id="tab-' + mode + '"'));
    assert.match(html, new RegExp('data-mode="' + mode + '"'));
  }
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
    assert.ok(html.includes(key), 'Missing keyboard tab navigation key ' + key);
  }
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /focus-visible/);
  assert.match(html, /class="skip"/);
});

test('visual layers remain user-controlled and sample timeline is not a solver', () => {
  for (const name of ['terrain', 'rivers', 'buildings', 'scenario']) {
    assert.match(html, new RegExp('id="' + name + '"'));
    assert.match(html, new RegExp('id="layer-' + name + '"'));
  }
  assert.match(html, /id="reset"/);
  assert.match(html, /id="time"/);
  assert.match(html, /Changing the frame only changes the opacity/);
  assert.match(html, /frame\.addEventListener\("input", refresh\)/);
});

test('public concept does not fetch credentials, remote measurements, or tiles', () => {
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /\bXMLHttpRequest\b|\bWebSocket\s*\(/);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(html, /pk\.[a-zA-Z0-9]{15,}|sk\.[a-zA-Z0-9]{15,}/);
  assert.match(blueprint, /human|authority/i);
  assert.match(blueprint, /MapLibre|Three\.js/);
});
