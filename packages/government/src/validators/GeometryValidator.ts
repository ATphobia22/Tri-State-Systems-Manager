export const SUPPORTED_GEOMETRY_TYPES=['Point','MultiPoint','Polygon','MultiPolygon','Polyline','MultiLineString'] as const;
export type SupportedGeometryType=typeof SUPPORTED_GEOMETRY_TYPES[number];
export interface GeometryAudit {expectedType:string;actualType:string;passed:boolean;errors:readonly string[];}
export class GeometryValidator {
 validate(geometryType:string,expectedType?:string):GeometryAudit {
  const supported=new Set<string>(SUPPORTED_GEOMETRY_TYPES);
  const errors:string[]=[];
  if(!supported.has(geometryType))errors.push('UNSUPPORTED_GEOMETRY_TYPE:'+geometryType);
  if(expectedType!==undefined&&geometryType!==expectedType)errors.push('GEOMETRY_TYPE_MISMATCH:'+expectedType+':'+geometryType);
  return {expectedType:expectedType??geometryType,actualType:geometryType,passed:errors.length===0,errors};
 }
}
