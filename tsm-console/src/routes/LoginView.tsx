import { useState } from 'react';
import { useLocation } from 'react-router';
import { getIdPConfig, login } from '../lib/auth';

export default function LoginView() {
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const config = getIdPConfig();
  const returnTo = new URLSearchParams(location.search).get('from') || '/';

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
        <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>
          Authentication is required before accessing protected engineering and evidence workflows.
          Authorization uses OIDC Authorization Code + PKCE; no client secret is stored in the browser.
        </p>
        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Provider: {config.provider} · Client: {config.clientId ? 'configured' : 'not configured'}
        </p>
        {error && <div role="alert" style={{ marginBottom: '1rem', color: '#fca5a5' }}>{error}</div>}
        <button type="button" onClick={() => void beginLogin()} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer' }}>
          Continue with Keycloak
        </button>
      </section>
    </main>
  );
}
