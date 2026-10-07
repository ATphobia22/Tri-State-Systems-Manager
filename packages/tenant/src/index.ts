export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  metadata: Record<string, string>;
}

export interface TenantContext {
  tenantId: string;
  userId?: string;
  roles: string[];
}

export class TenantRegistry {
  private readonly tenants = new Map<string, Tenant>();
  private counter = 0;

  public create(name: string, metadata: Record<string, string> = {}): Tenant {
    const tenant: Tenant = {
      id: `tenant-${++this.counter}`,
      name,
      createdAt: new Date().toISOString(),
      metadata,
    };
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  public get(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  public list(): Tenant[] {
    return [...this.tenants.values()];
  }

  public context(tenantId: string, userId?: string, roles: string[] = []): TenantContext {
    if (!this.tenants.has(tenantId)) {
      throw new Error(`Unknown tenant: ${tenantId}`);
    }
    return { tenantId, userId, roles };
  }
}
