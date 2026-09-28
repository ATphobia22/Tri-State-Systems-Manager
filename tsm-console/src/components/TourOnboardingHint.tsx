/**
 * First-run onboarding hint. Shown once per browser (dismissal persisted in
 * localStorage); points the user at the existing cinematic tour on the
 * Geospatial map rather than building a new tour system.
 */

import { useState } from 'react';
import { t } from '../lib/design-tokens';
import { useNavigate } from 'react-router';

const DISMISS_KEY = 'tsm.onboarding-hint-dismissed';

export function TourOnboardingHint(): React.ReactElement | null {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const navigate = useNavigate();

  if (dismissed) return null;

  const dismiss = (): void => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // private-mode / blocked storage: just hide for this session
    }
    setDismissed(true);
  };

  return (
    <div
      role="note"
      aria-label="First-run tour hint"
      style={{
        background: t.color.surface.infoInk,
        borderBottom: `1px solid ${t.color.accent.brandHairline}`,
        color: t.color.text.body,
        padding: '0.6rem 1rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.6rem',
        fontSize: '0.82rem',
      }}
    >
      <span>
        <strong style={{ color: t.color.accent.brand }}>New here?</strong> The Geospatial map has a guided
        cinematic fly-through of the Ohio–Wabash valley.
      </span>
      <span style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
        <button
          type="button"
          onClick={() => {
            dismiss();
            navigate('/map');
          }}
          style={{
            minHeight: 44,
            padding: '0.4rem 1rem',
            borderRadius: t.radius.sm,
            border: `1px solid ${t.color.accent.brandBorder}`,
            background: t.color.accent.brandSoft,
            color: t.color.text.body,
            fontWeight: 600,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Take the tour
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss tour hint"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0.4rem 0.8rem',
            borderRadius: t.radius.sm,
            border: `1px solid ${t.color.surface.card}`,
            background: 'transparent',
            color: t.color.text.secondary,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </span>
    </div>
  );
}
