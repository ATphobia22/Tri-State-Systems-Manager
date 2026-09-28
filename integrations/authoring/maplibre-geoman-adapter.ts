import type { Feature, Geometry } from 'geojson';
import type { Map } from 'maplibre-gl';

export interface GeomanInstance {
  enableGlobalEditMode?: () => void;
  disableGlobalEditMode?: () => void;
  destroy?: () => void;
}
export interface GeomanConstructor {
  new (map: Map, options?: Record<string, unknown>): GeomanInstance;
}
export interface DraftGeometryRecord {
  readonly geometry: Feature<Geometry>;
  readonly authorityClass: 'DRAFT';
  readonly status: 'draft';
  readonly operatorId: string;
}
/** Dependency-injected adapter keeps the commercial/free Geoman choice outside TSM core code. */
export function attachDraftGeometryAuthoring(map: Map, operatorId: string, Geoman: GeomanConstructor): GeomanInstance {
  if (!operatorId.trim()) throw new TypeError('operatorId is required');
  const instance = new Geoman(map, { controls: { draw: { polygon: true, line: true, circle: false } } });
  instance.enableGlobalEditMode?.();
  return instance;
}
export function toDraftGeometry(feature: Feature<Geometry>, operatorId: string): DraftGeometryRecord {
  if (!operatorId.trim()) throw new TypeError('operatorId is required');
  return { geometry: structuredClone(feature), authorityClass: 'DRAFT', status: 'draft', operatorId };
}
