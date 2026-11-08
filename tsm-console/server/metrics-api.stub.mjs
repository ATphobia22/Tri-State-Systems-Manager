/**
 * Compatibility re-export — prefer metrics-api.mjs.
 * Handlers default all rows to is_simulation_demo and PRESENTATION authority.
 */
export { createMetricsHandlers, resetMetricsStoreForTests } from "./metrics-api.mjs";
