import type { CSSProperties } from 'react';
/** Civic infrastructure sketch tools. Every route is a local, unverified proposal. */
type UtilityKind = 'sewer' | 'water' | 'power' | 'broadband' | 'stormwater' | 'road' | 'berm' | 'retention';
type Utility = { id: UtilityKind; symbol: string; label: string; purpose: string; color: string };
const utilities: readonly Utility[] = [
  { id: 'sewer', symbol: '◉', label: 'Sanitary sewer', purpose: 'Collection routes, lift-station concepts', color: '#b58aff' },
  { id: 'water', symbol: '◈', label: 'Drinking water', purpose: 'Distribution and main-loop concepts', color: '#35b5ed' },
  { id: 'power', symbol: 'ϟ', label: 'Electric power', purpose: 'Feeder corridors and resilience', color: '#ffc04f' },
  { id: 'broadband', symbol: '⌁', label: 'Internet / fiber', purpose: 'Backbone and service corridors', color: '#ec82cb' },
  { id: 'stormwater', symbol: '≈', label: 'Stormwater', purpose: 'Drainage and outfall concepts', color: '#4bceae' },
  { id: 'road', symbol: '━', label: 'Roads', purpose: 'Access and emergency rerouting', color: '#f28f5b' },
  { id: 'berm', symbol: '⌃', label: 'Flood berm', purpose: 'Conceptual protection alignments', color: '#86d46e' },
  { id: 'retention', symbol: '▱', label: 'Retention', purpose: 'Draw a potential holding area', color: '#4daaca' },
];
export type CivicUtilityMode = UtilityKind;
export default function MountVernonUtilityDesk({ selected, onSelect, onCancel, vertexCount }: {
  selected: UtilityKind | null;
  onSelect: (next: UtilityKind) => void;
  onCancel: () => void;
  vertexCount: number;
}): JSX.Element {
  return <section className="tsm-civic-utilities" aria-label="Mount Vernon utility planning tools">
    <div className="tsm-civic-section-title">
      <span className="tsm-civic-eyebrow">MOUNT VERNON · PUBLIC WORKS</span>
      <h2>Plan the city, layer by layer</h2>
      <p>Select a project type and draw a draft route on the map. Explore alternatives before engaging utilities, property owners, or licensed engineers.</p>
    </div>
    <div className="tsm-civic-utility-grid" role="group" aria-label="Choose a utility or infrastructure planning sketch">
      {utilities.map((item) => <button key={item.id} type="button"
        className={selected === item.id ? 'tsm-civic-utility selected' : 'tsm-civic-utility'}
        aria-pressed={selected === item.id} title={item.purpose}
        style={{ '--utility-accent': item.color } as CSSProperties}
        onClick={() => onSelect(item.id)}>
        <span className="tsm-civic-utility-symbol" aria-hidden="true">{item.symbol}</span>
        <span><strong>{item.label}</strong><small>{item.purpose}</small></span>
      </button>)}
    </div>
    <nav className="tsm-civic-authority-links" aria-label="Official local utility planning resources">
      <a href="https://www.mountvernonin.gov/225/Wastewater-Department" target="_blank" rel="noopener noreferrer">Mount Vernon wastewater department</a>
      <a href="https://www.mountvernonin.gov/215/Water-Department" target="_blank" rel="noopener noreferrer">Mount Vernon water department</a>
      <a href="https://www.in.gov/indianabroadband/maps/" target="_blank" rel="noopener noreferrer">Indiana broadband coverage maps</a>
      <a href="https://indiana811.org/" target="_blank" rel="noopener noreferrer">Indiana 811: locate before excavation</a>
    </nav>
    <div className="tsm-civic-draft-status" role="status" aria-live="polite">
      {selected
        ? <><strong>{utilities.find((item) => item.id === selected)?.label} draft active.</strong> Click the map to add points ({vertexCount} placed). Complete and export the sketch from the map toolbox. <button type="button" onClick={onCancel}>Cancel draft</button></>
        : <><strong>No sketch active.</strong> Utility locations are not asserted: drawings are proposals, not surveyed underground lines or permitted designs.</>}
    </div>
    <p className="tsm-civic-excavation-note">Concept drawings do not identify buried facilities. Actual excavation requires authorized utility coordination and Indiana 811 notification; no map here is a utility locate.</p>
  </section>;
}
