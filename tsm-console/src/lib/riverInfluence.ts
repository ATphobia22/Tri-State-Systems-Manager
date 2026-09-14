export type InfluenceConfidence = 'UNVERIFIED' | 'LOW' | 'MEDIUM' | 'HIGH';
export type InfluenceRelationship = 'HYDRAULIC_CONNECTIVITY' | 'UPSTREAM_CONTROL' | 'DOWNSTREAM_BACKWATER' | 'TRIBUTARY_INFLOW' | 'MODEL_DERIVED_RESPONSE' | 'GEOGRAPHIC_CONTEXT';

export interface RiverInfluenceEdge {
  from: string;
  to: string;
  relationshipType: InfluenceRelationship;
  confidence: InfluenceConfidence;
  evidenceIds: readonly string[];
  derivedAt: string | null;
}

export interface RiverInfluenceGraph {
  generatedAt: string;
  nodes: readonly { id: string; type: 'GAUGE' | 'DAM' | 'RIVER_REACH' | 'CONFLUENCE' | 'COMMUNITY_ASSET'; name: string }[];
  edges: readonly RiverInfluenceEdge[];
}

export function assertInfluenceEvidence(edge: RiverInfluenceEdge): void {
  if (edge.evidenceIds.length === 0) throw new Error('Influence edge requires at least one evidence identifier');
  if (edge.confidence === 'HIGH' && edge.relationshipType === 'GEOGRAPHIC_CONTEXT') {
    throw new Error('Geographic proximity cannot independently produce HIGH causal confidence');
  }
}

export function buildCandidateInfluenceGraph(generatedAt = new Date().toISOString()): RiverInfluenceGraph {
  const nodes = [
    { id: 'community:lower-wabash-ohio', type: 'COMMUNITY_ASSET' as const, name: 'Lower Wabash–Ohio Confluence Community' },
    { id: 'gauge:03378500', type: 'GAUGE' as const, name: 'Wabash River at New Harmony, IN' },
    { id: 'gauge:03322000', type: 'GAUGE' as const, name: 'Ohio River at Evansville, IN' },
    { id: 'dam:jtm', type: 'DAM' as const, name: 'John T. Myers Locks and Dam' },
    { id: 'dam:smithland', type: 'DAM' as const, name: 'Smithland Locks and Dam' },
    { id: 'dam:olmsted', type: 'DAM' as const, name: 'Olmsted Locks and Dam' },
  ];
  const edges: RiverInfluenceEdge[] = [
    { from: 'gauge:03378500', to: 'community:lower-wabash-ohio', relationshipType: 'HYDRAULIC_CONNECTIVITY', confidence: 'HIGH', evidenceIds: ['USGS-03378500'], derivedAt: generatedAt },
    { from: 'gauge:03322000', to: 'community:lower-wabash-ohio', relationshipType: 'GEOGRAPHIC_CONTEXT', confidence: 'MEDIUM', evidenceIds: ['USGS-03322000'], derivedAt: generatedAt },
    { from: 'dam:jtm', to: 'community:lower-wabash-ohio', relationshipType: 'GEOGRAPHIC_CONTEXT', confidence: 'LOW', evidenceIds: ['USACE-LRD-OHIO-RIVER'], derivedAt: generatedAt },
    { from: 'dam:smithland', to: 'community:lower-wabash-ohio', relationshipType: 'GEOGRAPHIC_CONTEXT', confidence: 'LOW', evidenceIds: ['USACE-LRD-OHIO-RIVER'], derivedAt: generatedAt },
    { from: 'dam:olmsted', to: 'community:lower-wabash-ohio', relationshipType: 'GEOGRAPHIC_CONTEXT', confidence: 'LOW', evidenceIds: ['USACE-LRD-OHIO-RIVER'], derivedAt: generatedAt },
  ];
  edges.forEach(assertInfluenceEvidence);
  return { generatedAt, nodes, edges };
}
