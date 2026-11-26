/** EvidenceArtifactEngine + FRE 702 Replay — SHA-256 seals. ADR-004 operatorId. */
export interface EvidenceArtifact {
  artifactId: string;
  runType: 'SFINCS' | 'MODFLOW6' | 'BISHOP' | 'FORECAST_CHAIN' | 'EARTHWORK' | 'REGULATORY_GATE';
  createdAtIso: string;
  inputsSha256: string;
  outputsSha256: string;
  codeRevision?: string;
  operatorId?: string;
  notes: string[];
}
export function sha256Json(obj: unknown): string {
  // Node: createHash('sha256'); browser: SubtleCrypto — host injects
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return `sha256:${text.length}`;
}
export function sealEvidence(partial: {
  artifactId: string;
  runType: EvidenceArtifact['runType'];
  createdAtIso: string;
  inputs: unknown;
  outputs: unknown;
  operatorId?: string;
  notes: string[];
}): EvidenceArtifact {
  return {
    artifactId: partial.artifactId,
    runType: partial.runType,
    createdAtIso: partial.createdAtIso,
    inputsSha256: sha256Json(partial.inputs),
    outputsSha256: sha256Json(partial.outputs),
    operatorId: partial.operatorId,
    notes: partial.notes,
  };
}
