import { useMemo, useState } from 'react';
import {
  parseFoundryLedgerReview,
  type FoundryLedgerReview,
} from '../lib/foundry-ledger-review';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Import a locally generated Foundry review queue beside the signed ledger.
 * No remote request, silent auto-append, approval action, or elevation assertion.
 */
export default function FoundryLedgerReview(): JSX.Element {
  const [review, setReview] = useState<FoundryLedgerReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const matches = useMemo(() => (
    review?.entries.filter(entry =>
      [entry.sourceId, entry.field, entry.kind, ...entry.affectedPlanes]
        .some(value => value.toLowerCase().includes(filter.trim().toLowerCase()))
    ) ?? []
  ), [review, filter]);

  async function readFile(file: File | undefined): Promise<void> {
    setReview(null);
    setError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('Source-review file exceeds the 8 MiB local import limit');
      return;
    }
    try {
      const text = await file.text();
      const data: unknown = JSON.parse(text);
      setReview(parseFoundryLedgerReview(data));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Source-review file could not be read');
    }
  }

  return (
    <details aria-label="Government Data Contract Foundry ledger review"
      style={{ marginBottom: 18, padding: 14, border: '1px solid #64748b', borderRadius: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 36 }}>
        Government Data Contract Foundry · Human-review queue (separate from signed ledger)
      </summary>
      <p style={{ margin: '8px 0', fontSize: 13 }}>
        Load an advisory <code>foundry-ledger-review.json</code> produced by the headless
        Foundry adapter. This view does not append, sign, certify, or approve any record.
      </p>
      <label htmlFor="tsm-foundry-local-review">Import local review report</label>
      <input id="tsm-foundry-local-review" type="file" accept=".json,application/json"
        onChange={event => void readFile(event.target.files?.[0])}
        style={{ display: 'block', marginTop: 6, marginBottom: 9 }} />
      <div role="status" aria-live="polite">
        {error && <p style={{ color: '#fbbf24' }}>NOT EVIDENCED: {error}</p>}
        {!error && !review && <p>No source change queue loaded. The immutable evidence ledger remains unchanged.</p>}
      </div>
      {review && (
        <div style={{ fontSize: 13 }}>
          <p><strong>{review.reviewItemCount}</strong> review items · PENDING HUMAN REVIEW ·
            ledger submission: <strong>{review.ledgerSubmissionState}</strong> ·
            regulation/survey approval: <strong>NOT EVIDENCED</strong></p>
          <details>
            <summary>Source hashes and interpretation limits</summary>
            <p>Foundry input SHA-256 (declared; original input bytes not rehashed): <code style={{ overflowWrap: 'anywhere' }}>{review.sourceReportSha256}</code></p>
            <p>Catalog SHA-256 (declared): <code style={{ overflowWrap: 'anywhere' }}>{review.catalogSha256}</code></p>
            <p>Data-plane links are DECLARED_ONLY. This file is not a signed or accepted ledger block.</p>
          </details>
          <label htmlFor="tsm-foundry-filter">Filter by source, field or plane</label>
          <input id="tsm-foundry-filter" type="search" value={filter}
            onChange={event => setFilter(event.target.value)}
            style={{ display: 'block', marginTop: 5, marginBottom: 9, padding: 7,
              width: 'min(100%, 440px)', borderRadius: 6 }}/>
          <ul style={{ maxHeight: 260, overflowY: 'auto', paddingLeft: 24 }}>
            {matches.slice(0, 50).map(entry => (
              <li key={entry.entryId} style={{ marginBottom: 6 }}>
                <strong>{entry.sourceId}</strong> · {entry.field} · {entry.kind}
                <span> · {entry.reviewStatus}</span>
                {entry.affectedPlanes.length > 0 && (
                  <span> · declared planes: {entry.affectedPlanes.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
          {matches.length > 50 && <p>Showing 50 of {matches.length} filtered entries. Narrow the source filter to inspect more.</p>}
          <p style={{ color: '#fbbf24' }}>Unknowns remain unknown. Human authority final.
            Only server-side reviewed/authorized evidence may enter the immutable ledger.</p>
        </div>
      )}
    </details>
  );
}
