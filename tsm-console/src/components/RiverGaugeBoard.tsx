/**
 * RiverGaugeBoard — retired.
 *
 * This component was a live river-gauge board (5-minute refresh of USGS/NWS
 * observations). Live river data was dropped by owner decision on
 * 2026-09-29 ("drop login and live river data"), so the board renders a
 * retirement notice instead of polling. The default export is preserved so
 * existing route wiring (RiverWatchView, CinematicHudView) degrades
 * gracefully.
 */

const retiredStyle = {
  background: '#06101a',
  color: '#f8fafc',
  border: '1px solid #334155',
  borderRadius: 18,
  padding: 20,
} as const;

export default function RiverGaugeBoard(): JSX.Element {
  return (
    <section aria-labelledby="river-gauge-board-title" style={retiredStyle}>
      <h2 id="river-gauge-board-title" style={{ fontSize: '1.15rem', lineHeight: 1.5, margin: 0, fontWeight: 900 }}>
        River Watch — retired
      </h2>
      <p style={{ margin: '6px 0 0', color: '#cbd5e1', fontSize: '1rem' }}>
        Live river-gauge observations were retired on 2026-09-29 by owner
        decision. No gauges are polled and no values are shown; nothing is
        fabricated to fill the gap.
      </p>
    </section>
  );
}
