/** HydroMT/SFINCS + MODFLOW6 + Bishop FoS ≥ 1.500 contracts. OpenMI retired. */
export const BISHOP_FOS_GATE = 1.5;
export type PhysicsBackend = 'HydroMT_SFINCS' | 'MODFLOW6' | 'BISHOP_FOS' | 'PySWMM';
export interface BishopRequest {
  sectionId: string;
  slopeRatio: number;
  phreaticNavd88Ft: number;
  materialCohesionPsf: number;
  frictionAngleDeg: number;
  unitWeightPcf: number;
}
export interface BishopResult {
  backend: 'BISHOP_FOS';
  fos: number;
  pass: boolean;
  notes: string[];
}
export function evaluateBishop(req: BishopRequest): BishopResult {
  const beta = Math.atan(1 / Math.max(req.slopeRatio, 0.1));
  const c = req.materialCohesionPsf;
  const phi = (req.frictionAngleDeg * Math.PI) / 180;
  const gamma = req.unitWeightPcf;
  const h = 10;
  const fos =
    (c + gamma * h * Math.cos(beta) * Math.cos(beta) * Math.tan(phi)) /
    Math.max(gamma * h * Math.sin(beta) * Math.cos(beta), 1e-6);
  const pass = fos >= BISHOP_FOS_GATE;
  return {
    backend: 'BISHOP_FOS',
    fos,
    pass,
    notes: pass ? [`FoS ${fos.toFixed(3)} ≥ ${BISHOP_FOS_GATE}`] : [`FoS ${fos.toFixed(3)} < ${BISHOP_FOS_GATE}`],
  };
}
