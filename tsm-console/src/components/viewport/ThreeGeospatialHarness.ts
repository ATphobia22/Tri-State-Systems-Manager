/**
 * TSM Three.js geospatial viewport ingestion harness.
 *
 * Security/data-integrity contract:
 * - MVT/PBF is decoded as protobuf; bytes are never interpreted as Float32 terrain.
 * - Horizontal coordinates are transformed from Web Mercator tile space to EPSG:2966.
 * - EPSG:2966 is horizontal only; NAVD88 elevation is a separate, explicitly supplied value.
 * - No synthetic elevation or regulatory determination is generated.
 * - Rendering uses a local floating origin while authoritative coordinates remain in EPSG:2966.
 */

import * as THREE from 'three';

export interface ITileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface IGeospatialTileOptions {
  /** Martin/MVT source CRS. Martin's standard vector-tile output is Web Mercator. */
  sourceCrs?: 'EPSG:3857';
  /** MVT extent. 4096 is the MVT default. */
  extent?: number;
  /** Local EPSG:2966 rendering origin. */
  originEastingFt: number;
  originNorthingFt: number;
  /** Optional feature property containing an elevation in the declared datum. */
  elevationProperty?: string;
  /** Elevation datum must be explicit when elevation is consumed. */
  elevationDatum?: 'NAVD88';
  /** Optional BFE reference in NAVD88 feet for visualization only. */
  bfeNavd88Ft?: number;
  /** Maximum features accepted from one tile to bound browser workload. */
  maxFeatures?: number;
}

interface IProtoField {
  field: number;
  wireType: number;
  value: number | Uint8Array;
}

interface IMvtFeature {
  id?: number;
  type: number;
  tags: number[];
  geometry: number[];
}

interface IMvtLayer {
  name: string;
  extent: number;
  keys: string[];
  values: unknown[];
  features: IMvtFeature[];
}

interface IVertex {
  x: number;
  y: number;
  z: number;
  belowBfe: boolean;
}

const EARTH_RADIUS_METERS = 6378137;
const US_SURVEY_FOOT_METERS = 1200 / 3937;
const GRS80_A = 6378137;
const GRS80_INV_F = 298.257222101;
const GRS80_F = 1 / GRS80_INV_F;
const GRS80_E2 = GRS80_F * (2 - GRS80_F);

// EPSG:2966 — NAD83 / Indiana West (ftUS).
const TM_LATITUDE_OF_ORIGIN_DEG = 37.5;
const TM_CENTRAL_MERIDIAN_DEG = -87.0833333333333;
const TM_SCALE = 0.999966667;
const TM_FALSE_EASTING_FT = 900000;
const TM_FALSE_NORTHING_FT = 249999.9998984;

function readVarint(bytes: Uint8Array, offset: number): { value: number; offset: number } {
  let result = 0;
  let shift = 0;

  for (let i = 0; i < 10; i += 1) {
    if (offset >= bytes.length) throw new Error('Malformed protobuf: truncated varint.');
    const byte = bytes[offset++];
    result += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return { value: result, offset };
    shift += 7;
  }

  throw new Error('Malformed protobuf: varint exceeds 64-bit limit.');
}

