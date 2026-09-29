// Single Page Apps for GitHub Pages — redirect restore.
//
// MIT License, adapted from https://github.com/rafgraph/spa-github-pages
// (ATphobia22/spa-github-pages fork).
//
// This script checks to see if a redirect is present in the query string,
// converts it back into the correct url and adds it to the browser's history
// using window.history.replaceState(...), which won't cause the browser to
// attempt to load the new url. When the single page app boots, the correct
// url will be waiting in the browser's history for the router.
//
// Kept as an external file (rather than inline) so it complies with the
// app's Content-Security-Policy (script-src 'self').
(function (l) {
  if (l.search[1] === '/') {
    var decoded = l.search
      .slice(1)
      .split('&')
      .map(function (s) {
        return s.replace(/~and~/g, '&');
      })
      .join('?');
    window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash);
  }
})(window.location);
