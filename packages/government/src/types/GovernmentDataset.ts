export interface GovernmentDataset {
 readonly sourceId:string;readonly datasetName:string;readonly version:string;readonly retrievedAt:string;
 readonly checksum:string;readonly featureCount?:number;readonly geometryType?:string;
}
