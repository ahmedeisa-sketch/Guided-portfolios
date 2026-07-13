import { jsPDF } from 'jspdf';
import { supabase } from './supabase.js';

let pendingEnrollmentFactorId = null;
const fxToAed = { AED: 1, USD: 3.6725 };

function fail(error) {
  if (error) throw new Error(error.message || 'Request failed');
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  fail(error);
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

async function profileFor(userId) {
  const { data, error } = await supabase.from('em_profiles').select('*').eq('user_id', userId).single();
  fail(error);
  const { data: userData } = await supabase.auth.getUser();
  return {
    id: userId,
    email: userData.user?.email,
    fullName: data.full_name,
    role: data.role,
    clientCode: data.client_code,
    riskProfile: data.risk_profile,
    baseCurrency: data.base_currency
  };
}

async function verifiedTotpFactor() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  fail(error);
  return data.totp?.find((factor) => factor.status === 'verified') || null;
}

async function requiresMfa() {
  const factor = await verifiedTotpFactor();
  if (!factor) return null;
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  fail(error);
  return data.currentLevel === 'aal1' && data.nextLevel === 'aal2' ? factor : null;
}

async function loadPortfolioRows(userId) {
  const { data: portfolios, error: portfolioError } = await supabase.from('em_portfolios').select('*').eq('user_id', userId).order('created_at');
  fail(portfolioError);
  if (!portfolios?.length) return [];

  const portfolioIds = portfolios.map((p) => p.id);
  const { data: holdings, error: holdingError } = await supabase.from('em_holdings').select('*').in('portfolio_id', portfolioIds);
  fail(holdingError);
  const productIds = [...new Set((holdings || []).map((h) => h.product_id))];
  const emptyId = '00000000-0000-0000-0000-000000000000';
  const [{ data: products, error: productError }, { data: prices, error: priceError }] = await Promise.all([
    supabase.from('em_products').select('*').in('id', productIds.length ? productIds : [emptyId]),
    supabase.from('em_prices').select('*').in('product_id', productIds.length ? productIds : [emptyId]).order('price_date', { ascending: false })
  ]);
  fail(productError);
  fail(priceError);
  const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
  const latestPrice = {};
  for (const price of prices || []) if (!latestPrice[price.product_id]) latestPrice[price.product_id] = price;

  return portfolios.map((portfolio) => {
    const rows = (holdings || []).filter((h) => h.portfolio_id === portfolio.id).map((holding) => {
      const product = productMap[holding.product_id];
      const quote = latestPrice[holding.product_id];
      const fx = fxToAed[product?.currency] || null;
      const price = quote ? Number(quote.price) : null;
      const marketValue = price != null && fx != null ? Number(holding.quantity) * price * fx : null;
      const cost = fx != null ? Number(holding.quantity) * Number(holding.average_cost) * fx : null;
      return {
        id: holding.id,
        productId: holding.product_id,
        productName: product?.name || 'Unknown product',
        productType: product?.type || '',
        productCurrency: product?.currency || 'AED',
        quantity: Number(holding.quantity),
        averageCost: Number(holding.average_cost),
        price,
        marketValue,
        gainLoss: marketValue != null && cost != null ? marketValue - cost : null
      };
    });
    return {
      id: portfolio.id,
      name: portfolio.name,
      baseCurrency: portfolio.base_currency,
      holdings: rows,
      totalMarketValue: rows.reduce((sum, h) => sum + Number(h.marketValue || 0), 0),
      totalCost: rows.reduce((sum, h) => sum + Number(h.quantity * h.averageCost * (fxToAed[h.productCurrency] || 0)), 0),
      totalGainLoss: rows.reduce((sum, h) => sum + Number(h.gainLoss || 0), 0),
      hasUnpricedHoldings: rows.some((h) => h.marketValue == null)
    };
  });
}

