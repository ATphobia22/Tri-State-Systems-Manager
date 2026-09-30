#!/usr/bin/env node
/**
 * Generates dist/404.html for Single Page Apps on GitHub Pages.
 *
 * MIT License, adapted from https://github.com/rafgraph/spa-github-pages
 * (ATphobia22/spa-github-pages fork).
 *
 * This script takes the current url and converts the path and query string
 * into just a query string, and then redirects the browser to the new url
 * with only a query string and hash fragment, e.g.
 * https://atphobia22.github.io/Tri-State-Systems-Manager/map?a=b becomes
 * https://atphobia22.github.io/Tri-State-Systems-Manager/?/map&a=b
 *
 * The restore half lives in public/spa-redirect.js, loaded by index.html,
 * which converts ?/path back into the real path via history.replaceState
 * before the React Router boots.
 *
 * Usage: node scripts/generate-spa-fallback.mjs [--out dist/404.html] [--base /Tri-State-Systems-Manager/]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const argAfter = (flag) => {
  const idx = process.argv.indexOf(flag);
  return idx === -1 ? undefined : process.argv[idx + 1];
};

const outPath = resolve(argAfter('--out') || 'dist/404.html');

// Project Pages base path (e.g. /Tri-State-Systems-Manager/). The redirect
// must keep every base-path segment so only the route part is rewritten:
// pathSegmentsToKeep is derived from the base, not hardcoded.
const rawBase = (argAfter('--base') || '/Tri-State-Systems-Manager/').trim() || '/';
const leading = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
const basePath = leading.endsWith('/') ? leading : `${leading}/`;
const pathSegmentsToKeep = basePath.split('/').filter(Boolean).length;

const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>TSM · Tri-State Systems Manager</title>
    <script type="text/javascript">
      // Single Page Apps for GitHub Pages
      // MIT License, adapted from https://github.com/rafgraph/spa-github-pages
      // This script takes the current url and converts the path and query
      // string into just a query string, and then redirects the browser
      // to the new url with only a query string and hash fragment.
      // Note: this 404.html file must be at least 512 bytes for it to work
      // with Internet Explorer.
      // Configured for GitHub Pages project base path: ${basePath}
      var pathSegmentsToKeep = ${pathSegmentsToKeep};

      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body>
  </body>
</html>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
if (Buffer.byteLength(html) < 512) {
  throw new Error('404.html must be at least 512 bytes for IE compatibility');
}
console.log(`Wrote SPA fallback: ${outPath} (${Buffer.byteLength(html)} bytes)`);
