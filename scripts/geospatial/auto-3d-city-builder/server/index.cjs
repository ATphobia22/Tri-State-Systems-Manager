#!/usr/bin/env node
'use strict';
/** Auto-3D City Builder local MCP stdio server, no external npm runtime dependencies.
 * Host must support local stdio tools; not a remotely running service.
 * Requires Python 3.11+ and pyproj, numpy, shapely, trimesh installed.
 */
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const {spawnSync}=require('node:child_process');
const here=path.resolve(__dirname,'..');
const root=process.env.CITYBUILDER_WORKSPACE?path.resolve(process.env.CITYBUILDER_WORKSPACE):process.cwd();
const runtime=fs.existsSync(path.join(here,'runtime','src','citybuilder','auto.py'))?path.join(here,'runtime'):here;
const python=process.env.CITYBUILDER_PYTHON||'python3';
function resolveWorkspace(x){
 if(typeof x!=='string'||!x.trim())throw Error('Nonempty workspace-relative path required');
 const p=path.resolve(root,x);
 if(p!==root&&!p.startsWith(root+path.sep))throw Error('Path must remain inside CITYBUILDER_WORKSPACE');
 if(p.includes('\0'))throw Error('Invalid path');
 return p;
}
function toolResult(body,isError=false){return {content:[{type:'text',text:typeof body==='string'?body:JSON.stringify(body,null,2)}],isError};}
const specs=[
 {name:'build_city',description:'Build traceable visual LoD1 3D Tiles, estimates ledger and browser viewer from a city profile (local snapshot; optional bounded official IGIO fetch). Never publishes or certifies.',inputSchema:{type:'object',properties:{profile:{type:'string'},output:{type:'string'},online_acquire:{type:'boolean'},strict:{type:'boolean'}},required:['profile','output']}},
 {name:'prepare_neural_reconstruction',description:'Inspect local overlapping imagery and produce an auditable Nerfstudio/COLMAP/3DGS plan; does not run GPU training.',inputSchema:{type:'object',properties:{images:{type:'string'},output:{type:'string'}},required:['images','output']}},
 {name:'inspect_city',description:'Read build report and assumptions ledger from an existing world build. Does not modify files.',inputSchema:{type:'object',properties:{output:{type:'string'},limit:{type:'integer',minimum:1,maximum:100}},required:['output']}},
 {name:'list_city_profiles',description:'List packaged city profiles, including vetted official-source entry points.',inputSchema:{type:'object',properties:{}}},
 {name:'bootstrap_city_profile',description:'Copy one packaged city profile into an authorized local workspace for editing/building; never downloads or publishes.',inputSchema:{type:'object',properties:{profile_name:{type:'string'},destination:{type:'string'}},required:['profile_name','destination']}}
];
function runPy(args){const call=spawnSync(python,args,{cwd:runtime,env:{...process.env,PYTHONPATH:path.join(runtime,'src')},encoding:'utf8',timeout:120000,maxBuffer:3e6,shell:false});return {exit_code:call.status,stdout:call.stdout?.slice(0,16000),stderr:call.stderr?.slice(0,4000),error:call.error?.message||null};}
function callTool(name,a={}){
 if(name==='list_city_profiles')return toolResult(fs.readdirSync(path.join(runtime,'profiles')).filter(f=>f.endsWith('.json')).map(f=>({name:f,profile_json:JSON.parse(fs.readFileSync(path.join(runtime,'profiles',f),'utf8'))})));
 if(name==='bootstrap_city_profile'){
   const nameStr=a.profile_name;if(typeof nameStr!=='string'||!/^[-_a-zA-Z0-9]+\.json$/.test(nameStr))throw Error('Choose packaged profile filename only');
   const src=path.join(runtime,'profiles',nameStr),dst=resolveWorkspace(a.destination);
   if(!fs.existsSync(src))throw Error('Packaged city profile not found');
   if(fs.existsSync(dst))throw Error('Refusing to overwrite existing profile');
   fs.mkdirSync(path.dirname(dst),{recursive:true});
   const parsed=JSON.parse(fs.readFileSync(src,'utf8'));
   if(nameStr==='sample_city.json'){
     // Self-contained demonstrator: remap bundled synthetic source path, not the requested real city.
     parsed.source_snapshot=path.join(runtime,'examples','sample_footprints_32616.geojson');
   }
   fs.writeFileSync(dst,JSON.stringify(parsed,null,2)+'\n');
   return toolResult({copied_profile:nameStr,destination:dst,source_snapshot:parsed.source_snapshot||null,
      online_acquire_required:!parsed.source_snapshot});
 }
 if(name==='build_city'){
   const p=resolveWorkspace(a.profile),out=resolveWorkspace(a.output);
   if(!fs.existsSync(p))throw Error('Profile not found in authorized workspace');
   const args=['-m','citybuilder.auto',p,out];
   if(a.online_acquire===true)args.push('--online-acquire');
   if(a.strict===true)args.push('--strict');
   const result=runPy(args);return toolResult(result,result.exit_code!==0);
 }
 if(name==='prepare_neural_reconstruction'){
   const img=resolveWorkspace(a.images),out=resolveWorkspace(a.output);
   const code=`import json,sys;from citybuilder.auto import design_nerf_job;print(json.dumps(design_nerf_job(sys.argv[1],sys.argv[2])))`;
   const result=runPy(['-c',code,img,out]);return toolResult(result,result.exit_code!==0);
 }
 if(name==='inspect_city'){
   const out=resolveWorkspace(a.output);let report={};
   for(const f of ['build_report.json','manifest.json','estimate_ledger.json']){const p=path.join(out,f);if(fs.existsSync(p))report[f]=JSON.parse(fs.readFileSync(p,'utf8'))}
   if(!Object.keys(report).length)throw Error('No build reports found');
   if(Array.isArray(report['estimate_ledger.json']?.estimates)){const all=report['estimate_ledger.json'].estimates;report['estimate_ledger.json'].total_estimates=all.length;report['estimate_ledger.json'].estimates=all.slice(0,Math.max(1,Math.min(100,a.limit||20)))}
   return toolResult(report);
 }
 throw Error('Unknown tool');
}
function respond(id,result,error=null){const obj={jsonrpc:'2.0',id};if(error)obj.error={code:-32603,message:String(error.message||error)};else obj.result=result;process.stdout.write(JSON.stringify(obj)+'\n');}
let counter=0;
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',s=>{if(s.length>3e6)return;let req;try{req=JSON.parse(s)}catch(e){respond(null,null,Error('Invalid JSON'));return}
 if(!req||req.id===undefined)return;
 try{
   if(req.method==='initialize')return respond(req.id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'auto-3d-city-builder',version:'0.2.1'}});
   if(req.method==='ping')return respond(req.id,{});
   if(req.method==='tools/list')return respond(req.id,{tools:specs});
   if(req.method==='tools/call')return respond(req.id,callTool(req.params?.name,req.params?.arguments||{}));
   return respond(req.id,null,Error('Method not found'));
 }catch(e){respond(req.id,toolResult(e.message,true))}
});
