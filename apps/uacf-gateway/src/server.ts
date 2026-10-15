import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { CapabilityRegistry } from '../../../packages/registry/src/CapabilityRegistry.ts';
import { CapabilityRouter } from '../../../packages/router/src/CapabilityRouter.ts';
import { StaticPolicyEngine } from '../../../packages/policy/src/PolicyEngine.ts';
import { UniversalCapabilityFabric } from '../../../packages/core/src/UniversalCapabilityFabric.ts';
import { EchoProvider } from '../../../packages/provider-runtime/src/EchoProvider.ts';
import { TsmEngineeringProvider } from '../../../packages/provider-runtime/src/TsmEngineeringProvider.ts';
import { McpCapabilityProvider } from '../../../packages/mcp/src/McpCapabilityProvider.ts';
import { OpenApiCapabilityProvider } from '../../../packages/openapi/src/OpenApiCapabilityProvider.ts';
import { EvidenceGateProvider } from '../../../packages/provider-runtime/src/EvidenceGateProvider.ts';
import { LocalCapabilityProvider } from '../../../providers/local/src/index.ts';
import { createJob, getJob, pruneJobs } from './jobs.ts';
import { authenticateGatewayRequest, createGatewaySecurityConfig } from './security.ts';
import type { CapabilityRequest, PermissionSet } from '../../../packages/contracts/src/index.ts';

const HOST = process.env.UACF_HOST ?? '127.0.0.1';
const PORT = Number.parseInt(process.env.UACF_PORT ?? '8790', 10);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const CORS_ORIGIN = process.env.UACF_CORS_ORIGIN ?? 'http://localhost:3000';
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('UACF_PORT must be an integer between 1 and 65535');
}
const security = createGatewaySecurityConfig(HOST);
const registry = new CapabilityRegistry();
registry.register(new EchoProvider());
registry.register(new TsmEngineeringProvider());
registry.register(new EvidenceGateProvider());
registry.register(new LocalCapabilityProvider());

const mcpEndpoints = String(process.env.UACF_MCP_ENDPOINTS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
for (const endpoint of mcpEndpoints) {
  try {
    const provider = new McpCapabilityProvider({ endpoint });
    await provider.discover();
    registry.register(provider);
  } catch (error) {
    // An unavailable optional provider must not prevent local capabilities from starting.
    console.error('[UACF] MCP provider unavailable', { endpoint, error: String(error) });
  }
}

const openapiSpec = process.env.UACF_OPENAPI_SPEC_JSON;
if (openapiSpec) {
  try {
    registry.register(new OpenApiCapabilityProvider(JSON.parse(openapiSpec) as Record<string, unknown>, 'env'));
  } catch (error) {
    console.error('[UACF] OpenAPI spec rejected', { error: String(error) });
  }
}

const policyRules = [
  { capability: 'test.*', allow: true, permissions: [] },
  { capability: 'tsm.engineering.*', allow: true, permissions: ['tsm:engineering'] },
  { capability: 'tsm.hydraulic.*', allow: true, permissions: ['tsm:hydraulic'] },
  { capability: 'tsm.autonomy.*', allow: true, permissions: ['tsm:autonomy'] },
  { capability: 'tsm.hydrologic.*', allow: true, permissions: ['tsm:hydrologic'] },
  { capability: 'tsm.geospatial.*', allow: true, permissions: ['tsm:geospatial'] },
  { capability: '*', allow: false, permissions: [] },
] as const;
const fabric = new UniversalCapabilityFabric(
  new CapabilityRouter(registry, new StaticPolicyEngine(policyRules)),
);

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  response.end(body);
}

function sendError(response: ServerResponse, status: number, code: string, message: string): void {
  sendJson(response, status, { success: false, error: { code, message } });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error('Request body exceeds 2 MiB limit'), { statusCode: 413 });
    }
    chunks.push(buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON'), { statusCode: 400 });
  }
}

function buildRequest(value: Record<string, unknown>, permissions: PermissionSet): CapabilityRequest {
  const capability = value.capability;
  if (typeof capability !== 'string' || capability.length === 0 || capability.length > 200) {
    throw Object.assign(new Error('capability must be a non-empty string of at most 200 characters'), { statusCode: 400 });
  }
  const options = value.options && typeof value.options === 'object' && !Array.isArray(value.options)
    ? value.options as CapabilityRequest['options']
    : undefined;
  return {
    capability: capability as CapabilityRequest['capability'],
    input: value.input,
    context: { requestId: randomUUID(), permissions },
    options,
  };
}

