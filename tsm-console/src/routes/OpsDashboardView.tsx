/**
 * Operations dashboard — SCADA-style river gauge status board.
 *
 * Rendering engine: @meta2d/core 1.x (MIT, le5le-com/meta2d.js), chosen as
 * the token-free open-source 2D canvas layer for the console. (The 2.0.0
 * npm release ships a dangling worker import that breaks bundlers, so the
 * stable 1.x line is pinned.) Data: the existing community gauge pipeline
 * (river-gauges.ts), which is fail-closed — gauges with no data render as
 * "unavailable", never as fabricated values.
 *
 * Honesty contract: this is screening visualization, not survey or regulatory
 * evidence. Status and provisional qualifiers are shown on every panel.
 */

import { useEffect, useRef } from 'react';
import { Meta2d, type Pen } from '@meta2d/core';
import {
  COMMUNITY_RIVER_GAUGES,
  startGaugePoll,
  type RiverGaugeObservation,
} from '../lib/river-gauges';

const PANEL_W = 380;
const PANEL_H = 150;
const GAP = 20;
const COLS = 3;
const HEADER_H = 90;

function statusColor(status: RiverGaugeObservation['status']): string {
  switch (status) {
    case 'current':
      return '#22c55e';
    case 'stale':
      return '#f59e0b';
    case 'candidate':
      return '#38bdf8';
    default:
      return '#6b7280';
  }
}

function statusLabel(obs: RiverGaugeObservation): string {
  const base =
    obs.status === 'current'
      ? 'current'
      : obs.status === 'stale'
        ? 'stale'
        : obs.status === 'candidate'
          ? 'candidate station'
          : 'unavailable';
  return obs.provisional ? `${base} · provisional` : base;
}

function valueLabel(obs: RiverGaugeObservation): string {
  if (obs.value == null) return '—';
  const unit = obs.unit ? ` ${obs.unit}` : '';
  return `${obs.value.toFixed(2)}${unit}`;
}

function textPen(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  fontSize: number,
  color: string,
): Pen {
  return { id, name: 'text', x, y, width, height, text, fontSize, color, textAlign: 'left' };
}

function buildPens(): Pen[] {
  const pens: Pen[] = [
    textPen('board-title', GAP, 16, COLS * (PANEL_W + GAP), 32,
      'River gauge operations board', 22, '#e5e7eb'),
    textPen('board-subtitle', GAP, 52, COLS * (PANEL_W + GAP), 24,
      'Screening visualization only — not survey or regulatory evidence.', 13, '#9ca3af'),
  ];

  COMMUNITY_RIVER_GAUGES.forEach((gauge, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = GAP + col * (PANEL_W + GAP);
    const y = HEADER_H + row * (PANEL_H + GAP);

    pens.push(
      {
        id: `panel-${gauge.id}`,
        name: 'rectangle',
        x, y, width: PANEL_W, height: PANEL_H,
        background: '#111c30',
        color: '#1f2d47',
        borderWidth: 1,
      },
      {
        id: `dot-${gauge.id}`,
        name: 'circle',
        x: x + 16, y: y + 20, width: 14, height: 14,
        background: '#6b7280',
        color: '#6b7280',
      },
      textPen(`name-${gauge.id}`, x + 40, y + 14, PANEL_W - 56, 28,
        gauge.name, 14, '#e5e7eb'),
      textPen(`river-${gauge.id}`, x + 40, y + 40, PANEL_W - 56, 22,
        `${gauge.river} · ${gauge.provider}`, 12, '#9ca3af'),
      textPen(`value-${gauge.id}`, x + 16, y + 66, PANEL_W - 32, 44,
        '—', 30, '#f3f4f6'),
      textPen(`status-${gauge.id}`, x + 16, y + 114, PANEL_W - 32, 22,
        'loading…', 12, '#9ca3af'),
    );
  });

  return pens;
}

export default function OpsDashboardView() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const meta2d = new Meta2d(host, {
      background: '#0b1220',
      rule: false,
      grid: false,
    });

    void meta2d.addPens(buildPens());

    const applyRows = (rows: RiverGaugeObservation[]) => {
      const byId = new Map(rows.map((row) => [row.gaugeId, row]));
      for (const gauge of COMMUNITY_RIVER_GAUGES) {
        const obs = byId.get(gauge.id);
        if (!obs) continue;
        meta2d.setValue({ id: `value-${gauge.id}`, text: valueLabel(obs) });
        meta2d.setValue({ id: `status-${gauge.id}`, text: statusLabel(obs) });
        meta2d.setValue({
          id: `dot-${gauge.id}`,
          background: statusColor(obs.status),
          color: statusColor(obs.status),
        });
      }
      meta2d.render();
    };

    const stop = startGaugePoll(applyRows, 60_000);

    return () => {
      stop();
      meta2d.destroy();
    };
  }, []);

  const rows = Math.ceil(COMMUNITY_RIVER_GAUGES.length / COLS);
  const height = HEADER_H + rows * (PANEL_H + GAP) + GAP;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#0b1220',
        padding: 8,
        boxSizing: 'border-box',
      }}
    >
      <div ref={hostRef} style={{ width: '100%', height }} />
    </div>
  );
}
