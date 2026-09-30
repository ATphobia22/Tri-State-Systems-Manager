/**
 * Route-matching regression tests.
 *
 * The iPhone home-screen manifest uses `start_url: ./index.html` (plus
 * `./index.html?mode=...` shortcuts), which lands on an explicit
 * `/index.html` path. That used to match no route and surfaced as a console
 * error; it must render the charter. Unknown addresses must hit the friendly
 * catch-all instead of the error boundary.
 */
import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router';
import { appRoutes } from './router';

// Match against the real route definitions (no DOM needed — the browser
// router itself is only created in the app shell).
const BASENAME = '/';

function matchedPaths(url: string): string[] | null {
  const matches = matchRoutes(appRoutes, url, BASENAME);
  return matches ? matches.map((m) => m.route.path ?? '(index)') : null;
}

describe('console route matching', () => {
  it('matches the charter at /', () => {
    expect(matchedPaths('/')).toContain('(index)');
  });

  it('matches the charter at /index.html (PWA start_url)', () => {
    const paths = matchedPaths('/index.html');
    expect(paths).not.toBeNull();
    expect(paths).toContain('index.html');
  });

  it('matches /index.html with a shortcut query string', () => {
    const paths = matchedPaths('/index.html?mode=live');
    expect(paths).not.toBeNull();
    expect(paths).toContain('index.html');
  });

  it('still matches the map route', () => {
    expect(matchedPaths('/map')).toContain('map');
  });

  it('routes unknown addresses to the friendly catch-all', () => {
    const paths = matchedPaths('/no-such-page-here');
    expect(paths).not.toBeNull();
    expect(paths).toContain('*');
  });
});
