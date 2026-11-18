/** Public bridge of PDF UE5.6 index terms to TSM web/native implementations.
 * This is not a browser Unreal loader, certified source map, or Shipping proof.
 * Entries are curated, never generated from assumptions about runtime availability.
 */
export type UnrealBridgeBoundary = 'EDITOR_PIPELINE' | 'NATIVE_RUNTIME' | 'DEVELOPER_TEST' | 'PUBLIC_WEB_ANALOG';
export type UnrealBridgeStatus = 'WEB_PRESENTATION' | 'SOURCE_BOUND_PARTIAL' | 'NATIVE_NOT_VERIFIED' | 'TOOLCHAIN_ONLY';
export type UnrealBridgeFilter = UnrealBridgeBoundary | 'all';
export interface UnrealBridgeEntry {
  id: string;
  unrealTerm: string;
  indexVersion: '5.6';
  boundary: UnrealBridgeBoundary;
  status: UnrealBridgeStatus;
  browserRole: string;
  nativeRole: string;
  repositoryPath: string;
  epicReference: string;
  evidenceCaveat: string;
}
export const UNREAL_WEB_BRIDGE: readonly UnrealBridgeEntry[] = [
  {
    "id": "world-partition-hlod",
    "unrealTerm": "WorldPartitionEditor / World Partition HLOD Utilities",
    "indexVersion": "5.6",
    "boundary": "EDITOR_PIPELINE",
    "status": "SOURCE_BOUND_PARTIAL",
    "browserRole": "Browser streams independently published 3D Tiles and building layers, not Unreal World Partition cells.",
    "nativeRole": "UE editor commandlets build world-partition cells and HLOD proxy meshes before packaging.",
    "repositoryPath": "tsm-console/src/routes/CesiumRegionalTwinView.tsx",
    "epicReference": "https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition---hierarchical-level-of-detail-in-unreal-engine",
    "evidenceCaveat": "Published building inventory is partial; editor HLOD output is not native Shipping proof."
  },
  {
    "id": "georeferencing",
    "unrealTerm": "GeoReferencing",
    "indexVersion": "5.6",
    "boundary": "NATIVE_RUNTIME",
    "status": "SOURCE_BOUND_PARTIAL",
    "browserRole": "Web map identifies source CRS and vertical-datum evidence instead of treating screen coordinates as engineering elevations.",
    "nativeRole": "UE georeferencing can position imported engineering assets using reviewed coordinate transforms.",
    "repositoryPath": "packages/geo/src/geodesy/CrsValidator.ts",
    "epicReference": "https://dev.epicgames.com/documentation/en-us/unreal-engine/georeferencing-a-level-in-unreal-engine",
    "evidenceCaveat": "No browser display verifies a GEOID/NAVD88 transformation or control-point accuracy."
  },
  {
    "id": "landscape-heightfield",
    "unrealTerm": "Landscape / Virtual Heightfield Mesh",
    "indexVersion": "5.6",
    "boundary": "NATIVE_RUNTIME",
    "status": "SOURCE_BOUND_PARTIAL",
    "browserRole": "MapLibre terrain, hillshade and terrain-preview layers are presentation surfaces for source-bound elevation data.",
    "nativeRole": "Landscape and heightfield components support true native terrain geometry and material streaming.",
    "repositoryPath": "tsm-console/src/components/TriStateDigitalTwinMap.tsx",
    "epicReference": "https://dev.epicgames.com/documentation/en-us/unreal-engine/landscape-overview",
    "evidenceCaveat": "Full Tri-State DEM coverage, nodata assessment and vertical accuracy remain unverified."
  },
  {
    "id": "sequencer-camera",
    "unrealTerm": "Sequencer / LevelSequence / CinematicCamera",
    "indexVersion": "5.6",
    "boundary": "PUBLIC_WEB_ANALOG",
    "status": "WEB_PRESENTATION",
    "browserRole": "Cinematic camera paths provide browser navigation and visual storytelling, not surveyed camera or flood evidence.",
    "nativeRole": "UE Level Sequences and cinematic cameras animate the actual native world and film shots.",
    "repositoryPath": "tsm-console/src/lib/cinematic/camera-tour.ts",
    "epicReference": "https://dev.epicgames.com/documentation/en-us/unreal-engine/cinematics-and-movie-making-in-unreal-engine",
    "evidenceCaveat": "A browser camera tour is only a visual presentation, not a UE frame render."
  },
  {
    "id": "movie-render-queue",
    "unrealTerm": "Movie Render Queue / Movie Render Pipeline",
    "indexVersion": "5.6",
    "boundary": "NATIVE_RUNTIME",
    "status": "NATIVE_NOT_VERIFIED",
    "browserRole": "A public page may present only separately verified pre-rendered films; it cannot run a UE render farm.",
    "nativeRole": "Headless automation prepares validated scenes; UE renderer produces real frames on a graphical-capable runner.",
    "repositoryPath": "scripts/cinema/Invoke-TSMVerifiedMovieRender.ps1",
    "epicReference": "https://dev.epicgames.com/documentation/en-us/unreal-engine/movie-render-pipeline-in-unreal-engine",
    "evidenceCaveat": "UE5.8 Shipping or actual Movie Render Queue frames require headed runner receipts and source proof."
  },
  {
    "id": "niagara-effects",
    "unrealTerm": "Niagara / Volumetrics",
    "indexVersion": "5.6",
    "boundary": "PUBLIC_WEB_ANALOG",
    "status": "WEB_PRESENTATION",
    "browserRole": "Optional web mist and atmospheric lighting are presentation effects independent of hydrologic measurements.",
    "nativeRole": "Niagara can drive native rain, fog and particle effects in cinematic scenes.",
    "repositoryPath": "tsm-console/src/components/TriStateDigitalTwinMap.tsx",
    "epicReference": "https://dev.epicgames.com/documentation/en-us/unreal-engine/creating-visual-effects-in-niagara-for-unreal-engine",
    "evidenceCaveat": "No simulated precipitation, flood depth or measured water level is established by visual effects."
  },
  {
    "id": "umg-common-ui",
    "unrealTerm": "UMG / Common UI Plugin",
    "indexVersion": "5.6",
    "boundary": "PUBLIC_WEB_ANALOG",
    "status": "WEB_PRESENTATION",
    "browserRole": "Accessible React controls, collapsible GIS menus and operator status indicators remain usable without Unreal.",
    "nativeRole": "UMG and Slate compose native HUD menus and accessible operator interactions in a built UE runtime.",
    "repositoryPath": "tsm-console/src/components/RootLayout.tsx",
    "epicReference": "https://dev.epicgames.com/documentation/unreal-engine/umg-ui-designer-quick-start-guide-in-unreal-engine?lang=en-US",
    "evidenceCaveat": "React menu behavior is not proof of functional native UMG/Slate packaged widgets."
  },
  {
    "id": "sqlite",
    "unrealTerm": "SQLite / SQLite Support",
    "indexVersion": "5.6",
    "boundary": "NATIVE_RUNTIME",
    "status": "NATIVE_NOT_VERIFIED",
    "browserRole": "The static public page reads published, provenance-labelled JSON; it does not expose or mutate a local SQLite store.",
    "nativeRole": "An offline native application may use local SQLite or SpatiaLite snapshots and validate them on startup.",
    "repositoryPath": "tsm-native/Source/TSMNative/TSMEngineeringHUD.cpp",
    "epicReference": "https://dev.epicgames.com/documentation/unreal-engine/API/PluginIndex?application_version=5.6",
    "evidenceCaveat": "No native packaged-app SQLite/SpatiaLite data validation is proved by a web page."
  },
  {
    "id": "gauntlet-automation",
    "unrealTerm": "Gauntlet / WidgetAutomationTests / FunctionalTesting",
    "indexVersion": "5.6",
    "boundary": "DEVELOPER_TEST",
    "status": "TOOLCHAIN_ONLY",
    "browserRole": "Cypress exercises browser menus, test-fixture overlays and captures headed screenshots for public UX regression.",
    "nativeRole": "Gauntlet and Unreal widget automation can test cooked and packaged runtime workflows on actual Windows hardware.",
    "repositoryPath": ".github/workflows/ptdt-e2e-visual.yml",
    "epicReference": "https://dev.epicgames.com/documentation/en-us/unreal-engine/gauntlet-automation-framework-in-unreal-engine",
    "evidenceCaveat": "Passing Cypress tests is not proof of any Gauntlet or native Shipping acceptance run."
  },
  {
    "id": "data-layer-editor",
    "unrealTerm": "DataLayerEditor / WorldPartitionEditor",
    "indexVersion": "5.6",
    "boundary": "EDITOR_PIPELINE",
    "status": "WEB_PRESENTATION",
    "browserRole": "Public GIS layer switches operate on published maps and never edit authoritative engineering datasets.",
    "nativeRole": "Editor modules organize, activate and author Unreal world layers before packaging.",
    "repositoryPath": "tsm-console/src/components/RealWorldTwinMap.tsx",
    "epicReference": "https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition---data-layers-in-unreal-engine",
    "evidenceCaveat": "An editor module cannot run in GitHub Pages or be used as evidence of published data completeness."
  }
];
export function filterUnrealWebBridge(query = '', boundary: UnrealBridgeFilter = 'all'): UnrealBridgeEntry[] {
  const term = query.trim().toLocaleLowerCase('en-US');
  return UNREAL_WEB_BRIDGE.filter((row) => {
    if (boundary !== 'all' && row.boundary !== boundary) return false;
    return !term || [row.unrealTerm, row.browserRole, row.nativeRole, row.evidenceCaveat]
      .some((field) => field.toLocaleLowerCase('en-US').includes(term));
  });
}
