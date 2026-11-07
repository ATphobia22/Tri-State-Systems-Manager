/**
 * Python-compatible canonical JSON + SHA-256.
 *
 * Reproduces `backend/evidence/canonical_hash.py` (`canonical_json` /
 * `hash_payload`) exactly, so a hash computed here matches the hash computed
 * by the Python side for the same payload.
 *
 * This is intentionally separate from the existing `stableJson` /
 * `hashEvidencePayload` in `./index.ts`: those use `JSON.stringify` number
 * formatting (`1.0` -> `"1"`, `-0` -> `"0"`) and existing consumers
 * (`packages/twin-pipeline` derives entity ids from them) depend on that
 * output. Do NOT change those helpers; use these new exports when the hash
 * must agree with Python.
 *
 * Python float formatting reproduced here (`json.dumps` / `repr(float)`):
 * integral floats render with `.0` (`1.0`), negative zero as `-0.0`,
 * scientific notation for exponents < -4 or >= 16 (`1e+21`, `1e-05` with a
 * two-digit exponent), shortest round-trip digits otherwise.
 *
 * Known TypeScript limitation, documented honestly: a JS `number` carries
 * no int/float distinction, so `canonicalJsonPy(1)` renders Python-int
 * `"1"` while Python `canonical_json(1.0)` renders `"1.0"`. Integral JS
 * numbers below 1e16 are therefore rendered as Python ints; float-ness is
 * observable (and reproduced) for non-integral values, `-0.0`, and values
 * >= 1e16 in scientific form. Test vectors use values where the two
 * languages agree; do not assert `canonicalJsonPy(1) === "1.0"`.
 */
import { createHash } from 'node:crypto';

function compareCodePoints(a: string, b: string): number {
  const aPoints = Array.from(a);
  const bPoints = Array.from(b);
  const len = Math.min(aPoints.length, bPoints.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (aPoints[i].codePointAt(0) ?? 0) - (bPoints[i].codePointAt(0) ?? 0);
    if (diff !== 0) return diff;
  }
  return aPoints.length - bPoints.length;
}

/**
 * Python `repr(float)` for a finite, non-zero number that is not an integral
 * value below 1e16 (the caller renders those as Python ints).
 */
function pythonFloatRepr(value: number): string {
  const negative = value < 0;
  const absJs = Math.abs(value).toString();
  let digits: string;
  let sciExp: number;
  const expIndex = absJs.indexOf('e');
  if (expIndex !== -1) {
    const mantissa = absJs.slice(0, expIndex);
    sciExp = Number.parseInt(absJs.slice(expIndex + 1), 10);
    digits = mantissa.replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  } else if (absJs.includes('.')) {
    const [intPart, fracPart] = absJs.split('.');
    if (intPart !== '0') {
      sciExp = intPart.length - 1;
      digits = (intPart + fracPart).replace(/0+$/, '');
    } else {
      const firstNonZero = [...fracPart].findIndex((ch) => ch !== '0');
      sciExp = -(firstNonZero + 1);
      digits = fracPart.slice(firstNonZero).replace(/0+$/, '');
    }
  } else {
    sciExp = absJs.length - 1;
    digits = absJs.replace(/0+$/, '');
  }
  let body: string;
  if (sciExp < -4 || sciExp >= 16) {
    const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits[0];
    const expSign = sciExp < 0 ? '-' : '+';
    body = `${mantissa}e${expSign}${String(Math.abs(sciExp)).padStart(2, '0')}`;
  } else if (sciExp >= digits.length - 1) {
    body = `${digits}${'0'.repeat(sciExp - digits.length + 1)}.0`;
  } else if (sciExp >= 0) {
    body = `${digits.slice(0, sciExp + 1)}.${digits.slice(sciExp + 1)}`;
  } else {
    body = `0.${'0'.repeat(-sciExp - 1)}${digits}`;
  }
  return negative ? `-${body}` : body;
}

function formatPyNumber(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Number.POSITIVE_INFINITY) return 'Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  if (Object.is(value, -0)) return '-0.0';
  // Integral JS numbers render as Python ints (see module doc: TS cannot
  // distinguish int 1 from float 1.0). Floats >= 1e16 use scientific form.
  if (Number.isInteger(value) && Math.abs(value) < 1e16) return String(value);
  return pythonFloatRepr(value);
}

/**
 * Canonical JSON mirroring Python `backend.evidence.canonical_hash.canonical_json`:
 * object keys sorted (by Unicode code point) at every depth, arrays keep
 * order, `ensure_ascii=False` (non-ASCII kept raw), `separators=(",", ":")`.
 * Throws TypeError for values Python cannot encode (undefined, functions,
 * symbols) — mirroring Python's TypeError rather than silently dropping keys.
 */
export function canonicalJsonPy(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return formatPyNumber(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return `[${value.map(canonicalJsonPy).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareCodePoints);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonPy(record[key])}`).join(',')}}`;
  }
  throw new TypeError(`canonicalJsonPy cannot encode ${typeof value}`);
}

/** Lowercase hex SHA-256 of the Python-canonical JSON encoding. */
export function hashCanonicalPayload(value: unknown): string {
  return createHash('sha256').update(canonicalJsonPy(value), 'utf-8').digest('hex');
}