function startSse(response: ServerResponse): void {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-content-type-options': 'nosniff',
  });
  response.write(': connected\n\n');
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
  response.setHeader('access-control-allow-origin', CORS_ORIGIN);
  response.setHeader('vary', 'Origin');

  if (method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
      'access-control-max-age': '600',
    });
    response.end();
    return;
  }

  if (url.pathname === '/v1/health' && method === 'GET') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'uacf-gateway',
      version: '0.3.0',
      providers: registry.list().map((provider) => provider.id),
    });
    return;
  }

  const permissionSet = authenticateGatewayRequest(request, security);
  if (!permissionSet) {
    sendError(response, 401, 'UNAUTHENTICATED', 'A valid bearer token is required for this gateway.');
    return;
  }

  if (method === 'GET' && url.pathname === '/v1/providers') {
    const providers = await Promise.all(registry.list().map(async (provider) => ({
      id: provider.id,
      version: provider.version,
      capabilities: provider.capabilities.map((capability) => capability.id),
      health: await provider.health(),
    })));
    sendJson(response, 200, { providers });
    return;
  }
  if (method === 'GET' && url.pathname === '/v1/capabilities') {
    const context = { requestId: randomUUID(), permissions: permissionSet };
    sendJson(response, 200, { capabilities: await fabric.router.describeAvailableCapabilities(context) });
    return;
  }
  if (method === 'GET' && url.pathname === '/v1/routes') {
    sendJson(response, 200, {
      routes: [
        'GET /v1/health', 'GET /v1/providers', 'GET /v1/capabilities', 'GET /v1/routes',
        'POST /v1/execute', 'POST /v1/stream', 'GET /v1/jobs/:id', 'GET /v1/jobs/:id/events',
      ],
    });
    return;
  }

  if (method === 'POST' && (url.pathname === '/v1/execute' || url.pathname === '/v1/stream')) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      sendError(response, 400, 'INVALID_INPUT', 'Request body must be a JSON object.');
      return;
    }
    const requestBody = payload as Record<string, unknown>;
    const capabilityRequest = buildRequest(requestBody, permissionSet);
    const options = capabilityRequest.options as Record<string, unknown> | undefined;
    const wantsJob = url.searchParams.get('async') === 'true' || options?.async === true;
    if (wantsJob) {
      const job = createJob(() => fabric.execute(capabilityRequest));
      pruneJobs();
      sendJson(response, 202, {
        jobId: job.id,
        status: job.status,
        poll: `/v1/jobs/${job.id}`,
        events: `/v1/jobs/${job.id}/events`,
      });
      return;
    }
    if (url.pathname === '/v1/stream') {
      startSse(response);
      const traceId = capabilityRequest.context.requestId;
      response.write(`event: execution.started\ndata: ${JSON.stringify({ traceId, capability: capabilityRequest.capability })}\n\n`);
      const result = await fabric.execute(capabilityRequest);
      response.write(`event: execution.completed\ndata: ${JSON.stringify(result)}\n\n`);
      response.end();
      return;
    }
    sendJson(response, 200, await fabric.execute(capabilityRequest));
    return;
  }

  if (method === 'GET' && url.pathname.startsWith('/v1/jobs/')) {
    const parts = url.pathname.split('/');
    const id = parts[3] ?? '';
    const job = getJob(id);
    if (!job) {
      sendError(response, 404, 'NOT_FOUND', 'Job not found.');
      return;
    }
    if (url.pathname.endsWith('/events')) {
      startSse(response);
      for (const event of job.events) response.write(`event: job\ndata: ${JSON.stringify(event)}\n\n`);
      if (job.status === 'completed' || job.status === 'failed') {
        response.write(`event: result\ndata: ${JSON.stringify({ status: job.status, result: job.result, error: job.error })}\n\n`);
      }
      response.end();
      return;
    }
    sendJson(response, 200, job);
    return;
  }

  sendError(response, 404, 'NOT_FOUND', 'UACF endpoint not found.');
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error &&
      typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (!response.headersSent) {
      sendError(response, status, status === 500 ? 'INTERNAL_ERROR' : 'INVALID_INPUT',
        error instanceof Error ? error.message : 'Internal server error.');
    } else {
      response.destroy();
    }
  });
});
server.listen(PORT, HOST, () => process.stdout.write(`UACF gateway listening on http://${HOST}:${PORT}\n`));

const shutdown = (): void => {
  const timer = setTimeout(() => process.exit(0), 5000);
  timer.unref();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
