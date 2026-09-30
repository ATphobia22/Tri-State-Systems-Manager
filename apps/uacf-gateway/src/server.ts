import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { CapabilityRegistry } from '../../../packages/registry/src/CapabilityRegistry.ts';
import { CapabilityRouter } from '../../../packages/router/src/CapabilityRouter.ts';
import { StaticPolicyEngine } from '../../../packages/policy/src/PolicyEngine.ts';
import { UniversalCapabilityFabric } from '../../../packages/core/src/UniversalCapabilityFabric.ts';
import { EchoProvider } from '../../../packages/provider-runtime/src/EchoProvider.ts';
import type { CapabilityRequest, PermissionSet } from '../../../packages/contracts/src/index.ts';

const HOST = process.env.UACF_HOST ?? '127.0.0.1';
const PORT = Number.parseInt(process.env.UACF_PORT ?? '8790', 10);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('UACF_PORT must be an integer between 1 and 65535');
}

const registry = new CapabilityRegistry();
registry.register(new EchoProvider());

const fabric = new UniversalCapabilityFabric(
  new CapabilityRouter(
    registry,
    new StaticPolicyEngine([{ capability: '*', allow: true }]),
  ),
);

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function sendError(response: ServerResponse, status: number, code: string, message: string): void {
  sendJson(response, {
    success: false,
    error: { code, message },
  });
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
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON'), { statusCode: 400 });
  }
}

function requestContext(value: Record<string, unknown>): PermissionSet {
  const permissions = value.permissions;
  if (!permissions || typeof permissions !== 'object') return { allow: [] };

  const allow = (permissions as Record<string, unknown>).allow;
  if (!Array.isArray(allow) || !allow.every((item) => typeof item === 'string')) {
    return { allow: [] };
  }

  return { allow };
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);

  if (method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    response.end();
    return;
  }

  response.setHeader('access-control-allow-origin', '*');

  if (method === 'GET' && url.pathname === '/v1/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'uacf-gateway',
      version: '0.1.0',
      providers: registry.list().map((provider) => provider.id),
    });
    return;
  }

  if (method === 'GET' && url.pathname === '/v1/providers') {
    const providers = await Promise.all(
      registry.list().map(async (provider) => ({
        id: provider.id,
        version: provider.version,
        capabilities: provider.capabilities.map((capability) => capability.id),
        health: await provider.health(),
      })),
    );
    sendJson(response, 200, { providers });
    return;
  }

  if (method === 'GET' && url.pathname === '/v1/capabilities') {
    const context = {
      requestId: randomUUID(),
      permissions: { allow: [] },
    };
    const capabilities = await fabric.router.describeAvailableCapabilities(context);
    sendJson(response, 200, { capabilities });
    return;
  }

  if (method === 'POST' && url.pathname === '/v1/execute') {
    const payload = await readJson(request);

    if (!payload || typeof payload !== 'object') {
      sendError(response, 400, 'INVALID_INPUT', 'Request must be a JSON object');
      return;
    }

    const value = payload as Record<string, unknown>;
    if (typeof value.capability !== 'string' || !value.capability.length) {
      sendError(response, 400, 'INVALID_INPUT', 'capability is required');
      return;
    }

    const contextValue =
      value.context && typeof value.context === 'object'
        ? value.context as Record<string, unknown>
        : {};

    const requestId =
      typeof contextValue.requestId === 'string' && contextValue.requestId.length > 0
        ? contextValue.requestId
        : randomUUID();

    const capabilityRequest: CapabilityRequest = {
      capability: value.capability as CapabilityRequest['capability'],
      input: value.input,
      context: {
        requestId,
        sessionId: typeof contextValue.sessionId === 'string' ? contextValue.sessionId : undefined,
        userId: typeof contextValue.userId === 'string' ? contextValue.userId : undefined,
        tenantId: typeof contextValue.tenantId === 'string' ? contextValue.tenantId : undefined,
        permissions: requestContext(contextValue),
      },
      options:
        value.options && typeof value.options === 'object'
          ? value.options as CapabilityRequest['options']
          : undefined,
    };

    sendJson(response, 200, await fabric.execute(capabilityRequest));
    return;
  }

  sendError(response, 404, 'NOT_FOUND', 'UACF endpoint not found');
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    const status =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (!response.headersSent) sendError(response, status, status === 500 ? 'INTERNAL_ERROR' : 'INVALID_INPUT', message);
    else response.destroy();
  });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`UACF gateway listening on http://${HOST}:${PORT}\n`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
