import CinematicHudView from './CinematicHudView';

/**
 * Digital Twin route entry point.
 * The cinematic HUD is now the primary interactive twin surface while
 * backend loaders and evidence contracts remain owned by the router.
 */
export default function TwinCanvasView() {
  return <CinematicHudView />;
}
