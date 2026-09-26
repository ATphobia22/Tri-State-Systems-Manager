/**
 * LocalAiPanel — mountable UI for the on-device built-in AI module.
 *
 * Shows: capability list, textarea/prompt input, result display with the
 * provisional label, and a clear DISABLED state when built-in AI is unavailable.
 * The disabled state never offers a server fallback — the local-AI path makes
 * zero network calls by design.
 *
 * Optional props let the flood simulator team wire this panel directly:
 *   <LocalAiPanel scenarioSummary={sim.toLocalAiSummary()} />
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getLocalAiCapabilities,
  explainFloodResult,
  askFloodplainQuestion,
  summarizeEvidencePacket,
  proofreadFiling,
  GOVERNING_AXIOM,
  type AiTextResult,
  type FloodScenarioSummary,
  type EvidencePacketSummary,
  type LocalAiCapabilitiesReport,
} from '../lib/local-ai';

interface LocalAiPanelProps {
  scenarioSummary?: FloodScenarioSummary;
  packet?: EvidencePacketSummary;
}

type ActionId = 'explain' | 'ask' | 'summarize' | 'proofread';

export function LocalAiPanel({ scenarioSummary, packet }: LocalAiPanelProps) {
  const [report, setReport] = useState<LocalAiCapabilitiesReport | null>(null);
  const [busy, setBusy] = useState<ActionId | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<AiTextResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLocalAiCapabilities().then((r) => {
      if (!cancelled) setReport(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runAction = useCallback(async (id: ActionId, fn: () => Promise<AiTextResult>) => {
    setBusy(id);
    setNotice(null);
    setResult(null);
    try {
      const r = await fn();
      if (r.ok) {
        setResult(r);
      } else {
        setNotice(r.reason);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Local AI action failed.');
    } finally {
      setBusy(null);
    }
  }, []);

  const promptReady = report?.capabilities.prompt.status === 'available';
  const summarizerReady = report?.capabilities.summarizer.status === 'available';
  const proofreaderReady = report?.capabilities.proofreader.status === 'available';

  if (report && report.overall !== 'available') {
    return (
      <div style={boxStyle}>
        <div style={titleStyle}>Local AI — unavailable</div>
        <p style={muted}>
          On-device AI is not available in this browser ({report.overall}).
        </p>
        <p style={muted}>{report.reason}</p>
        <ul style={listStyle}>
          <li>Requires Chrome on desktop or Android with built-in AI enabled (Gemma model).</li>
          <li>iOS WKWebView is currently unsupported — Apple does not expose these APIs.</li>
          <li>Core TSM flood and evidence tools work fully without it.</li>
        </ul>
        <p style={muted}>
          This path never falls back to a server model: the local-AI module makes
          zero network calls by design.
        </p>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={titleStyle}>Local AI — on-device copilot</div>
      <p style={muted}>
        Runs on your device via Chrome built-in AI. {GOVERNING_AXIOM}
      </p>
      {report && (
        <ul style={listStyle}>
          {Object.values(report.capabilities).map((c) => (
            <li key={c.id}>
              <span style={{ color: statusColor(c.status) }}>●</span> {c.displayName}:{' '}
              {c.status}
            </li>
          ))}
        </ul>
      )}

      <div style={rowStyle}>
        <button
          type="button"
          disabled={busy !== null || !promptReady || !scenarioSummary}
          onClick={() =>
            scenarioSummary &&
            runAction('explain', () => explainFloodResult(scenarioSummary))
          }
          style={btnStyle}
        >
          {busy === 'explain' ? 'Working…' : 'Explain flood result'}
        </button>
        <button
          type="button"
          disabled={busy !== null || !summarizerReady || !packet}
          onClick={() => packet && runAction('summarize', () => summarizeEvidencePacket(packet))}
          style={btnStyle}
        >
          {busy === 'summarize' ? 'Working…' : 'Summarize evidence packet'}
        </button>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask a floodplain question, or paste filing text to proofread…"
        rows={4}
        style={textareaStyle}
      />
      <div style={rowStyle}>
        <button
          type="button"
          disabled={busy !== null || !promptReady || input.trim().length === 0}
          onClick={() => runAction('ask', () => askFloodplainQuestion(input))}
          style={btnStyle}
        >
          {busy === 'ask' ? 'Working…' : 'Ask (on-device)'}
        </button>
        <button
          type="button"
          disabled={busy !== null || !proofreaderReady || input.trim().length === 0}
          onClick={() => runAction('proofread', () => proofreadFiling(input))}
          style={btnStyle}
        >
          {busy === 'proofread' ? 'Working…' : 'Proofread text'}
        </button>
      </div>

      {notice && <p style={{ ...muted, color: '#fb7185' }}>{notice}</p>}
      {result && result.ok && (
        <div style={resultStyle}>
          <div style={provisionalStyle}>{result.label}</div>
          <div style={whitespacePre}>{result.text}</div>
          <div style={provenanceStyle}>
            {result.model} · provenance: {result.provenance} · status: {result.status}
          </div>
        </div>
      )}
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#0f172a',
};
const titleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#38bdf8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
const muted: React.CSSProperties = { fontSize: 11, color: '#94a3b8', margin: '6px 0' };
const listStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  margin: '8px 0',
  paddingLeft: 18,
};
const rowStyle: React.CSSProperties = { display: 'flex', gap: 8, margin: '8px 0', flexWrap: 'wrap' };
const btnStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #0ea5e9',
  background: '#0c4a6e',
  color: '#e0f2fe',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const textareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 8,
  padding: 10,
  borderRadius: 8,
  border: '1px solid #1e293b',
  background: '#020617',
  color: '#e2e8f0',
  fontSize: 12,
  fontFamily: 'inherit',
};
const resultStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 8,
  background: '#020617',
  border: '1px solid #f59e0b',
  fontSize: 12,
  color: '#e2e8f0',
};
const provisionalStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#fbbf24',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
};
const provenanceStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#64748b',
  marginTop: 8,
};
const whitespacePre: React.CSSProperties = { whiteSpace: 'pre-wrap' };

function statusColor(status: string): string {
  if (status === 'available') return '#4ade80';
  if (status === 'downloading') return '#fbbf24';
  return '#64748b';
}
