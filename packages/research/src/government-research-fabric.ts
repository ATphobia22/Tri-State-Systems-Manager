import { createHash, randomUUID } from 'node:crypto';

export const RESEARCH_CAPABILITY_ID = 'research.search' as const;
export type ResearchProviderId='github'|'search'|'browser'|'firecrawl-compatible'|'exa-compatible'|'government-api';
export interface ResearchDocument {readonly url:string;readonly title:string;readonly text:string;readonly retrievedAt:string;readonly provider:ResearchProviderId;readonly sha256:string}
export interface ResearchEvidence {readonly claim:string;readonly documentUrls:readonly string[];readonly confidence:'high'|'medium'|'low'|'unverified'}
export interface ResearchFabricResult {
 readonly answer:string;readonly traceId:string;readonly hash:string;readonly evidence:readonly ResearchEvidence[];
 readonly citations:readonly {url:string;title:string}[];
 readonly provenance:{traceId:string;providers:readonly ResearchProviderId[];generatedAt:string;inputHash:string;outputHash:string};
 readonly hashes:{input:string;output:string};readonly limitations:readonly string[];
}
export interface ResearchProvider {readonly id:ResearchProviderId;search(query:string,signal?:AbortSignal):Promise<readonly ResearchDocument[]>}
const stable=(value:unknown,ancestors:WeakSet<object>=new WeakSet()):string=>{
 if(value===null)return 'null';
 if(typeof value==='string')return JSON.stringify(value);
 if(typeof value==='boolean')return value?'true':'false';
 if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('CANONICAL_VALUE_MUST_BE_FINITE');return JSON.stringify(value);}
 if(typeof value!=='object')throw new TypeError('CANONICAL_VALUE_MUST_BE_JSON_COMPATIBLE');
 if(ancestors.has(value))throw new TypeError('CANONICAL_VALUE_MUST_NOT_BE_CIRCULAR');
 ancestors.add(value);
 try{
  if(Array.isArray(value))return '['+value.map(item=>stable(item,ancestors)).join(',')+']';
  const object=value as Record<string,unknown>;
  return '{'+Object.keys(object).sort().map(k=>JSON.stringify(k)+':'+stable(object[k],ancestors)).join(',')+'}';
 }finally{ancestors.delete(value);}
};
const hash=(value:unknown)=>createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
export async function researchSearch(query:string,providers:readonly ResearchProvider[],options:{signal?:AbortSignal;maxDocuments?:number}={}):Promise<ResearchFabricResult>{
 if(!query.trim()) throw new Error('RESEARCH_QUERY_REQUIRED');
 if(providers.length===0) throw new Error('RESEARCH_PROVIDER_REQUIRED');
 const max=options.maxDocuments??30;if(!Number.isInteger(max)||max<1||max>100)throw new Error('INVALID_MAX_DOCUMENTS');
 const settled=await Promise.allSettled(providers.map(p=>p.search(query,options.signal)));
 const documents:Array<{document:ResearchDocument;expectedProvider:ResearchProviderId}>=[];
 const failures:string[]=[];
 settled.forEach((entry,index)=>{
  if(entry.status!=='fulfilled'){failures.push(providers[index].id+': '+String(entry.reason));return;}
  if(!Array.isArray(entry.value)){failures.push(providers[index].id+': provider returned a non-array result');return;}
  for(const document of entry.value.slice(0,max))documents.push({document,expectedProvider:providers[index].id});
 });
 const candidates:ResearchDocument[]=[];
 for(const item of documents){
  const document=item.document;
  if(!document||typeof document!=='object'||typeof document.url!=='string'||typeof document.title!=='string'||typeof document.text!=='string'){failures.push('invalid document envelope rejected');continue;}
  let url:URL;try{url=new URL(document.url)}catch{failures.push('invalid document URL rejected');continue;}
  if(url.protocol!=='https:'||url.username||url.password||!document.title.trim()||!document.text.trim()){failures.push('unsafe or incomplete document rejected: '+url.origin);continue;}
  if(!Number.isFinite(Date.parse(document.retrievedAt))){failures.push('invalid document retrieval timestamp rejected: '+url.origin);continue;}
  if(document.provider!==item.expectedProvider){failures.push('provider identity mismatch rejected: '+url.origin);continue;}
  if(!/^[a-f0-9]{64}$/.test(document.sha256)||hash(document.text)!==document.sha256){failures.push('document content hash mismatch: '+url.origin);continue;}
  candidates.push({...document,url:url.toString()});
 }
 candidates.sort((a,b)=>a.url.localeCompare(b.url)||a.provider.localeCompare(b.provider)||a.sha256.localeCompare(b.sha256));
 const unique=new Map<string,ResearchDocument>();
 for(const document of candidates)if(!unique.has(document.url))unique.set(document.url,document);
 const selected=[...unique.values()].slice(0,max);
 const generatedAt=new Date().toISOString(),traceId=randomUUID(),inputHash=hash({query,providers:providers.map(p=>p.id).sort()});
 const answer=selected.length?'Collected '+selected.length+' source documents. Claims require explicit synthesis and citation; raw retrieval is not itself a verified answer.':'No verifiable source documents were returned.';
 const evidence:ResearchEvidence[]=selected.map(d=>({claim:'Retrieved source; claim-level synthesis not yet asserted.',documentUrls:[d.url],confidence:'unverified'}));
 const citations=selected.map(d=>({url:d.url,title:d.title}));
 const limitations=[...failures.sort(),'Provider adapters must preserve upstream terms, retrieval times, licensing, and source identity. No claim is marked verified by retrieval alone.'];
 const payload={answer,evidence,citations,providers:providers.map(p=>p.id).sort(),limitations};
 const outputHash=hash(payload);
 return {answer,traceId,hash:outputHash,evidence,citations,provenance:{traceId,providers:providers.map(p=>p.id).sort(),generatedAt,inputHash,outputHash},hashes:{input:inputHash,output:outputHash},limitations};
}
