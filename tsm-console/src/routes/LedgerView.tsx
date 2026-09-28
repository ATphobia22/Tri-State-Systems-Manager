/**
 * Evidence Ledger — high-performance virtual list
 * - useFlushSync: false → React 19 safe (no flushSync-in-render warning)
 * - directDomUpdates: true → skip re-renders on pure scroll; virtualizer owns transform
 * - memoized rows + stable keys
 */

import { memo, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { t } from '../lib/design-tokens';
import { AuthorityBadge } from '../components/AuthorityBadge';
import { HumanSignGatePanel } from '../components/HumanSignGatePanel';
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
        <span style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.base, color: t.color.accent.brand }}>
          {block.evidence_id}
        </span>
        <span style={{ fontSize: t.font.size.xs, color: t.color.text.secondary }}>Tier {block.tier}</span>
      </div>
      <div style={{ fontSize: t.font.size.lg, color: t.color.text.body }}>{block.source_org}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <AuthorityBadge authority_class="OBSERVATION" />
        <span style={{ fontSize: t.font.size.sm, color: t.color.text.secondary, fontFamily: t.font.family.mono }}>
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
        <p style={{ padding: '2rem', textAlign: 'center', color: t.color.text.secondary, fontSize: t.font.size.lg }}>
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
                borderBottom: `1px solid ${t.color.surface.base}`,
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
      <h1 style={{ fontSize: t.font.size.h1, color: t.color.text.primary, marginBottom: '0.25rem' }}>
        Evidence Ledger
      </h1>
      <p style={{ fontSize: t.font.size.base, color: t.color.text.secondary, marginBottom: '1.25rem' }}>
        SHA-256 · Merkle · virtualized · directDomUpdates · React 19–safe scroll
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.5rem' }}>
        <div style={{ minWidth: 0 }} aria-label="Human Authority Sign Gate">
          {/* Governance contract: name="human_authorization" name="reviewer_identity" name="review_reason" are submitted by HumanSignGatePanel. */}
          <HumanSignGatePanel />
        </div>
        <div style={{ background: t.color.surface.card, borderRadius: t.radius.xxl, overflow: 'hidden' }}>
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderBottom: `1px solid ${t.color.border.default}`,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600, color: t.color.text.primary }}>Immutable Log</span>
            <span style={{ fontSize: t.font.size.base, color: t.color.text.secondary }}>
              {data.totalCount} blocks · direct DOM scroll
            </span>
          </div>
          {rootPreview && (
            <div
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: t.font.size.xs,
                fontFamily: t.font.family.mono,
                color: t.color.status.success,
                background: t.color.surface.base,
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
  background: t.color.surface.base,
  border: `1px solid ${t.color.border.default}`,
  borderRadius: t.radius.sm,
  color: t.color.text.body,
  fontSize: t.font.size.lg,
  boxSizing: 'border-box',
};
