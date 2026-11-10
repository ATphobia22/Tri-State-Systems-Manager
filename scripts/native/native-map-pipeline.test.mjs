import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

test("UE startup map paths are aligned and not the engine template", () => {
  const engine = read("tsm-native/Config/DefaultEngine.ini");
  const game = read("tsm-native/Config/DefaultGame.ini");
  for (const content of [engine, game]) {
    assert.match(content, /GameDefaultMap=\/Game\/TSM\/Maps\/TSMNative/);
    assert.doesNotMatch(content, /GameDefaultMap=\/Engine\/Maps\/Templates\/OpenWorld/);
  }
});
test("Win64 Shipping build explicitly cooks locally generated partitioned map", () => {
  const workflow = read(".github/workflows/tsm-native.yml");
  const cook = read("scripts/native/Build-TSMNative.ps1");
  const generate = read("scripts/native/Generate-TSMNativeMap.ps1");
  const py = read("tsm-native/Content/Python/tsm_generate_native_map.py");
  const native = workflow.split(/^  package-windows:\s*$/m)[1]?.split(/^  package-macos:\s*$/m)[0];
  assert.ok(native);
  assert.match(native, /Generate-TSMNativeMap\.ps1/);
  assert.ok(native.indexOf("Generate-TSMNativeMap.ps1") < native.indexOf("Build native Windows package"));
  assert.match(cook, /-map=\/Game\/TSM\/Maps\/TSMNative/);
  assert.match(generate, /TSMNative\.umap/);
  assert.match(py, /is_partitioned_world=True/);
  assert.match(py, /data-manifest\.json/);
  assert.match(py, /TSM_LOCAL_TILESET/);
  assert.match(py, /tileset\.relative_to\(staged\)/);
  assert.doesNotMatch(py, /https?:\/\//);
});
