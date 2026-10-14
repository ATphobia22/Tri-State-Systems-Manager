/**
 * GlobeView route — 3D globe using MapLibre GL (open source, no Cesium).
 *
 * The 3D buildings and terrain render via MapLibre's 3D capabilities.
 * All data loads from this deployment's own URLs — no external services.
 */

import TriStateDigitalTwinMap from '../components/TriStateDigitalTwinMap';

export default function GlobeView() {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 64px)' }}>
      <TriStateDigitalTwinMap />
    </div>
  );
}
