import { useEffect, useState } from 'react';
import { MOUNT_VERNON_CITY_EVENT, type CityEvent, type CitySelection } from '../lib/mount-vernon-city-scene';

export default function MountVernonCityInspector() {
  const [scene, setScene] = useState<CityEvent>({ status: 'LOADING', reason: 'Awaiting local scene archive.' });
  const [chosen, setChosen] = useState<CitySelection | null>(null);
  useEffect(() => {
    const listener = (event: Event) => {
      const value = (event as CustomEvent<CityEvent>).detail;
      if (!value?.status) return;
      setScene(current => ({ ...current, ...value }));
      if (value.selection !== undefined) setChosen(value.selection);
    };
    window.addEventListener(MOUNT_VERNON_CITY_EVENT, listener);
    return () => window.removeEventListener(MOUNT_VERNON_CITY_EVENT, listener);
  }, []);
  return (
    <section aria-label="Mount Vernon government city-scene inspector"
      style={{ marginTop: 12, border: '1px solid #334155', borderRadius: 8, padding: 10, background: '#0f172a' }}>
      <strong>Mount Vernon · source-identity scene</strong>
      <div role="status">Scene: {scene.status} · {scene.reason}</div>
      {scene.counts && <div>Buildings: {scene.counts.buildings.toLocaleString()} · Roads: {scene.counts.roads.toLocaleString()}</div>}
      {chosen ? (
        <dl style={{ margin: '8px 0 0', overflowWrap: 'anywhere' }}>
          <dt>Government source object</dt><dd>{chosen.id}</dd>
          <dt>Type / name</dt><dd>{chosen.kind} · {chosen.name ?? 'Unlabeled'}</dd>
          <dt>Measured roof height</dt><dd>NOT EVIDENCED — no synthetic extrusion</dd>
          <dt>Source layer</dt><dd><a target="_blank" rel="noopener noreferrer" href={chosen.source}>Indiana GIO source</a></dd>
          <dt>Source feature SHA-256</dt><dd><code>{chosen.sourceFeatureSha256}</code></dd>
          <dt>Scene archive SHA-256</dt><dd><code>{chosen.sourceSceneSha256}</code></dd>
          <dt>Review state</dt><dd>{chosen.evidenceStatus} · Engineering approval: NO</dd>
        </dl>
      ) : <div>Select an outlined building or road after a verified scene archive has loaded.</div>}
      <small>Source geometry for planning context; not a boundary survey, structural model, certified elevation, or flood determination.</small>
    </section>
  );
}
