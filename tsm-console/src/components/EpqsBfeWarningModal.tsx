import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * EpqsBfeWarningModal — UI guard shown when a user picks a 3DEP-derived
 * elevation source in the flood simulator (FloodSimulator Terrain selector).
 *
 * ENGINEERING VALIDATION ONLY — this modal is not a FEMA or survey
 * certification, and nothing it says is LOMA evidence. It exists to stop the
 * exact misuse the EPQS validation warns about: treating an interpolated
 * 3DEP/EPQS terrain sample as if it were a surveyed elevation or a
 * substitute for the regulatory BFE.
 *
 * Grounded facts (verified 2026-11-07 against USGS FAQs):
 * - EPQS returns elevations INTERPOLATED from the 3DEP dynamic elevation
 *   service. USGS says only "interpolated" — no specific interpolation
 *   method is asserted for EPQS anywhere in this file.
 * - 3DEP dynamic service RMSE 0.53 m (~1.7 ft); NSSDA 95% bound
 *   1.96 x 0.53 m = +/-1.04 m (~+/-3.4 ft).
 * - 1/3 arc-second seamless DEM ~0.82 m RMSE; 95% bound +/-1.61 m (~+/-5.3 ft).
 * - Regulatory BFE is 369.1 ft NAVD88 (FEMA FIS 18129CV000A Table 9, section A).
 * - LOMA case 26-05-2022A: FEMA additional-information request; NOT ISSUED;
 *   90-day track ends 2026-12-21.
 *
 * Design follows the console's existing modal pattern
 * (CinematicTwinHud cutaway: fixed overlay, role="dialog", aria-modal,
 * bottom sheet on small screens, overlay click closes) with the light
 * shadcn-primitive panel (tsm-card / tsm-btn) and large touch targets
 * (min 48px buttons, full-width on narrow screens) for iOS 15-era Safari
 * at ~375px. No network fetch, no polling, no live data.
 */

export type EpqsTerrainMode = 'auto' | 'live';

/** Labels must match the FloodSimulator Terrain <option> text exactly. */
export const EPQS_TERRAIN_OPTION_LABELS: Record<EpqsTerrainMode, string> = {
  auto: 'Auto (3DEP-derived screening grid)',
  live: 'Live tiles (→ bundled grid fallback)',
};

export const EPQS_WARNING_COPY = {
  title: 'Check before you use this elevation',
  scopeNote:
    'This is an engineering screening warning from TSM. It is not a FEMA determination and not a survey certification.',
  acknowledgeLabel: 'I understand — use this terrain',
  cancelLabel: 'Cancel — keep current terrain',
  closeLabel: 'Close warning',
  bullets: [
    'It is an interpolated sample from a terrain grid — not a surveyed ground elevation. The U.S. Geological Survey says EPQS elevations are interpolated from the 3DEP dynamic elevation service.',
    'Its accuracy is a network average, not a promise for one spot. The 3DEP dynamic service is rated at 0.53 m RMSE (about 1.7 ft), which is about ±1.04 m (about ±3.4 ft) at 95% confidence. The 1/3 arc-second layer is 0.82 m RMSE, about ±1.61 m (about ±5.3 ft) at 95%.',
    'Screening only. Do not use it to judge a lot corner, a lowest adjacent grade, or a LOMA outcome.',
    'It never replaces the regulatory base flood elevation — 369.1 ft NAVD88 (FEMA Flood Insurance Study 18129CV000A, Table 9) — or a surveyed elevation from a licensed surveyor or engineer.',
    'LOMA case 26-05-2022A is still open: FEMA asked for more information, and the LOMA has not been issued. This check does not change that.',
  ],
} as const;

export function buildEpqsWarningIntro(pendingTerrainMode: EpqsTerrainMode): string {
  return (
    `You picked ${EPQS_TERRAIN_OPTION_LABELS[pendingTerrainMode]}. ` +
    'That terrain comes from USGS 3DEP data — the same data behind the Elevation Point Query Service (EPQS). ' +
    'Before it is used, know what it is and what it is not:'
  );
}

/**
 * Pure trigger decision for a Terrain selector change. Returns the pending
 * mode (show the warning) when the user picks a different source, or null
 * when nothing changes — no warning on mount, no warning for a no-op pick,
 * and no warning for unrelated controls (quality, speed, pause, scenario).
 */
export function requestTerrainModeChange(
  current: EpqsTerrainMode,
  next: EpqsTerrainMode,
): EpqsTerrainMode | null {
  return next === current ? null : next;
}

export interface EpqsBfeWarningModalProps {
  open: boolean;
  pendingTerrainMode: EpqsTerrainMode | null;
  onAcknowledge: () => void;
  onCancel: () => void;
}

export function EpqsBfeWarningModal({
  open,
  pendingTerrainMode,
  onAcknowledge,
  onCancel,
}: EpqsBfeWarningModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open || pendingTerrainMode == null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={EPQS_WARNING_COPY.title}
      aria-describedby="epqs-warning-body"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        className="tsm-card"
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '88vh',
          overflowY: 'auto',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.3 }}>
            {EPQS_WARNING_COPY.title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={EPQS_WARNING_COPY.closeLabel}
            style={{
              flexShrink: 0,
              minWidth: 44,
              minHeight: 44,
              background: '#e2e8f0',
              border: 'none',
              borderRadius: 8,
              color: '#0f172a',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div id="epqs-warning-body" style={{ fontSize: 15, lineHeight: 1.5 }}>
          <p style={{ marginTop: 0 }}>{buildEpqsWarningIntro(pendingTerrainMode)}</p>
          <ul style={{ margin: '0 0 12px', paddingLeft: '1.25rem' }}>
            {EPQS_WARNING_COPY.bullets.map((bullet) => (
              <li key={bullet} style={{ marginBottom: 8 }}>
                {bullet}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 0 }}>
            {EPQS_WARNING_COPY.scopeNote}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginTop: 16,
          }}
        >
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={onAcknowledge}
            style={{ width: '100%', minHeight: 48 }}
          >
            {EPQS_WARNING_COPY.acknowledgeLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            style={{ width: '100%', minHeight: 48 }}
          >
            {EPQS_WARNING_COPY.cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function shouldBlockEpqsBfeEligibilityCompare(args: {
  sourceAuthority: string;
  intent: 'eligibility' | 'screening' | 'display';
}): boolean {
  if (args.intent !== 'eligibility') return false;
  const a = args.sourceAuthority.toUpperCase();
  return a.includes('EPQS') || a.includes('3DEP') || a.includes('DEM') || a === 'DERIVED';
}
