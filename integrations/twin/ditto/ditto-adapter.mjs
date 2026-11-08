/**
 * Eclipse Ditto adapter boundary for TSM digital twins.
 * Operator deploys Ditto; TSM speaks HTTP/WebSocket to twin things.
 * Repo: https://github.com/eclipse-ditto/ditto
 */

export const DITTO_AUTHORITY = "PRESENTATION";

/**
 * @param {string} baseUrl e.g. http://localhost:8080
 * @param {string} thingId
 * @param {typeof fetch} [fetchImpl]
 */
export async function getDittoThing(baseUrl, thingId, fetchImpl = fetch) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/2/things/${encodeURIComponent(thingId)}`;
  try {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        authority: DITTO_AUTHORITY,
        detail: `Ditto HTTP ${res.status}`,
      };
    }
    const body = await res.json();
    return { ok: true, authority: DITTO_AUTHORITY, thing: body };
  } catch (e) {
    return {
      ok: false,
      authority: DITTO_AUTHORITY,
      detail: e instanceof Error ? e.message : "fetch failed",
      guidance: "Deploy Eclipse Ditto and set TSM_DITTO_BASE_URL",
    };
  }
}

export function dittoWsTelemetryUrl(baseWsUrl, thingId) {
  const base = baseWsUrl.replace(/\/$/, "");
  return `${base}/ws/2?x-correlation-id=tsm-${encodeURIComponent(thingId)}`;
}

export function probeDittoConfig(env = process.env) {
  const base = env.TSM_DITTO_BASE_URL || "";
  return {
    configured: Boolean(base),
    baseUrl: base || null,
    authority: DITTO_AUTHORITY,
    repo: "https://github.com/eclipse-ditto/ditto",
  };
}
