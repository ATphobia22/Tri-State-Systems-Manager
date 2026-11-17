/**
 * Cesium OSM Buildings display modes and bounded source-tag inspection.
 * All styles are cartographic; none changes geometry, elevations, LoD or material textures.
 * Tag values must be observed on the selected OSM feature before shown as source facts.
 * https://cesium.com/learn/cesiumjs-learn/cesiumjs-3d-tiles-styling/
 * https://github.com/CesiumGS/cesium/tree/main/packages/sandcastle/gallery/3d-tiles-feature-styling
 */
export type OsmBuildingStyle = 'native' | 'wall-material' | 'building-use' | 'roof-shape' | 'height-evidence';
type Condition = [expression: string, color: string];
export type OsmColorStyle = { color: { conditions: Condition[] } };

function prop(key: string): string {
  // 3D Tiles Styling language. Do not evaluate this as JavaScript.
  return '$' + "{feature['" + key + "']}";
}

const paint = (hex: string): string => "color('" + hex + "')";

const fallback: Condition = ['true', paint('#dfe8ef')];

export function osmBuildingStyleRules(mode: OsmBuildingStyle): OsmColorStyle | undefined {
  if (mode === 'native') return undefined;
  if (mode === 'wall-material') {
    const value = prop('building:material');
    return { color: { conditions: [
      [value + " === 'brick'", paint('#ba796a')],
      [value + " === 'glass'", paint('#83c8d6')],
      [value + " === 'concrete'", paint('#929ca4')],
      [value + " === 'stone'", paint('#a8aba2')],
      [value + " === 'wood'", paint('#b58c67')],
      [value + " === 'metal' || " + value + " === 'steel'", paint('#839bad')],
      fallback,
    ] } };
  }
  if (mode === 'building-use') {
    const value = prop('building');
    return { color: { conditions: [
      [value + " === 'residential' || " + value + " === 'house' || " + value + " === 'apartments'", paint('#91bdb7')],
      [value + " === 'commercial' || " + value + " === 'office' || " + value + " === 'retail'", paint('#73a4cb')],
      [value + " === 'industrial' || " + value + " === 'warehouse'", paint('#caa980')],
      [value + " === 'school' || " + value + " === 'hospital' || " + value + " === 'public'", paint('#aaa4c9')],
      fallback,
    ] } };
  }
  if (mode === 'roof-shape') {
    const value = prop('roof:shape');
    return { color: { conditions: [
      [value + " === 'flat'", paint('#719fb9')],
      [value + " === 'gabled'", paint('#bd8a6d')],
      [value + " === 'hipped' || " + value + " === 'half-hipped'", paint('#98b094')],
      [value + " === 'pyramidal' || " + value + " === 'dome'", paint('#afa4cd')],
      fallback,
    ] } };
  }
  const direct = prop('height');
  const estimated = prop('cesium#estimatedHeight');
  return { color: { conditions: [
    [direct + " !== null", paint('#3e9b80')],
    [estimated + " !== null", paint('#d1a14e')],
    fallback,
  ] } };
}

export type OsmPropertyReader = { getProperty: (key: string) => unknown };
export type OsmPickedBuilding = { title: string; detail: string };

function scalar(feature: OsmPropertyReader, key: string): string | null {
  const value = feature.getProperty(key);
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return clean ? clean.slice(0, 84) : null;
}

/** Source-driven selection; do not mistake Cesium fallback heights for surveys. */
export function inspectOsmBuilding(feature: OsmPropertyReader): OsmPickedBuilding {
  const get = (key: string): string | null => scalar(feature, key);
  const name = get('name');
  const building = get('building');
  const elementType = get('elementType');
  const elementId = get('elementId');
  const id = elementType && elementId ? elementType + ':' + elementId : 'identifier unavailable';
  const observations: string[] = [];
  if (building) observations.push('use tag: ' + building);
  const material = get('building:material');
  if (material) observations.push('wall material tag: ' + material);
  const roof = get('roof:shape');
  if (roof) observations.push('roof shape tag: ' + roof);
  const roofMaterial = get('roof:material');
  if (roofMaterial) observations.push('roof material tag: ' + roofMaterial);
  const levels = get('building:levels');
  if (levels) observations.push('levels tag: ' + levels);
  const height = get('height');
  if (height) observations.push('OSM height tag: ' + height + ' (units/source not verified)');
  else {
    const estimated = get('cesium#estimatedHeight');
    if (estimated) observations.push('Cesium estimated height: ' + estimated + ' m (not measured)');
    else observations.push('building height not recorded');
  }
  const source = get('source');
  if (source) observations.push('OSM source tag: ' + source);
  return {
    title: (name ? name : 'OSM building') + ' · open map context',
    detail: 'OSM ' + id + ' · ' + observations.join(' · ') +
      ' · Community annotations; no surveying, material verification, or regulatory certification.',
  };
}
