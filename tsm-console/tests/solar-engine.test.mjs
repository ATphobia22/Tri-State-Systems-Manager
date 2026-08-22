import test from "node:test";
import assert from "node:assert/strict";

function solar(latitudeDegrees, longitudeDegrees, utcTime) {
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;
  const start = Date.UTC(utcTime.getUTCFullYear(), 0, 0);
  const n = Math.floor((utcTime.getTime() - start) / 86400000);
  const hour = utcTime.getUTCHours() + utcTime.getUTCMinutes() / 60;
  const gamma = (2 * Math.PI / 365) * (n - 1 + (hour - 12) / 24);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const hourAngle = (hour * 60 + eot + 4 * longitudeDegrees) / 4 - 180;
  const lat = latitudeDegrees * DEG;
  const elevation = Math.asin(Math.min(1, Math.max(-1, Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle * DEG)))) * RAD;
  return elevation;
}

test("solar position remains finite and bounded", () => {
  const elevation = solar(37.93, -88.01, new Date("2026-08-22T18:00:00Z"));
  assert.ok(Number.isFinite(elevation));
  assert.ok(elevation >= -90 && elevation <= 90);
});

test("solar engine responds to time-of-day", () => {
  const morning = solar(37.93, -88.01, new Date("2026-08-22T12:00:00Z"));
  const evening = solar(37.93, -88.01, new Date("2026-08-22T22:00:00Z"));
  assert.notEqual(morning, evening);
});
