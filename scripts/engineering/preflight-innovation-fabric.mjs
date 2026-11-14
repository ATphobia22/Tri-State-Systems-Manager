#!/usr/bin/env node
/**
 * Evidence-first, headless worker preflight. NEVER executes a model, installs
 * software, manufactures observations, or asserts a patent has been cleared.
 * Existing model/HLOD/cinema runners retain their independent approval gates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'tsm.innovation.fabric.v1';
const SHA = /^[a-f0-9]{64}$/;
const SOURCE_CLASSES = new Set(['OBSERVED', 'DERIVED', 'SCENARIO', 'PRESENTATION']);
const ELEVATION_ROLES = new Set(['terrain', 'water', 'hydraulic_surface', 'flood_depth']);
const SCIENCE_KINDS = new Set(['hec_ras', 'epa_swmm', 'coupling_review', 'terrain_normalization']);
const has = (o, key) => Object.prototype.hasOwnProperty.call(o ?? {}, key);
const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function relativeFile(root, value) {
  if (typeof value !== 'string' || !value || value.includes('\\') ||
      path.isAbsolute(value) || value.includes('\0') ||
      value.split('/').some(p => p === '..' || p === '.' || !p)) {
    throw new Error('UNSAFE_RELATIVE_PATH');
  }
  const canonicalRoot = fs.realpathSync(root);
  const target = path.resolve(canonicalRoot, value);
  if (!target.startsWith(canonicalRoot + path.sep)) throw new Error('PATH_OUTSIDE_ROOT');
  let ancestor = target;
  while (!fs.existsSync(ancestor) && ancestor !== path.dirname(ancestor)) ancestor = path.dirname(ancestor);
  const resolvedAncestor = fs.realpathSync(ancestor);
  if (resolvedAncestor !== canonicalRoot && !resolvedAncestor.startsWith(canonicalRoot + path.sep)) {
    throw new Error('SYMLINK_OUTSIDE_ROOT');
  }
  return target;
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const unique = (items, field) => {
  const ids = new Set();
  for (const item of items) {
    if (!obj(item) || typeof item[field] !== 'string' || !/^[a-z][a-z0-9_-]{1,63}$/.test(item[field]) || ids.has(item[field])) {
      throw new Error('INVALID_OR_DUPLICATE_' + field.toUpperCase());
    }
    ids.add(item[field]);
  }
  return ids;
};

export function orderStages(stages, stageKinds) {
  if (!Array.isArray(stages)) throw new Error('STAGES_REQUIRED');
  const known = unique(stages,'id');
  const all = new Map(stages.map(stage => [stage.id,stage]));
  const done = new Set(), stack = new Set(), ordered = [];
  function visit(id) {
    if (!known.has(id)) throw new Error('UNKNOWN_STAGE_DEPENDENCY:' + id);
    if (stack.has(id)) throw new Error('CYCLIC_WORKER_GRAPH:' + id);
    if (done.has(id)) return;
    stack.add(id);
    const stage = all.get(id);
    if (!has(stageKinds,stage.kind)) throw new Error('UNKNOWN_STAGE_KIND:' + stage.kind);
    if (!Array.isArray(stage.needs) || !Array.isArray(stage.inputs)) throw new Error('INVALID_STAGE_INPUTS:' + id);
    if (new Set(stage.needs).size !== stage.needs.length) throw new Error('DUPLICATE_STAGE_NEEDS:' + id);
    for (const dep of stage.needs) visit(dep);
    stack.delete(id);
    done.add(id);
    ordered.push(stage);
  }
  for (const stage of stages) visit(stage.id);
  return ordered;
}

export function inspectPatents(record) {
  if (!obj(record) || record.schema !== 'tsm.patent.prior-art-screen.v1' ||
      record.legal_clearance !== 'NOT_ASSESSED' || !Array.isArray(record.patents) || record.patents.length === 0) {
    throw new Error('PATENT_RESEARCH_NOT_REVIEWED');
  }
  for (const p of record.patents) {
    if (!/^US\d{6,9}[A-C]\d?$/.test(p.patent) || !p.official_record?.startsWith('https://ppubs.uspto.gov/') ||
        p.freedom_to_operate !== 'NOT_ASSESSED' || p.implementation !== 'IDEA_ONLY' ||
        p.expiration_independently_verified !== false) {
      throw new Error('PATENT_NOT_CLEARED:' + String(p.patent));
    }
  }
  return { count: record.patents.length, freedom_to_operate: 'NOT_ASSESSED', status: 'PRIOR_ART_ONLY' };
}

async function inspectSource(row, root) {
  if (!obj(row) || !SOURCE_CLASSES.has(row.classification)) return { id: row?.id ?? null, status: 'PROVENANCE_INCOMPLETE' };
  if (!SHA.test(row.sha256 ?? '') || typeof row.authority !== 'string' || !row.authority.trim() ||
      typeof row.source_uri !== 'string' || !row.source_uri.startsWith('https://') ||
      row.license_review !== 'REVIEWED' || row.verified !== true) {
    return { id: row.id, status: 'PROVENANCE_INCOMPLETE' };
  }
  if (ELEVATION_ROLES.has(row.role) && (!/^EPSG:\d{4,6}$/.test(row.horizontal_crs ?? '') ||
      !row.vertical_datum || !row.vertical_units)) return { id: row.id, status: 'DATUM_NOT_EVIDENCED' };
  let file;
  try { file = relativeFile(root,row.path); }
  catch (error) { return { id: row.id, status: String(error.message) }; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return { id: row.id, status: 'SOURCE_NOT_EVIDENCED' };
  if (await sha256(file) !== row.sha256) return { id: row.id, status: 'HASH_MISMATCH' };
  return { id: row.id, status: 'HASH_VERIFIED', size_bytes: fs.statSync(file).size };
}

async function inspectRuntime(descriptor, root) {
  if (!obj(descriptor) || !SHA.test(descriptor.sha256 ?? '') ||
      typeof descriptor.version !== 'string' || !descriptor.version.trim()) return 'RUNTIME_NOT_CONFIGURED';
  let file;
  try { file = relativeFile(root,descriptor.path); }
  catch { return 'RUNTIME_UNSAFE_PATH'; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return 'RUNTIME_NOT_INSTALLED';
  if (await sha256(file) !== descriptor.sha256) return 'RUNTIME_HASH_MISMATCH';
  return 'RUNTIME_PIN_VERIFIED';
}

export async function inspectFabric(document, root, patentRecord) {
  if (!obj(document) || document.schema !== SCHEMA || !obj(document.stage_kinds) || !obj(document.proposal)) {
    throw new Error('FABRIC_SCHEMA_INVALID');
  }
  const patents = inspectPatents(patentRecord);
  const sources = document.proposal.sources;
  if (!Array.isArray(sources)) throw new Error('FABRIC_SOURCES_REQUIRED');
  const ids = unique(sources,'id');
  const checked = new Map();
  for (const source of sources) checked.set(source.id,await inspectSource(source,root));
  const stages = [];
  for (const stage of orderStages(document.proposal.stages,document.stage_kinds)) {
    const spec = document.stage_kinds[stage.kind];
    if (!obj(spec) || !['headless','headed'].includes(spec.mode) ||
        (spec.mode === 'headed' && stage.kind !== 'unreal_shot') ||
        (spec.mode === 'headless' && stage.kind === 'unreal_shot')) {
      throw new Error('WORKER_RENDER_BOUNDARY_VIOLATION:' + stage.id);
    }
    if (typeof spec.runner !== 'string') throw new Error('WORKER_ADAPTER_UNDEFINED:' + stage.id);
    const reasons = [];
    for (const id of stage.inputs) {
      if (!ids.has(id)) throw new Error('UNKNOWN_EVIDENCE_INPUT:' + id);
      const status = checked.get(id).status;
      if (status !== 'HASH_VERIFIED') reasons.push(id + ':' + status);
    }
    if (SCIENCE_KINDS.has(stage.kind) && !stage.inputs.length && !stage.needs.length) reasons.push('CALIBRATED_INPUTS_NOT_EVIDENCED');
    // Downstream prerequisites are NOT considered executed merely because upstream is planned.
    if (stage.needs.length) reasons.push('UPSTREAM_EXECUTION_NOT_EVIDENCED');
    const runtimeStatus = await inspectRuntime(stage.runtime,root);
    if (runtimeStatus !== 'RUNTIME_PIN_VERIFIED') reasons.push(runtimeStatus);
    stages.push({ id:stage.id,kind:stage.kind,mode:spec.mode,adapter:spec.runner,
      status:reasons.length ? 'NOT_EVIDENCED' : 'READY_FOR_EXECUTION',
      reasons,executed:false,approved_for_publication:false });
  }
  return { schema:SCHEMA,patent_screen:patents,source_evidence:[...checked.values()],stages,
    summary:{ ready_for_execution:stages.filter(s=>s.status==='READY_FOR_EXECUTION').length,
      not_evidenced:stages.filter(s=>s.status==='NOT_EVIDENCED').length,
      verified_execution:0,public_model_outputs:0 },
    disclaimer:'Preparation/verification report, not a performed flood simulation, certified design, FTO conclusion, or Windows Shipping build.' };
}

async function cli() {
  const args = process.argv.slice(2);
  const get = k => { const i=args.indexOf(k); return i===-1 ? null : args[i+1]; };
  const strict = args.includes('--strict');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repo = path.resolve(here,'../..');
  const input = get('--manifest') ?? path.join(repo,'integrations/innovation-fabric-stages-v1.json');
  const priorArt = get('--patents') ?? path.join(repo,'integrations/patent-prior-art-screen-2026-11-14.json');
  const root = get('--root') ?? repo;
  const report = await inspectFabric(JSON.parse(fs.readFileSync(input,'utf8')),root,
    JSON.parse(fs.readFileSync(priorArt,'utf8')));
  const result = JSON.stringify(report,null,2) + '\n';
  const out = get('--out');
  if (out) fs.writeFileSync(out,result,'utf8');
  else process.stdout.write(result);
  if (strict && (report.summary.not_evidenced > 0 || report.summary.verified_execution === 0)) process.exitCode=2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(err => { console.error('INNOVATION_PREFLIGHT_ERROR:',err.message);process.exitCode=3; });
}
