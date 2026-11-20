/** Offline-first, evidence-aware BIM review. No vendor calls or engineering certification. */
export const REVIEW_SCHEMA = 'tsm.design-review.v1' as const;
export type Unit = 'm' | 'm2' | 'm3' | 'kg' | 'count';
export type Evidence = 'SOURCE_OBSERVATION' | 'DERIVED' | 'UNVERIFIED';
export type Quantity = { value: number; unit: Unit; evidence: Evidence };
export type Element = { id: string; parentId: string | null; title: string; category: string; quantities: Record<string, Quantity> };
export type Review = {
  schema: typeof REVIEW_SCHEMA; modelId: string; revisionId: string;
  source: { sourceId: string; sha256: string; horizontalCrs: string; horizontalUnits: 'm' | 'ftUS' | 'ft'; verticalDatum: string; license: string };
  placement: { state: 'PENDING_EVIDENCE' | 'CONTROL_REVIEWED'; controlCount: number; maxResidualM: number | null; toleranceM: number | null };
  elements: Element[];
};
export type Changes = { added: string[]; removed: string[]; modified: string[]; unchanged: string[] };
export type Summary = { key: string; unit: Unit; count: number; omitted: number; sourceCount: number; derivedCount: number; sum: number | null; min: number | null; max: number | null; average: number | null };
const idPattern = /^[a-zA-Z0-9_.:-]{1,128}$/;
const hashPattern = /^[0-9a-fA-F]{64}$/;
const crsPattern = /^EPSG:[0-9]{3,6}$/;
const units: Unit[] = ['m', 'm2', 'm3', 'kg', 'count'];
const evidence: Evidence[] = ['SOURCE_OBSERVATION', 'DERIVED', 'UNVERIFIED'];
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(label + ': expected an object');
  return value as Record<string, unknown>;
};
const asString = (value: unknown, label: string, pattern?: RegExp): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 512 || (pattern && !pattern.test(value))) throw new Error(label + ': invalid string');
  return value;
};
const asNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(label + ': non-finite number');
  return value;
};
export function parseDesignReview(input: unknown): Review {
  const obj = asObject(input, 'review');
  if (obj.schema !== REVIEW_SCHEMA) throw new Error('Unsupported design-review schema');
  const modelId = asString(obj.modelId, 'modelId', idPattern);
  const revisionId = asString(obj.revisionId, 'revisionId', idPattern);
  const origin = asObject(obj.source, 'source');
  const sourceId = asString(origin.sourceId, 'sourceId', idPattern);
  const sha256 = asString(origin.sha256, 'sha256', hashPattern).toLowerCase();
  const horizontalCrs = asString(origin.horizontalCrs, 'horizontalCrs', crsPattern);
  const horizontalUnits = asString(origin.horizontalUnits, 'horizontalUnits') as Review['source']['horizontalUnits'];
  if (!['m', 'ftUS', 'ft'].includes(horizontalUnits)) throw new Error('Unsupported source units');
  const verticalDatum = asString(origin.verticalDatum, 'verticalDatum');
  if (['unknown', 'n/a', 'none', 'unspecified'].includes(verticalDatum.toLowerCase())) throw new Error('Declare unverified datum as UNVERIFIED');
  const license = asString(origin.license, 'license');
  const loc = asObject(obj.placement, 'placement');
  if (loc.state !== 'PENDING_EVIDENCE' && loc.state !== 'CONTROL_REVIEWED') throw new Error('Unknown alignment review state');
  const controlCount = asNumber(loc.controlCount, 'controlCount');
  if (!Number.isSafeInteger(controlCount) || controlCount < 0) throw new Error('Invalid control point count');
  const maxResidualM = loc.maxResidualM === null ? null : asNumber(loc.maxResidualM, 'maxResidualM');
  const toleranceM = loc.toleranceM === null ? null : asNumber(loc.toleranceM, 'toleranceM');
  if ((maxResidualM !== null && maxResidualM < 0) || (toleranceM !== null && toleranceM <= 0)) throw new Error('Invalid alignment metric');
  if (loc.state === 'CONTROL_REVIEWED' && (controlCount < 3 || maxResidualM === null || toleranceM === null || maxResidualM > toleranceM || verticalDatum === 'UNVERIFIED')) {
    throw new Error('Alignment cannot be CONTROL_REVIEWED without independent controls and datum');
  }
  if (!Array.isArray(obj.elements) || obj.elements.length > 20000) throw new Error('Invalid element count');
  const elements: Element[] = [];
  const byId = new Map<string, Element>();
  for (const raw of obj.elements) {
    const x = asObject(raw, 'element');
    const id = asString(x.id, 'element.id', idPattern);
    if (byId.has(id)) throw new Error('Duplicate element ID ' + id);
    const parentId = x.parentId === null ? null : asString(x.parentId, 'parentId', idPattern);
    const title = asString(x.title, 'title');
    const category = asString(x.category, 'category', idPattern);
    const rawQuantities = asObject(x.quantities, 'quantities');
    if (Object.keys(rawQuantities).length > 64) throw new Error('Too many quantities');
    const quantities: Record<string, Quantity> = {};
    for (const [key, value] of Object.entries(rawQuantities)) {
      if (!idPattern.test(key)) throw new Error('Invalid quantity name');
      const q = asObject(value, 'quantity');
      const val = asNumber(q.value, 'quantity.value');
      const unit = asString(q.unit, 'quantity.unit') as Unit;
      const kind = asString(q.evidence, 'quantity.evidence') as Evidence;
      if (!units.includes(unit) || !evidence.includes(kind) || (unit === 'count' && !Number.isInteger(val))) throw new Error('Invalid quantity unit/evidence');
      quantities[key] = { value: val, unit, evidence: kind };
    }
    const item: Element = { id, parentId, title, category, quantities };
    elements.push(item);
    byId.set(id, item);
  }
  const visiting = new Set<string>();
  const ancestryDepth = new Map<string, number>();
  function depthOf(id: string): number {
    const cached = ancestryDepth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) throw new Error('Cyclic BIM element tree');
    visiting.add(id);
    const parent = byId.get(id)?.parentId;
    let depth = 0;
    if (parent !== null && parent !== undefined) {
      if (!byId.has(parent)) throw new Error('Orphan BIM element parent: ' + parent);
      depth = depthOf(parent) + 1;
    }
    if (depth > 128) throw new Error('BIM element nesting exceeds safe depth');
    visiting.delete(id);
    ancestryDepth.set(id, depth);
    return depth;
  }
  for (const { id } of elements) depthOf(id);
  elements.sort((a,b) => order(a.id, b.id));
  return {
    schema: REVIEW_SCHEMA, modelId, revisionId,
    source: { sourceId, sha256, horizontalCrs, horizontalUnits, verticalDatum, license },
    placement: { state: loc.state, controlCount, maxResidualM, toleranceM } as Review['placement'],
    elements,
  };
}
export async function readDesignReviewFile(file: File): Promise<Review> {
  if (file.size === 0 || file.size > 4 * 1024 * 1024) throw new Error('Review file must be 1 byte to 4 MiB');
  return parseDesignReview(JSON.parse(await file.text()) as unknown);
}
export function flattenDesignTree(review: Review): (Element & { depth: number })[] {
  const children = new Map<string | null, Element[]>();
  for (const element of review.elements) {
    const list = children.get(element.parentId) ?? [];
    list.push(element);
    children.set(element.parentId, list);
  }
  const result: (Element & { depth: number })[] = [];
  function visit(parentId: string | null, depth: number): void {
    const list = (children.get(parentId) ?? []).sort((a,b) => order(a.id,b.id));
    for (const el of list) { result.push({ ...el, depth }); visit(el.id, depth + 1); }
  }
  visit(null, 0);
  return result;
}
const stable = (v: unknown): string => {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return '{' + Object.keys(obj).sort(order).map(key => JSON.stringify(key) + ':' + stable(obj[key])).join(',') + '}';
  }
  return JSON.stringify(v);
};
export function compareDesignRevisions(before: Review, after: Review): Changes {
  if (before.modelId !== after.modelId ||
      before.source.horizontalCrs !== after.source.horizontalCrs ||
      before.source.horizontalUnits !== after.source.horizontalUnits ||
      before.source.verticalDatum !== after.source.verticalDatum) {
    throw new Error('Cannot compare models across different identifiers/CRS/datums');
  }
  if (before.revisionId === after.revisionId && before.source.sha256 !== after.source.sha256) {
    throw new Error('Same revision ID has conflicting source hash');
  }
  const a = new Map(before.elements.map(el => [el.id, el]));
  const b = new Map(after.elements.map(el => [el.id, el]));
  const changes: Changes = { added: [], removed: [], modified: [], unchanged: [] };
  for (const id of a.keys()) if (!b.has(id)) changes.removed.push(id);
  for (const [id, el] of b) {
    if (!a.has(id)) changes.added.push(id);
    else if (stable(a.get(id)) !== stable(el)) changes.modified.push(id);
    else changes.unchanged.push(id);
  }
  for (const list of Object.values(changes)) list.sort(order);
  return changes;
}
export function summarizeQuantity(review: Review, key: string, unit: Unit): Summary {
  if (!idPattern.test(key) || !units.includes(unit)) throw new Error('Invalid requested quantity');
  const values: number[] = [];
  let omitted = 0, sourceCount = 0, derivedCount = 0;
  for (const el of review.elements) {
    const q = el.quantities[key];
    if (!q || q.unit !== unit || q.evidence === 'UNVERIFIED') { omitted++; continue; }
    values.push(q.value);
    if (q.evidence === 'DERIVED') derivedCount++;
    else sourceCount++;
  }
  const sum = values.length ? values.reduce((a,b)=>a+b, 0) : null;
  if (sum !== null && !Number.isFinite(sum)) throw new Error('Quantity aggregate exceeds safe numeric range');
  return {
    key, unit, count: values.length, omitted, sourceCount, derivedCount, sum,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    average: sum === null ? null : sum / values.length,
  };
}
