/** Civilian fixed-gage snapshot display; no networking or inferred water elevation. */
const STATIONS = new Set(["USGS-03322000", "USGS-03377500", "USGS-03378500"]);
const DATUM = "STATION_GAGE_DATUM_UNRESOLVED";
export function gaugeMarkers(doc, now = Date.now()) {
  if (!Number.isFinite(now) || doc?.schema !== "tsm.community-cop.v1" ||
      doc.type !== "FeatureCollection" || doc.publicPublication !== "REVIEW_REQUIRED" ||
      doc.navd88WseIncluded !== false || doc.hydraulicSimulationIncluded !== false ||
      !Array.isArray(doc.features) || doc.features.length > 1000 ||
      !Number.isInteger(doc.staleAfterSeconds) || doc.staleAfterSeconds <= 0 ||
      doc.staleAfterSeconds > 31 * 86400) throw new Error("Invalid COP snapshot");
  const captured = Date.parse(doc.capturedAt);
  const read = Date.parse(doc.readAt);
  if (!Number.isFinite(captured) || !Number.isFinite(read) || captured > read || read > now)
    throw new Error("Invalid snapshot clock");
  const stations = doc.stations;
  if (!stations || typeof stations !== "object" ||
      Object.keys(stations).length !== STATIONS.size ||
      ![...STATIONS].every(id => {
        const s = stations[id];
        return s && ["CAPTURED", "SOURCE_UNAVAILABLE", "NO_OBSERVATIONS", "NOT_IN_CAPTURE"].includes(s.sourceStatus) &&
          Number.isInteger(s.seriesCount) && s.seriesCount >= 0 && s.seriesCount <= 1000 &&
          Number.isInteger(s.unlocatedSeriesCount) && s.unlocatedSeriesCount >= 0 &&
          s.unlocatedSeriesCount <= s.seriesCount &&
          (s.sourceStatus === "CAPTURED" || s.seriesCount === 0);
      })) throw new Error("Invalid station inventory");
  const seen = new Set();
  const counts = new Map();
  const markers = doc.features.map(f => {
    const p = f.properties;
    const xy = f.geometry?.coordinates;
    const observed = Date.parse(p?.observedAt);
    if (f.type !== "Feature" || f.geometry?.type !== "Point" ||
        !Array.isArray(xy) || xy.length !== 2 || !xy.every(Number.isFinite) ||
        Math.abs(xy[0]) > 180 || Math.abs(xy[1]) > 90 ||
        !STATIONS.has(p?.stationId) || p.authority !== "USGS" ||
        p.sourceStatus !== "CAPTURED" || p.verticalReference !== DATUM ||
        typeof p.timeSeriesId !== "string" || !p.timeSeriesId ||
        typeof p.eventId !== "string" || !p.eventId || seen.has(p.eventId) ||
        !/^[a-f0-9]{64}$/.test(p.sourceSha256) ||
        !Number.isFinite(observed) || observed > captured ||
        !(p.gageHeightFt === null || Number.isFinite(p.gageHeightFt)))
      throw new Error("Invalid COP gage feature");
    if (stations[p.stationId].sourceStatus !== "CAPTURED") throw new Error("Station unavailable");
    seen.add(p.eventId);
    counts.set(p.stationId, (counts.get(p.stationId) ?? 0) + 1);
    const stale = (now - observed) / 1000 > doc.staleAfterSeconds;
    const status = p.gageHeightFt === null ? "MISSING_MEASUREMENT" : stale ? "STALE" : "RECENT_OBSERVATION";
    const reading = p.gageHeightFt === null ? "No measurement" : p.gageHeightFt + " ft gage height";
    return {id:p.eventId, longitude:xy[0], latitude:xy[1], status,
      text:p.stationId + "\n" + reading + "\n" + status + " | recorded " + p.observedAt,
      source:p.stationId, sourceSha256:p.sourceSha256};
  });
  for (const id of STATIONS) {
    if ((counts.get(id) ?? 0) !== stations[id].seriesCount - stations[id].unlocatedSeriesCount)
      throw new Error("Station series count differs from mapped features");
  }
  return markers;
}

export function stationSummary(doc, now = Date.now()) {
  gaugeMarkers(doc, now);
  return [...STATIONS].map(stationId => ({stationId, ...doc.stations[stationId]}));
}

