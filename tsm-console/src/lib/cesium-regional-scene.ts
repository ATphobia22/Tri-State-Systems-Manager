import {
  ArcType, Cartesian3, type Cesium3DTile, Cesium3DTileFeature, Cesium3DTileStyle, ClassificationType, Cesium3DTileset, CesiumTerrainProvider, CesiumWidget,
  Color, ColorGeometryInstanceAttribute, createOsmBuildingsAsync, Credit, EllipsoidTerrainProvider, GeometryInstance,
  Ion, IonImageryProvider, ImageryLayer,
  GroundPolylineGeometry, GroundPolylinePrimitive, HeightReference, JulianDate, LabelCollection,
  LabelStyle, Math as CesiumMath, PolylineColorAppearance, ScreenSpaceEventHandler,
  ScreenSpaceEventType, UrlTemplateImageryProvider, Rectangle, SingleTileImageryProvider,
  TextureMagnificationFilter, TextureMinificationFilter,
} from 'cesium';
import { loadMountVernonCityScene } from './mount-vernon-city-scene';
import { ContextRecoveryManager } from './webgl-context-recovery';
import { inspectOsmBuilding, osmBuildingStyleRules, type OsmBuildingStyle } from './cesium-osm-building-style';
import { BUILDING_SCREEN_SPACE_ERROR, ION_CATALOG, ION_IMAGERY_ASSETS, type BuildingPreviewDetail, type IonImageryPreset, type TerrainPreviewSource } from './cesium-ion-assets';

export const CESIUM_VIEWS = [
  { id: 'mount-vernon', name: 'Mount Vernon, IN', lon: -87.898, lat: 37.932, range: 4300, heading: 15 },
  { id: 'confluence', name: 'Ohio–Wabash confluence', lon: -88.023, lat: 37.799, range: 8200, heading: 26 },
  { id: 'new-harmony', name: 'New Harmony, IN', lon: -87.941, lat: 38.128, range: 4600, heading: 335 },
  { id: 'evansville', name: 'Evansville, IN', lon: -87.573, lat: 37.975, range: 6500, heading: 340 },
  { id: 'henderson', name: 'Henderson, KY', lon: -87.594, lat: 37.841, range: 6500, heading: 353 },
  { id: 'shawneetown', name: 'Shawneetown, IL', lon: -88.187, lat: 37.716, range: 7300, heading: 12 },
  { id: 'overview', name: 'Tri-State overview', lon: -87.79, lat: 37.99, range: 82000, heading: 352 },
  // Navigational camera anchors, not exact county boundaries or surveyed monuments.
  { id: 'white-il', name: 'Carmi, IL · White County', lon: -88.172, lat: 38.086, range: 6900, heading: 20 },
  { id: 'union-ky', name: 'Morganfield, KY · Union County', lon: -87.917, lat: 37.684, range: 6900, heading: 25 },
] as const;

export const REPLAY_DATES = Array.from({ length: 30 }, (_, i) => `2025-04-${String(i + 1).padStart(2, '0')}`);
export type ReplayRow = { date: string; value: number; approval: string; qualifier: string | null };
export type Replay = {
  stationId: string; name: string; lon: number; lat: number; label: string; unit: string;
  source: string; rows: ReplayRow[];
};
const BASE = import.meta.env.BASE_URL;
const VECTORS = `${BASE}data/cesium-regional/`;
const BUILDINGS = `${VECTORS}posey-buildings/`;
const IMAGERY = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer';
export type SceneLayer = 'terrain' | 'buildings' | 'roads' | 'city' | 'osmContext';
export type LayerState = { state: 'loading' | 'ready' | 'unavailable'; detail: string };
export type PickedFeature = { title: string; detail: string };
type LineItems = { features: GeoJSON.Feature[]; metadata: { featureCount: number; countyCount: number } };
export type ScreeningBounds = readonly [number, number, number, number];
export type ScreeningFrame = { levelMNavd88: number; connectedCells: number; bounds: ScreeningBounds; rows: number; cols: number };

