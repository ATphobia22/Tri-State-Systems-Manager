/** IFC 4.3 grading → SDF delta contract (stub until full parser). */
export interface IfcEarthworkJob {
  ifcPath: string;
  targetCrs: 'EPSG:26916';
  verticalDatum: 'NAVD88';
  operatorId?: string;
}
export interface IfcAlignmentResult {
  jobId: string;
  status: 'PARSED' | 'STUB' | 'FAILED';
  deltaLayerIds: string[];
  notes: string[];
}
export function alignIfcToSdf(job: IfcEarthworkJob): IfcAlignmentResult {
  return {
    jobId: `ifc-${Date.now()}`,
    status: 'STUB',
    deltaLayerIds: [],
    notes: [
      'Full IFC 4.3 parser pending',
      `CRS=${job.targetCrs} datum=${job.verticalDatum}`,
      'Baseline DEM remains immutable',
    ],
  };
}