function readField(bytes: Uint8Array, offset: number): { field: IProtoField; offset: number } {
  const tag = readVarint(bytes, offset);
  const fieldNumber = Math.floor(tag.value / 8);
  const wireType = tag.value % 8;

  if (fieldNumber <= 0) throw new Error('Malformed protobuf: invalid field number.');

  if (wireType === 0) {
    const value = readVarint(bytes, tag.offset);
    return { field: { field: fieldNumber, wireType, value: value.value }, offset: value.offset };
  }

  if (wireType === 2) {
    const length = readVarint(bytes, tag.offset);
    const end = length.offset + length.value;
    if (end > bytes.length) throw new Error('Malformed protobuf: length-delimited field exceeds payload.');
    return { field: { field: fieldNumber, wireType, value: bytes.subarray(length.offset, end) }, offset: end };
  }

  if (wireType === 1) {
    if (tag.offset + 8 > bytes.length) throw new Error('Malformed protobuf: truncated fixed64.');
    return {
      field: { field: fieldNumber, wireType, value: bytes.subarray(tag.offset, tag.offset + 8) },
      offset: tag.offset + 8,
    };
  }

  if (wireType === 5) {
    if (tag.offset + 4 > bytes.length) throw new Error('Malformed protobuf: truncated fixed32.');
    return {
      field: { field: fieldNumber, wireType, value: bytes.subarray(tag.offset, tag.offset + 4) },
      offset: tag.offset + 4,
    };
  }

  throw new Error(`Unsupported protobuf wire type ${wireType}.`);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function decodeString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function zigZagDecode(value: number): number {
  return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
}

function decodePackedVarints(bytes: Uint8Array): number[] {
  const values: number[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const result = readVarint(bytes, offset);
    values.push(result.value);
    offset = result.offset;
  }
  return values;
}

function parseMvtValue(bytes: Uint8Array): unknown {
  let offset = 0;
  while (offset < bytes.length) {
    const result = readField(bytes, offset);
    offset = result.offset;
    const field = result.field;

    if (field.wireType === 2 && field.field === 1) return decodeString(field.value as Uint8Array);
    if (field.wireType === 0 && field.field === 4) return Boolean(field.value);
    if (field.wireType === 0 && field.field === 5) return field.value;
    if (field.wireType === 1 && field.field === 3) return new DataView(toArrayBuffer(field.value as Uint8Array)).getFloat64(0, true);
    if (field.wireType === 5 && field.field === 2) return new DataView(toArrayBuffer(field.value as Uint8Array)).getFloat32(0, true);
  }
  return null;
}

function parseMvtFeature(bytes: Uint8Array): IMvtFeature {
  const feature: IMvtFeature = { tags: [], geometry: [], type: 0 };
  let offset = 0;

  while (offset < bytes.length) {
    const result = readField(bytes, offset);
    offset = result.offset;
    const field = result.field;

    if (field.field === 1 && field.wireType === 0) feature.id = field.value as number;
    else if (field.field === 2 && field.wireType === 2) feature.tags = decodePackedVarints(field.value as Uint8Array);
    else if (field.field === 3 && field.wireType === 0) feature.type = field.value as number;
    else if (field.field === 4 && field.wireType === 2) feature.geometry = decodePackedVarints(field.value as Uint8Array);
  }

  if (![1, 2, 3].includes(feature.type)) throw new Error('MVT feature has an unsupported geometry type.');
  return feature;
}

function parseMvtLayer(bytes: Uint8Array): IMvtLayer {
  const layer: IMvtLayer = { name: '', extent: 4096, keys: [], values: [], features: [] };
  let offset = 0;

  while (offset < bytes.length) {
    const result = readField(bytes, offset);
    offset = result.offset;
    const field = result.field;

    if (field.field === 1 && field.wireType === 2) layer.name = decodeString(field.value as Uint8Array);
    else if (field.field === 2 && field.wireType === 2) layer.features.push(parseMvtFeature(field.value as Uint8Array));
    else if (field.field === 3 && field.wireType === 2) layer.keys.push(decodeString(field.value as Uint8Array));
    else if (field.field === 4 && field.wireType === 2) layer.values.push(parseMvtValue(field.value as Uint8Array));
    else if (field.field === 5 && field.wireType === 0) layer.extent = field.value as number;
  }

  if (!layer.name) throw new Error('MVT layer is missing its name.');
  if (!Number.isInteger(layer.extent) || layer.extent <= 0) throw new Error('MVT layer has an invalid extent.');
  return layer;
}

function parseMvtTile(bytes: Uint8Array): IMvtLayer[] {
  const layers: IMvtLayer[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    const result = readField(bytes, offset);
    offset = result.offset;
    if (result.field.field === 3 && result.field.wireType === 2) {
      layers.push(parseMvtLayer(result.field.value as Uint8Array));
    }
  }

  if (layers.length === 0) throw new Error('MVT payload contains no vector-tile layers.');
  return layers;
}

function tileToMercatorMeters(tile: ITileCoordinate, x: number, y: number, extent: number): { x: number; y: number } {
  const worldSize = 2 ** tile.z;
  const normalizedX = (tile.x + x / extent) / worldSize;
  const normalizedY = (tile.y + y / extent) / worldSize;

  return {
    x: (normalizedX - 0.5) * 2 * Math.PI * EARTH_RADIUS_METERS,
    y: (0.5 - normalizedY) * 2 * Math.PI * EARTH_RADIUS_METERS,
  };
}

function mercatorToLonLat(x: number, y: number): { lonDeg: number; latDeg: number } {
  return {
    lonDeg: (x / EARTH_RADIUS_METERS) * (180 / Math.PI),
    latDeg: (2 * Math.atan(Math.exp(y / EARTH_RADIUS_METERS)) - Math.PI / 2) * (180 / Math.PI),
  };
}

function meridionalArc(phi: number): number {
  const e2 = GRS80_E2;
  const e4 = e2 * e2;
  const e6 = e4 * e2;

  return GRS80_A * (
    (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi)
  );
}

function lonLatToEpsg2966(lonDeg: number, latDeg: number): { eastingFt: number; northingFt: number } {
  const phi = latDeg * Math.PI / 180;
  const lambda = lonDeg * Math.PI / 180;
  const lambda0 = TM_CENTRAL_MERIDIAN_DEG * Math.PI / 180;
  const phi0 = TM_LATITUDE_OF_ORIGIN_DEG * Math.PI / 180;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const ep2 = GRS80_E2 / (1 - GRS80_E2);
  const n = GRS80_A / Math.sqrt(1 - GRS80_E2 * sinPhi ** 2);
  const t = tanPhi ** 2;
  const c = ep2 * cosPhi ** 2;
  const a = cosPhi * (lambda - lambda0);
  const m = meridionalArc(phi);
  const m0 = meridionalArc(phi0);

  const eastingMeters = TM_FALSE_EASTING_FT * US_SURVEY_FOOT_METERS +
    TM_SCALE * n * (
      a + (1 - t + c) * a ** 3 / 6
      + (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * a ** 5 / 120
    );

  const northingMeters = TM_FALSE_NORTHING_FT * US_SURVEY_FOOT_METERS +
    TM_SCALE * (
      m - m0 + n * tanPhi * (
        a ** 2 / 2
        + (5 - t + 9 * c + 4 * c ** 2) * a ** 4 / 24
        + (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * a ** 6 / 720
      )
    );

  return {
    eastingFt: eastingMeters / US_SURVEY_FOOT_METERS,
    northingFt: northingMeters / US_SURVEY_FOOT_METERS,
  };
}

function geometryToVertices(
  feature: IMvtFeature,
  tile: ITileCoordinate,
  extent: number,
  originEastingFt: number,
  originNorthingFt: number,
  elevationNavd88Ft: number | null,
  bfeNavd88Ft: number | undefined,
): IVertex[][] {
  const paths: IVertex[][] = [];
  let cursorX = 0;
  let cursorY = 0;
  let geometryIndex = 0;
  let currentPath: IVertex[] = [];

  const commandCount = feature.geometry.length;
  while (geometryIndex < commandCount) {
    const command = feature.geometry[geometryIndex++];
    const commandId = command & 0x7;
    const count = command >>> 3;

    if (commandId === 1) {
      if (currentPath.length > 0) paths.push(currentPath);
      currentPath = [];

      for (let i = 0; i < count; i += 1) {
        const dx = zigZagDecode(feature.geometry[geometryIndex++]);
        const dy = zigZagDecode(feature.geometry[geometryIndex++]);
        cursorX += dx;
        cursorY += dy;
        const mercator = tileToMercatorMeters(tile, cursorX, cursorY, extent);
        const lonLat = mercatorToLonLat(mercator.x, mercator.y);
        const projected = lonLatToEpsg2966(lonLat.lonDeg, lonLat.latDeg);
        const z = elevationNavd88Ft ?? 0;
        currentPath.push({
          x: projected.eastingFt - originEastingFt,
          y: projected.northingFt - originNorthingFt,
          z,
          belowBfe: bfeNavd88Ft !== undefined && elevationNavd88Ft !== null && z < bfeNavd88Ft,
        });
      }
      continue;
    }

    if (commandId === 2) {
      for (let i = 0; i < count; i += 1) {
        const dx = zigZagDecode(feature.geometry[geometryIndex++]);
        const dy = zigZagDecode(feature.geometry[geometryIndex++]);
        cursorX += dx;
        cursorY += dy;
        const mercator = tileToMercatorMeters(tile, cursorX, cursorY, extent);
        const lonLat = mercatorToLonLat(mercator.x, mercator.y);
        const projected = lonLatToEpsg2966(lonLat.lonDeg, lonLat.latDeg);
        const z = elevationNavd88Ft ?? 0;
        currentPath.push({
          x: projected.eastingFt - originEastingFt,
          y: projected.northingFt - originNorthingFt,
          z,
          belowBfe: bfeNavd88Ft !== undefined && elevationNavd88Ft !== null && z < bfeNavd88Ft,
        });
      }
      continue;
    }

    if (commandId === 7) {
      continue;
    }

    throw new Error(`Unsupported MVT geometry command ${commandId}.`);
  }

  if (currentPath.length > 0) paths.push(currentPath);
  return paths;
}

function featureProperties(feature: IMvtFeature, layer: IMvtLayer): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (let i = 0; i + 1 < feature.tags.length; i += 2) {
    const key = layer.keys[feature.tags[i]];
    const value = layer.values[feature.tags[i + 1]];
    if (key !== undefined) properties[key] = value;
  }
  return properties;
}

export class ThreeGeospatialHarness {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly container: HTMLDivElement;
  private readonly tileCache = new Map<string, THREE.Object3D>();
  private readonly resizeObserver: ResizeObserver;
  private animationFrameId: number | null = null;
  private destroyed = false;

  public constructor(container: HTMLDivElement) {
    if (container.clientWidth <= 0 || container.clientHeight <= 0) {
      throw new Error('ThreeGeospatialHarness requires a non-zero container size.');
    }

    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09090b);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100000,
    );
    this.camera.position.set(0, 1500, 2000);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5000, 10000, 5000);
    this.scene.add(directionalLight);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  public async ingestTilePayloadBytes(
    coords: ITileCoordinate,
    byteBuffer: ArrayBuffer,
    options: IGeospatialTileOptions,
  ): Promise<void> {
    this.assertActive();
    this.validateTileCoordinate(coords);

    if (byteBuffer.byteLength === 0) throw new Error('Cannot ingest an empty MVT payload.');
    if (byteBuffer.byteLength > 10 * 1024 * 1024) throw new Error('MVT payload exceeds 10 MiB safety limit.');

    const tileKey = `${coords.z}/${coords.x}/${coords.y}`;
    if (this.tileCache.has(tileKey)) return;

    const bytes = new Uint8Array(byteBuffer);
    const decoded = await this.decodeTransport(bytes);
    const layers = parseMvtTile(decoded);

    const origin = {
      easting: options.originEastingFt,
      northing: options.originNorthingFt,
    };

    const root = new THREE.Group();
    let acceptedFeatures = 0;

    for (const layer of layers) {
      for (const feature of layer.features) {
        if (acceptedFeatures >= (options.maxFeatures ?? 5000)) break;

        const properties = featureProperties(feature, layer);
        const elevation = this.readElevation(properties, options);
        const paths = geometryToVertices(
          feature,
          coords,
          options.extent ?? layer.extent,
          origin.easting,
          origin.northing,
          elevation,
          options.bfeNavd88Ft,
        );

        for (const path of paths) {
          this.addPath(root, path, feature.type, properties);
        }
        acceptedFeatures += 1;
      }
    }

    root.userData = {
      tile: { ...coords },
      sourceCrs: options.sourceCrs ?? 'EPSG:3857',
      renderingCrs: 'EPSG:2966',
      verticalDatum: options.elevationDatum ?? null,
      bfeNavd88Ft: options.bfeNavd88Ft ?? null,
    };

    this.scene.add(root);
    this.tileCache.set(tileKey, root);
  }

  public removeTile(coords: ITileCoordinate): void {
    const key = `${coords.z}/${coords.x}/${coords.y}`;
    const object = this.tileCache.get(key);
    if (!object) return;
    this.scene.remove(object);
    this.disposeObject(object);
    this.tileCache.delete(key);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.resizeObserver.disconnect();

    for (const object of this.tileCache.values()) {
      this.scene.remove(object);
      this.disposeObject(object);
    }
    this.tileCache.clear();

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private async decodeTransport(bytes: Uint8Array): Promise<Uint8Array> {
    // MVT responses may be gzip encoded by the tile transport.
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('Gzip-compressed MVT received but DecompressionStream is unavailable.');
      }
      const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return bytes;
  }

  private readElevation(properties: Record<string, unknown>, options: IGeospatialTileOptions): number | null {
    if (!options.elevationProperty) return null;
    if (options.elevationDatum !== 'NAVD88') {
      throw new Error('Elevation data requires an explicit NAVD88 datum declaration.');
    }

    const value = properties[options.elevationProperty];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Elevation property "${options.elevationProperty}" is missing or non-numeric.`);
    }
    return value;
  }

  private addPath(
    root: THREE.Group,
    vertices: IVertex[],
    geometryType: number,
    properties: Record<string, unknown>,
  ): void {
    if (vertices.length === 0) return;

    const positions = new Float32Array(vertices.length * 3);
    for (let i = 0; i < vertices.length; i += 1) {
      positions[i * 3] = vertices[i].x;
      positions[i * 3 + 1] = vertices[i].z;
      positions[i * 3 + 2] = -vertices[i].y;
    }

    if (geometryType === 2) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({ color: 0x60a5fa });
      const line = new THREE.Line(geometry, material);
      line.userData.properties = properties;
      root.add(line);
      return;
    }

    if (geometryType === 1) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({ color: 0xfbbf24, size: 4 });
      const points = new THREE.Points(geometry, material);
      points.userData.properties = properties;
      root.add(points);
      return;
    }

    // Polygon paths are represented as line loops until a polygon triangulation
    // policy is explicitly selected. This avoids inventing fill topology for
    // clipped MVT rings with ambiguous winding/holes.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0xa1a1aa });
    const loop = new THREE.LineLoop(geometry, material);
    loop.userData.properties = properties;
    root.add(loop);
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      const renderable = child as THREE.Mesh | THREE.Line | THREE.Points;
      const geometry = renderable.geometry;
      const material = renderable.material;

      if (geometry instanceof THREE.BufferGeometry) geometry.dispose();

      if (Array.isArray(material)) {
        for (const entry of material) entry.dispose();
      } else if (material instanceof THREE.Material) {
        material.dispose();
      }
    });
  }

  private handleResize(): void {
    if (this.destroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    if (this.destroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  };

  private assertActive(): void {
    if (this.destroyed) throw new Error('ThreeGeospatialHarness has been destroyed.');
  }

  private validateTileCoordinate(coords: ITileCoordinate): void {
    if (!Number.isInteger(coords.z) || coords.z < 0 || coords.z > 24) {
      throw new Error('Invalid tile zoom level.');
    }
    const maxIndex = 2 ** coords.z;
    if (!Number.isInteger(coords.x) || coords.x < 0 || coords.x >= maxIndex) {
      throw new Error('Invalid tile X coordinate.');
    }
    if (!Number.isInteger(coords.y) || coords.y < 0 || coords.y >= maxIndex) {
      throw new Error('Invalid tile Y coordinate.');
    }
  }
}