export async function loadCityScreening(signal: AbortSignal): Promise<ScreeningFrame[]> {
  const response = await fetch(`${VECTORS}screening.json`, { signal });
  if (!response.ok) throw new Error('City screening archive unavailable');
  const data = await response.json();
  const bounds: unknown = data.bounds;
  if (data.classification !== 'SCENARIO' || data.verticalDatum !== 'NAVD88' ||
      !Array.isArray(bounds) || bounds.length !== 4 ||
      !bounds.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)) ||
      !((bounds[0] as number) >= -180 && (bounds[2] as number) <= 180 &&
        (bounds[1] as number) >= -90 && (bounds[3] as number) <= 90 &&
        (bounds[0] as number) < (bounds[2] as number) && (bounds[1] as number) < (bounds[3] as number)) ||
      !Number.isInteger(data.rows) || !Number.isInteger(data.cols) ||
      data.rows <= 0 || data.cols <= 0 || data.rows > 4096 || data.cols > 4096 ||
      !Array.isArray(data.frames) ||
      !data.frames.every((frame: ScreeningFrame) => Number.isInteger(frame.levelMNavd88) && Number.isInteger(frame.connectedCells) &&
        frame.connectedCells >= 0 && frame.connectedCells <= data.rows * data.cols)) {
    throw new Error('Invalid city screening archive or geographic rectangle');
  }
  return data.frames.map((frame: ScreeningFrame) => ({
    levelMNavd88: frame.levelMNavd88, connectedCells: frame.connectedCells,
    bounds: bounds as [number, number, number, number],
    rows: data.rows, cols: data.cols,
  }));
}

function cameraLocation(view: typeof CESIUM_VIEWS[number], headingOffsetDeg = 0, rangeScale = 1) {
  const pitch = -CesiumMath.PI / 3;
  const heading = CesiumMath.toRadians(view.heading + headingOffsetDeg);
  const range = view.range * rangeScale;
  const distance = range * Math.cos(pitch);
  const lat = view.lat - distance * Math.cos(heading) / 111_133;
  const lon = view.lon - distance * Math.sin(heading) / (111_320 * Math.cos(CesiumMath.toRadians(view.lat)));
  return {
    destination: Cartesian3.fromDegrees(lon, lat, range * -Math.sin(pitch) + 100),
    orientation: { heading, pitch, roll: 0 },
  };
}

function line(positions: GeoJSON.Position[], color: Color, width: number, id: PickedFeature) {
  return new GeometryInstance({
    geometry: new GroundPolylineGeometry({
      positions: positions.map(([lon, lat]) => Cartesian3.fromDegrees(lon!, lat!)),
      width, arcType: ArcType.GEODESIC,
    }),
    attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
    id,
  });
}

function roadLines(feature: GeoJSON.Feature, city = false): GeometryInstance[] {
  const { geometry, properties } = feature;
  const paths = geometry.type === 'MultiLineString' ? geometry.coordinates
    : geometry.type === 'LineString' ? [geometry.coordinates] : [];
  const major = ['S1100', 'S1200'].includes(properties?.mtfcc);
  const title = String(properties?.name || 'Unnamed road centerline');
  const source = city ? 'Indiana GIO · Mount Vernon area' : 'Census TIGER/Line 2024';
  const color = city ? Color.fromCssColorString('#ffdf9c').withAlpha(0.82)
    : Color.fromCssColorString(major ? '#eac186' : '#f1e9d9').withAlpha(major ? 0.73 : 0.48);
  return paths.filter((path) => path.length >= 2).map((path) =>
    line(path, color, city ? 2 : major ? 2.6 : 1.3,
      { title, detail: `${source} · ${properties?.source_objectid ?? properties?.source_id ?? ''}` }));
}

function footprintLines(feature: GeoJSON.Feature, detail = 'Roof height not supplied'): GeometryInstance[] {
  const { geometry, properties } = feature;
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates
    : geometry.type === 'Polygon' ? [geometry.coordinates] : [];
  return polygons.flatMap((polygon) => polygon.filter((ring) => ring.length >= 4).map((ring) =>
    line(ring, Color.fromCssColorString('#8ed1ff').withAlpha(0.78), 1.4, {
      title: 'Indiana GIO building footprint',
      detail: `OBJECTID ${properties?.source_objectid ?? ''} · ${detail}`,
    })));
}

