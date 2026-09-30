import type { CapabilityDefinition, CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ProviderHealth, SupportDecision } from '../../contracts/src/index.ts';
import { evaluateEngineeringGate } from '../../gates/src/index.ts';

const DEFINITION: CapabilityDefinition = {
  id: 'tsm.engineering.evidence-gate.evaluate' as CapabilityId,
  name: 'Engineering Evidence Gate',
  description: 'Deterministically validates the seven required engineering evidence modules and fails closed before solver execution.',
  version: '1.0.0',
  inputSchema: { type:'object', required:['controlledSurvey','geotechnicalInvestigation','groundwaterEvidence','qualifiedFill','laboratoryResults','hydraulicBoundaryConditions','approvedProjectGeometry','evidence'] },
  outputSchema: { type:'object', required:['state','validation','canCompute','canApprove'] },
  permissions: ['tsm:engineering'],
  tags: ['tsm','engineering','evidence','deterministic','fail-closed'],
};

export class EvidenceGateProvider implements CapabilityProvider {
  readonly id = 'tsm-evidence-gate';
  readonly version = '1.0.0';
  readonly capabilities = [DEFINITION] as const;

  async health(): Promise<ProviderHealth> {
    return { healthy:true, latencyMs:0, errorRate:0, lastChecked:new Date().toISOString() };
  }

  async supports(capability: CapabilityId): Promise<SupportDecision> {
    return { supported: capability === DEFINITION.id };
  }

  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    const started = new Date().toISOString();
    const gate = evaluateEngineeringGate(request.input as never);
    return {
      success: true,
      output: gate,
      provenance: [],
      citations: [],
      usage: { deterministic:1 },
      events: [{ type:'capability.completed', traceId:request.context.requestId, timestamp:new Date().toISOString(), capability:request.capability }],
      provider: { providerId:this.id, version:this.version, attempt:1, startedAt:started, completedAt:new Date().toISOString() },
      traceId:request.context.requestId,
    };
  }
}
