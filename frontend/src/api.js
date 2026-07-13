let accessToken = null;
let refreshPromise = null;

async function parseResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('Unexpected server response');
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Request failed');
    error.code = body?.error?.code;
    error.status = response.status;
    throw error;
  }
  return body;
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    })
      .then(parseResponse)
      .then((data) => {
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request(path, options = {}, retry = true) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(path, { ...options, headers, credentials: 'include' });

  if (response.status === 401 && retry && path !== '/api/auth/refresh') {
    try {
      await refreshSession();
      return request(path, options, false);
    } catch {
      accessToken = null;
    }
  }
  return parseResponse(response);
}

export const api = {
  async bootstrap() {
    try { return await refreshSession(); }
    catch { return null; }
  },
  async login(email, password) {
    const data = await request('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    }, false);
    if (data.accessToken) accessToken = data.accessToken;
    return data;
  },
  async verifyTwoFactorLogin(challengeToken, token) {
    const data = await request('/api/auth/verify-2fa-login', {
      method: 'POST', body: JSON.stringify({ challengeToken, token })
    }, false);
    accessToken = data.accessToken;
    return data;
  },
  async logout() {
    await request('/api/auth/logout', { method: 'POST' }, false);
    accessToken = null;
  },
  getProducts: () => request('/api/products'),
  getPortfolio: () => request('/api/portfolios/me'),
  getDividends: () => request('/api/dividends/me'),
  getStatements: () => request('/api/statements/me'),
  getRequests: () => request('/api/requests/me'),
  createRequest: (payload) => request('/api/requests', { method: 'POST', body: JSON.stringify(payload) }),
  getAdminClients: () => request('/api/admin/clients'),
  getAdminRequests: () => request('/api/admin/requests'),
  updateAdminRequest: (id, payload) => request(`/api/admin/requests/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getTwoFactorStatus: () => request('/api/security/2fa'),
  setupTwoFactor: () => request('/api/security/2fa/setup', { method: 'POST' }),
  verifyTwoFactor: (token) => request('/api/security/2fa/verify', { method: 'POST', body: JSON.stringify({ token }) }),
  disableTwoFactor: (password, token) => request('/api/security/2fa/disable', { method: 'POST', body: JSON.stringify({ password, token }) }),
  async downloadStatement(id, title) {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    let response = await fetch(`/api/statements/${id}/pdf`, { headers, credentials: 'include' });
    if (response.status === 401) {
      await refreshSession();
      response = await fetch(`/api/statements/${id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include'
      });
    }
    if (!response.ok) throw new Error('Unable to download statement');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title || 'statement'}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
};
