import { Suspense, useEffect, useRef, useState } from 'react';
import { Activity, Compass, Cpu, Database, Layers, Lock, Map, Radio, RefreshCw, Shield, Users, Video, Zap } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';

const CONFIG = {
  PROJECT_NODE: '13101 Bonebank Road, Point Township, Posey County, Indiana',
  CRS: 'EPSG:2966 (NAD83 / Indiana West ftUS)',
  VERTICAL_DATUM: 'NAVD88',
  BFE_FT: 375,
  LAG_FT: 377.2,
  FFE_FT: 382.5,
  BERM_CREST_FT: 379.8,
  VERIFIED_APN: '65-19-08-100-008.001-010',
  USGS_STATION: '03378500',
  COMPENSATORY_STORAGE_RATIO: 1.2,
} as const;

type Tab = 'twin' | 'heritage' | 'medical' | 'power' | 'cinematic';
type Finding = 'NOMINAL' | 'BFE_EXCEEDED' | 'CRITICAL_INUNDATION';

function CinematicWaterPlane({ waterStageFt }: { waterStageFt: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const targetY = Math.max(0, (waterStageFt - CONFIG.BFE_FT) * 0.8) + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.08);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000, 64, 64]} />
      <meshPhysicalMaterial color="#0ea5e9" roughness={0.1} metalness={0.2} transmission={0.9} ior={1.333} transparent opacity={0.85} />
    </mesh>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#060a17',
  border: '1px solid #1e293b',
  borderRadius: 16,
  boxShadow: '0 20px 45px rgba(0,0,0,0.28)',
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(0,0,0,.4)', border: '1px solid #1e293b', borderRadius: 10, padding: 12 }}>
      <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div style={{ color: '#38bdf8', fontWeight: 800, fontFamily: 'ui-monospace,monospace', marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function CinematicHudView() {
  const [activeTab, setActiveTab] = useState<Tab>('twin');
  const [waterStageFt, setWaterStageFt] = useState(376.4);
  const [dischargeCfs, setDischargeCfs] = useState(128000);
  const [finding, setFinding] = useState<Finding>('NOMINAL');
  const [logs, setLogs] = useState<string[]>([
    '[INIT] Tri-State Systems Manager cinematic subsystem initialized.',
    '[EVIDENCE] Evidence ledger interface active; values shown here are model/UI state until sealed by backend.',
    '[GEODESY] EPSG:2966 horizontal CRS / NAVD88 vertical datum labels loaded.',
    '[HYDRAULICS] Hydraulic visualization linked to local simulation state.',
  ]);

  const addLog = (message: string, critical = false) => {
    const timestamp = new Date().toISOString().slice(11, 19);
    setLogs((previous) => [`[${timestamp}Z] ${critical ? '[CRITICAL] ' : ''}${message}`, ...previous].slice(0, 50));
  };

  useEffect(() => {
    const next: Finding = waterStageFt >= CONFIG.LAG_FT ? 'CRITICAL_INUNDATION' : waterStageFt >= CONFIG.BFE_FT ? 'BFE_EXCEEDED' : 'NOMINAL';
    if (next === finding) return;
    setFinding(next);
    if (next === 'CRITICAL_INUNDATION') addLog(`Modeled stage ${waterStageFt.toFixed(2)} ft exceeds LAG ${CONFIG.LAG_FT.toFixed(2)} ft.`, true);
    else if (next === 'BFE_EXCEEDED') addLog(`Modeled stage ${waterStageFt.toFixed(2)} ft exceeds BFE ${CONFIG.BFE_FT.toFixed(2)} ft.`);
    else addLog(`Modeled stage ${waterStageFt.toFixed(2)} ft returned below BFE.`);
  }, [waterStageFt, finding]);

  const nav: Array<{ id: Tab; icon: JSX.Element; label: string }> = [
    { id: 'twin', icon: <Map size={16} />, label: '3D Digital Twin Viewport' },
    { id: 'heritage', icon: <Users size={16} />, label: 'Family Lineage Vault' },
    { id: 'medical', icon: <Activity size={16} />, label: 'Medical Integration' },
    { id: 'power', icon: <Zap size={16} />, label: 'Tucker Power & PCM' },
    { id: 'cinematic', icon: <Video size={16} />, label: 'Natron / Blender Pipeline' },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#010206', color: '#e2e8f0', display: 'flex', fontFamily: 'system-ui,sans-serif' }}>
      <aside style={{ width: 270, background: '#060a17', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.12em', color: '#22d3ee', textTransform: 'uppercase', fontFamily: 'ui-monospace,monospace', margin: 0 }}>Tri-State Systems Manager</h1>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>Cinematic HUD & Ingestion Console</div>
          </div>
          <nav style={{ display: 'grid', gap: 6 }}>
            {nav.map((item) => {
              const active = activeTab === item.id;
              return <button key={item.id} onClick={() => { setActiveTab(item.id); addLog(`Switched viewport context to ${item.label}.`); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 13px', borderRadius: 11, border: active ? '1px solid rgba(34,211,238,.3)' : '1px solid transparent', background: active ? 'rgba(34,211,238,.08)' : 'transparent', color: active ? '#22d3ee' : '#94a3b8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer', textAlign: 'left' }}>{item.icon}{item.label}</button>;
            })}
          </nav>
        </div>
        <div style={{ padding: 14, borderTop: '1px solid #1e293b', background: 'rgba(0,0,0,.4)' }}>
          <div style={{ background: '#000', border: '1px solid #1e293b', borderRadius: 9, padding: 11, height: 190, overflow: 'auto', fontFamily: 'ui-monospace,monospace', fontSize: 9 }}>
            <div style={{ color: '#64748b', fontWeight: 800, borderBottom: '1px solid #1e293b', paddingBottom: 6, marginBottom: 8 }}>EVIDENCE LEDGER STREAM</div>
            {logs.map((log, index) => <div key={`${log}-${index}`} style={{ color: log.includes('[CRITICAL]') ? '#fb7185' : '#cbd5e1', paddingBottom: 6 }}>{log}</div>)}
          </div>
        </div>
      </aside>

      <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 64, flexShrink: 0, background: '#090e1f', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.1em', fontFamily: 'ui-monospace,monospace' }}>{activeTab.toUpperCase()} SUBSYSTEM MAPPING</div>
            <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'ui-monospace,monospace', marginTop: 3 }}>Anchor: {CONFIG.PROJECT_NODE}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontFamily: 'ui-monospace,monospace' }}>
            <div style={{ padding: '6px 10px', border: '1px solid #14532d', borderRadius: 8, background: 'rgba(5,46,22,.35)' }}><div style={{ fontSize: 8, color: '#64748b' }}>EVIDENCE AUTHORITY</div><div style={{ fontSize: 10, color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={10} /> BACKEND-SEAL REQUIRED</div></div>
            <div style={{ padding: '6px 10px', border: `1px solid ${finding === 'CRITICAL_INUNDATION' ? '#7f1d1d' : '#0c4a6e'}`, borderRadius: 8, background: 'rgba(8,47,73,.35)', minWidth: 125 }}><div style={{ fontSize: 8, color: '#64748b' }}>MODELED STAGE</div><div style={{ fontSize: 12, color: finding === 'CRITICAL_INUNDATION' ? '#fb7185' : '#38bdf8', fontWeight: 800 }}>{waterStageFt.toFixed(2)} FT</div></div>
          </div>
        </header>

        <main style={{ flex: 1, minHeight: 0, padding: 20, overflow: 'auto' }}>
          {activeTab === 'twin' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 14, minHeight: 520 }}>
                <div style={{ ...panelStyle, overflow: 'hidden', position: 'relative', minHeight: 520 }}>
                  <div style={{ position: 'absolute', zIndex: 5, top: 14, left: 14, background: 'rgba(0,0,0,.82)', border: '1px solid rgba(34,211,238,.3)', borderRadius: 8, padding: '6px 9px', color: '#22d3ee', fontSize: 9, fontFamily: 'ui-monospace,monospace', fontWeight: 800 }}>THREE.JS / WEBGL SPATIAL RENDER · {CONFIG.CRS}</div>
                  <div style={{ position: 'absolute', zIndex: 5, bottom: 14, left: 14, background: 'rgba(0,0,0,.82)', border: '1px solid #1e293b', borderRadius: 8, padding: 9, fontSize: 9, fontFamily: 'ui-monospace,monospace', lineHeight: 1.7 }}>
                    <div>BFE: <b style={{ color: '#fbbf24' }}>{CONFIG.BFE_FT.toFixed(2)} FT</b></div><div>LAG: <b style={{ color: '#34d399' }}>{CONFIG.LAG_FT.toFixed(2)} FT</b></div><div>FFE: <b style={{ color: '#fb7185' }}>{CONFIG.FFE_FT.toFixed(2)} FT</b></div>
                  </div>
                  <Canvas camera={{ position: [0, 60, 180], fov: 45 }} shadows gl={{ antialias: true }} style={{ height: '100%', minHeight: 520 }}>
                    <color attach="background" args={['#020409']} /><ambientLight intensity={0.5} /><directionalLight castShadow position={[100, 200, 50]} intensity={2} /><Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0.2} azimuth={0.25} />
                    <Suspense fallback={null}><CinematicWaterPlane waterStageFt={waterStageFt} /><Grid infiniteGrid fadeDistance={400} sectionColor="#1e293b" cellColor="#0f172a" position={[0, -0.1, 0]} /></Suspense>
                    <OrbitControls maxPolarAngle={Math.PI / 2.05} minDistance={20} maxDistance={400} />
                  </Canvas>
                </div>

                <div style={{ ...panelStyle, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.1em', display: 'flex', gap: 8, alignItems: 'center' }}><Activity size={16} color="#22d3ee" /> Simulation Control HUD</h3>
                  <div style={{ background: 'rgba(0,0,0,.35)', border: '1px solid #1e293b', borderRadius: 11, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'ui-monospace,monospace', fontSize: 11 }}><span style={{ color: '#94a3b8' }}>Modeled WSE / stage vector</span><b style={{ color: '#22d3ee' }}>{waterStageFt.toFixed(2)} FT</b></div>
                    <input aria-label="Modeled water stage" type="range" min="365" max="385" step="0.1" value={waterStageFt} onChange={(event) => { const value = Number(event.target.value); setWaterStageFt(value); setDischargeCfs(Math.max(0, 128000 + (value - 375) * 22000)); }} style={{ width: '100%', marginTop: 15, accentColor: '#22d3ee' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: 9, fontFamily: 'ui-monospace,monospace' }}><span>Low flow</span><span>Major flood</span></div>
                  </div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    <Metric label="Modeled discharge" value={`${dischargeCfs.toLocaleString()} CFS`} />
                    <Metric label="Status finding" value={finding} />
                    <Metric label="Compensatory storage" value={`${CONFIG.COMPENSATORY_STORAGE_RATIO.toFixed(2)}x · configured policy value`} />
                  </div>
                  <button onClick={() => { setWaterStageFt(375); setDischargeCfs(128000); addLog('Reset hydraulic simulation to configured BFE baseline.'); }} style={{ marginTop: 'auto', padding: 11, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#cbd5e1', fontWeight: 800, cursor: 'pointer' }}><RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} />Reset Baseline State</button>
                </div>
              </div>
              <div style={{ ...panelStyle, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
                <Metric label={`USGS ${CONFIG.USGS_STATION} stage display`} value={`${(waterStageFt - 353.92).toFixed(2)} FT · modeled`} />
                <Metric label="Posey County parcel" value={`APN ${CONFIG.VERIFIED_APN}`} />
                <Metric label="Vertical reference" value={CONFIG.VERTICAL_DATUM} />
                <Metric label="Evidence state" value="MODEL-ONLY · NOT SEALED" />
              </div>
            </div>
          )}

          {activeTab === 'heritage' && <SubsystemPanel icon={<Users size={24} />} title="Digital Lineage Twin & Family Heritage Vault" description="A protected interface for authorized lineage and property records. The frontend does not itself establish legal ownership, identity, or evidentiary authenticity."><Metric label="Site anchor" value={CONFIG.PROJECT_NODE} /><Metric label="Parcel" value={CONFIG.VERIFIED_APN} /><Metric label="CRS / vertical datum" value={`${CONFIG.CRS} / ${CONFIG.VERTICAL_DATUM}`} /></SubsystemPanel>}
          {activeTab === 'medical' && <SubsystemPanel icon={<Activity size={24} />} title="Clinical Intelligence & Research Engine" description="Integration boundary for authorized clinical research, RAG, multi-omics workflows, and HIPAA-controlled services. Clinical decisions remain outside the UI and require authorized professionals."><Metric label="Clinical data boundary" value="PHI/PII ISOLATED" /><Metric label="Research mode" value="DE-IDENTIFIED / CONTROLLED" /><Metric label="Human authority" value="REQUIRED" /></SubsystemPanel>}
          {activeTab === 'power' && <SubsystemPanel icon={<Zap size={24} />} title="Tucker Power & Thermal PCM Battery" description="Telemetry visualization boundary for industrial energy and thermal storage systems. Values are placeholders until authenticated Modbus/SCADA ingestion supplies observations."><Metric label="Telemetry state" value="AWAITING AUTHENTICATED FEED" /><Metric label="Protocol boundary" value="MODBUS / SCADA" /><Metric label="Safety mode" value="FAIL-CLOSED" /></SubsystemPanel>}
          {activeTab === 'cinematic' && <SubsystemPanel icon={<Video size={24} />} title="Natron & Blender Cinematic Pipeline" description="Production control surface for ACEScg, OpenEXR, simulation passes, and render-farm orchestration. Dispatch remains a backend-authorized operation."><Metric label="Color management" value="ACESCG / 32-BIT LINEAR" /><Metric label="Render format" value="OPENEXR MULTI-PASS" /><button onClick={() => addLog('Render dispatch requested; backend authorization is required before execution.')} style={{ padding: 12, borderRadius: 10, border: '1px solid #0e7490', background: '#0891b2', color: '#001018', fontWeight: 900, cursor: 'pointer' }}><Layers size={17} style={{ verticalAlign: 'middle', marginRight: 7 }} />Request Render-Farm Dispatch</button></SubsystemPanel>}
        </main>
      </section>
    </div>
  );
}

function SubsystemPanel({ icon, title, description, children }: { icon: JSX.Element; title: string; description: string; children: React.ReactNode }) {
  return <div style={{ ...panelStyle, padding: 28, minHeight: 520 }}><h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, textTransform: 'uppercase', letterSpacing: '.06em' }}>{icon}{title}</h2><p style={{ color: '#94a3b8', maxWidth: 850, lineHeight: 1.7, fontSize: 13 }}>{description}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 30 }}>{children}</div></div>;
}
