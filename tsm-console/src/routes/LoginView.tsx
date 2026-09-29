import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { getIdPConfig, isAuthDisabled, login } from '../lib/auth';

export default function LoginView() {
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState<boolean | null>(null);
  const config = getIdPConfig();
  const returnTo = new URLSearchParams(location.search).get('from') || '/';

  useEffect(() => {
    let cancelled = false;
    void isAuthDisabled().then((value) => {
      if (!cancelled) setDisabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function beginLogin() {
    setError(null);
    try {
      await login({ returnTo });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start authentication');
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#020617', color: '#e2e8f0' }}>
      <section aria-labelledby="login-title" style={{ width: 'min(100%, 460px)', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: '2rem' }}>
        <h1 id="login-title" style={{ marginTop: 0 }}>TSM Console Sign-In</h1>
        {disabled === true ? (
          <>
            <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>
              Sign-in is disabled in this deployment. The console runs in local mode —
              all engineering, simulation, and evidence tools work without an account.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              No credentials are required or accepted here.
            </p>
          </>
        ) : (
          <>
            <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>
              Authentication is required before accessing protected engineering and evidence workflows.
              The server handles OIDC Authorization Code + PKCE. Access and refresh tokens never enter browser JavaScript.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Provider: {config.provider} · API session gateway: {config.apiBaseUrl ? 'configured' : 'same-origin'}
            </p>
            {error && <div role="alert" style={{ marginBottom: '1rem', color: '#fca5a5' }}>{error}</div>}
            <button type="button" onClick={() => void beginLogin()} disabled={disabled === null} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer' }}>
              {disabled === null ? 'Checking sign-in status…' : 'Continue with Keycloak'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
