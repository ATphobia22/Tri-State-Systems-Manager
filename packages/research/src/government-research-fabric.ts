import { createHash, randomUUID } from 'node:crypto';

export const RESEARCH_CAPABILITY_ID = 'research.search' as const;
export type ResearchProviderId='github'|'search'|'browser'|'firecrawl-compatible'|'exa-compatible'|'government-api';
export interface ResearchDocument {readonly url:string;readonly title:string;readonly text:string;readonly retrievedAt:string;readonly provider:ResearchProviderId;readonly sha256:string}
export interface ResearchEvidence {readonly claim:string;readonly documentUrls:readonly string[];readonly confidence:'high'|'medium'|'low'|'unverified'}
export interface ResearchFabricResult {
 readonly answer:string;readonly evidence:readonly ResearchEvidence[];
 readonly citations:readonly {url:string;title:string}[];
 readonly provenance:{traceId:string;providers:readonly ResearchProviderId[];generatedAt:string;inputHash:string;outputHash:string};
 readonly hashes:{input:string;output:string};readonly limitations:readonly string[];
}
export interface ResearchProvider {readonly id:ResearchProviderId;search(query:string,signal?:AbortSignal):Promise<readonly ResearchDocument[]>}
const stable=(value:unknown):string=>value===null||typeof value!=='object'?(JSON.stringify(value)??'null'):Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value as object).sort().map(k=>JSON.stringify(k)+':'+stable((value as Record<string,unknown>)[k])).join(',')+'}';
const hash=(value:unknown)=>createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
export async function researchSearch(query:string,providers:readonly ResearchProvider[],options:{signal?:AbortSignal;maxDocuments?:number}={}):Promise<ResearchFabricResult>{
 if(!query.trim()) throw new Error('RESEARCH_QUERY_REQUIRED');
 if(providers.length===0) throw new Error('RESEARCH_PROVIDER_REQUIRED');
 const max=options.maxDocuments??30;if(!Number.isInteger(max)||max<1||max>100)throw new Error('INVALID_MAX_DOCUMENTS');
 const settled=await Promise.allSettled(providers.map(p=>p.search(query,options.signal)));
 const documents:ResearchDocument[]=[];const failures:string[]=[];
 settled.forEach((entry,index)=>{if(entry.status==='fulfilled')documents.push(...entry.value);else failures.push(providers[index].id+': '+String(entry.reason));});
 const unique=new Map<string,ResearchDocument>();
 for(const document of documents){let url:URL;try{url=new URL(document.url)}catch{continue}if(url.protocol!=='https:'||!document.title.trim()||!document.text.trim())continue;if(hash(document.text)!==document.sha256)continue;unique.set(url.toString(),document);}
 const selected=[...unique.values()].sort((a,b)=>a.url.localeCompare(b.url)).slice(0,max);
 const generatedAt=new Date().toISOString(),traceId=randomUUID(),inputHash=hash({query,providers:providers.map(p=>p.id).sort()});
 const answer=selected.length?'Collected '+selected.length+' source documents. Claims require explicit synthesis and citation; raw retrieval is not itself a verified answer.':'No verifiable source documents were returned.';
 const evidence:ResearchEvidence[]=selected.map(d=>({claim:'Retrieved source; claim-level synthesis not yet asserted.',documentUrls:[d.url],confidence:'unverified'}));
 const citations=selected.map(d=>({url:d.url,title:d.title}));
 const limitations=[...failures,'Provider adapters must preserve upstream terms, retrieval times, licensing, and source identity. No claim is marked verified by retrieval alone.'];
 const payload={answer,evidence,citations,providers:providers.map(p=>p.id).sort(),limitations};
 const outputHash=hash(payload);
 return {answer,evidence,citations,provenance:{traceId,providers:providers.map(p=>p.id).sort(),generatedAt,inputHash,outputHash},hashes:{input:inputHash,output:outputHash},limitations};
}
