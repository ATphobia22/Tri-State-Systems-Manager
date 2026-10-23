export interface LayerMetadata {readonly id:number;readonly name:string;readonly geometryType:string;}
export interface MetadataAudit {readonly passed:boolean;readonly errors:readonly string[];readonly metadataHash:string;}
import { createHash } from 'node:crypto';
export class MetadataValidator {
 validateLayers(expected:readonly LayerMetadata[],actual:readonly LayerMetadata[]):MetadataAudit {
  const errors:string[]=[];
  const canonical=(items:readonly LayerMetadata[])=>items.map(x=>({id:x.id,name:x.name,geometryType:x.geometryType})).sort((a,b)=>a.id-b.id);
  const expectedMap=new Map(expected.map(x=>[x.id,x]));
  const actualMap=new Map(actual.map(x=>[x.id,x]));
  if(expectedMap.size!==expected.length)errors.push('EXPECTED_DUPLICATE_LAYER_IDS');
  if(actualMap.size!==actual.length)errors.push('ACTUAL_DUPLICATE_LAYER_IDS');
  if(expected.length!==actual.length)errors.push('LAYER_COUNT_MISMATCH:'+expected.length+':'+actual.length);
  for(const e of expected){const a=actualMap.get(e.id);if(!a){errors.push('MISSING_LAYER:'+e.id);continue;}if(a.name!==e.name)errors.push('LAYER_NAME_MISMATCH:'+e.id);if(a.geometryType!==e.geometryType)errors.push('LAYER_GEOMETRY_MISMATCH:'+e.id);}
  for(const a of actual)if(!expectedMap.has(a.id))errors.push('UNEXPECTED_LAYER:'+a.id);
  const metadataHash=createHash('sha256').update(JSON.stringify(canonical(actual))).digest('hex');
  return {passed:errors.length===0,errors,metadataHash};
 }
}
