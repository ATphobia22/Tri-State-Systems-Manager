/**
 * Root error boundary page — rendered by the router's root `errorElement`.
 * A loader/chunk failure used to mean a blank page; this keeps the shell
 * chrome (skip link, header, nav) and shows a recoverable error instead.
 */

import { Link, useRouteError, isRouteErrorResponse } from 'react-router';
import { t } from '../lib/design-tokens';

export default function RouteErrorPage() {
  const error = useRouteError();
  let message = 'Something went wrong loading this view.';
  if (isRouteErrorResponse(error)) {
    message = error.status === 404
      ? 'That page does not exist in this console.'
      : `Request failed (${error.status}).`;
  } else if (error instanceof Error) {
    message = error.message || message;
  }

  const reload = (): void => window.location.reload();

  return (
    <div style={{ minHeight: '100dvh', background: t.color.surface.base, color: t.color.text.body, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ maxWidth: 520 }}>
        <div style={{ color: t.color.status.warning, fontSize: t.font.size.sm, fontWeight: 700, letterSpacing: '0.08em' }}>CONSOLE ERROR</div>
        <h1 style={{ color: t.color.text.primary, fontSize: t.font.size.h1, margin: '0.5rem 0' }}>This view failed to load</h1>
        <p style={{ color: t.color.text.secondary, fontSize: t.font.size.base, lineHeight: 1.6 }}>{message}</p>
        <p style={{ color: t.color.text.secondary, fontSize: t.font.size.sm }}>
          No data was fabricated — a loader or code chunk failed before anything rendered.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reload}
            style={{ minHeight: 44, padding: '0.6rem 1.25rem', borderRadius: t.radius.sm, border: 0, background: t.color.action.primary, color: t.color.text.inverse, fontWeight: 700, fontSize: t.font.size.base, cursor: 'pointer' }}
          >
            Reload this view
          </button>
          <Link
            to="/"
            style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0.6rem 1.25rem', borderRadius: t.radius.sm, border: `1px solid ${t.color.border.default}`, color: t.color.accent.brand, textDecoration: 'none', fontWeight: 600, fontSize: t.font.size.base }}
          >
            Back to Charter
          </Link>
        </div>
      </div>
    </div>
  );
}
