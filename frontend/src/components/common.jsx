import React from 'react';

export const money = (value, currency = 'AED') => new Intl.NumberFormat('en-AE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
export const number = (value, digits = 2) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: digits }).format(Number(value || 0));

export function Metric({ label, value, note, warning }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong>{note && <small className={warning ? 'warning' : ''}>{note}</small>}</div>;
}

export function State({ loading, error, empty, children }) {
  if (loading) return <div className="panel state"><div className="spinner" />Loading…</div>;
  if (error) return <div className="panel state error-box">{error.message}</div>;
  if (empty) return <div className="panel state">No data available.</div>;
  return children;
}
