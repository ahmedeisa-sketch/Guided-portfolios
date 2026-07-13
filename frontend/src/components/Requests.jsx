import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { State } from './common.jsx';

const types = ['General Inquiry', 'Subscription Inquiry', 'Redemption Inquiry', 'Withdrawal Inquiry', 'Document Request', 'Support Request'];

export default function Requests() {
  const client = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ['requests'], queryFn: api.getRequests });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: api.getProducts });
  const [form, setForm] = useState({ type: types[0], productId: '', amount: '', message: '' });
  const mutation = useMutation({
    mutationFn: api.createRequest,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['requests'] });
      setForm({ type: types[0], productId: '', amount: '', message: '' });
    }
  });

  function submit(event) {
    event.preventDefault();
    mutation.mutate({
      type: form.type,
      productId: form.productId || null,
      amount: form.amount ? Number(form.amount) : null,
      message: form.message
    });
  }

  const requests = requestsQuery.data?.requests || [];
  const products = productsQuery.data?.products || [];
  return <State loading={requestsQuery.isLoading || productsQuery.isLoading} error={requestsQuery.error || productsQuery.error}>
    <div className="two-column"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">New request</p><h2>Contact the investment team</h2></div></div><form className="form-grid" onSubmit={submit}><label>Request type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{types.map((type) => <option key={type}>{type}</option>)}</select></label><label>Related product<select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">None</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label className="full">Message<textarea required minLength="3" maxLength="2000" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>{mutation.error && <div className="error-box full">{mutation.error.message}</div>}<button className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? 'Submitting…' : 'Submit request'}</button></form></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">History</p><h2>Your requests</h2></div></div><div className="request-list">{requests.length ? requests.map((request) => <div key={request.id}><div><strong>{request.request_type}</strong><span>{request.message}</span></div><em>{request.status}</em></div>) : <p className="muted">No requests submitted.</p>}</div></section></div>
  </State>;
}
