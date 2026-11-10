/** Phase 1 — Native application shell contract. */

export const NATIVE_WORKSPACES = [
  "explore",
  "layers",
  "engineering",
  "scenarios",
  "cinema",
  "evidence",
] as const;

export type NativeWorkspaceId = (typeof NATIVE_WORKSPACES)[number];

export type ShellSettings = {
  workspace: NativeWorkspaceId;
  camera: { lon: number; lat: number; heightM: number; pitchDeg: number; yawDeg: number };
  clockIso: string | null;
  reducedMotion: boolean;
  highContrast: boolean;
  commandPaletteOpen: boolean;
};

export const DEFAULT_SHELL_SETTINGS: ShellSettings = Object.freeze({
  workspace: "explore",
  camera: {
    lon: -88.0051,
    lat: 37.84589,
    heightM: 2500,
    pitchDeg: -35,
    yawDeg: 0,
  },
  clockIso: null,
  reducedMotion: false,
  highContrast: false,
  commandPaletteOpen: false,
});

export const SHELL_SHORTCUTS: Readonly<Record<string, string>> = Object.freeze({
  "mod+k": "command_search",
  "mod+1": "workspace_explore",
  "mod+2": "workspace_layers",
  "mod+3": "workspace_engineering",
  "mod+4": "workspace_scenarios",
  "mod+5": "workspace_cinema",
  "mod+6": "workspace_evidence",
  escape: "clear_selection",
  f: "frame_selection",
});

export type LayerBrowserEntry = {
  id: string;
  label: string;
  authority: "REGULATORY" | "OBSERVATION" | "DERIVED" | "MODEL_SIMULATION" | "PRESENTATION";
  visible: boolean;
};

export const DEFAULT_LAYER_BROWSER: readonly LayerBrowserEntry[] = Object.freeze([
  { id: "nfhl", label: "FEMA NFHL", authority: "REGULATORY", visible: true },
  { id: "3dep", label: "USGS 3DEP terrain", authority: "DERIVED", visible: true },
  { id: "nwps-stage", label: "NWPS stage (GAGE_DATUM)", authority: "OBSERVATION", visible: true },
  { id: "parcels", label: "Parcels", authority: "REGULATORY", visible: false },
  { id: "scenario-overlay", label: "Scenario overlay", authority: "MODEL_SIMULATION", visible: false },
]);

const SETTINGS_KEY = "tsm.native.shell.settings.v1";

export function loadShellSettings(storage?: Storage): ShellSettings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SHELL_SETTINGS, camera: { ...DEFAULT_SHELL_SETTINGS.camera } };
    const parsed = JSON.parse(raw) as Partial<ShellSettings>;
    return {
      ...DEFAULT_SHELL_SETTINGS,
      ...parsed,
      camera: { ...DEFAULT_SHELL_SETTINGS.camera, ...(parsed.camera ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SHELL_SETTINGS, camera: { ...DEFAULT_SHELL_SETTINGS.camera } };
  }
}

export function saveShellSettings(settings: ShellSettings, storage?: Storage): void {
  storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function listWorkspaces(): readonly NativeWorkspaceId[] {
  return NATIVE_WORKSPACES;
}
