/**
 * Illustrative depth-damage curves — NOT official HAZUS output.
 * authority_class: SIMULATION_DEMO / MODEL_OUTPUT (illustrative)
 * Requires model_version, assumptions, and human review before any funding claim.
 */

export const HAZUS_ILLUSTRATIVE_META = {
  model_name: 'TSM illustrative depth-damage (not FEMA HAZUS)',
  model_version: 'demo-0.1.0',
  is_simulation_demo: true as const,
  assumptions: {
    building_value_usd: 250000,
    content_value_usd: 100000,
    occupancy: 'unspecified_residential_placeholder',
    curves: 'simplified piecewise — not HAZUS MH library',
  },
  disclaimer:
    'SIMULATION / DEMO only. Does not establish FEMA eligibility or official loss estimates. BCA ratios require separate provenance.',
};

export function illustrativeHazusLoss(waterStageFt: number, lagFt: number) {
  const depthAtStructure = waterStageFt - lagFt;
  let structDamagePct = 0;
  let contentDamagePct = 0;

  if (depthAtStructure >= -2 && depthAtStructure < 0) {
    structDamagePct = 0.05 * (depthAtStructure + 2);
    contentDamagePct = 0.02 * (depthAtStructure + 2);
  } else if (depthAtStructure >= 0 && depthAtStructure < 1) {
    structDamagePct = 0.18 + depthAtStructure * 0.12;
    contentDamagePct = 0.1 + depthAtStructure * 0.15;
  } else if (depthAtStructure >= 1 && depthAtStructure < 4) {
    structDamagePct = 0.3 + (depthAtStructure - 1) * 0.09;
    contentDamagePct = 0.25 + (depthAtStructure - 1) * 0.14;
  } else if (depthAtStructure >= 4) {
    structDamagePct = Math.min(0.88, 0.57 + (depthAtStructure - 4) * 0.03);
    contentDamagePct = Math.min(0.92, 0.67 + (depthAtStructure - 4) * 0.04);
  }

  const buildingLoss = HAZUS_ILLUSTRATIVE_META.assumptions.building_value_usd * structDamagePct;
  const contentLoss = HAZUS_ILLUSTRATIVE_META.assumptions.content_value_usd * contentDamagePct;

  return {
    ...HAZUS_ILLUSTRATIVE_META,
    depthFt: depthAtStructure,
    buildingLossUsd: buildingLoss,
    contentLossUsd: contentLoss,
    totalLossUsd: buildingLoss + contentLoss,
    riskScore: Math.round((structDamagePct * 0.6 + contentDamagePct * 0.4) * 100),
    authority_class: 'SIMULATION_DEMO' as const,
  };
}