export const api = {
  async bootstrap() {
    const { data, error } = await supabase.auth.getSession();
    fail(error);
    if (!data.session) return null;
    if (await requiresMfa()) return null;
    return { user: await profileFor(data.session.user.id) };
  },

  async register(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    fail(error);
    if (!data.session) return { confirmationRequired: true };
    return { user: await profileFor(data.user.id) };
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    fail(error);
    const factor = await requiresMfa();
    if (factor) return { requiresTwoFactor: true, challengeToken: factor.id };
    return { user: await profileFor(data.user.id) };
  },

  async verifyTwoFactorLogin(factorId, token) {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    fail(challengeError);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: token });
    fail(error);
    const userId = await currentUserId();
    return { user: await profileFor(userId) };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    fail(error);
  },

  async getProducts() {
    const { data, error } = await supabase.from('em_products').select('*').eq('status', 'Active').order('name');
    fail(error);
    return { products: data || [] };
  },
  async getPortfolio() {
    return { portfolios: await loadPortfolioRows(await currentUserId()) };
  },
  async getDividends() {
    const userId = await currentUserId();
    const { data, error } = await supabase.from('em_dividends').select('*').eq('user_id', userId).order('payment_date', { ascending: false });
    fail(error);
    return { dividends: (data || []).map((d) => ({ ...d, date: d.payment_date })) };
  },
  async getStatements() {
    const userId = await currentUserId();
    const { data, error } = await supabase.from('em_statements').select('*').eq('user_id', userId).order('statement_date', { ascending: false });
    fail(error);
    return { statements: data || [] };
  },
  async getRequests() {
    const userId = await currentUserId();
    const { data, error } = await supabase.from('em_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    fail(error);
    return { requests: data || [] };
  },
  async createRequest(payload) {
    const userId = await currentUserId();
    const { data, error } = await supabase.from('em_requests').insert({
      user_id: userId,
      request_type: payload.type,
      product_id: payload.productId || null,
      amount: payload.amount || null,
      message: payload.message
    }).select().single();
    fail(error);
    return data;
  },
  async getAdminClients() {
    const { data: profiles, error } = await supabase.from('em_profiles').select('*').eq('role', 'client').order('full_name');
    fail(error);
    const clients = [];
    for (const profile of profiles || []) {
      const portfolios = await loadPortfolioRows(profile.user_id);
      clients.push({
        id: profile.user_id,
        fullName: profile.full_name,
        clientCode: profile.client_code,
        riskProfile: profile.risk_profile,
        totalMarketValue: portfolios.reduce((s, p) => s + p.totalMarketValue, 0),
        totalGainLoss: portfolios.reduce((s, p) => s + p.totalGainLoss, 0),
        hasUnpricedHoldings: portfolios.some((p) => p.hasUnpricedHoldings)
      });
    }
    return { clients };
  },
  async getAdminRequests() {
    const [{ data: requests, error }, { data: profiles, error: profileError }] = await Promise.all([
      supabase.from('em_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('em_profiles').select('user_id,full_name,client_code')
    ]);
    fail(error);
    fail(profileError);
    const map = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
    return { requests: (requests || []).map((r) => ({ ...r, full_name: map[r.user_id]?.full_name, client_code: map[r.user_id]?.client_code })) };
  },
  async updateAdminRequest(id, payload) {
    const { data, error } = await supabase.from('em_requests').update({
      status: payload.status,
      admin_note: payload.adminNote || '',
      updated_at: new Date().toISOString()
    }).eq('id', id).select().single();
    fail(error);
    return data;
  },
  async getTwoFactorStatus() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    fail(error);
    return { enabled: Boolean(data.totp?.some((f) => f.status === 'verified')) };
  },
  async setupTwoFactor() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'EmCoin Portal' });
    fail(error);
    pendingEnrollmentFactorId = data.id;
    return { factorId: data.id, qrDataUrl: data.totp.qr_code, secret: data.totp.secret };
  },
  async verifyTwoFactor(token) {
    if (!pendingEnrollmentFactorId) throw new Error('Start 2FA setup first');
    const factorId = pendingEnrollmentFactorId;
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    fail(challengeError);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: token });
    fail(error);
    pendingEnrollmentFactorId = null;
    await supabase.auth.refreshSession();
    return { enabled: true };
  },
  async disableTwoFactor(password, token) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    fail(userError);
    const email = userData.user?.email;
    if (!email) throw new Error('Unable to verify account');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    fail(authError);
    const factor = await verifiedTotpFactor();
    if (!factor) return { enabled: false };
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    fail(challengeError);
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: token });
    fail(verifyError);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    fail(error);
    await supabase.auth.refreshSession();
    return { enabled: false };
  },
  async downloadStatement(id, title) {
    const userId = await currentUserId();
    const { data, error } = await supabase.from('em_statements').select('*').eq('id', id).eq('user_id', userId).single();
    fail(error);
    const profile = await profileFor(userId);
    const portfolios = await loadPortfolioRows(userId);
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text('EmCoin Investment Statement', 20, 24);
    pdf.setFontSize(11);
    pdf.text(`Client: ${profile.fullName}`, 20, 38);
    pdf.text(`Client code: ${profile.clientCode}`, 20, 46);
    pdf.text(`Statement: ${data.title}`, 20, 54);
    pdf.text(`Date: ${data.statement_date}`, 20, 62);
    pdf.text(`Portfolio value: AED ${(portfolios[0]?.totalMarketValue || 0).toLocaleString('en-AE', { maximumFractionDigits: 2 })}`, 20, 76);
    pdf.text(data.summary || '', 20, 90, { maxWidth: 170 });
    pdf.save(`${title || 'statement'}.pdf`);
  }
};
