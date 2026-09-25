/**
 * Provenance label taxonomy.
 *
 * A fixed vocabulary for answering "where did this value come from?" Labels
 * attach to derived products (gauge observations, elevations, flood
 * elevations, rendered layers) so consumers — and the UI — can tell
 * authoritative data apart from modeled or estimated values at a glance.
 *
 * Label meanings:
 * - `FEMA-EFFECTIVE`: value taken verbatim from the effective FEMA source
 *   (FIRM panel, FIS profile, LOMA/LOMR case). Authoritative for flood
 *   elevations at the parcel.
 * - `STATE-BEST`: value from the best available state source (e.g. INDOT /
 *   IDNR datasets) where no FEMA-effective value exists. Second-best
 *   authority, but not FEMA-effective.
 * - `OBSERVED`: value measured or reported by the authoritative sensor or
 *   observing network itself (a live USGS/NWS gauge reading). Authoritative
 *   for what was observed.
 * - `MODELED`: value produced by a hydraulic, hydrologic, or other model
 *   (HEC-RAS, SCS-CN, HAZUS). Only as good as the model, its inputs, and its
 *   calibration — never authoritative by itself.
 * - `FORECAST`: a modeled value projected into the future. Like `MODELED`,
 *   but additionally subject to forecast uncertainty; never authoritative.
 * - `OWNER-SUPPLIED`: value provided by the property owner (survey notes,
 *   photos, claimed elevations). Useful context; unverified until checked
 *   against an authoritative source.
 * - `DERIVED`: value computed from one or more other values (unit
 *   conversions, datum shifts, interpolations). Inherits the provenance of
 *   its inputs — it cannot be more authoritative than its weakest input.
 * - `UNAVAILABLE`: no value could be obtained or the source failed closed.
 *   Marks an explicit absence of data so it is never confused with a
 *   zero or a stale value.
 *
 * Guidance: prefer `FEMA-EFFECTIVE` for regulatory flood-elevation answers,
 * `OBSERVED` for sensor readings, and `MODELED`/`FORECAST` for model output.
 * Multiple labels may combine (e.g. `MODELED + DERIVED` for a value that is
 * both modeled and re-projected); `UNAVAILABLE` should never be combined with
 * a label that implies a value exists.
 */

/** The complete, fixed set of provenance labels. */
export const PROVENANCE_LABELS = [
  'FEMA-EFFECTIVE',
  'STATE-BEST',
  'OBSERVED',
  'MODELED',
  'FORECAST',
  'OWNER-SUPPLIED',
  'DERIVED',
  'UNAVAILABLE',
] as const;

export type ProvenanceLabel = (typeof PROVENANCE_LABELS)[number];

export interface Provenance {
  readonly labels: readonly ProvenanceLabel[];
  readonly sourceUri?: string;
  readonly retrievedAt: string;
  readonly modelVersion?: string;
}

function isKnownLabel(label: unknown): label is ProvenanceLabel {
  return (PROVENANCE_LABELS as readonly unknown[]).includes(label);
}

/**
 * Builds a `Provenance` record.
 * - Throws on an unknown label or an empty label list (fail closed: a value
 *   without known provenance must not be presented as labeled).
 * - Deduplicates labels, preserving first-seen order.
 * - `retrievedAt` defaults to the current time as an ISO-8601 timestamp.
 */
export function makeProvenance(
  labels: ProvenanceLabel[],
  opts?: { sourceUri?: string; modelVersion?: string; retrievedAt?: string },
): Provenance {
  const unique: ProvenanceLabel[] = [];
  for (const label of labels) {
    if (!isKnownLabel(label)) {
      throw new Error(`Unknown provenance label: ${String(label)}`);
    }
    if (!unique.includes(label)) {
      unique.push(label);
    }
  }
  if (unique.length === 0) {
    throw new Error('makeProvenance requires at least one provenance label');
  }
  const provenance: {
    labels: ProvenanceLabel[];
    retrievedAt: string;
    sourceUri?: string;
    modelVersion?: string;
  } = {
    labels: unique,
    retrievedAt: opts?.retrievedAt ?? new Date().toISOString(),
  };
  if (opts?.sourceUri !== undefined) provenance.sourceUri = opts.sourceUri;
  if (opts?.modelVersion !== undefined) provenance.modelVersion = opts.modelVersion;
  return provenance;
}

/**
 * True for `FEMA-EFFECTIVE` and `OBSERVED`.
 *
 * Authoritative here means the value originates from the authoritative source
 * itself — the effective FEMA flood map for a flood elevation, or the
 * observing sensor/network for a measurement — rather than being computed,
 * estimated, or relayed from a secondary source. `STATE-BEST` is the best
 * available state data but is not the regulatory authority; `MODELED`,
 * `FORECAST`, and `DERIVED` are computations; `OWNER-SUPPLIED` is
 * unverified; `UNAVAILABLE` marks an explicit absence.
 */
export function isAuthoritativeLabel(label: ProvenanceLabel): boolean {
  return label === 'FEMA-EFFECTIVE' || label === 'OBSERVED';
}

/**
 * One-line human-readable summary, e.g.
 * `MODELED + DERIVED · retrieved 2026-09-25T13:00:00.000Z · scs-cn-v1`.
 */
export function describeProvenance(p: Provenance): string {
  const parts = [p.labels.join(' + '), `retrieved ${p.retrievedAt}`];
  if (p.modelVersion) parts.push(p.modelVersion);
  if (p.sourceUri) parts.push(p.sourceUri);
  return parts.join(' · ');
}
