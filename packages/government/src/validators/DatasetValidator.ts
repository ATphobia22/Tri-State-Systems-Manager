import type { GovernmentDataset } from '../types/GovernmentDataset.ts';
import { GeometryValidator } from './GeometryValidator.ts';
export class DatasetValidator {
 validate(dataset:GovernmentDataset):readonly string[] {
  const errors:string[]=[];
  for(const field of ['sourceId','datasetName','version','checksum','retrievedAt'] as const)if(typeof dataset[field]!=='string'||!dataset[field].trim())errors.push('MISSING_'+field.toUpperCase());
  if(!Number.isFinite(Date.parse(dataset.retrievedAt)))errors.push('INVALID_RETRIEVED_AT');
  if(!/^[a-f0-9]{64}$/.test(dataset.checksum))errors.push('INVALID_SHA256_CHECKSUM');
  if(dataset.featureCount!==undefined&&(!Number.isSafeInteger(dataset.featureCount)||dataset.featureCount<0))errors.push('INVALID_FEATURE_COUNT');
  if(dataset.geometryType){const audit=new GeometryValidator().validate(dataset.geometryType);errors.push(...audit.errors);}
  return errors;
 }
}
