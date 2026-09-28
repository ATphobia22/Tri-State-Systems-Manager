import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeUnityMcpCall } from './gateway.mjs';
test('Unity MCP gateway fails closed by default', () => {
  assert.deepEqual(authorizeUnityMcpCall({ tool: 'scene.inspect' }), { allowed: false, code: 'UNITY_MCP_DISABLED' });
});
test('Unity MCP gateway allowlists tools and blocks sensitive paths', () => {
  const policy = { enabled: true, allowedTools: ['scene.inspect'], blockedPathPrefixes: ['/etc'], requireHumanApprovalFor: [] };
  assert.equal(authorizeUnityMcpCall({ tool: 'scene.inspect', path: '/project/scene.unity' }, policy).allowed, true);
  assert.equal(authorizeUnityMcpCall({ tool: 'filesystem.write', path: '/project/a' }, policy).allowed, false);
  assert.equal(authorizeUnityMcpCall({ tool: 'scene.inspect', path: '/etc/passwd' }, policy).code, 'UNITY_MCP_PATH_BLOCKED');
});
