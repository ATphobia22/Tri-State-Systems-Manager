/**
 * Optional Chrome built-in AI assist panel.
 * Progressive enhancement — hidden/disabled when APIs unavailable.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  probeBuiltinAi,
  summarizeForOperator,
  type BuiltinAvailability,
  type ChromeAiCapability,
  CHROME_AI_POLICY,
} from '../lib/chrome-builtin-ai';

export function BuiltinAiAssistPanel({ sourceText }: { sourceText: string }) {
  const [status, setStatus] = useState<Record<ChromeAiCapability, BuiltinAvailability> | null>(
    null
  );
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    probeBuiltinAi().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSummarize = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await summarizeForOperator(sourceText);
      if (!result) {
        setError('Built-in AI unavailable in this browser/session.');
        setSummary(null);
      } else {
        setSummary(result.summary);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assist failed');
    } finally {
      setBusy(false);
    }
  }, [sourceText]);

  const anyReady =
    status &&
    Object.values(status).some((v) => v === 'available' || v === 'downloadable' || v === 'downloading');

  if (status && !anyReady) {
    return (
      <div style={boxStyle}>
        <div style={titleStyle}>Chrome built-in AI</div>
        <p style={muted}>Not available here — core TSM works without it.</p>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={titleStyle}>Operator assist (on-device AI)</div>
      <p style={muted}>
        {CHROME_AI_POLICY.authorityClass} only · does not write Evidence Ledger ·{' '}
        {CHROME_AI_POLICY.requiresHumanGate ? 'human gate required' : ''}
      </p>
      {status && (
        <pre style={preStyle}>
          {Object.entries(status)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n')}
        </pre>
      )}
      <button type="button" disabled={busy || !sourceText} onClick={onSummarize} style={btnStyle}>
        {busy ? 'Working…' : 'Summarize log (local model)'}
      </button>
      {error && <p style={{ color: '#fb7185', fontSize: 12 }}>{error}</p>}
      {summary && (
        <div style={summaryStyle}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>AI_ASSIST summary</div>
          {summary}
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
const preStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#64748b',
  whiteSpace: 'pre-wrap',
  margin: '8px 0',
};
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
const summaryStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 8,
  background: '#020617',
  border: '1px solid #1e293b',
  fontSize: 12,
  color: '#e2e8f0',
  whiteSpace: 'pre-wrap',
};
