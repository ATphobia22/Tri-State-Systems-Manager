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
  const seen = new Set();
  return doc.features.map(f => {
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
    seen.add(p.eventId);
    const stale = (now - observed) / 1000 > doc.staleAfterSeconds;
    const status = p.gageHeightFt === null ? "MISSING_MEASUREMENT" : stale ? "STALE" : "RECENT_OBSERVATION";
    const reading = p.gageHeightFt === null ? "No measurement" : p.gageHeightFt + " ft gage height";
    return {id:p.eventId, longitude:xy[0], latitude:xy[1], status,
      text:p.stationId + "\n" + reading + "\n" + status + " | recorded " + p.observedAt,
      source:p.stationId, sourceSha256:p.sourceSha256};
  });
}

/** Add a separate data source to an existing Cesium Viewer. Caller supplies parsed local JSON.
 * Only a ground-clamped marker is rendered; no vertical water geometry is created.
 * Call again with current clock when reopening or refreshing a saved snapshot.
 */
export async function showCommunityCop({Cesium, viewer, document, now = Date.now()}) {
  const markers = gaugeMarkers(document, now);
  const source = new Cesium.CustomDataSource("USGS recorded river observations");
  for (const m of markers) {
    const color = m.status === "RECENT_OBSERVATION" ? Cesium.Color.CYAN :
      m.status === "STALE" ? Cesium.Color.ORANGE : Cesium.Color.GRAY;
    source.entities.add({
      id: m.id, name: m.source,
      position: Cesium.Cartesian3.fromDegrees(m.longitude, m.latitude),
      point: {pixelSize: 12, color, outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND},
      label: {text: m.text, font: "13px sans-serif",
              pixelOffset: new Cesium.Cartesian2(0, -22),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              showBackground: true}
    });
  }
  await viewer.dataSources.add(source);
  viewer.scene.requestRender();
  return {source, stations: document.stations, dispose: () => {
    viewer.dataSources.remove(source, true);
    viewer.scene.requestRender();
  }};
}
