import { detectCapabilities } from "@tsm/browser";
import { createEmptyIndex } from "@tsm/search";
import { defaultContext } from "@tsm/agent-runtime";

const caps = detectCapabilities();
const search = createEmptyIndex();
search.add({
  id: "gage-03378500",
  domain: "gage",
  title: "USGS 03378500 Wabash River at New Harmony, IN",
  snippet: "Primary Tri-State stage reference.",
  score: 1,
});
const agent = defaultContext("dashboard-session");

export function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>TSM Dashboard</h1>
      <p>Trust Fabric · Autonomy {agent.autonomy} · Human authority remains final</p>
      <h2>Capabilities</h2>
      <ul>
        <li>WebGPU: {String(caps.webgpu)}</li>
        <li>WebGL2: {String(caps.webgl2)}</li>
      </ul>
      <h2>Sample search</h2>
      <pre>{JSON.stringify(search.search({ q: "Wabash", domain: "gage" }), null, 2)}</pre>
    </div>
  );
}
