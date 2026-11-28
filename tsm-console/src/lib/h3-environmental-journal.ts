import { isValidCell } from 'h3-js';

export const ENVIRONMENTAL_SAVE_VERSION = 2;
export const ENVIRONMENTAL_JOURNAL_DB = 'tsm-environmental-journal';
export const ENVIRONMENTAL_JOURNAL_STORE = 'records';

export type EvidenceClass = 'observed' | 'derived' | 'simulated';
export interface EnvironmentalRecord {
  readonly recordId: string;
  readonly cellId: string;
  readonly recordedAt: string;
  readonly kind: 'weather' | 'season' | 'visitation' | 'environment';
  readonly evidenceClass: EvidenceClass;
  readonly sourceUri?: string;
  readonly sourceSha256?: string;
  readonly values: Readonly<Record<string, string | number | boolean | null>>;
}

export function validateEnvironmentalRecord(record: EnvironmentalRecord): void {
  if (!record || typeof record !== 'object') throw new TypeError('Record must be an object.');
  if (!isValidCell(record.cellId)) throw new TypeError('cellId must be a valid persistent H3 index.');
  if (!record.recordId || record.recordId.length > 160) throw new TypeError('recordId is required and bounded.');
  if (!Number.isFinite(Date.parse(record.recordedAt))) throw new TypeError('recordedAt must be an ISO-compatible timestamp.');
  if (!['weather', 'season', 'visitation', 'environment'].includes(record.kind)) throw new TypeError('Unsupported journal kind.');
  if (!['observed', 'derived', 'simulated'].includes(record.evidenceClass)) throw new TypeError('Evidence class is required.');
  if (record.evidenceClass === 'observed' && (!record.sourceUri || !/^[a-f0-9]{64}$/i.test(record.sourceSha256 ?? ''))) {
    throw new TypeError('Observed records require source URI and SHA-256 provenance.');
  }
  if (!record.values || typeof record.values !== 'object' || Array.isArray(record.values)) throw new TypeError('values must be a key-value object.');
  for (const [key, value] of Object.entries(record.values)) {
    if (!key || key.length > 128 || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new TypeError('Journal value key or number is invalid.');
    }
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new TypeError('Journal values must be scalar and serializable.');
  }
}

/** Versioned, loss-preserving migration. Unlocated legacy records are not assigned fabricated H3 cells. */
export function migrateLegacySave(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Legacy save must be an object.');
  const save = input as Record<string, unknown>;
  const version = save.schemaVersion === undefined ? 0 : save.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0 || version > ENVIRONMENTAL_SAVE_VERSION) {
    throw new TypeError('Unsupported save schema version.');
  }
  if (version === ENVIRONMENTAL_SAVE_VERSION) return structuredClone(save);
  const priorHistory = Array.isArray(save.cellHistory) ? save.cellHistory : [];
  const migratedHistory = priorHistory.map((item) => {
    const entry: Record<string, unknown> = item && typeof item === 'object' ? item as Record<string, unknown> : { legacyValue: item };
    const h3Cell = typeof entry.cellId === 'string' && isValidCell(entry.cellId) ? entry.cellId : null;
    return { ...entry, h3Cell, spatialStatus: h3Cell ? 'identified' : 'requires-source-remap' };
  });
  return {
    ...structuredClone(save),
    schemaVersion: ENVIRONMENTAL_SAVE_VERSION,
    cellHistory: migratedHistory,
    migration: { from: version, to: ENVIRONMENTAL_SAVE_VERSION, preservesLegacyPayload: true },
  };
}

export function dueEnvironmentalEvents<T extends { eventId: string; dueAt: string }>(events: readonly T[], now: string): T[] {
  const instant = Date.parse(now);
  if (!Number.isFinite(instant)) throw new TypeError('Scheduler clock must be a valid timestamp.');
  return events.filter((event) => Number.isFinite(Date.parse(event.dueAt)) && Date.parse(event.dueAt) <= instant)
    .slice().sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.eventId.localeCompare(b.eventId));
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export function openEnvironmentalJournal(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(ENVIRONMENTAL_JOURNAL_DB, ENVIRONMENTAL_SAVE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(ENVIRONMENTAL_JOURNAL_STORE)
        ? request.transaction!.objectStore(ENVIRONMENTAL_JOURNAL_STORE)
        : db.createObjectStore(ENVIRONMENTAL_JOURNAL_STORE, { keyPath: 'recordId' });
      if (!store.indexNames.contains('cellId')) store.createIndex('cellId', 'cellId', { unique: false });
      if (!store.indexNames.contains('recordedAt')) store.createIndex('recordedAt', 'recordedAt', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open environmental journal.'));
    request.onblocked = () => reject(new Error('Environmental journal upgrade is blocked by another open tab.'));
  });
}

/** Append-only storage: duplicate record IDs fail rather than overwrite source history. */
export async function appendEnvironmentalRecord(db: IDBDatabase, record: EnvironmentalRecord): Promise<void> {
  validateEnvironmentalRecord(record);
  const transaction = db.transaction(ENVIRONMENTAL_JOURNAL_STORE, 'readwrite');
  const complete = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Journal transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Journal transaction aborted.'));
  });
  transaction.objectStore(ENVIRONMENTAL_JOURNAL_STORE).add(structuredClone(record));
  await complete;
}

export async function readCellJournal(db: IDBDatabase, cellId: string): Promise<EnvironmentalRecord[]> {
  if (!isValidCell(cellId)) throw new TypeError('cellId must be a valid H3 index.');
  const transaction = db.transaction(ENVIRONMENTAL_JOURNAL_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(ENVIRONMENTAL_JOURNAL_STORE).index('cellId').getAll(cellId));
  return records.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}
