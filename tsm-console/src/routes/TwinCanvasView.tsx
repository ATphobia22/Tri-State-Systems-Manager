import CinematicHudView from './CinematicHudView';
import PoseyResilienceDashboard from './PoseyResilienceDashboard';

/**
 * Digital Twin route entry point.
 * The public-interest Posey resilience dashboard is presented first so
 * engineering capability is directly connected to community benefit.
 * The existing cinematic twin remains available below it.
 */
export default function TwinCanvasView() {
  return (
    <>
      <PoseyResilienceDashboard />
      <CinematicHudView />
    </>
  );
}
