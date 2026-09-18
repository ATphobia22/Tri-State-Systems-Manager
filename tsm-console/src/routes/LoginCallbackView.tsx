import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { handleOidcCallback } from '../lib/auth';

export default function LoginCallbackView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) {
      setError('Missing OIDC authorization code or state.');
      return () => { active = false; };
    }
    void handleOidcCallback(code, state)
      .then(() => {
        if (active) navigate('/', { replace: true });
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Authentication callback failed');
      });
    return () => { active = false; };
  }, [navigate, params]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#020617', color: '#e2e8f0' }}>
      <section aria-live="polite" style={{ width: 'min(100%, 520px)', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: '2rem' }}>
        <h1 style={{ marginTop: 0 }}>Completing sign-in</h1>
        {error ? <p role="alert" style={{ color: '#fca5a5' }}>{error}</p> : <p style={{ color: '#94a3b8' }}>Validating the authorization response…</p>}
      </section>
    </main>
  );
}
