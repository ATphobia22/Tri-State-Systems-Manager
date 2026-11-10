/**
 * Phase 1 web mirror — six workspaces, settings, command search, accessibility.
 */
import { useMemo, useState } from "react";
import {
  DEFAULT_LAYER_BROWSER,
  DEFAULT_SHELL_SETTINGS,
  NATIVE_WORKSPACES,
  SHELL_SHORTCUTS,
  type NativeWorkspaceId,
  type ShellSettings,
} from "../../../packages/geo/src/native/NativeShellContract";
import { CINEMATIC_PRESETS } from "../../../packages/geo/src/native/CinematicProductionContract";
import { ENGINEERING_TOOLS, createScenarioDraft, hecRasReadonlyPlaybackStatus } from "../../../packages/geo/src/native/EngineeringInteractionContract";
import { defaultReleaseGates, summarizeReleaseGates } from "../../../packages/geo/src/native/ReleaseValidationContract";
import { MTVI3_GAGE_ZERO_NAVD88 } from "../../../packages/geo/src/hydrology/GageDatumDiscipline";

export default function WorkspaceShell(): React.JSX.Element {
  const [settings, setSettings] = useState<ShellSettings>({ ...DEFAULT_SHELL_SETTINGS, camera: { ...DEFAULT_SHELL_SETTINGS.camera } });
  const [query, setQuery] = useState("");
  const [selectedParcel, setSelectedParcel] = useState<string | null>(null);
  const scenario = useMemo(() => createScenarioDraft("Bonebank compare", 377.2, 375.0), []);
  const ras = hecRasReadonlyPlaybackStatus();
  const gates = defaultReleaseGates();
  const gateSum = summarizeReleaseGates(gates);

  const commands = useMemo(() => {
    const all = [
      ...NATIVE_WORKSPACES.map((w) => `workspace:${w}`),
      ...ENGINEERING_TOOLS.map((t) => `tool:${t}`),
      ...CINEMATIC_PRESETS.map((p) => `cinema:${p.id}`),
    ];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((c) => c.includes(q));
  }, [query]);

  const setWorkspace = (workspace: NativeWorkspaceId) => setSettings((s) => ({ ...s, workspace }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr 280px",
        minHeight: "100vh",
        background: settings.highContrast ? "#000" : "#0b1220",
        color: settings.highContrast ? "#fff" : "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <aside style={{ borderRight: "1px solid #1e293b", padding: 12 }}>
        <strong style={{ color: "#38bdf8" }}>TSM Workspaces</strong>
        <nav style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {NATIVE_WORKSPACES.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWorkspace(w)}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 6,
                border: settings.workspace === w ? "1px solid #38bdf8" : "1px solid #334155",
                background: settings.workspace === w ? "rgba(56,189,248,0.15)" : "transparent",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              {w}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 16, fontSize: 11, color: "#94a3b8" }}>
          Shortcuts: {Object.keys(SHELL_SHORTCUTS).slice(0, 4).join(", ")}…
        </div>
        <label style={{ display: "flex", gap: 8, marginTop: 12, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => setSettings((s) => ({ ...s, reducedMotion: e.target.checked }))}
          />
          Reduced motion
        </label>
        <label style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={(e) => setSettings((s) => ({ ...s, highContrast: e.target.checked }))}
          />
          High contrast
        </label>
      </aside>

      <main style={{ padding: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Phase shell — {settings.workspace}</h1>
        <p style={{ color: "#94a3b8", fontSize: 13 }}>
          Persistent 3D scene attaches via Map/Twin/UE. Web shell mirrors native contracts.
        </p>

        {settings.workspace === "layers" && (
          <ul>
            {DEFAULT_LAYER_BROWSER.map((l) => (
              <li key={l.id}>
                {l.label} <span style={{ color: "#64748b" }}>[{l.authority}]</span>
              </li>
            ))}
          </ul>
        )}

        {settings.workspace === "engineering" && (
          <div>
            <p>Parcel: {selectedParcel ?? "none"}</p>
            <button type="button" onClick={() => setSelectedParcel("65-19-08-100-008.001-010")}>
              Select Bonebank parcel
            </button>
            <p style={{ marginTop: 12 }}>
              Scenario freeboard: <strong>{scenario.freeboardFt} ft</strong> ({scenario.authority})
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>{ras.guidance}</p>
            <p style={{ fontSize: 12 }}>
              MTVI3 zero: {MTVI3_GAGE_ZERO_NAVD88.gageZeroFt} ft NAVD88 (product table only)
            </p>
          </div>
        )}

        {settings.workspace === "cinema" && (
          <ul>
            {CINEMATIC_PRESETS.map((p) => (
              <li key={p.id}>
                {p.label} — solar {p.solarTimeLocal} — {p.weather} [{p.authority}]
              </li>
            ))}
          </ul>
        )}

        {settings.workspace === "evidence" && (
          <div>
            <p>Release gates (track Native Actions for live status):</p>
            <ul>
              {gates.map((g) => (
                <li key={g.id}>
                  {g.label}: <strong>{g.status}</strong>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 12, color: "#fbbf24" }}>
              readyForPublicClaim={String(gateSum.readyForPublicClaim)} (pass {gateSum.pass}/8)
            </p>
          </div>
        )}

        {(settings.workspace === "explore" || settings.workspace === "scenarios") && (
          <p style={{ fontSize: 13 }}>
            Camera lon {settings.camera.lon}, lat {settings.camera.lat}, h {settings.camera.heightM}m — clock{" "}
            {settings.clockIso ?? "system"}
          </p>
        )}
      </main>

      <aside style={{ borderLeft: "1px solid #1e293b", padding: 12 }}>
        <label style={{ fontSize: 12, color: "#94a3b8" }}>
          Command search
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="mod+k"
            style={{ display: "block", width: "100%", marginTop: 6 }}
          />
        </label>
        <ul style={{ fontSize: 12, maxHeight: "70vh", overflow: "auto" }}>
          {commands.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
