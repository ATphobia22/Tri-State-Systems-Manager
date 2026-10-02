import { PerspectiveCamera, Vector3 } from "three";
import { TilesRenderer } from "3d-tiles-renderer";

const status = document.querySelector<HTMLDivElement>("#status");
if (!status) throw new Error("smoke status element missing");

const setStatus = (value: string) => {
  status.textContent = value;
  status.dataset.state = value;
};

const tilesetUrl = "/3d-tiles/terrain-3dep/tileset.json";
const tileset = await fetch(tilesetUrl).then(async response => {
  if (!response.ok) throw new Error(`tileset HTTP ${response.status}`);
  return response.json();
});
const renderer = new TilesRenderer(tilesetUrl);
const camera = new PerspectiveCamera(45, 1, 1, 1e9);
const errors: string[] = [];
let loadedTileset = false;
let loadedModels = 0;

renderer.addEventListener("load-tileset", () => { loadedTileset = true; });
renderer.addEventListener("load-model", () => { loadedModels += 1; });
renderer.addEventListener("load-error", (event: unknown) => {
  const detail = event as { error?: unknown; message?: unknown };
  errors.push(String(detail.error ?? detail.message ?? "unknown load error"));
});

const rootVolume = tileset.root?.boundingVolume;
const rootBox = rootVolume?.box;
const rootSphere = rootVolume?.sphere;
const center = rootSphere
  ? new Vector3(rootSphere[0], rootSphere[1], rootSphere[2])
  : rootBox
    ? new Vector3(rootBox[0], rootBox[1], rootBox[2])
    : new Vector3(0, 0, 0);
const radius = rootSphere
  ? rootSphere[3]
  : rootBox
    ? Math.hypot(rootBox[3], rootBox[7], rootBox[11])
    : 1000;

camera.position.copy(center).add(new Vector3(0, 0, Math.max(radius * 2, 1000)));
camera.lookAt(center);
camera.updateMatrixWorld();
renderer.setCamera(camera);
renderer.setResolution(camera, 1280, 720);

const deadline = performance.now() + 15000;
const tick = () => {
  try {
    camera.updateMatrixWorld();
    renderer.update();
    if (errors.length) {
      setStatus("error:" + errors.join("; "));
      return;
    }
    if (loadedTileset && loadedModels > 0) {
      setStatus(`ready:tileset=1;models=${loadedModels}`);
      return;
    }
    if (performance.now() >= deadline) {
      setStatus(`timeout:tileset=${loadedTileset ? 1 : 0};models=${loadedModels}`);
      return;
    }
    requestAnimationFrame(tick);
  } catch (error) {
    setStatus("error:" + String(error));
  }
};
tick();
