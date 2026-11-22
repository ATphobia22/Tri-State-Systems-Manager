/** Public Atlas remains navigable when GPU/WebGL2 is not available.
 * This is a non-graphical accessibility path, never a substitute terrain map.
 */
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';

const GraphicsAtlas = lazy(() => import('./TriStateAtlasView'));

export function supportsWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function AtlasGraphicsGuard() {
  const [supported] = useState(supportsWebGL2);
  if (supported) {
    return <Suspense fallback={<div role="status">Loading 4D Atlas…</div>}><GraphicsAtlas /></Suspense>;
  }
  return (
    <main data-testid="atlas-webgl-fallback" style={{
      maxWidth: 860, margin: '0 auto', padding: '2rem', minHeight: '65vh',
    }}>
      <h1>4D Engineering Atlas — graphics unavailable</h1>
      <p role="status">
        This browser cannot initialize a WebGL2 renderer. Terrain, Cesium 3D
        buildings, flood overlays and cinematic camera navigation were not
        loaded or verified. No terrain, building heights or water levels have
        been synthesized as a replacement.
      </p>
      <p>
        The public source and memorial pages remain available without GPU
        acceleration. Try a browser and graphics driver with WebGL2 support
        for visual mapping, or use the non-graphical pages below.
      </p>
      <nav aria-label="Non-graphical public Atlas navigation"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <Link to="/river-watch">River Watch — user-requested USGS observations</Link>
        <Link to="/memorial">Beverly Ann Tucker Memorial</Link>
        <Link to="/architecture">Evidence and engineering trust planes</Link>
      </nav>
      <p style={{ marginTop: '1.5rem', opacity: 0.85 }}>
        Engineering calculation output is not a formal FEMA determination or
        evidence of regulatory floodplain boundaries. River gauge heights
        must not be treated as NAVD88 water-surface elevations without an
        independently verified station datum.
      </p>
    </main>
  );
}
