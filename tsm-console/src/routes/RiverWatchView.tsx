import RiverGaugeBoard from '../components/RiverGaugeBoard';

export default function RiverWatchView(): JSX.Element {
  return (
    <main style={{ minHeight: '100%', padding: 20, background: '#020617', color: '#e2e8f0' }}>
      <header style={{ maxWidth: 1200, margin: '0 auto 18px' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Community River Watch</h1>
        <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>Live observations are available through explicit user-triggered snapshots via the TSM server API. Automatic polling is prohibited; observations, forecasts, and engineering model outputs remain separate data classes.</p>
      </header>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}><RiverGaugeBoard /></div>
    </main>
  );
}
