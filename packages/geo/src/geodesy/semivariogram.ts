/** Inter-product disagreement only; grid distances are not survey-ground distances. */
export interface MetricCrs { epsg: number; units: 'metre' | 'ftUS' }
const UNITS = new Map<number, string>([[2965,'ftUS'],[2966,'ftUS'],[26915,'metre'],[26916,'metre']]);
export function empiricalSemivariogram(x: readonly number[], y: readonly number[], z: readonly number[],
  options: {crs: MetricCrs; nLags?: number; maxDistM?: number; minPairs?: number}) {
  const {crs}=options;
  if (UNITS.get(crs.epsg)!==crs.units) throw new Error('Unsupported CRS or mismatched coordinate units');
  const factor=crs.units==='ftUS'?1200/3937:1;
  const n=x.length, nLags=options.nLags??12, minPairs=options.minPairs??30;
  if(n<2||y.length!==n||z.length!==n||![...x,...y,...z].every(Number.isFinite)) throw new Error('Need aligned finite observations');
  if(!Number.isInteger(nLags)||nLags<1||!Number.isInteger(minPairs)||minPairs<1) throw new Error('Invalid bins or minimum pairs');
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  for(let i=0;i<n;i++){xmin=Math.min(xmin,x[i]);xmax=Math.max(xmax,x[i]);ymin=Math.min(ymin,y[i]);ymax=Math.max(ymax,y[i]);}
  const maxDistM=options.maxDistM??Math.hypot(xmax-xmin,ymax-ymin)*factor/2;
  if(!Number.isFinite(maxDistM)||maxDistM<=0)throw new Error('Positive maximum distance required');
  const counts=new Array<number>(nLags).fill(0), sums=new Array<number>(nLags).fill(0);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const h=Math.hypot(x[j]-x[i],y[j]-y[i])*factor;
    if(h<=0||h>maxDistM)continue;
    const ratio=h/maxDistM*nLags, nearest=Math.round(ratio);
    const snapped=Math.abs(ratio-nearest)<=8*Number.EPSILON*Math.max(1,Math.abs(ratio))?nearest:ratio;
    const k=Math.min(nLags-1,Math.floor(snapped));
    counts[k]++;sums[k]+=(z[j]-z[i])**2;
  }
  return {authorityClass:'DERIVED' as const,regulatoryUse:false,crs,coordinateScaleToMetres:factor,
    distanceBasis:'PROJECTED_GRID_METRES',maxDistM,minPairs,
    bins:counts.map((count,k)=>({lagCenterM:(k+.5)*maxDistM/nLags,pairCount:count,
      gamma:count? sums[k]/(2*count):null,sufficient:count>=minPairs}))};
}
export function sphericalModel(h:number,nugget:number,partialSill:number,range:number):number {
  if(![h,nugget,partialSill,range].every(Number.isFinite)||h<0||nugget<0||partialSill<0||range<=0)throw new Error('Invalid model parameters');
  if(h===0)return 0;
  const r=h/range;return h>=range?nugget+partialSill:nugget+partialSill*(1.5*r-.5*r**3);
}
export function exponentialModel(h:number,nugget:number,partialSill:number,practicalRange:number):number {
  sphericalModel(h,nugget,partialSill,practicalRange);
  return h===0?0:nugget+partialSill*(1-Math.exp(-3*h/practicalRange));
}
