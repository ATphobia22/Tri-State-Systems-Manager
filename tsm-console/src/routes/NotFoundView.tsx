/**
 * Friendly not-found page for unmatched routes.
 *
 * Rendered by the catch-all `*` route (inside the root layout, so the console
 * chrome stays visible). This is for plain unknown addresses — real loader or
 * chunk failures still go through the root `errorElement` (RouteErrorPage).
 *
 * Added after the iPhone home-screen manifest (`start_url: ./index.html` and
 * the `./index.html?mode=...` shortcuts) was found to land on an explicit
 * `/index.html` path with no matching route, which surfaced as a console
 * error instead of the charter.
 */

import { Link } from 'react-router';
import { t } from '../lib/design-tokens';

export default function NotFoundView() {
  const linkStyle: React.CSSProperties = {
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.6rem 1.25rem',
    borderRadius: t.radius.sm,
    border: `1px solid ${t.color.border.default}`,
    color: t.color.accent.brand,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: t.font.size.base,
  };
  return (
    <div style={{ minHeight: '60dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ color: t.color.text.primary, fontSize: t.font.size.h1, margin: '0.5rem 0' }}>Page not found</h1>
        <p style={{ color: t.color.text.secondary, fontSize: t.font.size.base, lineHeight: 1.6 }}>
          This console doesn&rsquo;t have a page at that address.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <Link to="/" style={linkStyle}>Back to Charter</Link>
          <Link to="/map" style={linkStyle}>Open the map</Link>
          <Link to="/river-watch" style={linkStyle}>River Watch</Link>
        </div>
      </div>
    </div>
  );
}
