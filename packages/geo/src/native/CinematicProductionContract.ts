/** Phase 3 — Cinematic production contract. */

export type CinematicPresetId = "golden_hour" | "overcast_flood" | "night_gauge" | "clear_noon";

export type CameraPathKeyframe = {
  t: number;
  lon: number;
  lat: number;
  heightM: number;
  pitchDeg: number;
  yawDeg: number;
};

export type CinematicPreset = {
  id: CinematicPresetId;
  label: string;
  solarTimeLocal: string;
  weather: "clear" | "overcast" | "rain" | "fog";
  authority: "PRESENTATION";
};

export const CINEMATIC_PRESETS: readonly CinematicPreset[] = Object.freeze([
  { id: "golden_hour", label: "Golden hour", solarTimeLocal: "18:15", weather: "clear", authority: "PRESENTATION" },
  { id: "overcast_flood", label: "Overcast flood",
 solarTimeLocal: "10:00", weather: "overcast", authority: "PRESENTATION" },
  { id: "night_gauge", label: "Night gauge", solarTimeLocal: "21:30", weather: "fog", authority: "PRESENTATION" },
  { id: "clear_noon", label: "Clear noon", solarTimeLocal: "12:00", weather: "clear", authority: "PRESENTATION" },
]);

export type RenderJob = {
  id: string;
  presetId: CinematicPresetId;
  status: "queued" | "running" | "done" | "failed";
  evidenceIds: string[];
  /** Presentation only — must not alter evidence. */
  authority: "PRESENTATION";
};

export function buildDefaultCameraPath(): CameraPathKeyframe[] {
  return [
    { t: 0, lon: -88.02, lat: 37.86, heightM: 4000, pitchDeg: -40, yawDeg: 20 },
    { t: 0.5, lon: -88.0051, lat: 37.84589, heightM: 1200, pitchDeg: -50, yawDeg: 0 },
    { t: 1, lon: -87.99, lat: 37.84, heightM: 800, pitchDeg: -25, yawDeg: -15 },
  ];
}

export function sequencerIntegrationNotes(): string {
  return "UE Sequencer binds camera paths + solar time; exports do not mutate evidence ledger hashes.";
}
