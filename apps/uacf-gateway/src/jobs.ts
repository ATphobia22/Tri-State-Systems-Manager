import { randomUUID } from 'node:crypto';
import type { CapabilityResult } from '../../../packages/contracts/src/index.ts';
export type JobStatus='queued'|'running'|'completed'|'failed';
export interface UacfJob { id:string; status:JobStatus; createdAt:string; updatedAt:string; result?:CapabilityResult; error?:string; events:Array<Record<string,unknown>>; }
const jobs=new Map<string,UacfJob>();
export function createJob(run:()=>Promise<CapabilityResult>):UacfJob{const now=new Date().toISOString();const job:UacfJob={id:randomUUID(),status:'queued',createdAt:now,updatedAt:now,events:[]};jobs.set(job.id,job);void (async()=>{job.status='running';job.updatedAt=new Date().toISOString();job.events.push({type:'job.started',timestamp:job.updatedAt});try{job.result=await run();job.status=job.result.success?'completed':'failed';job.events.push({type:'job.completed',timestamp:new Date().toISOString(),success:job.result.success});}catch(e){job.status='failed';job.error=e instanceof Error?e.message:String(e);job.events.push({type:'job.failed',timestamp:new Date().toISOString(),error:job.error});}job.updatedAt=new Date().toISOString();})();return job;}
export function getJob(id:string):UacfJob|undefined{return jobs.get(id);}
export function pruneJobs(max=1000):void{if(jobs.size<=max)return;const ids=[...jobs.keys()].slice(0,jobs.size-max);for(const id of ids)jobs.delete(id);}
