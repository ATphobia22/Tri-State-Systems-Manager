export interface UsageRecord {
  tenantId: string;
  meter: string;
  quantity: number;
  unit: string;
  recordedAt: string;
}

export interface InvoiceLine {
  meter: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  lines: InvoiceLine[];
  total: number;
  currency: string;
}

export class BillingLedger {
  private readonly usage: UsageRecord[] = [];
  private readonly prices = new Map<string, number>();

  public setPrice(meter: string, unitPrice: number): void {
    this.prices.set(meter, unitPrice);
  }

  public recordUsage(tenantId: string, meter: string, quantity: number, unit = "unit"): UsageRecord {
    const record: UsageRecord = {
      tenantId,
      meter,
      quantity,
      unit,
      recordedAt: new Date().toISOString(),
    };
    this.usage.push(record);
    return record;
  }

  public invoice(tenantId: string, periodStart: string, periodEnd: string, currency = "USD"): Invoice {
    const lines: InvoiceLine[] = [];
    for (const record of this.usage) {
      if (record.tenantId !== tenantId) continue;
      if (record.recordedAt < periodStart || record.recordedAt > periodEnd) continue;
      const unitPrice = this.prices.get(record.meter) ?? 0;
      lines.push({
        meter: record.meter,
        quantity: record.quantity,
        unit: record.unit,
        unitPrice,
        total: record.quantity * unitPrice,
      });
    }
    return {
      tenantId,
      periodStart,
      periodEnd,
      lines,
      total: lines.reduce((sum, line) => sum + line.total, 0),
      currency,
    };
  }
}
