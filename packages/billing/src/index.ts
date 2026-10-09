/**
 * Billing package intentionally DISABLED for Tri-State public-interest offline deployment.
 * No commercial ledger, no metered cloud billing, no SaaS invoices.
 * Usage accounting for local capacity planning may live under packages/observability later.
 */

export const BILLING_ENABLED = false as const;

export class BillingDisabledError extends Error {
  readonly code = 'BILLING_DISABLED';
  constructor(message = 'ADR/public-interest: commercial billing is disabled in TSM offline stack') {
    super(message);
    this.name = 'BillingDisabledError';
  }
}

export interface UsageRecord {
  readonly capabilityId: string;
  readonly units: number;
  readonly at: string;
}

/** Stub retained so workspace/tsconfig stay valid; all mutators throw. */
export class BillingLedger {
  record(_usage: UsageRecord): never {
    throw new BillingDisabledError();
  }

  setPrice(_capabilityId: string, _unitPrice: number): never {
    throw new BillingDisabledError();
  }

  total(): number {
    return 0;
  }
}

export function assertBillingDisabled(): void {
  if (BILLING_ENABLED) {
    throw new Error('invariant: BILLING_ENABLED must remain false');
  }
}
