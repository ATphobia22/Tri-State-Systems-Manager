export interface MeshRangeFt { min: number; max: number; }
export interface HecRas2DMeshRefinement { channel_conveyance_ft: MeshRangeFt; near_berm_structures_lag_ft: MeshRangeFt; active_floodplain_ft: MeshRangeFt; overbank_ag_ft: MeshRangeFt; }
export interface HecRas2DProjectContract {
  contract_version: '1.0.0';
  terrain: { source: 'USGS_3DEP' | 'BEST_AVAILABLE_LIDAR'; resolution_m: number; hydro_enforced: true; horizontal_crs: string; vertical_datum: 'NAVD88' };
  mesh_refinement: HecRas2DMeshRefinement;
  breaklines: Array<'channel_centerline' | 'left_bank' | 'right_bank' | 'berm_crest' | 'structure_edges' | 'roadway_crest'>;
  site_constants: { lag_ft: 377.2; bfe_ft: 375; berm_crest_ft: 379.8; ffe_ft: 382.5; no_rise_tolerance_ft: 0 };
  boundary_conditions: { gage: { usgs_id: '03378500'; nws_id: 'NHRI3'; stage_source_order: ['NOAA_NWPS', 'USGS_WATER_DATA'] }; upstream: { boundary_type: 'FLOW' | 'STAGE_FLOW'; provenance: string }; downstream: { boundary_type: 'STAGE' | 'NORMAL_DEPTH' | 'RATING_CURVE'; provenance: string }; manning_n: { source: string; values: number[] }; compensatory_storage_ratio: { minimum: 1.2; maximum: 1.3 }; no_rise_tolerance_ft?: 0 };
  authority: { authority_class: 'SIMULATION_DEMO' | 'MODEL_OUTPUT'; governance_status: 'human_review_required'; is_simulation_demo: true; human_review_status: 'pending' | 'approved' | 'rejected' };
}

export const HEC_RAS_2D_PROJECT: HecRas2DProjectContract = {
  contract_version: '1.0.0',
  terrain: { source: 'USGS_3DEP', resolution_m: 1, hydro_enforced: true, horizontal_crs: 'EPSG:26916', vertical_datum: 'NAVD88' },
  mesh_refinement: {
    channel_conveyance_ft: { min: 25, max: 50 },
    near_berm_structures_lag_ft: { min: 25, max: 40 },
    active_floodplain_ft: { min: 50, max: 100 },
    overbank_ag_ft: { min: 100, max: 200 },
  },
  breaklines: ['channel_centerline', 'left_bank', 'right_bank', 'berm_crest'],
  site_constants: { lag_ft: 377.2, bfe_ft: 375, berm_crest_ft: 379.8, ffe_ft: 382.5, no_rise_tolerance_ft: 0 },
  boundary_conditions: {
    gage: { usgs_id: '03378500', nws_id: 'NHRI3', stage_source_order: ['NOAA_NWPS', 'USGS_WATER_DATA'] },
    upstream: { boundary_type: 'STAGE_FLOW', provenance: 'USGS 03378500 / NOAA NWPS NHRI3 observed telemetry; refresh at runtime' },
    downstream: { boundary_type: 'STAGE', provenance: 'Project hydraulic profile / Myers pool condition; human-reviewed model input required' },
    manning_n: { source: 'Project hydraulic profile; land-cover/bathymetry evidence required', values: [0.03, 0.04, 0.06, 0.1] },
    compensatory_storage_ratio: { minimum: 1.2, maximum: 1.3 },
    no_rise_tolerance_ft: 0,
  },
  authority: { authority_class: 'SIMULATION_DEMO', governance_status: 'human_review_required', is_simulation_demo: true, human_review_status: 'pending' },
};

function assertRange(range: MeshRangeFt, label: string): void {
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min <= 0 || range.max < range.min) throw new RangeError(`${label} must be a positive ascending range`);
}

export function validateHecRas2DProject(project: HecRas2DProjectContract): HecRas2DProjectContract {
  if (project.terrain.vertical_datum !== 'NAVD88' || !project.terrain.hydro_enforced) throw new Error('HEC-RAS terrain must be hydro-enforced NAVD88');
  if (project.terrain.resolution_m <= 0 || project.terrain.resolution_m > 2) throw new RangeError('HEC-RAS terrain resolution must be finer than 2 m');
  assertRange(project.mesh_refinement.channel_conveyance_ft, 'channel_conveyance_ft');
  assertRange(project.mesh_refinement.near_berm_structures_lag_ft, 'near_berm_structures_lag_ft');
  assertRange(project.mesh_refinement.active_floodplain_ft, 'active_floodplain_ft');
  assertRange(project.mesh_refinement.overbank_ag_ft, 'overbank_ag_ft');
  for (const required of ['channel_centerline', 'left_bank', 'right_bank', 'berm_crest'] as const) if (!project.breaklines.includes(required)) throw new Error(`Missing required breakline: ${required}`);
  if (project.authority.governance_status !== 'human_review_required' || !project.authority.is_simulation_demo) throw new Error('HEC-RAS outputs require human review and simulation labeling');
  return project;
}
