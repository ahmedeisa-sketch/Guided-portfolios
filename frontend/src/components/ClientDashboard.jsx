import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { Metric, State, money } from './common.jsx';

export default function ClientDashboard() {
  const portfolioQuery = useQuery({ queryKey: ['portfolio'], queryFn: api.getPortfolio });
  const dividendsQuery = useQuery({ queryKey: ['dividends'], queryFn: api.getDividends });
  const portfolio = portfolioQuery.data?.portfolios?.[0];
  const dividends = dividendsQuery.data?.dividends || [];
  const totalDividends = dividends.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return <State loading={portfolioQuery.isLoading || dividendsQuery.isLoading} error={portfolioQuery.error || dividendsQuery.error} empty={!portfolio}>
    {portfolio && <>
      <section className="metrics-grid">
        <Metric label="Portfolio value" value={money(portfolio.totalMarketValue, portfolio.baseCurrency)} note={portfolio.hasUnpricedHoldings ? 'Some positions are awaiting a valid price or FX rate' : 'Latest available valuation'} warning={portfolio.hasUnpricedHoldings} />
        <Metric label="Invested cost" value={money(portfolio.totalCost, portfolio.baseCurrency)} />
        <Metric label="Unrealized gain/loss" value={money(portfolio.totalGainLoss, portfolio.baseCurrency)} />
        <Metric label="Distributed dividends" value={money(totalDividends, portfolio.baseCurrency)} />
      </section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Allocation</p><h2>Portfolio composition</h2></div><span>{portfolio.baseCurrency}</span></div>
        <div className="allocation-list">{portfolio.holdings.map((holding) => {
          const percentage = portfolio.totalMarketValue && holding.marketValue ? holding.marketValue / portfolio.totalMarketValue * 100 : 0;
          return <div key={holding.id}><div><strong>{holding.productName}</strong><span>{percentage.toFixed(1)}%</span></div><div className="progress"><i style={{ width: `${Math.min(100, percentage)}%` }} /></div></div>;
        })}</div>
      </section>
    </>}
  </State>;
}
