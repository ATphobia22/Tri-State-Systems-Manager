const REQUIRED_LAYER_TYPES = new Set([
  'existing_ground',
  'soil_horizon',
  'foundation_preparation',
  'approved_fill',
  'compacted_lift',
  'drainage',
  'finished_grade',
]);

export function validateEngineeringSection(section) {
  if (!section || typeof section !== 'object') return { ok: false, error: 'SECTION_REQUIRED' };
  if (section.verticalDatum !== 'NAVD88') return { ok: false, error: 'VERTICAL_DATUM_UNVERIFIED' };
  if (!Array.isArray(section.layers) || section.layers.length === 0) return { ok: false, error: 'SECTION_LAYERS_REQUIRED' };
  const missingProvenance = section.layers.filter((layer) => typeof layer.sourceId !== 'string' || layer.sourceId.length === 0);
  if (missingProvenance.length > 0) return { ok: false, error: 'LAYER_PROVENANCE_REQUIRED' };
  const layerTypes = new Set(section.layers.map((layer) => layer.type));
  const missing = [...REQUIRED_LAYER_TYPES].filter((type) => !layerTypes.has(type));
  if (missing.includes('approved_fill')) return { ok: false, error: 'APPROVED_FILL_EVIDENCE_REQUIRED' };
  if (missing.includes('foundation_preparation') || missing.includes('soil_horizon')) return { ok: false, error: 'SITE_INVESTIGATION_OR_SOIL_CONTEXT_REQUIRED' };
  return { ok: true, error: null, missing_optional_layers: missing };
}
