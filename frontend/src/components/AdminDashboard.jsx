import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { Metric, State, money } from './common.jsx';

export default function AdminDashboard({ view }) {
  const queryClient = useQueryClient();
  const clientsQuery = useQuery({ queryKey: ['admin-clients'], queryFn: api.getAdminClients, enabled: view === 'clients' });
  const requestsQuery = useQuery({ queryKey: ['admin-requests'], queryFn: api.getAdminRequests, enabled: view === 'requests' });
  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => api.updateAdminRequest(id, { status, adminNote: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-requests'] })
  });

  if (view === 'requests') {
    const requests = requestsQuery.data?.requests || [];
    return <State loading={requestsQuery.isLoading} error={requestsQuery.error} empty={!requests.length}>
      <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Operations</p><h2>Client service requests</h2></div></div><div className="table-scroll"><table><thead><tr><th>Client</th><th>Type</th><th>Message</th><th>Status</th><th>Action</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.full_name}</strong><small>{request.client_code}</small></td><td>{request.request_type}</td><td>{request.message}</td><td>{request.status}</td><td><select value={request.status} onChange={(e) => updateMutation.mutate({ id: request.id, status: e.target.value })}><option>Submitted</option><option>Under Review</option><option>Completed</option><option>Rejected</option></select></td></tr>)}</tbody></table></div></section>
    </State>;
  }

  const clients = clientsQuery.data?.clients || [];
  const totalAum = clients.reduce((sum, item) => sum + Number(item.totalMarketValue || 0), 0);
  const totalGain = clients.reduce((sum, item) => sum + Number(item.totalGainLoss || 0), 0);
  return <State loading={clientsQuery.isLoading} error={clientsQuery.error}>
    <><section className="metrics-grid"><Metric label="Total AUM" value={money(totalAum)} /><Metric label="Active clients" value={clients.length} /><Metric label="Aggregate gain/loss" value={money(totalGain)} /><Metric label="Pricing exceptions" value={clients.filter((item) => item.hasUnpricedHoldings).length} /></section><section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Clients</p><h2>Portfolio summary</h2></div></div><div className="table-scroll"><table><thead><tr><th>Client</th><th>Code</th><th>Risk</th><th className="right">Market value</th><th className="right">Gain/Loss</th><th>Pricing</th></tr></thead><tbody>{clients.map((client) => <tr key={client.id}><td><strong>{client.fullName}</strong></td><td>{client.clientCode}</td><td>{client.riskProfile}</td><td className="right">{money(client.totalMarketValue)}</td><td className="right">{money(client.totalGainLoss)}</td><td>{client.hasUnpricedHoldings ? 'Exception' : 'Complete'}</td></tr>)}</tbody></table></div></section></>
  </State>;
}
