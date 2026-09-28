import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_POLICY = {
  enabled: false,
  authorityClass: 'TOOLING',
  allowedTools: ['scene.inspect', 'scene.capture', 'test.run', 'build.validate'],
  blockedPathPrefixes: ['.git', '.secrets', '/etc', '/root', '/proc', '/sys'],
  requireHumanApprovalFor: ['scene.write', 'asset.import', 'build.publish', 'filesystem.write'],
};
export function authorizeUnityMcpCall({ tool, path: targetPath = '' }, policy = DEFAULT_POLICY) {
  if (!policy.enabled) return { allowed: false, code: 'UNITY_MCP_DISABLED' };
  if (!policy.allowedTools.includes(tool)) return { allowed: false, code: 'UNITY_MCP_TOOL_NOT_ALLOWLISTED' };
  const normalized = path.posix.normalize(`/${String(targetPath).replaceAll('\\\\', '/')}`);
  if (policy.blockedPathPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) return { allowed: false, code: 'UNITY_MCP_PATH_BLOCKED' };
  return { allowed: true, code: 'UNITY_MCP_ALLOWED', normalizedPath: normalized };
}
export async function auditUnityMcpCall(event, auditDir = process.env.TSM_UNITY_MCP_AUDIT_DIR || '.data/unity-mcp') {
  const dir = path.resolve(auditDir);
  await mkdir(dir, { recursive: true });
  const record = { event_id: randomUUID(), recorded_at: new Date().toISOString(), ...event };
  await appendFile(path.join(dir, 'audit.ndjson'), `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
  return record;
}
