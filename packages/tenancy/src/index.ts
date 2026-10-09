export interface TenantIdentity { readonly tenantId: string; readonly userId: string }
export interface TenantPolicy { readonly tenantId: string; readonly allowedCapabilities: readonly string[]; readonly disabled?: boolean }

/** Fail-closed tenant capability check. Call only after authenticating the principal. */
export function authorizeTenantCapability(identity: TenantIdentity | null, policy: TenantPolicy | null, capability: string): boolean {
  if (!identity || !policy || !identity.tenantId || !identity.userId || !capability.trim()) return false;
  if (policy.disabled || identity.tenantId !== policy.tenantId) return false;
  return policy.allowedCapabilities.some((pattern) => pattern === capability || (pattern.endsWith('.*') && capability.startsWith(pattern.slice(0, -1))));
}
