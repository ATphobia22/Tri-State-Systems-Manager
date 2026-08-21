/**
 * Metrics API stub — portable Express-style handlers (no Nest runtime required).
 * Map to evidence-store or stage loaders; never elevate demo trends to OBSERVATION.
 */

/**
 * @typedef {{ id: string, title: string, metricValue: string, trendPercentage: number, isPositiveTrend: boolean, is_simulation_demo?: boolean }} MetricReport
 */

export function createMetricsHandlers({ listMetrics, saveMetric }) {
  return {
    async postCreate(body) {
      const row = {
        id: body.id || `metric-${Date.now()}`,
        title: String(body.title || 'Untitled'),
        metricValue: String(body.metricValue ?? '—'),
        trendPercentage: Number(body.trendPercentage) || 0,
        isPositiveTrend: Boolean(body.isPositiveTrend),
        is_simulation_demo: body.is_simulation_demo !== false,
      };
      if (saveMetric) await saveMetric(row);
      return { status: 201, body: row };
    },
    async getById(id) {
      const row = listMetrics ? await listMetrics(id) : null;
      return { status: row ? 200 : 404, body: row };
    },
  };
}
