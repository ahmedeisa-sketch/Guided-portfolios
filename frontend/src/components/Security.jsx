import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { State } from './common.jsx';

export default function Security() {
  const client = useQueryClient();
  const statusQuery = useQuery({ queryKey: ['2fa-status'], queryFn: api.getTwoFactorStatus });
  const [setup, setSetup] = useState(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const setupMutation = useMutation({ mutationFn: api.setupTwoFactor, onSuccess: setSetup });
  const verifyMutation = useMutation({ mutationFn: api.verifyTwoFactor, onSuccess: () => { setSetup(null); setToken(''); client.invalidateQueries({ queryKey: ['2fa-status'] }); } });
  const disableMutation = useMutation({ mutationFn: () => api.disableTwoFactor(password, token), onSuccess: () => { setPassword(''); setToken(''); client.invalidateQueries({ queryKey: ['2fa-status'] }); } });
  const enabled = statusQuery.data?.enabled;

  return <State loading={statusQuery.isLoading} error={statusQuery.error}>
    <section className="panel security-panel"><div className="panel-heading"><div><p className="eyebrow">Account protection</p><h2>Two-factor authentication</h2></div><span className={enabled ? 'status-on' : 'status-off'}>{enabled ? 'Enabled' : 'Not enabled'}</span></div>
      {!enabled && !setup && <><p className="muted">Protect the account with a six-digit code from an authenticator app.</p><button className="primary-button inline" onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>Start setup</button></>}
      {setup && <div className="setup-box"><img src={setup.qrDataUrl} alt="Authenticator QR code" /><div><p>Scan the QR code, then enter the generated code.</p><code>{setup.secret}</code><label>Verification code<input inputMode="numeric" maxLength="6" value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))} /></label><button className="primary-button inline" onClick={() => verifyMutation.mutate(token)}>Enable 2FA</button></div></div>}
      {enabled && <div className="disable-box"><p className="muted">Disabling 2FA requires both your password and a current authenticator code.</p><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label>Authentication code<input inputMode="numeric" maxLength="6" value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))} /></label><button className="danger-button" onClick={() => disableMutation.mutate()}>Disable 2FA</button></div>}
      {(setupMutation.error || verifyMutation.error || disableMutation.error) && <div className="error-box">{(setupMutation.error || verifyMutation.error || disableMutation.error).message}</div>}
    </section>
  </State>;
}
