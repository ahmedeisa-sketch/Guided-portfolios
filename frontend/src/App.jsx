import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './components/Login.jsx';
import Shell from './components/Shell.jsx';
import ClientDashboard from './components/ClientDashboard.jsx';
import Holdings from './components/Holdings.jsx';
import Statements from './components/Statements.jsx';
import Requests from './components/Requests.jsx';
import Security from './components/Security.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';

export default function App() {
  const [session, setSession] = useState({ loading: true, user: null });
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    let active = true;
    api.bootstrap().then((data) => {
      if (active) setSession({ loading: false, user: data?.user || null });
    });
    return () => { active = false; };
  }, []);

  async function logout() {
    await api.logout();
    setSession({ loading: false, user: null });
    setTab('dashboard');
  }

  if (session.loading) return <div className="center-screen"><div className="spinner" />Loading secure session…</div>;
  if (!session.user) return <Login onAuthenticated={(user) => setSession({ loading: false, user })} />;

  const isAdmin = session.user.role === 'admin';
  const tabs = isAdmin
    ? [{ id: 'dashboard', label: 'Overview' }, { id: 'requests', label: 'Requests' }, { id: 'security', label: 'Security' }]
    : [
        { id: 'dashboard', label: 'Overview' },
        { id: 'holdings', label: 'Holdings' },
        { id: 'statements', label: 'Statements' },
        { id: 'requests', label: 'Requests' },
        { id: 'security', label: 'Security' }
      ];

  let content;
  if (isAdmin && tab === 'dashboard') content = <AdminDashboard view="clients" />;
  else if (isAdmin && tab === 'requests') content = <AdminDashboard view="requests" />;
  else if (tab === 'dashboard') content = <ClientDashboard />;
  else if (tab === 'holdings') content = <Holdings />;
  else if (tab === 'statements') content = <Statements />;
  else if (tab === 'requests') content = <Requests />;
  else content = <Security />;

  return (
    <Shell user={session.user} tabs={tabs} activeTab={tab} onTab={setTab} onLogout={logout}>
      {content}
    </Shell>
  );
}
