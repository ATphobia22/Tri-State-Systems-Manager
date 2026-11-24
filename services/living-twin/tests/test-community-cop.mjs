import test from "node:test";
import assert from "node:assert/strict";
import {gaugeMarkers} from "../community-cop.mjs";
const doc = {schema:"tsm.community-cop.v1",type:"FeatureCollection",
  publicPublication:"REVIEW_REQUIRED",navd88WseIncluded:false,hydraulicSimulationIncluded:false,
  capturedAt:"2025-01-01T12:01:00Z",readAt:"2025-01-01T12:01:00Z",staleAfterSeconds:3600,
  stations:{"USGS-03322000":{sourceStatus:"SOURCE_UNAVAILABLE",seriesCount:0,unlocatedSeriesCount:0},
    "USGS-03377500":{sourceStatus:"NOT_IN_CAPTURE",seriesCount:0,unlocatedSeriesCount:0},
    "USGS-03378500":{sourceStatus:"CAPTURED",seriesCount:1,unlocatedSeriesCount:0}},
  features:[{type:"Feature",geometry:{type:"Point",coordinates:[-87.9,38.1]},
    properties:{stationId:"USGS-03378500",authority:"USGS",sourceStatus:"CAPTURED",
      verticalReference:"STATION_GAGE_DATUM_UNRESOLVED",timeSeriesId:"test",
      eventId:"test-id",sourceSha256:"a".repeat(64),observedAt:"2025-01-01T12:00:00Z",
      gageHeightFt:8.5}}]};
test("recorded gauge ages rather than becoming live",()=>{
  assert.equal(gaugeMarkers(doc, Date.parse("2025-01-01T12:15:00Z"))[0].status,"RECENT_OBSERVATION");
  assert.equal(gaugeMarkers(doc, Date.parse("2025-01-01T14:00:00Z"))[0].status,"STALE");
});
test("missing measurement is not zero",()=>{
  const d=structuredClone(doc);d.features[0].properties.gageHeightFt=null;
  assert.equal(gaugeMarkers(d, Date.parse("2025-01-01T12:15:00Z"))[0].status,"MISSING_MEASUREMENT");
});
test("no arbitrary sensor or height coordinate",()=>{
  const d=structuredClone(doc);d.features[0].properties.stationId="private-unit";
  assert.throws(()=>gaugeMarkers(d, Date.parse("2025-01-01T12:15:00Z")));
  const e=structuredClone(doc);e.features[0].geometry.coordinates.push(5);
  assert.throws(()=>gaugeMarkers(e, Date.parse("2025-01-01T12:15:00Z")));
});
test("station inventory does not silently hide missing series",()=>{
  const d=structuredClone(doc);d.stations["USGS-03378500"].seriesCount=2;
  assert.throws(()=>gaugeMarkers(d, Date.parse("2025-01-01T12:15:00Z")));
});
