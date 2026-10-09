/**
 * GlobeView route — self-hosted CesiumJS 3D globe.
 *
 * Zero Cesium ion: the globe, terrain, and building tiles all load from
 * this deployment's own URLs. See CesiumGlobeView for the self-hosting
 * contract and per-layer availability handling.
 */

import CesiumGlobeView from '../components/CesiumGlobeView';

export default function GlobeView() {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 64px)' }}>
      <CesiumGlobeView />
    </div>
  );
}
