import React from 'react';

export default function Shell({ user, tabs, activeTab, onTab, onLogout, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark small">EM</div><div><strong>EmCoin</strong><span>Investment Portal</span></div></div>
        <nav>{tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => onTab(tab.id)}>{tab.label}</button>)}</nav>
        <div className="sidebar-user"><span>{user.fullName}</span><small>{user.role}</small><button onClick={onLogout}>Sign out</button></div>
      </aside>
      <main className="content"><header className="topbar"><div><p className="eyebrow">EmCoin Investment Portal</p><h1>{tabs.find((item) => item.id === activeTab)?.label}</h1></div><div className="secure-chip">Secure session</div></header>{children}</main>
    </div>
  );
}
