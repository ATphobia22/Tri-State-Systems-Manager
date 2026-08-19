/**
 * 3D Digital Twin canvas foundation — 13101 Bonebank Road
 * React Three Fiber + procedural terrain proxy
 * Elevations driven by SITE constants (BFE/LAG/FFE/Berm)
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Grid, Text } from '@react-three/drei';
import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import { useMemo } from 'react';
import { AuthorityBadge, SimulationDemoBanner } from '../components/AuthorityBadge';

function Terrain({ bfe, lag, ffe, berm }: { bfe: number; lag: number; ffe: number; berm: number }) {
  // Relative heights (ft above BFE for visualization scale)
  const lagH = (lag - bfe) * 0.15;
  const ffeH = (ffe - bfe) * 0.15;
  const bermH = (berm - bfe) * 0.15;

  return (
    <group>
      {/* Ground plane at BFE */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#1e3a2f" />
      </mesh>
      {/* Structure volume at FFE */}
      <mesh position={[0, ffeH / 2, 0]} castShadow>
        <boxGeometry args={[4, ffeH, 3]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>
      {/* Berm ridge */}
      <mesh position={[8, bermH / 2, 0]} castShadow>
        <boxGeometry args={[1.5, bermH, 20]} />
        <meshStandardMaterial color="#a78bfa" />
      </mesh>
      {/* LAG marker */}
      <mesh position={[-6, lagH, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.3} />
      </mesh>
      <Grid infiniteGrid fadeDistance={40} sectionColor="#334155" cellColor="#1e293b" />
    </group>
  );
}

function StageWater({ stageFt, bfe }: { stageFt: number | null; bfe: number }) {
  if (stageFt == null) return null;
  const h = Math.max(0, (stageFt - (bfe - 20)) * 0.02); // visualization scale
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Math.min(h, 3), -12]}>
      <planeGeometry args={[50, 20]} />
      <meshStandardMaterial color="#0ea5e9" transparent opacity={0.45} />
    </mesh>
  );
}

export default function TwinCanvasView() {
  const data = useLoaderData() as MapTwinLoaderData;
  const elev = data.site.elevations;

  const statusColor = useMemo(() => {
    switch (data.stage.floodCategory) {
      case 'major':
      case 'moderate':
        return '#f87171';
      case 'minor':
      case 'action':
        return '#fbbf24';
      default:
        return '#34d399';
    }
  }, [data.stage.floodCategory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {data.stage.source === 'MOCK' && <div style={{ padding: '0.5rem 1.25rem' }}><SimulationDemoBanner /></div>}
      <div style={{ padding: '0.75rem 1.25rem', background: '#020617', borderBottom: '1px solid #1e293b', display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem' }}>
        <span style={{ color: '#38bdf8', fontWeight: 700 }}>{data.site.address}</span>
        <span style={{ color: '#64748b' }}>APN {data.site.apn}</span>
        <span style={{ color: '#94a3b8' }}>
          BFE {elev.bfe_ft} · LAG {elev.lag_ft} (+{elev.clearanceAboveBfe_ft}) · FFE {elev.ffe_ft} · Berm {elev.bermCrest_ft}
        </span>
        <AuthorityBadge authority_class={data.stage.source === 'MOCK' ? 'SIMULATION_DEMO' : 'OBSERVATION'} is_simulation_demo={data.stage.source === 'MOCK'} />
        <span style={{ color: statusColor }}>
          Stage: {data.stage.source} {data.stage.value_ft != null ? `${data.stage.value_ft} ft` : 'n/a'} ({data.stage.floodCategory})
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas shadows camera={{ position: [18, 14, 18], fov: 45 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 20, 5]} intensity={1.1} castShadow />
          <Sky sunPosition={[100, 40, 50]} />
          <Terrain bfe={elev.bfe_ft} lag={elev.lag_ft} ffe={elev.ffe_ft} berm={elev.bermCrest_ft} />
          <StageWater stageFt={data.stage.value_ft} bfe={elev.bfe_ft} />
          <OrbitControls maxPolarAngle={Math.PI / 2.1} />
        </Canvas>
      </div>
      <div style={{ padding: '0.5rem 1.25rem', fontSize: '0.7rem', color: '#475569', background: '#020617' }}>
        Visualization only · Not a regulatory model · Human authority required for LOMA / No-Rise · OpenMI coupling deferred to sealed solvers
      </div>
    </div>
  );
}
