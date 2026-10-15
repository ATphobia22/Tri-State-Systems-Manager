import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { PermissionSet } from '../../../packages/contracts/src/index.ts';

export interface GatewaySecurityConfig {
  readonly host: string;
  readonly token?: string;
  readonly permissions: readonly string[];
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export function createGatewaySecurityConfig(
  host: string,
  token = process.env.UACF_API_TOKEN,
  permissions = process.env.UACF_API_PERMISSIONS ?? '',
): GatewaySecurityConfig {
  const normalizedHost = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const isLoopback = LOOPBACK_HOSTS.has(normalizedHost);
  if (!isLoopback && (!token || token.length < 32)) {
    throw new Error('UACF_API_TOKEN with at least 32 characters is required when binding beyond loopback');
  }
  if (token && token.length < 32) {
    throw new Error('UACF_API_TOKEN must contain at least 32 characters');
  }
  return Object.freeze({
    host: normalizedHost,
    token,
    permissions: Object.freeze([...new Set(permissions.split(',').map((value) => value.trim()).filter(Boolean))]),
  });
}

/** Client-supplied permission claims are never consulted. */
export function authenticateGatewayRequest(
  request: IncomingMessage,
  config: GatewaySecurityConfig,
): PermissionSet | null {
  if (!config.token) return { allow: [] };
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const supplied = Buffer.from(header.slice(7), 'utf8');
  const expected = Buffer.from(config.token, 'utf8');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return { allow: [...config.permissions] };
}
