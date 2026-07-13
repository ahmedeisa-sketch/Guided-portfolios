CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret_enc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  client_code TEXT NOT NULL UNIQUE,
  risk_profile TEXT NOT NULL DEFAULT 'Unassessed',
  onboarding_status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  isin TEXT UNIQUE,
  inception_date DATE,
  min_subscription NUMERIC(20,2),
  management_fee NUMERIC(8,6),
  benchmark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_currency CHAR(3) NOT NULL DEFAULT 'AED' CHECK (base_currency = 'AED'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(24,8) NOT NULL CHECK (quantity >= 0),
  average_cost NUMERIC(24,8) NOT NULL CHECK (average_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, product_id)
);

CREATE TABLE IF NOT EXISTS prices (
  instrument_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  price NUMERIC(24,8) NOT NULL CHECK (price >= 0),
  currency CHAR(3) NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (instrument_id, price_date)
);

CREATE TABLE IF NOT EXISTS fx_rates (
  from_currency CHAR(3) NOT NULL,
  to_currency CHAR(3) NOT NULL,
  rate_date DATE NOT NULL,
  rate NUMERIC(24,10) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL,
  PRIMARY KEY (from_currency, to_currency, rate_date)
);

CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  statement_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  amount NUMERIC(24,2),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted'
    CHECK (status IN ('Submitted', 'Under Review', 'Completed', 'Rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  amount NUMERIC(24,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Distributed' CHECK (status IN ('Pending', 'Distributed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_prices_latest ON prices(instrument_id, price_date DESC);
CREATE INDEX IF NOT EXISTS idx_fx_latest ON fx_rates(from_currency, to_currency, rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_requests_client ON service_requests(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
