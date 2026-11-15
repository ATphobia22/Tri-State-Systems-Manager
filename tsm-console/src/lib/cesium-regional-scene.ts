import {
  ArcType, Cartesian3, type Cesium3DTile, Cesium3DTileFeature, ClassificationType, ConstantProperty, Cesium3DTileset, CesiumTerrainProvider, CesiumWidget,
  Color, ColorGeometryInstanceAttribute, Credit, EllipsoidTerrainProvider, GeoJsonDataSource, GeometryInstance,
  GroundPolylineGeometry, GroundPolylinePrimitive, HeightReference, JulianDate, LabelCollection,
  LabelStyle, Math as CesiumMath, PolylineColorAppearance, ScreenSpaceEventHandler,
  ScreenSpaceEventType, UrlTemplateImageryProvider, GroundPrimitive,
} from 'cesium';
import { loadMountVernonCityScene } from './mount-vernon-city-scene';
import { ContextRecoveryManager } from './webgl-context-recovery';

export const CESIUM_VIEWS = [
  { id: 'mount-vernon', name: 'Mount Vernon, IN', lon: -87.898, lat: 37.932, range: 4300, heading: 15 },
  { id: 'confluence', name: 'Ohio–Wabash confluence', lon: -88.023, lat: 37.799, range: 8200, heading: 26 },
  { id: 'new-harmony', name: 'New Harmony, IN', lon: -87.941, lat: 38.128, range: 4600, heading: 335 },
  { id: 'evansville', name: 'Evansville, IN', lon: -87.573, lat: 37.975, range: 6500, heading: 340 },
  { id: 'henderson', name: 'Henderson, KY', lon: -87.594, lat: 37.841, range: 6500, heading: 353 },
  { id: 'shawneetown', name: 'Shawneetown, IL', lon: -88.187, lat: 37.716, range: 7300, heading: 12 },
  { id: 'overview', name: 'Tri-State overview', lon: -87.79, lat: 37.99, range: 82000, heading: 352 },
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
export type SceneLayer = 'terrain' | 'buildings' | 'roads' | 'city';
export type LayerState = { state: 'loading' | 'ready' | 'unavailable'; detail: string };
export type PickedFeature = { title: string; detail: string };
type LineItems = { features: GeoJSON.Feature[]; metadata: { featureCount: number; countyCount: number } };
export type ScreeningFrame = { levelMNavd88: number; connectedCells: number };

export async function loadCityScreening(signal: AbortSignal): Promise<ScreeningFrame[]> {
  const response = await fetch(`${VECTORS}screening.json`, { signal });
  if (!response.ok) throw new Error('City screening archive unavailable');
  const data = await response.json();
  if (data.classification !== 'SCENARIO' || data.verticalDatum !== 'NAVD88' ||
      !Array.isArray(data.frames) || !data.frames.every((frame: ScreeningFrame) => Number.isInteger(frame.levelMNavd88))) {
    throw new Error('Invalid city screening archive');
  }
  return data.frames;
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
) {
  const abort = new AbortController();
  let stopped = false;
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
  const visibility: Record<SceneLayer, boolean> = { terrain: true, buildings: true, roads: true, city: false };
  let terrain: CesiumTerrainProvider | undefined;
  const ellipsoid = new EllipsoidTerrainProvider();
  let buildings: Cesium3DTileset | undefined;
  let cityStarted = false;
  let screening: GeoJsonDataSource | undefined;
  let screeningRequest: AbortController | undefined;
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
      if (visibility.terrain) widget.terrainProvider = provider;
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
        maximumScreenSpaceError: 18, cacheBytes: 96 * 1024 * 1024,
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
      const id = hit.getProperty('OBJECTID') ?? hit.getProperty('sourceObjectId') ?? hit.getProperty('source_object_id');
      onPick({ title: 'Posey LiDAR building mesh', detail: id == null ? 'Derived LoD1 preview' : `OBJECTID ${String(id)} · Derived LoD1 preview` });
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
      if (layer === 'terrain') widget.terrainProvider = show && terrain ? terrain : ellipsoid;
      if (layer === 'buildings' && buildings) buildings.show = show;
      if (layer === 'city' && show && !cityStarted) void loadCity();
      for (const primitive of graphics.get(layer) ?? []) primitive.show = show;
      scene.requestRender();
    },
    setImagery(show: boolean) { aerial.show = show; scene.requestRender(); },
    async setScreening(level: number | null): Promise<void> {
      screeningRequest?.abort();
      if (screening) {
        widget.dataSources.remove(screening, true);
        screening = undefined;
        scene.requestRender();
      }
      if (level === null) return;
      if (!GroundPrimitive.isSupported(scene)) throw new Error('Ground overlays unavailable on this device');
      const request = new AbortController();
      screeningRequest = request;
      try {
        const response = await fetch(`${VECTORS}screening/${level}.json`, { signal: request.signal });
        if (!response.ok) throw new Error('Screening frame unavailable');
        const polygons = await GeoJsonDataSource.load(await response.json(), {
          clampToGround: true, fill: Color.fromCssColorString('#23baf2').withAlpha(0.55),
          stroke: Color.fromCssColorString('#bfeeff'), strokeWidth: 1,
        });
        for (const entity of polygons.entities.values) {
          if (entity.polygon) entity.polygon.classificationType = new ConstantProperty(ClassificationType.TERRAIN);
        }
        if (request.signal.aborted || stopped) return;
        await widget.dataSources.add(polygons);
        if (stopped) return;
        if (request.signal.aborted) {
          widget.dataSources.remove(polygons, true);
          return;
        }
        screening = polygons;
        scene.requestRender();
      } catch (error) {
        if (!request.signal.aborted) throw error;
      }
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
      screeningRequest?.abort();
      recovery.dispose();
      holder.destroy();
      widget.destroy();
    },
  };
}
