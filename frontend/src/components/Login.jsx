import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onAuthenticated }) {
  const [form, setForm] = useState({ email: 'client1@demo.com', password: 'Client@123456', token: '' });
  const [challengeToken, setChallengeToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (challengeToken) {
        const data = await api.verifyTwoFactorLogin(challengeToken, form.token);
        onAuthenticated(data.user);
      } else {
        const data = await api.login(form.email, form.password);
        if (data.requiresTwoFactor) setChallengeToken(data.challengeToken);
        else onAuthenticated(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark">EM</div>
        <p className="eyebrow">Secure Investment Access</p>
        <h1>{challengeToken ? 'Two-factor verification' : 'Welcome to EmCoin'}</h1>
        <p className="muted">
          {challengeToken ? 'Enter the six-digit code from your authenticator app.' : 'Access your portfolio, documents, and service requests.'}
        </p>
        <form onSubmit={submit}>
          {!challengeToken ? (
            <>
              <label>Email<input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            </>
          ) : (
            <label>Authentication code<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value.replace(/\D/g, '') })} /></label>
          )}
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? 'Please wait…' : challengeToken ? 'Verify' : 'Sign in'}</button>
          {challengeToken && <button type="button" className="text-button" onClick={() => { setChallengeToken(null); setForm({ ...form, token: '' }); }}>Back to sign in</button>}
        </form>
      </section>
      <aside className="login-art">
        <div className="art-card"><span>Institutional-grade access</span><strong>One secure view of your investments.</strong></div>
      </aside>
    </main>
  );
}