export async function loadCesiumReplay(signal: AbortSignal): Promise<Replay[]> {
  const response = await fetch(`${VECTORS}replay.json`, { signal });
  if (!response.ok) throw new Error('USGS replay archive unavailable');
  const data = await response.json() as { series?: Replay[] };
  if (!Array.isArray(data.series) || !data.series.length) throw new Error('USGS replay archive is empty');
  return data.series;
}

export function mountCesiumRegionalScene(
  element: HTMLElement,
  onLayer: (layer: SceneLayer, status: LayerState) => void,
  onPick: (feature: PickedFeature | null) => void,
  onError: (message: string) => void,
  onImageryError: () => void,
  onContextStatus: (state: 'lost' | 'restored') => void,
  onScreeningError?: (message: string) => void,
) {
  const abort = new AbortController();
  let stopped = false;
  const ionToken = (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined)?.trim();
  // Only the online browser scene uses an ion token; native/offline builds keep local snapshots.
  if (ionToken) Ion.defaultAccessToken = ionToken;
  const widget = new CesiumWidget(element, {
    baseLayer: false, requestRenderMode: true, maximumRenderTimeChange: Infinity,
    // Keep globe depth buffers single-sampled for the streamed layers.
    msaaSamples: 1,
    targetFrameRate: 45, scene3DOnly: true, showRenderLoopErrors: false,
  });
  const { scene, camera } = widget;
  const gl = widget.canvas.getContext('webgl2');
  const recovery = new ContextRecoveryManager({
    onStateChange(state) {
      if (stopped) return;
      if (state === 'lost') {
        widget.useDefaultRenderLoop = false;
        onContextStatus('lost');
      } else if (state === 'restored') {
        onContextStatus('restored');
      }
    },
  });
  recovery.attach(widget.canvas);
  scene.renderError.addEventListener((_scene: unknown, error: unknown) => {
    widget.useDefaultRenderLoop = false;
    // The browser's context loss event drives a full widget rebuild on restoration.
    if (gl?.isContextLost()) return;
    console.error('Cesium render loop failed', error, `Drawing buffer ${scene.drawingBufferWidth} × ${scene.drawingBufferHeight}`);
    onError('Cesium stopped rendering.');
  });
  scene.globe!.depthTestAgainstTerrain = true;
  scene.globe!.baseColor = Color.fromCssColorString('#545f50');
  scene.globe!.enableLighting = true;
  scene.fog.enabled = true;
  scene.verticalExaggeration = 1;
  widget.resolutionScale = Math.min(1, 1.5 / (window.devicePixelRatio || 1));
  const labels = scene.primitives.add(new LabelCollection({ scene })) as LabelCollection;
  const graphics = new Map<SceneLayer, GroundPolylinePrimitive[]>();
  const visibility: Record<SceneLayer, boolean> = { terrain: true, buildings: true, roads: true, city: false, osmContext: false };
  let terrain: CesiumTerrainProvider | undefined;
  let worldTerrain: CesiumTerrainProvider | undefined;
  let candidateTerrain: CesiumTerrainProvider | undefined;
  let terrainRequest = 0;
  let terrainSource: TerrainPreviewSource = 'local';
  const ellipsoid = new EllipsoidTerrainProvider();
  let buildings: Cesium3DTileset | undefined;
  let osmBuildings: Cesium3DTileset | undefined;
  let osmOriginalStyle: Cesium3DTileStyle | undefined;
  let osmRequested = false;
  let imageryRequest = 0;
  let ionImagery: ImageryLayer | undefined;
  let imageryShown = true;
  let detailLevel: BuildingPreviewDetail = 'balanced';
  let osmStyleMode: OsmBuildingStyle = 'native';
  let cityStarted = false;
  let screening: ImageryLayer | undefined;
  let screeningGeneration = 0;
  const update = (layer: SceneLayer, state: LayerState['state'], detail: string) => {
    if (!stopped) onLayer(layer, { state, detail });
  };

  const addLines = (layer: 'roads' | 'city' | 'buildings', items: GeometryInstance[]) => {
    if (!items.length) throw new Error('Empty line layer');
    const primitive = new GroundPolylinePrimitive({
      geometryInstances: items,
      appearance: new PolylineColorAppearance({ translucent: true }),
      show: visibility[layer],
      classificationType: ClassificationType.TERRAIN,
    });
    scene.groundPrimitives.add(primitive);
    graphics.set(layer, [...(graphics.get(layer) ?? []), primitive]);
    scene.requestRender();
    return primitive;
  };

  const loadTerrain = async () => {
    update('terrain', 'loading', 'USGS 3DEP terrain is loading');
    try {
      const root = `${VECTORS}terrain/`;
      // Cesium silently substitutes a different terrain format when layer.json is 404.
      const response = await fetch(`${root}layer.json`, { signal: abort.signal });
      if (!response.ok || (await response.json()).format !== 'heightmap-1.0') throw new Error('Terrain metadata unavailable');
      const provider = await CesiumTerrainProvider.fromUrl(root, { requestWaterMask: false });
      if (stopped) return;
      terrain = provider;
      if (visibility.terrain && terrainSource === 'local') widget.terrainProvider = provider;
      provider.errorEvent.addEventListener(() => update('terrain', 'unavailable', 'A USGS terrain tile failed to load'));
      update('terrain', 'ready', 'USGS 3DEP · regional relief');
      scene.requestRender();
    } catch {
      update('terrain', 'unavailable', 'USGS terrain unavailable · reference globe');
    }
  };

  const loadBuildings = async () => {
    update('buildings', 'loading', 'Posey LoD1 tiles are loading');
    try {
      const response = await fetch(`${BUILDINGS}missing-height-footprints.json`, { signal: abort.signal });
      if (!response.ok) throw new Error('Posey footprint overlay unavailable');
      const data = await response.json() as { features: GeoJSON.Feature[]; metadata: { featureCount: number } };
      if (stopped) return;
      if (!Array.isArray(data.features) || data.features.length !== data.metadata.featureCount) {
        throw new Error('Posey footprint overlay count mismatch');
      }
      addLines('buildings', data.features.flatMap((feature) => footprintLines(feature, '3D height unavailable in this preview')));
      const tileset = await Cesium3DTileset.fromUrl(`${BUILDINGS}tileset.json`, {
        maximumScreenSpaceError: BUILDING_SCREEN_SPACE_ERROR[detailLevel], cacheBytes: 96 * 1024 * 1024,
        maximumCacheOverflowBytes: 64 * 1024 * 1024, preloadWhenHidden: false,
      });
      if (stopped) { tileset.destroy(); return; }
      buildings = scene.primitives.add(tileset) as Cesium3DTileset;
      buildings.show = visibility.buildings;
      let failed = false;
      const removeVisible = buildings.tileVisible.addEventListener((tile: Cesium3DTile) => {
        if (tile.content.featuresLength === 0) return;
        removeVisible();
        if (!failed) update('buildings', 'ready', 'Posey County · 20,517 LoD1 meshes and 2,565 footprint-only IDs');
      });
      buildings.tileFailed.addEventListener((error: { url: string; message: string }) => {
        if (failed) return;
        failed = true;
        console.error('Posey building tile failed', error.url, error.message);
        update('buildings', 'unavailable', 'A Posey building tile failed to load');
      });
      scene.requestRender();
    } catch (error) {
      if (!stopped) console.error('Posey building layer failed', error);
      update('buildings', 'unavailable', 'Posey mesh tiles unavailable');
    }
  };

  const loadOsmBuildings = async () => {
    if (!ionToken || osmRequested) {
      if (!ionToken) update('osmContext', 'unavailable', 'Cesium ion public-scoped token not configured');
      return;
    }
    osmRequested = true;
    update('osmContext', 'loading', 'Fetching Cesium OSM contextual buildings');
    try {
      // Cesium's dedicated factory applies curated OSM default colors from tags.
      // fromIonAssetId(96188) lacks that documented default-style setup.
      const tileset = await createOsmBuildingsAsync();
      tileset.maximumScreenSpaceError = BUILDING_SCREEN_SPACE_ERROR[detailLevel];
      if (stopped) { tileset.destroy(); return; }
      osmOriginalStyle = tileset.style;
      osmBuildings = scene.primitives.add(tileset) as Cesium3DTileset;
      const initialRules = osmBuildingStyleRules(osmStyleMode);
      osmBuildings.style = initialRules ? new Cesium3DTileStyle(initialRules) : osmOriginalStyle;
      osmBuildings.show = visibility.osmContext;
      update('osmContext', 'ready', 'Cesium OSM Buildings · online context, not reviewed Posey LoD2');
      scene.requestRender();
    } catch {
      osmRequested = false;
      update('osmContext', 'unavailable', 'OSM buildings unavailable; local Posey tiles remain selectable');
    }
  };

  const loadRoads = async () => {
    update('roads', 'loading', 'Regional road centerlines are loading');
    try {
      const response = await fetch(`${VECTORS}roads.json`, { signal: abort.signal });
      if (!response.ok) throw new Error('Road archive unavailable');
      const data: LineItems = await response.json();
      if (stopped) return;
      if (!Array.isArray(data.features) || data.features.length !== data.metadata.featureCount) throw new Error('Road count mismatch');
      // Separate county primitives keep worker input bounded and preserve pickable source identities.
      const counties = new Map<string, GeometryInstance[]>();
      for (const feature of data.features) {
        const county = String(feature.properties?.county_geoid);
        const items = counties.get(county) ?? [];
        items.push(...roadLines(feature));
        counties.set(county, items);
      }
      if (counties.size !== data.metadata.countyCount) throw new Error('County count mismatch');
      for (const items of counties.values()) addLines('roads', items);
      update('roads', 'ready', `${data.features.length.toLocaleString()} centerlines · ${counties.size} counties · Census TIGER/Line 2024`);
    } catch {
      update('roads', 'unavailable', 'Regional roads unavailable');
    }
  };

  const loadCity = async () => {
    cityStarted = true;
    update('city', 'loading', 'Checking Indiana GIO city archive');
    try {
      const { scene: city } = await loadMountVernonCityScene(`${BASE}mount-vernon-scene/`, abort.signal);
      if (stopped) return;
      addLines('city', city.roads.features.flatMap((feature) => roadLines(feature, true)));
      addLines('city', city.buildings.features.flatMap((feature) => footprintLines(feature)));
      update('city', 'ready', `${city.buildings.features.length.toLocaleString()} footprints and ${city.roads.features.length.toLocaleString()} roads · Mount Vernon area`);
    } catch {
      cityStarted = false;
      update('city', 'unavailable', 'Indiana GIO city archive unavailable or failed integrity checks');
    }
  };

  const imagery = new UrlTemplateImageryProvider({
    url: `${IMAGERY}/tile/{z}/{y}/{x}`, maximumLevel: 16,
    credit: new Credit('USGS The National Map · USDA orthoimagery', true),
  });
  imagery.errorEvent.addEventListener(() => { if (!stopped) onImageryError(); });
  const aerial = widget.imageryLayers.addImageryProvider(imagery);
  const holder = new ScreenSpaceEventHandler(widget.canvas);
  holder.setInputAction(({ position }: { position: Parameters<typeof scene.pick>[0] }) => {
    const hit = scene.pick(position);
    if (hit instanceof Cesium3DTileFeature) {
      if (hit.tileset === osmBuildings) {
        onPick(inspectOsmBuilding(hit));
      } else if (hit.tileset === buildings) {
        const id = hit.getProperty('OBJECTID') ?? hit.getProperty('sourceObjectId') ?? hit.getProperty('source_object_id');
        onPick({ title: 'Posey LiDAR building mesh', detail: id == null ? 'Derived LoD1 preview' : `OBJECTID ${String(id)} · Derived LoD1 preview` });
      } else {
        onPick({ title: '3D Tiles feature', detail: 'Source and confidence not yet established' });
      }
    } else {
      onPick(hit?.id?.title ? hit.id as PickedFeature : null);
    }
  }, ScreenSpaceEventType.LEFT_CLICK);

  const fly = (index: number, duration: number, complete?: () => void, cancel?: () => void) => {
    const view = CESIUM_VIEWS[index];
    if (!view || stopped) return;
    const { destination, orientation } = cameraLocation(view);
    camera.flyTo({ destination, orientation, duration, complete, cancel });
    scene.requestRender();
  };

  void loadTerrain();
  void loadBuildings();
  void loadRoads();

  return {
    fly,
    setShotCamera(viewId: string, headingOffsetDeg: number, rangeScale: number) {
      const view = CESIUM_VIEWS.find(({ id }) => id === viewId);
      if (!view || stopped) return;
      camera.setView(cameraLocation(view, headingOffsetDeg, rangeScale));
      scene.requestRender();
    },
    stopFlight() { camera.cancelFlight(); },
    setLayer(layer: SceneLayer, show: boolean) {
      visibility[layer] = show;
      // Local Posey and global OSM building geometry are mutually exclusive to prevent double roofs.
      if (show && layer === 'osmContext') {
        visibility.buildings = false;
        if (buildings) buildings.show = false;
        for (const primitive of graphics.get('buildings') ?? []) primitive.show = false;
      }
      if (show && layer === 'buildings') {
        visibility.osmContext = false;
        if (osmBuildings) osmBuildings.show = false;
      }
      if (layer === 'terrain') {
        widget.terrainProvider = show
          ? (terrainSource === 'world' ? worldTerrain : terrainSource === 'candidate2426648' ? candidateTerrain : terrain) ?? ellipsoid : ellipsoid;
      }
      if (layer === 'buildings' && buildings) buildings.show = show;
      if (layer === 'osmContext') {
        if (osmBuildings) osmBuildings.show = show;
        else if (show) void loadOsmBuildings();
      }
      if (layer === 'city' && show && !cityStarted) void loadCity();
      for (const primitive of graphics.get(layer) ?? []) primitive.show = show;
      scene.requestRender();
    },
    setBuildingDetail(detail: BuildingPreviewDetail) {
      detailLevel = detail;
      if (buildings) buildings.maximumScreenSpaceError = BUILDING_SCREEN_SPACE_ERROR[detail];
      if (osmBuildings) osmBuildings.maximumScreenSpaceError = BUILDING_SCREEN_SPACE_ERROR[detail];
      scene.requestRender();
    },
    setOsmBuildingStyle(mode: OsmBuildingStyle) {
      osmStyleMode = mode;
      if (osmBuildings) {
        const rules = osmBuildingStyleRules(mode);
        osmBuildings.style = rules ? new Cesium3DTileStyle(rules) : osmOriginalStyle;
      }
      scene.requestRender();
    },
    async setTerrainSource(source: TerrainPreviewSource): Promise<boolean> {
      if (source !== 'local' && !ionToken) throw new Error('Cesium ion token not configured');
      const generation = ++terrainRequest;
      try {
        if (source === 'world' && !worldTerrain) {
          const provider = await CesiumTerrainProvider.fromIonAssetId(ION_CATALOG.worldTerrain);
          if (stopped || generation !== terrainRequest) return false;
          worldTerrain = provider;
        }
        if (source === 'candidate2426648' && !candidateTerrain) {
          // Preview only: this asset has no verified county coverage, license or NAVD88 receipt.
          const provider = await CesiumTerrainProvider.fromIonAssetId(ION_CATALOG.terrainCandidate2426648);
          if (stopped || generation !== terrainRequest) return false;
          candidateTerrain = provider;
        }
        if (stopped || generation !== terrainRequest) return false;
        terrainSource = source;
        if (visibility.terrain) {
          widget.terrainProvider = (source === 'world' ? worldTerrain
            : source === 'candidate2426648' ? candidateTerrain : terrain) ?? ellipsoid;
        }
        if (source === 'world') update('terrain', 'ready', 'Cesium World Terrain · online contextual elevation');
        else if (source === 'candidate2426648') update('terrain', 'ready', 'ion 2426648 · UNVERIFIED terrain preview; no engineering datum established');
        else if (terrain) update('terrain', 'ready', 'USGS 3DEP · local source-derived terrain');
        scene.requestRender();
        return true;
      } catch (error) {
        // Keep the previous terrain visible; do not let stale failures reset newer selections.
        throw error;
      }
    },
    setImagery(show: boolean) {
      imageryShown = show;
      aerial.show = show && !ionImagery;
      if (ionImagery) ionImagery.show = show;
      scene.requestRender();
    },
    async setImageryPreset(preset: IonImageryPreset) {
      const generation = ++imageryRequest;
      if (preset === 'usgs') {
        if (ionImagery) widget.imageryLayers.remove(ionImagery, true);
        ionImagery = undefined;
        aerial.show = imageryShown;
        scene.requestRender();
        return true;
      }
      if (!ionToken) throw new Error('Cesium ion token not configured');
      const provider = await IonImageryProvider.fromAssetId(ION_IMAGERY_ASSETS[preset]);
      if (stopped || generation !== imageryRequest) return false;
      const nextLayer = widget.imageryLayers.addImageryProvider(provider);
      nextLayer.show = imageryShown;
      if (ionImagery) widget.imageryLayers.remove(ionImagery, true);
      ionImagery = nextLayer;
      aerial.show = false;
      scene.requestRender();
      return true;
    },
    resize() { if (!stopped) { widget.resize(); scene.requestRender(); } },
    async setScreening(level: number | null, bounds?: ScreeningBounds, cols?: number, rows?: number): Promise<void> {
      const generation = ++screeningGeneration;
      if (screening) {
        widget.imageryLayers.remove(screening, true);
        screening = undefined;
        scene.requestRender();
      }
      if (level === null) return;
      if (!bounds || !bounds.every(Number.isFinite) || !(bounds[0] < bounds[2] && bounds[1] < bounds[3]) ||
          !Number.isInteger(cols) || !Number.isInteger(rows) || !cols || !rows || cols <= 0 || rows <= 0) {
        throw new Error('Screening extent has no verified geographic bounds and dimensions');
      }
      // Explicit dimensions avoid image-dimension discovery delays in
      // SingleTileImageryProvider.fromUrl under heavily loaded WebGL contexts.
      // These dimensions and each pixel's membership are independently
      // verified against the original source-cell mask by the Python release QA.
      const provider = new SingleTileImageryProvider({
        url: `${VECTORS}screening/${level}.png`,
        rectangle: Rectangle.fromDegrees(...bounds),
        tileWidth: cols, tileHeight: rows,
        credit: 'Hypothetical Mount Vernon fixed-level scenario (not regulatory)',
      });
      provider.errorEvent.addEventListener((failure) => {
        if (stopped || generation !== screeningGeneration) return;
        console.error('Cesium screening imagery failed', failure);
        if (screening) {
          widget.imageryLayers.remove(screening, true);
          screening = undefined;
          scene.requestRender();
        }
        onScreeningError?.('Screening extent unavailable.');
      });
      if (stopped || generation !== screeningGeneration) return;
      // Connected-cell evidence must retain crisp boundaries without alpha interpolation.
      const layer = new ImageryLayer(provider, {
        minificationFilter: TextureMinificationFilter.NEAREST,
        magnificationFilter: TextureMagnificationFilter.NEAREST,
      });
      widget.imageryLayers.add(layer);
      screening = layer;
      scene.requestRender();
    },
    setTime(date: string, hour: number, replay: Replay[]) {
      widget.clock.currentTime = JulianDate.fromIso8601(`${date}T05:00:00Z`);
      JulianDate.addMinutes(widget.clock.currentTime, hour * 60, widget.clock.currentTime);
      labels.removeAll();
      for (const series of replay) {
        const row = series.rows.find((value) => value.date === date);
        if (!row) continue;
        labels.add({
          position: Cartesian3.fromDegrees(series.lon, series.lat),
          heightReference: HeightReference.RELATIVE_TO_TERRAIN,
          text: `${series.name}\n${row.value.toLocaleString()} ${series.unit}`,
          font: '13px system-ui', style: LabelStyle.FILL_AND_OUTLINE, outlineWidth: 3, showBackground: true,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
      }
      scene.requestRender();
    },
    destroy() {
      stopped = true;
      abort.abort();
      screeningGeneration++;
      recovery.dispose();
      holder.destroy();
      widget.destroy();
    },
  };
}
