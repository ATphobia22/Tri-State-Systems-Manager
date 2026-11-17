import PagesUSGSGaugeReader from '../components/PagesUSGSGaugeReader';
import RiverGaugeBoard from '../components/RiverGaugeBoard';

/** Public Pages uses the direct on-demand USGS reader; the server board needs a real TSM API. */
export default function RiverWatchView(): JSX.Element {
  const pages = import.meta.env.VITE_TSM_PAGES_ATLAS_HOME === 'true';
  return (
    <main style={{ minHeight: '100%', padding: 'clamp(12px, 3vw, 24px)', background: '#f8fafc', color: '#17324d' }}>
      <header style={{ maxWidth: 1100, margin: '0 auto 18px' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Community River Watch</h1>
        <p style={{ lineHeight: 1.6 }}>Fetch current gage height directly from the official USGS public service when you request it. Readings retain each station's own reference datum; they are not NAVD88 flood elevations.</p>
      </header>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <PagesUSGSGaugeReader />
        {!pages && <details style={{ marginTop: 18, padding: 14, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 12 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, fontWeight: 700 }}>Advanced TSM server observations and NOAA forecasts</summary>
          <p>Requires a running, configured TSM server. No polling; click to request a snapshot.</p>
          <RiverGaugeBoard />
        </details>}
        {pages && <p style={{ marginTop: 18 }}>This static GitHub Pages site cannot execute TSM server endpoints. For the source-verified observation, use the reader above or open the station's official USGS page. Forecasts are not presented as observations.</p>}
      </div>
    </main>
  );
}
