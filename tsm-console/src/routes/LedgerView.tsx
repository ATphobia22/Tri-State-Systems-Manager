/**
 * Evidence Ledger — high-performance virtual list
 * - useFlushSync: false → React 19 safe (no flushSync-in-render warning)
 * - directDomUpdates: true → skip re-renders on pure scroll; virtualizer owns transform
 * - memoized rows + stable keys
 */

import { memo, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AuthorityBadge } from '../components/AuthorityBadge';
import { useLoaderData, Form, useNavigation } from 'react-router';
import type { LedgerLoaderData } from '../types/loaders';

type Block = LedgerLoaderData['blocks'][number];

const ROW_HEIGHT = 88;
const LIST_HEIGHT = 420;
const OVERSCAN = 6;

const LedgerRow = memo(function LedgerRow({ block }: { block: Block }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8' }}>
          {block.evidence_id}
        </span>
        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Tier {block.tier}</span>
      </div>
      <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{block.source_org}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <AuthorityBadge authority_class="OBSERVATION" />
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
          {block.sha256_hash.slice(0, 24)}…
        </span>
      </div>
    </>
  );
});

function VirtualBlockList({ blocks }: { blocks: Block[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const count = blocks.length;

  const estimateSize = useCallback(() => ROW_HEIGHT, []);
  const getScrollElement = useCallback(() => parentRef.current, []);
  const getItemKey = useCallback(
    (index: number) => blocks[index]?.evidence_id ?? index,
    [blocks]
  );

  const virtualizer = useVirtualizer({
    count,
    getScrollElement,
    estimateSize,
    overscan: OVERSCAN,
    getItemKey,
    // React 19: avoid flushSync-during-render warnings; batch scroll updates
    useFlushSync: false,
    // Skip React re-renders for pure scroll; write transform directly to DOM
    directDomUpdates: true,
    directDomUpdatesMode: 'transform',
  });

  const items = virtualizer.getVirtualItems();

  if (count === 0) {
    return (
      <div ref={parentRef} style={{ height: LIST_HEIGHT, overflow: 'auto' }}>
        <p style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>
          Ledger empty. Append the first evidence block.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      style={{ height: LIST_HEIGHT, overflow: 'auto', contain: 'strict' }}
    >
      {/* containerRef required for directDomUpdates — do not set height in style */}
      <div ref={virtualizer.containerRef} style={{ position: 'relative', width: '100%' }}>
        {items.map((row) => {
          const block = blocks[row.index];
          if (!block) return null;
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                // height from estimate; main-axis position owned by virtualizer (transform)
                height: row.size,
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid #0f172a',
                boxSizing: 'border-box',
              }}
            >
              <LedgerRow block={block} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LedgerView() {
  const data = useLoaderData() as LedgerLoaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  const blocks = useMemo(() => data.blocks, [data.blocks]);
  const rootPreview = useMemo(
    () => (data.merkleRoot ? `${data.merkleRoot.slice(0, 32)}…` : null),
    [data.merkleRoot]
  );

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
        Evidence Ledger
      </h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
        SHA-256 · Merkle · virtualized · directDomUpdates · React 19–safe scroll
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.5rem' }}>
        <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9rem', color: '#38bdf8', margin: '0 0 1rem' }}>
            Append Evidence Block
          </h2>
          <Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Source Organization
              <input name="source_org" required placeholder="e.g., Indiana DNR" style={inputStyle} />
            </label>
            <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Source URI
              <input name="source_uri" required placeholder="e.g., usgs.gov/nwis/..." style={inputStyle} />
            </label>
            <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Epistemology Tier (0–6)
              <select name="tier" defaultValue="1" style={inputStyle}>
                <option value="0">0 — Law / Regulation</option>
                <option value="1">1 — Gov Authoritative</option>
                <option value="2">2 — Gov Standards (NIST/GSA)</option>
                <option value="3">3 — Academic</option>
                <option value="4">4 — Public Interest</option>
                <option value="5">5 — Commercial</option>
                <option value="6">6 — Community Observation</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 8,
                padding: '0.6rem',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {busy ? 'Sealing…' : 'Sign & Append (Server Merkle)'}
            </button>
          </Form>
          <p style={{ fontSize: '0.65rem', color: '#475569', marginTop: 12 }}>
            Hash and Merkle root are computed server-side. Client never supplies a trusted root.
          </p>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>Immutable Log</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {data.totalCount} blocks · direct DOM scroll
            </span>
          </div>
          {rootPreview && (
            <div
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.65rem',
                fontFamily: 'monospace',
                color: '#34d399',
                background: '#0f172a',
              }}
            >
              Merkle Root: {rootPreview}
            </div>
          )}
          <VirtualBlockList blocks={blocks} />
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '0.5rem 0.65rem',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
};
