import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../src/db.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo seed is disabled in production');
}

const ids = {
  adminUser: '11111111-1111-4111-8111-111111111111',
  clientUser: '22222222-2222-4222-8222-222222222222',
  client: '33333333-3333-4333-8333-333333333333',
  productAed: '44444444-4444-4444-8444-444444444444',
  productUsd: '55555555-5555-4555-8555-555555555555',
  portfolio: '66666666-6666-4666-8666-666666666666',
  holdingAed: '77777777-7777-4777-8777-777777777777',
  holdingUsd: '88888888-8888-4888-8888-888888888888',
  statement: '99999999-9999-4999-8999-999999999999'
};

try {
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const clientHash = await bcrypt.hash('Client@123456', 12);

  await withTransaction(async (db) => {
    await db.query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
       VALUES ($1, 'admin@demo.com', $2, 'Demo Administrator', 'admin')
       ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [ids.adminUser, adminHash]
    );
    await db.query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
       VALUES ($1, 'client1@demo.com', $2, 'Demo Client', 'client')
       ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [ids.clientUser, clientHash]
    );
    await db.query(
      `INSERT INTO clients (id, user_id, client_code, risk_profile, onboarding_status)
       VALUES ($1, $2, 'AE-2401', 'Moderate', 'Active')
       ON CONFLICT (id) DO NOTHING`,
      [ids.client, ids.clientUser]
    );
    await db.query(
      `INSERT INTO products (id, name, type, currency, description, status, min_subscription, benchmark)
       VALUES
       ($1, 'Emirates Growth Fund', 'Fund', 'AED', 'Diversified GCC equity fund.', 'Active', 10000, 'S&P GCC Composite'),
       ($2, 'Global Income Fund', 'Fund', 'USD', 'Global diversified income strategy.', 'Active', 5000, 'Bloomberg Global Aggregate')
       ON CONFLICT (id) DO NOTHING`,
      [ids.productAed, ids.productUsd]
    );
    await db.query(
      `INSERT INTO portfolios (id, user_id, name, base_currency)
       VALUES ($1, $2, 'Primary Portfolio', 'AED')
       ON CONFLICT (id) DO NOTHING`,
      [ids.portfolio, ids.clientUser]
    );
    await db.query(
      `INSERT INTO holdings (id, portfolio_id, product_id, quantity, average_cost)
       VALUES
       ($1, $2, $3, 50, 130),
       ($4, $2, $5, 20, 98)
       ON CONFLICT (id) DO NOTHING`,
      [ids.holdingAed, ids.portfolio, ids.productAed, ids.holdingUsd, ids.productUsd]
    );
    await db.query(
      `INSERT INTO prices (instrument_id, price_date, price, currency, source)
       VALUES ($1, CURRENT_DATE, 142.50, 'AED', 'DEMO'),
              ($2, CURRENT_DATE, 103.25, 'USD', 'DEMO')
       ON CONFLICT (instrument_id, price_date) DO UPDATE SET price = EXCLUDED.price`,
      [ids.productAed, ids.productUsd]
    );
    await db.query(
      `INSERT INTO fx_rates (from_currency, to_currency, rate_date, rate, source)
       VALUES ('USD', 'AED', CURRENT_DATE, 3.6725, 'DEMO')
       ON CONFLICT (from_currency, to_currency, rate_date) DO UPDATE SET rate = EXCLUDED.rate`
    );
    await db.query(
      `INSERT INTO statements (id, client_id, title, statement_date)
       VALUES ($1, $2, 'Current Portfolio Statement', CURRENT_DATE)
       ON CONFLICT (id) DO NOTHING`,
      [ids.statement, ids.client]
    );
    await db.query(
      `INSERT INTO dividends (client_id, product_id, amount, payment_date, status)
       SELECT $1, $2, 1000, CURRENT_DATE - 30, 'Distributed'
       WHERE NOT EXISTS (SELECT 1 FROM dividends WHERE client_id = $1 AND product_id = $2)`,
      [ids.client, ids.productAed]
    );
  });

  console.info('Demo seed complete');
  console.info('Admin: admin@demo.com / Admin@123456');
  console.info('Client: client1@demo.com / Client@123456');
} finally {
  await pool.end();
}
