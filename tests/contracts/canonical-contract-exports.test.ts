import type { CapabilityDefinition as CanonicalDefinition, CapabilityProvider as CanonicalProvider, CapabilityRequest as CanonicalRequest, CapabilityResult as CanonicalResult } from '../../packages/contracts/src/index.ts';
import type { CapabilityDefinition as LegacyDefinition } from '../../packages/contracts/src/CapabilityDefinition.ts';
import type { CapabilityProvider as LegacyProvider } from '../../packages/contracts/src/CapabilityProvider.ts';
import type { CapabilityRequest as LegacyRequest } from '../../packages/contracts/src/CapabilityRequest.ts';
import type { CapabilityResult as LegacyResult } from '../../packages/contracts/src/CapabilityResult.ts';

const definition: CanonicalDefinition = {
  id: 'test.contracts',
  name: 'contracts',
  description: 'canonical contract',
  version: '1.0.0',
  inputSchema: {},
  outputSchema: {},
  permissions: [],
  tags: [],
};

const request: CanonicalRequest = {
  capability: definition.id,
  input: null,
  context: { requestId: 'contract-test', permissions: { allow: [] } },
};

const result: CanonicalResult = {
  success: true,
  output: null,
  provenance: [],
  citations: [],
  usage: {},
  events: [],
  provider: { providerId: 'contract-test', version: '1.0.0', attempt: 1, startedAt: new Date().toISOString() },
  traceId: 'contract-test',
};

const legacyDefinition: LegacyDefinition = definition;
const legacyRequest: LegacyRequest = request;
const legacyResult: LegacyResult = result;

export const contractCompatibility = [legacyDefinition, legacyRequest, legacyResult];
