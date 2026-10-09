import type {
  CapabilityDefinition,
  CapabilityError,
  CapabilityId,
  CapabilityProvider,
  CapabilityRequest,
  CapabilityResult,
  ProviderHealth,
  SupportDecision,
} from '../../../packages/contracts/src/index.ts';
import { LocalModelAdapter } from '../../../packages/model-runtime/src/index.ts';
import {
  convertGageHeightToNavd88,
  evaluateEngineeringGate,
  evaluateLomaLagVsBfe,
  requireHumanAuthoritySeal,
} from '../../../packages/gates/src/index.ts';

const generateDef: CapabilityDefinition = {
  id: 'system.local.generate',
  name: 'Local model generation',
  description: 'Deterministic local-reference model capability with no network dependency.',
  version: '1.0.0',
  inputSchema: { type: 'object', properties: { input: {} }, required: ['input'] },
  outputSchema: { type: 'object' },
  permissions: [],
  tags: ['model', 'local', 'offline'],
};

const convertGageDef: CapabilityDefinition = {
  id: 'hydrology.convert_gage',
  name: 'Gage height to NAVD88 (fail-closed)',
  description: 'Converts gage height only when conversionPublished is true; never invents WSE.',
  version: '1.0.0',
  inputSchema: {
    type: 'object',
    properties: {
      siteNo: {},
      gageHeightFt: {},
      gageZeroNavd88Ft: {},
      conversionPublished: {},
    },
    required: ['siteNo', 'gageHeightFt', 'conversionPublished'],
  },
  outputSchema: { type: 'object' },
  permissions: [],
  tags: ['hydrology', 'local', 'offline', 'fail-closed'],
};

const gatesEvaluateDef: CapabilityDefinition = {
  id: 'gates.evaluate',
  name: 'Engineering evidence gate',
  description: 'Validates system evidence; canApprove is always false.',
  version: '1.0.0',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  permissions: [],
  tags: ['gates', 'local', 'offline'],
};

const lomaLagBfeDef: CapabilityDefinition = {
  id: 'gates.loma_lag_bfe',
  name: 'LOMA LAG vs BFE helper',
  description: 'LAG >= BFE freeboard helper; never files LOMA.',
  version: '1.0.0',
  inputSchema: {
    type: 'object',
    properties: { lagFtNavd88: {}, bfeFtNavd88: {} },
    required: ['lagFtNavd88', 'bfeFtNavd88'],
  },
  outputSchema: { type: 'object' },
  permissions: [],
  tags: ['fema', 'local', 'offline'],
};

const humanSealDef: CapabilityDefinition = {
  id: 'gates.human_authority',
  name: 'Human authority seal check',
  description: 'Requires reviewer identity, reason, and timestamp when human_authorized.',
  version: '1.0.0',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  permissions: [],
  tags: ['governance', 'local', 'offline'],
};

function resultShell<TOutput = unknown>(
  request: CapabilityRequest,
  providerId: string,
  version: string,
  output: TOutput | undefined,
  success = true,
  error?: CapabilityError,
): CapabilityResult<TOutput> {
  return {
    success,
    output,
    provenance: [
      {
        sourceType: 'provider',
        sourceId: providerId,
        provider: providerId,
        version,
        timestamp: new Date().toISOString(),
      },
    ],
    citations: [],
    usage: {},
    events: [],
    provider: {
      providerId,
      version,
      attempt: 1,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
    traceId: request.context.requestId,
    ...(error ? { error } : {}),
  };
}

export class LocalCapabilityProvider implements CapabilityProvider {
  readonly id = 'provider.local';
  readonly version = '1.1.1';
  readonly capabilities = [generateDef, convertGageDef, gatesEvaluateDef, lomaLagBfeDef, humanSealDef];
  private readonly adapter: LocalModelAdapter;

  constructor(model = 'local-reference') {
    this.adapter = new LocalModelAdapter(model);
  }

  async health(): Promise<ProviderHealth> {
    return { healthy: true, latencyMs: 0, errorRate: 0, lastChecked: new Date().toISOString() };
  }

  async supports(capability: CapabilityId, input: unknown): Promise<SupportDecision> {
    const known = this.capabilities.some((c) => c.id === capability);
    if (!known) return { supported: false };
    if (capability === generateDef.id) {
      return {
        supported: typeof input === 'object' && input !== null && 'input' in input,
      };
    }
    return { supported: true };
  }

  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    const traceId = request.context.requestId;
    switch (request.capability) {
      case generateDef.id: {
        const input = request.input as { input: unknown };
        const chunks: unknown[] = [];
        for await (const chunk of this.adapter.generate(input.input)) {
          chunks.push(chunk);
        }
        return resultShell(request, this.id, this.version, { chunks });
      }
      case convertGageDef.id: {
        const input = request.input as {
          siteNo: string;
          gageHeightFt: number;
          gageZeroNavd88Ft: number | null;
          conversionPublished: boolean;
        };
        const converted = convertGageHeightToNavd88({
          siteNo: input.siteNo,
          gageHeightFt: input.gageHeightFt,
          gageZeroNavd88Ft: input.gageZeroNavd88Ft ?? null,
          conversionPublished: input.conversionPublished === true,
        });
        return resultShell(
          request,
          this.id,
          this.version,
          converted,
          converted.ok,
          converted.ok
            ? undefined
            : {
                code: 'VALIDATION_FAILED',
                message: converted.reason,
                retryable: false,
                traceId,
              },
        );
      }
      case gatesEvaluateDef.id: {
        const gate = evaluateEngineeringGate((request.input ?? {}) as object);
        return resultShell(request, this.id, this.version, gate);
      }
      case lomaLagBfeDef.id: {
        const input = request.input as { lagFtNavd88: number; bfeFtNavd88: number };
        return resultShell(request, this.id, this.version, evaluateLomaLagVsBfe(input));
      }
      case humanSealDef.id: {
        const seal = requireHumanAuthoritySeal(request.input as object);
        return resultShell(
          request,
          this.id,
          this.version,
          seal,
          seal.ok,
          seal.ok
            ? undefined
            : {
                code: 'FORBIDDEN',
                message: seal.reason,
                retryable: false,
                traceId,
              },
        );
      }
      default:
        return resultShell(request, this.id, this.version, undefined, false, {
          code: 'NOT_FOUND',
          message: `Local provider does not support ${request.capability}`,
          retryable: false,
          traceId,
        });
    }
  }
}
