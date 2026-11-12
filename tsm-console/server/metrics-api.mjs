import { randomUUID } from "node:crypto";

/**
 * Metrics API — fail-closed, simulation-labeled by default.
 * Never elevates demo trends to OBSERVATION or regulatory evidence.
 * Replaces metrics-api.stub.mjs for runtime use; stub file re-exports this module.
 */

/**
 * @typedef {{ id: string, title: string, metricValue: string, trendPercentage: number, isPositiveTrend: boolean, is_simulation_demo: boolean, authority_class: string }} MetricReport
 */

const store = new Map();

export function createMetricsHandlers(deps = {}) {
  const listMetrics = deps.listMetrics ?? (async (id) => store.get(id) ?? null);
  const saveMetric =
    deps.saveMetric ??
    (async (row) => {
      store.set(row.id, row);
      return row;
    });
  const listAll = deps.listAll ?? (async () => [...store.values()]);

  return {
    async postCreate(body = {}) {
      if (body && body.authority_class === "OBSERVATION") {
        return {
          status: 403,
          body: {
            error: "METRICS_OBSERVATION_FORBIDDEN",
            detail: "Metrics API cannot mint OBSERVATION authority. Use evidence-store with human review.",
          },
        };
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { status: 422, body: { error: "METRICS_INVALID_BODY" } };
      }
      const trendPercentage = body.trendPercentage == null ? 0 : Number(body.trendPercentage);
      if (!Number.isFinite(trendPercentage)) {
        return { status: 422, body: { error: "METRICS_INVALID_TREND" } };
      }
      const id = body.id == null || body.id === "" ? `metric-${randomUUID()}` : String(body.id);
      if (!id.trim() || id.length > 128) {
        return { status: 422, body: { error: "METRICS_INVALID_ID" } };
      }
      const row = {
        id,
        title: String(body.title || "Untitled"),
        metricValue: String(body.metricValue ?? "—"),
        trendPercentage,
        isPositiveTrend: Boolean(body.isPositiveTrend),
        is_simulation_demo: body.is_simulation_demo !== false,
        authority_class: "PRESENTATION",
      };
      await saveMetric(row);
      return { status: 201, body: row };
    },
    async getById(id) {
      const row = await listMetrics(id);
      return { status: row ? 200 : 404, body: row };
    },
    async getAll() {
      const rows = await listAll();
      return { status: 200, body: rows };
    },
  };
}

export function resetMetricsStoreForTests() {
  store.clear();
}
