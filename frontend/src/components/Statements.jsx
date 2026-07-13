import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { State } from './common.jsx';

export default function Statements() {
  const query = useQuery({ queryKey: ['statements'], queryFn: api.getStatements });
  const [error, setError] = useState('');
  const statements = query.data?.statements || [];

  async function download(statement) {
    setError('');
    try { await api.downloadStatement(statement.id, statement.title); }
    catch (err) { setError(err.message); }
  }

  return <State loading={query.isLoading} error={query.error} empty={!statements.length}>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Documents</p><h2>Statements</h2></div></div>{error && <div className="error-box">{error}</div>}<div className="document-list">{statements.map((statement) => <div key={statement.id}><div><strong>{statement.title}</strong><span>{statement.statement_date}</span></div><button onClick={() => download(statement)}>Download PDF</button></div>)}</div></section>
  </State>;
}
