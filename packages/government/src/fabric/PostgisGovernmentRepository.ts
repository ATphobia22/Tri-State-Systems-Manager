import { createHash } from 'node:crypto';
import { assertPromotableSnapshot, type GovernmentSnapshotManifest } from '../ingestion.ts';
import { getRegisteredGovernmentSource } from '../GovernmentSourceRegistry.ts';

export interface SqlClient { query(sql:string,params?:readonly unknown[]):Promise<{rows:readonly Record<string,unknown>[]}>, release?():void }
export interface SqlPool { connect():Promise<SqlClient> }
export type GovernmentVectorFeature={type:'Feature';id?:string|number;geometry:{type:string;coordinates?:unknown};properties:Record<string,unknown>};

/** SQL transaction adapter; the caller owns DB credentials, migration and authority review.
 * No fabricated data, no automatic regulatory promotion, no datum transformation.
 */
export class PostgisGovernmentRepository {
 constructor(private readonly pool:SqlPool){}
 async ingest(input:{
  manifest:GovernmentSnapshotManifest;
  sourceId:string;
  rawBytes:Uint8Array;
  features:readonly GovernmentVectorFeature[];
  datasetVersion:string;
  classification:'OBSERVED'|'DERIVED'|'SCENARIO_SIMULATION_DEMO'|'REGULATORY';
  effectiveDate?:string;
 }):Promise<{datasetId:string;featureCount:number;sha256:string}> {
  const {manifest,rawBytes,features}=input;
  const source=getRegisteredGovernmentSource(input.sourceId);
  if(!source.agency.toUpperCase().includes(manifest.authority.toUpperCase()) && !(input.sourceId==='army-corps.levees'&&manifest.authority==='USACE'))throw new Error('GOVERNMENT_AUTHORITY_MISMATCH');
  assertPromotableSnapshot(manifest);
  if(!(rawBytes instanceof Uint8Array)||createHash('sha256').update(rawBytes).digest('hex')!==manifest.sha256||rawBytes.length!==manifest.byteLength)
   throw new Error('GOVERNMENT_RAW_BYTES_HASH_MISMATCH');
  if(!input.datasetVersion?.trim()||features.length>50_000)throw new Error('GOVERNMENT_INGEST_BOUNDS_INVALID');
  if(manifest.horizontalCrs!=='EPSG:4326')throw new Error('GOVERNMENT_EXPLICIT_REPROJECTION_REQUIRED');
  const decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(rawBytes)) as {type?:string;features?:unknown};
  if(decoded.type!=='FeatureCollection'||!Array.isArray(decoded.features)||JSON.stringify(decoded.features)!==JSON.stringify(features))throw new Error('GOVERNMENT_FEATURES_DO_NOT_MATCH_HASHED_BYTES');
  if(input.classification==='REGULATORY')throw new Error('GOVERNMENT_REGULATORY_HUMAN_AUTHORIZATION_REQUIRED');
  for(const [i,f] of features.entries()){
   if(f?.type!=='Feature'||!f.geometry||!f.properties||typeof f.properties!=='object'||Array.isArray(f.properties))
    throw new Error('GOVERNMENT_FEATURE_INVALID_'+i);
  }
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   await client.query(`INSERT INTO government.source(source_id,authority,endpoint,catalog_version)
    VALUES ($1,$2,$3,$4) ON CONFLICT(source_id) DO UPDATE
    SET endpoint=EXCLUDED.endpoint,catalog_version=EXCLUDED.catalog_version`,
    [input.sourceId,manifest.authority,manifest.sourceUrl,manifest.schemaVersion]);
   const sourceId=input.sourceId;
   const match=await client.query('SELECT sha256 FROM government.dataset WHERE dataset_id=$1 FOR UPDATE',[manifest.datasetId]);
   if(match.rows.length&&match.rows[0]?.sha256!==manifest.sha256)throw new Error('GOVERNMENT_DATASET_ID_COLLISION');
   await client.query(`INSERT INTO government.dataset
    (dataset_id,source_id,dataset_version,retrieved_at,acquisition_date,effective_date,source_crs,vertical_datum,classification,validation_status,sha256,byte_length,media_type,attribution,license,manifest)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PASS',$10,$11,$12,$13,$14,$15::jsonb)
    ON CONFLICT(dataset_id) DO NOTHING`,
    [manifest.datasetId,sourceId,input.datasetVersion,manifest.retrievedAt,manifest.acquisitionDate??null,
     input.effectiveDate??null,manifest.horizontalCrs,manifest.verticalDatum??null,input.classification,
     manifest.sha256,manifest.byteLength,manifest.mediaType,manifest.attribution,manifest.license,JSON.stringify(manifest)]);
   for(let i=0;i<features.length;i++){
    const f=features[i],id=String(f.id??i);
    if(id.length>256)throw new Error('GOVERNMENT_FEATURE_ID_TOO_LONG');
    const geometry=JSON.stringify(f.geometry),properties=JSON.stringify(f.properties);
    if(geometry.length>2_000_000||properties.length>2_000_000)throw new Error('GOVERNMENT_FEATURE_TOO_LARGE');
    const featureHash=createHash('sha256').update(JSON.stringify(f)).digest('hex');
    await client.query(`INSERT INTO government.feature(dataset_id,feature_id,geom,properties,source_feature_hash)
      SELECT $1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4::jsonb,$5
      ON CONFLICT(dataset_id,feature_id) DO NOTHING`,[manifest.datasetId,id,geometry,properties,featureHash]);
   }
   await client.query('COMMIT');
   return {datasetId:manifest.datasetId,featureCount:features.length,sha256:manifest.sha256};
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release?.();}
 }
}
