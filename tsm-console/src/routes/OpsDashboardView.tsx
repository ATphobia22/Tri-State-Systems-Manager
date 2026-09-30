/**
 * Operations dashboard — retired.
 *
 * This route was a SCADA-style live river-gauge status board. Live river
 * data was dropped by owner decision on 2026-09-29 ("drop login and live
 * river data"), so the board no longer polls anything: no gauge polling,
 * no canvas, no fabricated values.
 *
 * The retirement is also documented in the spatial fabric
 * (lib/spatial-planes.ts → plane-gauge-telemetry, status RETIRED).
 *
 * Honesty contract: screening visualization only — never survey or
 * regulatory evidence. Human authority remains final.
 */

export default function OpsDashboardView() {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#0b1220',
        color: '#e5e7eb',
        padding: 32,
        boxSizing: 'border-box',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Operations dashboard — retired</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 640, lineHeight: 1.6 }}>
        The live river-gauge board was retired on 2026-09-29 by owner decision:
        TSM carries no live river data. No gauges are polled, no values are
        shown, and nothing here is fabricated to fill the gap.
      </p>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 640, lineHeight: 1.6 }}>
        Screening visualization only — not survey or regulatory evidence.
        Human authority remains final.
      </p>
    </div>
  );
}
