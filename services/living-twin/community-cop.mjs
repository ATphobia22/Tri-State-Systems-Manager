import { gaugeMarkers } from "../../tsm-console/src/lib/community-cop.mjs";
export { gaugeMarkers };

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
