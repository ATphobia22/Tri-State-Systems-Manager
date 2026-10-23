/**
 * FloodSimulator — CI-safe shell while full module is restored.
 * WebGL may be unavailable; never fabricate terrain.
 * Axiom: Technology informs people; it does not silently govern people.
 */
import { useState } from 'react';

export default function FloodSimulator(): React.JSX.Element {
  const [notice] = useState(
    'Flood simulator module is being restored. Human authority remains final.',
  );
  return (
    <div role="status" style={{ padding: 16 }}>
      <p>
        Technology informs people; it does not silently govern people. Human
        authority remains final.
      </p>
      <p>{notice}</p>
    </div>
  );
}
