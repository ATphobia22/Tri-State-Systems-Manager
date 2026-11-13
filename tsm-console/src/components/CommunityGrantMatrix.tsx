/**
 * Community Grant Matrix — GitHub Pages friendly, source-pinned inventory.
 * Data is copied byte-for-byte from docs/grants/47620-Grant-Master-Matrix-2026-10-08.csv.
 * Archived statuses are NEVER represented as current grant availability.
 */
import { useEffect, useMemo, useState } from 'react';

type Grant = {
  Program_ID: string; Agency: string; Program_Name: string; Status: string;
  Proposal_Deadline: string; Application_Deadline: string; Priority: string;
  Category: string; TSM_Evidence_Packet: string; Notes: string;
};
const snapshot = '2026-10-08';
const sourceHref = 'https://github.com/ATphobia22/Tri-State-Systems-Manager/blob/main/docs/grants/47620-Grant-Master-Matrix-2026-10-08.csv';

function parseCsv(data: string): Grant[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    if (char === '"') {
      if (quoted && data[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && data[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((part) => part.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((part) => part.trim())) rows.push(row);
  const headings = rows.shift() ?? [];
  return rows.map((parts) => Object.fromEntries(headings.map((name, i) => [name, (parts[i] ?? '').trim()])) as Grant)
    .filter((record) => Boolean(record.Program_ID && record.Program_Name));
}

export default function CommunityGrantMatrix(): JSX.Element {
  const [programs, setPrograms] = useState<Grant[]>([]);
  const [loadStatus, setLoadStatus] = useState('Loading locally staged grant inventory…');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/community-grant-matrix-2026-10-08.csv`, { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error(`Grant CSV HTTP ${res.status}`); return res.text(); })
      .then((csv) => {
        const parsed = parseCsv(csv);
        setPrograms(parsed);
        setLoadStatus(`Read ${parsed.length} recorded programs from the ${snapshot} snapshot; current eligibility is unverified.`);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setLoadStatus(`Inventory unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => controller.abort();
  }, []);
  const categories = useMemo(() => [...new Set(programs.map((p) => p.Category))].sort(), [programs]);
  const visible = useMemo(() => programs.filter((p) => {
    const matchesCategory = category === 'all' || p.Category === category;
    const text = [p.Agency, p.Program_Name, p.Category, p.Notes, p.Status].join(' ').toLowerCase();
    return matchesCategory && text.includes(search.toLowerCase().trim());
  }), [category, programs, search]);

  return (
    <section aria-label="Community and flood resiliency grant inventory">
      <h2>Pay for solutions — community grant matrix</h2>
      <p>Find public-funding programs for roads, flood resilience, water infrastructure and public works. This is a dated planning inventory, not a current funding notice or eligibility determination.</p>
      <div className="tsm-atlas-grant-filters">
        <label htmlFor="tsm-grant-query">Search funding opportunities
          <input id="tsm-grant-query" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="flood, bridge, USDA, levee…" />
        </label>
        <label htmlFor="tsm-grant-category">Category
          <select id="tsm-grant-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
      </div>
      <p className="tsm-atlas-note" role="status" aria-live="polite">{loadStatus} · {visible.length} matching entries.</p>
      <div className="tsm-atlas-grant-list">
        {visible.slice(0, 60).map((grant) => <article key={grant.Program_ID} className="tsm-atlas-grant">
          <h3>{grant.Program_Name}</h3>
          <p><strong>{grant.Agency}</strong> · {grant.Category} · Priority as recorded: {grant.Priority || 'unspecified'}</p>
          <dl>
            <dt>Recorded status</dt><dd>{grant.Status || 'unspecified'} <strong>(2026-10-08 snapshot only)</strong></dd>
            <dt>Recorded deadline</dt><dd>{grant.Application_Deadline || grant.Proposal_Deadline || 'Not supplied'}</dd>
            <dt>Evidence packet</dt><dd>{grant.TSM_Evidence_Packet || 'Not supplied'}</dd>
          </dl>
          {grant.Notes && <p>{grant.Notes}</p>}
        </article>)}
      </div>
      {programs.length > 0 && visible.length === 0 && <p>No entries match these filters.</p>}
      <p className="tsm-atlas-note">
        Verify every deadline, award round and eligibility with the issuing agency before applying. Reopening a closed round is never inferred.
        {' '}<a href={sourceHref} rel="noopener noreferrer" target="_blank">Inspect the source CSV and provenance</a>
        {' '}· <a href="https://www.grants.gov/search-grants" rel="noopener noreferrer" target="_blank">Check official federal opportunities</a>
      </p>
    </section>
  );
}
