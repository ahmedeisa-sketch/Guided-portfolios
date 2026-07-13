import { query } from '../db.js';

const valuationRowsSql = `
WITH latest_prices AS (
  SELECT DISTINCT ON (instrument_id)
    instrument_id, price, currency, price_date
  FROM prices
  ORDER BY instrument_id, price_date DESC
),
latest_fx AS (
  SELECT DISTINCT ON (from_currency, to_currency)
    from_currency, to_currency, rate, rate_date
  FROM fx_rates
  ORDER BY from_currency, to_currency, rate_date DESC
)
SELECT
  u.id AS user_id,
  c.id AS client_id,
  c.client_code,
  c.risk_profile,
  u.full_name,
  pf.id AS portfolio_id,
  pf.name AS portfolio_name,
  pf.base_currency,
  h.id AS holding_id,
  h.quantity,
  h.average_cost,
  p.id AS product_id,
  p.name AS product_name,
  p.type AS product_type,
  p.currency AS product_currency,
  lp.price,
  lp.price_date,
  CASE
    WHEN p.currency = pf.base_currency THEN 1
    ELSE fx.rate
  END AS fx_rate
FROM users u
JOIN clients c ON c.user_id = u.id
JOIN portfolios pf ON pf.user_id = u.id
LEFT JOIN holdings h ON h.portfolio_id = pf.id
LEFT JOIN products p ON p.id = h.product_id
LEFT JOIN latest_prices lp ON lp.instrument_id = p.id
LEFT JOIN latest_fx fx
  ON fx.from_currency = p.currency
 AND fx.to_currency = pf.base_currency
`;

function buildPortfolios(rows) {
  const portfolios = new Map();
  for (const row of rows) {
    if (!portfolios.has(row.portfolio_id)) {
      portfolios.set(row.portfolio_id, {
        id: row.portfolio_id,
        name: row.portfolio_name,
        baseCurrency: row.base_currency,
        totalMarketValue: 0,
        totalCost: 0,
        totalGainLoss: 0,
        hasUnpricedHoldings: false,
        holdings: []
      });
    }
    if (!row.holding_id) continue;

    const portfolio = portfolios.get(row.portfolio_id);
    const quantity = Number(row.quantity || 0);
    const averageCost = Number(row.average_cost || 0);
    const price = row.price == null ? null : Number(row.price);
    const fxRate = row.fx_rate == null ? null : Number(row.fx_rate);
    const marketValue = price == null || fxRate == null ? null : quantity * price * fxRate;
    const costValue = fxRate == null ? null : quantity * averageCost * fxRate;

    if (marketValue == null || costValue == null) portfolio.hasUnpricedHoldings = true;
    else {
      portfolio.totalMarketValue += marketValue;
      portfolio.totalCost += costValue;
    }

    portfolio.holdings.push({
      id: row.holding_id,
      productId: row.product_id,
      productName: row.product_name,
      productType: row.product_type,
      productCurrency: row.product_currency,
      quantity,
      averageCost,
      price,
      priceDate: row.price_date,
      fxRate,
      marketValue,
      gainLoss: marketValue == null || costValue == null ? null : marketValue - costValue
    });
  }

  return [...portfolios.values()].map((portfolio) => ({
    ...portfolio,
    totalGainLoss: portfolio.totalMarketValue - portfolio.totalCost
  }));
}

export async function getClientPortfolios(userId) {
  const result = await query(`${valuationRowsSql} WHERE u.id = $1 ORDER BY pf.id, p.name`, [userId]);
  return buildPortfolios(result.rows);
}

export async function getAdminClientSummaries() {
  const result = await query(`${valuationRowsSql} ORDER BY c.client_code, pf.id, p.name`);
  const clients = new Map();
  for (const row of result.rows) {
    if (!clients.has(row.client_id)) {
      clients.set(row.client_id, {
        id: row.client_id,
        clientCode: row.client_code,
        fullName: row.full_name,
        riskProfile: row.risk_profile,
        totalMarketValue: 0,
        totalCost: 0,
        hasUnpricedHoldings: false
      });
    }
    if (!row.holding_id) continue;
    const client = clients.get(row.client_id);
    const quantity = Number(row.quantity || 0);
    const averageCost = Number(row.average_cost || 0);
    const price = row.price == null ? null : Number(row.price);
    const fxRate = row.fx_rate == null ? null : Number(row.fx_rate);
    if (price == null || fxRate == null) client.hasUnpricedHoldings = true;
    else {
      client.totalMarketValue += quantity * price * fxRate;
      client.totalCost += quantity * averageCost * fxRate;
    }
  }
  return [...clients.values()].map((client) => ({
    ...client,
    totalGainLoss: client.totalMarketValue - client.totalCost
  }));
}
