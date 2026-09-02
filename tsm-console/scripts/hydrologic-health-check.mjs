#!/usr/bin/env node
/**
 * S-5 — Periodic NWIS / NWPS health check
 * Writes OBSERVATION-class status only. No governance mutations. No auto-append
 * to Merkle unless explicitly piped by an operator-approved job.
 *
 * Usage: node scripts/hydrologic-health-check.mjs
 */

const NODES = [
  {
    id: '03378500',
    kind: 'usgs',
    url: 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03378500&parameterCd=00065&siteStatus=all',
  },
  {
    id: '03322000',
    kind: 'usgs',
    url: 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03322000&parameterCd=00065&siteStatus=all',
  },
  {
    id: '03322420',
    kind: 'usgs',
    url: 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03322420&parameterCd=00065&siteStatus=all',
  },
  {
    id: 'MTVI3',
    kind: 'nwps',
    url: 'https://api.water.noaa.gov/nwps/v1/gauges/MTVI3',
  },
  {
    id: 'UNWK2',
    kind: 'nwps',
    url: 'https://api.water.noaa.gov/nwps/v1/gauges/UNWK2',
  },
];

async function checkNode(node) {
  const started = Date.now();
  try {
    const res = await fetch(node.url, { signal: AbortSignal.timeout(8000) });
    const ms = Date.now() - started;
    if (!res.ok) {
      return {
        id: node.id,
        kind: node.kind,
        ok: false,
        http: res.status,
        latency_ms: ms,
        vertical_reference: 'GAGE_DATUM',
        authority_class: 'OBSERVATION',
        governance_status: 'health_check_only',
        error: `HTTP ${res.status}`,
      };
    }
    const json = await res.json();
    let value = null;
    if (node.kind === 'usgs') {
      const v = json?.value?.timeSeries?.[0]?.values?.[0]?.value?.[0];
      value = v ? parseFloat(v.value) : null;
    } else {
      const primary = json?.status?.observed?.primary;
      value = typeof primary === 'number' ? primary : parseFloat(primary);
      if (Number.isNaN(value)) value = null;
    }
    return {
      id: node.id,
      kind: node.kind,
      ok: value != null && !Number.isNaN(value),
      http: 200,
      latency_ms: ms,
      gage_height_ft: value,
      vertical_reference: 'GAGE_DATUM',
      authority_class: 'OBSERVATION',
      governance_status: 'health_check_only',
      is_simulation_demo: false,
      note: 'Health check only — not an Evidence Ledger append; not a regulatory product.',
    };
  } catch (e) {
    return {
      id: node.id,
      kind: node.kind,
      ok: false,
      latency_ms: Date.now() - started,
      vertical_reference: 'GAGE_DATUM',
      authority_class: 'OBSERVATION',
      governance_status: 'health_check_only',
      error: e.message,
    };
  }
}

const results = [];
for (const node of NODES) {
  results.push(await checkNode(node));
}

const summary = {
  checked_at: new Date().toISOString(),
  plane: 'Evidence/Observation health',
  auto_governance: false,
  results,
  ok_count: results.filter((r) => r.ok).length,
  fail_count: results.filter((r) => !r.ok).length,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.fail_count === results.length ? 1 : 0);
