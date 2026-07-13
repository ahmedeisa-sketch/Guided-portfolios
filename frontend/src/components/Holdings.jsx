import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { State, money, number } from './common.jsx';

export default function Holdings() {
  const query = useQuery({ queryKey: ['portfolio'], queryFn: api.getPortfolio });
  const portfolio = query.data?.portfolios?.[0];
  return <State loading={query.isLoading} error={query.error} empty={!portfolio}>
    {portfolio && <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Positions</p><h2>Current holdings</h2></div></div>
      <div className="table-scroll"><table><thead><tr><th>Product</th><th>Currency</th><th className="right">Quantity</th><th className="right">Latest price</th><th className="right">Market value</th><th className="right">Gain/Loss</th></tr></thead><tbody>{portfolio.holdings.map((item) => <tr key={item.id}><td><strong>{item.productName}</strong><small>{item.productType}</small></td><td>{item.productCurrency}</td><td className="right">{number(item.quantity, 4)}</td><td className="right">{item.price == null ? 'Unavailable' : money(item.price, item.productCurrency)}</td><td className="right">{item.marketValue == null ? 'Unpriced' : money(item.marketValue, portfolio.baseCurrency)}</td><td className="right">{item.gainLoss == null ? '—' : money(item.gainLoss, portfolio.baseCurrency)}</td></tr>)}</tbody></table></div>
    </section>}
  </State>;
}
