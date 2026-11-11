#!/usr/bin/env node
/** Idempotent local/CI helper: ensure experience + public-interest routes appear in router.tsx */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const routerPath = join(root, "tsm-console/src/lib/router.tsx");
if (!existsSync(routerPath)) {
  console.error("router.tsx missing");
  process.exit(1);
}
let text = readFileSync(routerPath, "utf8");
let changed = false;

function ensureRoute(marker, block) {
  if (text.includes(marker)) return;
  const cinematic =
    "{ path: 'cinematic', hydrateFallbackElement: <RouteLoadingFallback label=\"the cinematic 3D twin\" />, lazy: async () => ({ Component: (await import('../routes/CinematicView')).default }) },";
  if (text.includes(cinematic)) {
    text = text.replace(cinematic, `${cinematic}\n  ${block}`);
    changed = true;
    console.log("wired", marker);
    return;
  }
  const eng =
    "{ path: 'cinematic-engineering', hydrateFallbackElement: <RouteLoadingFallback label=\"the cinematic engineering experience\" />, lazy: async () => ({ Component: (await import('../routes/CinematicEngineeringExperienceView')).default }) },";
  if (text.includes(eng)) {
    text = text.replace(eng, `${block}\n  ${eng}`);
    changed = true;
    console.log("wired", marker);
  }
}

ensureRoute(
  "path: 'public-interest'",
  "{ path: 'public-interest', hydrateFallbackElement: <RouteLoadingFallback label=\"public-interest finish\" />, lazy: async () => ({ Component: (await import('../routes/PublicInterestFinishView')).default }) },"
);

ensureRoute(
  "path: 'experiences'",
  "{ path: 'experiences', hydrateFallbackElement: <RouteLoadingFallback label=\"experience hub\" />, lazy: async () => ({ Component: (await import('../experiences/ExperienceHubView')).default }) },"
);

if (!text.includes("cinematic-engineering")) {
  const needle =
    "{ path: 'cinematic', hydrateFallbackElement: <RouteLoadingFallback label=\"the cinematic 3D twin\" />, lazy: async () => ({ Component: (await import('../routes/CinematicView')).default }) },";
  if (!text.includes(needle)) {
    console.error("cinematic needle not found — manual wire required");
    process.exit(1);
  }
  const insert = `${needle}
  { path: 'public-interest', hydrateFallbackElement: <RouteLoadingFallback label="public-interest finish" />, lazy: async () => ({ Component: (await import('../routes/PublicInterestFinishView')).default }) },
  { path: 'experiences', hydrateFallbackElement: <RouteLoadingFallback label="experience hub" />, lazy: async () => ({ Component: (await import('../experiences/ExperienceHubView')).default }) },
  { path: 'cinematic-engineering', hydrateFallbackElement: <RouteLoadingFallback label="the cinematic engineering experience" />, lazy: async () => ({ Component: (await import('../routes/CinematicEngineeringExperienceView')).default }) },
  { path: 'workspaces', hydrateFallbackElement: <RouteLoadingFallback label="workspace shell" />, lazy: async () => ({ Component: (await import('../workspaces/WorkspaceShell')).default }) },
  { path: 'experience/living-river', hydrateFallbackElement: <RouteLoadingFallback label="Living River Valley" />, lazy: async () => ({ Component: (await import('../experiences/LivingRiverValleyView')).default }) },
  { path: 'experience/scenario-sandbox', hydrateFallbackElement: <RouteLoadingFallback label="scenario sandbox" />, lazy: async () => ({ Component: (await import('../experiences/EngineeringScenarioSandboxView')).default }) },
  { path: 'experience/evidence-storyboard', hydrateFallbackElement: <RouteLoadingFallback label="evidence storyboard" />, lazy: async () => ({ Component: (await import('../experiences/EvidenceCinemaStoryboardView')).default }) },`;
  text = text.replace(needle, insert);
  changed = true;
  console.log("wired full experience route set");
}

if (!changed) {
  console.log("already wired");
  process.exit(0);
}
writeFileSync(routerPath, text);
console.log("wrote", routerPath);
