/** On public GitHub Pages, directly use the official USGS OGC collection. */
import PagesUSGSGaugeReader from '../components/PagesUSGSGaugeReader';
import RiverGaugeBoard from '../components/RiverGaugeBoard';

const pagesMode = import.meta.env.VITE_TSM_PAGES_ATLAS_HOME === 'true';

export default function RiverWatchView(): JSX.Element {
  return (
    <main style={{ minHeight: '100%', padding: 'clamp(12px, 3vw, 24px)', background: '#f8fafc', color: '#17324d' }}>
      <header style={{ maxWidth: 1200, margin: '0 auto 18px' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Community River Watch</h1>
        <p>Request an official USGS gage-height observation for a selected river station. Times, qualifiers and the original station datum stay visible. No automatic polling or fabricated values.</p>
      </header>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <PagesUSGSGaugeReader />
        {!pagesMode && <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, fontWeight: 700 }}>Additional USGS / NOAA snapshots (requires a connected TSM backend)</summary>
          <RiverGaugeBoard />
        </details>}
      </div>
    </main>
  );
}
