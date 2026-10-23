/**
 * FloodSimulator.tsx — Level-5 flood simulator (module restored; full UI in follow-up).
 * createFloodRenderer may return null when WebGL is unavailable.
 * Axiom: Technology informs people; it does not silently govern people.
 */
import { useEffect, useRef, useState } from 'react';
import {
  createFloodRenderer,
  listScenarios,
  type FloodRenderer,
  type FloodSimScenario,
} from '../lib/flood-sim/index';

export default function FloodSimulator(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarios] = useState<FloodSimScenario[]>(() => listScenarios());
  const rendererRef = useRef<FloodRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createFloodRenderer(canvas, 'medium');
    if (!renderer) {
      setError('WebGL unavailable — flood simulator cannot initialize on this device.');
      return;
    }
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  return (
    <div role="region" aria-label="Flood simulator">
      <p>
        Technology informs people; it does not silently govern people. Human
        authority remains final.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <canvas ref={canvasRef} style={{ width: '100%', height: 360 }} />
      <p>{scenarios.length} scenarios available.</p>
    </div>
  );
}
