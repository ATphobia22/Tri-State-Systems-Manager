export function buildInfluenceGraph({ structures = [], stations = [], modeledRelationships = [] } = {}) {
  const nodes = [
    ...structures.map((structure) => ({ id: `DAM:${structure.name}`, type: 'DAM', name: structure.name })),
    ...stations.map((station) => ({ id: `GAUGE:${station.stationId}`, type: 'GAUGE', name: station.name })),
  ];
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const edges = modeledRelationships
    .filter((relationship) => validNodeIds.has(relationship.from) && validNodeIds.has(relationship.to))
    .filter((relationship) => Array.isArray(relationship.evidenceIds) && relationship.evidenceIds.length > 0)
    .map((relationship) => ({
      from: relationship.from,
      to: relationship.to,
      relationshipType: relationship.relationshipType || 'MODEL_DERIVED_RESPONSE',
      confidence: relationship.confidence || 'LOW',
      evidenceIds: [...relationship.evidenceIds],
      derivedAt: new Date().toISOString(),
    }));
  return { generatedAt: new Date().toISOString(), nodes, edges };
}
